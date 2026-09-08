import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  galactocentricAzimuthDegrees,
  galactocentricRadiusParsec,
  planarRadiusParsec,
  projectRelativePositionToSky,
  updateFromPlanarPoint,
  updateRadiusPreservingAzimuth,
} from "../lib/physics/coordinates.ts";
import {
  DustIntegrationConvergenceError,
  integrateDustExtinction,
} from "../lib/physics/dust.ts";
import {
  GRAVITATIONAL_CONSTANT_PARSECS_CUBED_PER_SOLAR_MASS_MILLION_YEARS_SQUARED,
  jacobiIntegral,
  patternSpeedRadiansPerMillionYears,
  pointMassPotential,
  relativeInvariantDrift,
  rigidlyRotatingPotential,
} from "../lib/physics/dynamics.ts";
import {
  apparentMagnitude,
  fluxRatioFromMagnitudeDifference,
  receivedFluxWattsPerSquareMetre,
} from "../lib/physics/photometry.ts";
import {
  PhysicsDataUnavailableError,
  requireProviderValue,
} from "../lib/physics/providers.ts";
import {
  evaluateArtifactCapability,
  mayUnlockRenderer,
} from "../lib/science/contracts.ts";
import {
  createProbeObserver,
  DynamicObserverRequiredError,
  requireDynamicObserver,
} from "../lib/physics/observer.ts";
import { numericalBenchmarkEmitters } from "../lib/rendering/benchmark-catalog.ts";
import { projectNumericalBenchmark } from "../lib/rendering/benchmark-renderer.ts";
import { createCameraBasis, projectDirectionPerspective } from "../lib/rendering/projection.ts";
import {
  ProductionRendererLockedError,
  requireProductionRendererUnlocked,
} from "../lib/rendering/production-gate.ts";
import { benchmarkLinearRgbFromTemperature } from "../lib/rendering/spectrum.ts";
import { parseObservedBrightStarCatalog } from "../lib/rendering/observed-star-catalog.ts";
import { parseGaiaBrightStarCatalog } from "../lib/rendering/gaia-bright-star-catalog.ts";
import { projectGroundTexturePixels } from "../lib/rendering/terrain-projection.ts";
import { modelPopulationEmitters } from "../lib/rendering/model-star-catalog.ts";
import {
  circularVelocityAtPosition,
  integratePhaseSpaceLeapfrog,
  pointSourcePositionAtTime,
} from "../lib/physics/kinematics.ts";
import {
  allExtragalacticSources,
  cataloguedExtragalacticSources,
  projectExtragalacticSources,
  statisticalBackgroundGalaxies,
} from "../lib/rendering/extragalactic-catalog.ts";
import {
  deepSkyImageSources,
  projectDeepSkyImageSources,
} from "../lib/rendering/deep-sky-image-catalog.ts";
import {
  atmosphericExtinctionMagnitude,
  daylightVisibilityPenaltyMagnitude,
  relativeAirMass,
} from "../lib/rendering/planet-atmosphere.ts";
import {
  integrateGalaxyRadiance,
  integrateVisualExtinctionMagnitude,
  renderGalaxyAllSkyRadiancePixels,
  sampleGalacticStellarAndDustField,
} from "../lib/rendering/galaxy-radiance.ts";
import {
  assertRadianceBudgetConserved,
  integrateUnresolvedSpectralRadiance,
} from "../lib/rendering/unresolved-radiance.ts";
import { expectedCameraSignal } from "../lib/observation/camera.ts";
import {
  LIGHT_SPEED_PARSECS_PER_YEAR,
  solveRetardedEmissionTimeYears,
} from "../lib/observation/light-cone.ts";

const nearlyEqual = (actual, expected, tolerance = 1e-10) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test("changing radius preserves galactocentric azimuth without quantisation", () => {
  const start = { x: 3_000, y: 4_000, z: 0 };
  const targetRadius = 1_234.56789;
  const next = updateRadiusPreservingAzimuth(start, targetRadius);

  nearlyEqual(planarRadiusParsec(next), targetRadius, 1e-9);
  nearlyEqual(
    galactocentricAzimuthDegrees(next),
    galactocentricAzimuthDegrees(start),
    1e-12,
  );
});

test("changing radius off the plane preserves the full centre-observer ray", () => {
  const start = { x: 2_000, y: -3_000, z: 4_000 };
  const targetRadius = 8_765.4321;
  const next = updateRadiusPreservingAzimuth(start, targetRadius);
  const scale = targetRadius / galactocentricRadiusParsec(start);

  nearlyEqual(galactocentricRadiusParsec(next), targetRadius, 1e-9);
  nearlyEqual(next.x, start.x * scale, 1e-9);
  nearlyEqual(next.y, start.y * scale, 1e-9);
  nearlyEqual(next.z, start.z * scale, 1e-9);
});

test("planar dragging computes radius from coordinates and clamps only at physical bounds", () => {
  const interior = updateFromPlanarPoint(1_111.25, -2_222.5, 100, 20_000);
  nearlyEqual(interior.radiusParsec, Math.hypot(1_111.25, -2_222.5), 1e-10);
  assert.equal(interior.wasClamped, false);

  const centre = updateFromPlanarPoint(0, 0, 100, 20_000, 37.5);
  nearlyEqual(centre.radiusParsec, 100);
  nearlyEqual(centre.galactocentricAzimuthDegrees, 37.5);
  assert.equal(centre.wasClamped, true);
});

test("relative sky projection returns true distance and a unit direction", () => {
  const projected = projectRelativePositionToSky({ x: 3, y: 4, z: 12 });
  nearlyEqual(projected.distanceParsec, 13);
  nearlyEqual(
    Math.hypot(
      projected.unitDirection.x,
      projected.unitDirection.y,
      projected.unitDirection.z,
    ),
    1,
  );
});

test("perspective projection sends the camera axis to the canvas centre and rejects the rear hemisphere", () => {
  const camera = {
    azimuthDegrees: 0,
    elevationDegrees: 0,
    horizontalFieldOfViewDegrees: 90,
  };
  const basis = createCameraBasis(camera);
  assert.deepEqual(basis.forward, { x: 1, y: 0, z: 0 });
  const centre = projectDirectionPerspective({ x: 1, y: 0, z: 0 }, camera, 800, 400);
  assert.equal(centre.visible, true);
  nearlyEqual(centre.canvasX, 400);
  nearlyEqual(centre.canvasY, 200);
  assert.equal(
    projectDirectionPerspective({ x: -1, y: 0, z: 0 }, camera, 800, 400).visible,
    false,
  );
});

test("moving the observer changes benchmark distance and apparent magnitude by the distance modulus", () => {
  const camera = {
    azimuthDegrees: 0,
    elevationDegrees: 0,
    horizontalFieldOfViewDegrees: 90,
  };
  const emitter = [numericalBenchmarkEmitters[0]];
  const atAnchor = projectNumericalBenchmark(
    emitter,
    { x: -8_277, y: 0, z: 0 },
    camera,
    800,
    400,
  )[0];
  const movedTenParsec = projectNumericalBenchmark(
    emitter,
    { x: -8_267, y: 0, z: 0 },
    camera,
    800,
    400,
  )[0];
  nearlyEqual(atAnchor.distanceParsec, 40);
  nearlyEqual(movedTenParsec.distanceParsec, 30);
  nearlyEqual(
    atAnchor.apparentVisualMagnitude - movedTenParsec.apparentVisualMagnitude,
    5 * Math.log10(40 / 30),
  );
  const movedSideways = projectNumericalBenchmark(
    emitter,
    { x: -8_277, y: 10, z: 0 },
    camera,
    800,
    400,
  )[0];
  assert.notEqual(movedSideways.canvasX, atAnchor.canvasX);
});

test("the dense benchmark field is deterministic, unique and visibly populated at its reference anchor", () => {
  assert.equal(numericalBenchmarkEmitters.length, 8_204);
  assert.equal(
    new Set(numericalBenchmarkEmitters.map((emitter) => emitter.id)).size,
    numericalBenchmarkEmitters.length,
  );
  for (const emitter of numericalBenchmarkEmitters) {
    assert.ok(Number.isFinite(emitter.positionParsec.x));
    assert.ok(Number.isFinite(emitter.positionParsec.y));
    assert.ok(Number.isFinite(emitter.positionParsec.z));
    assert.ok(Number.isFinite(emitter.absoluteVisualMagnitude));
    assert.ok(emitter.effectiveTemperatureKelvin >= 2_000);
  }
  const visible = projectNumericalBenchmark(
    numericalBenchmarkEmitters,
    { x: -8_277, y: 0, z: 0 },
    {
      azimuthDegrees: 0,
      elevationDegrees: 0,
      horizontalFieldOfViewDegrees: 82,
    },
    1_600,
    900,
  ).filter((source) => source.apparentVisualMagnitude <= 13.5);
  assert.ok(visible.length >= 400);
});

test("benchmark emitter colours are derived deterministically from effective temperature", () => {
  const cool = benchmarkLinearRgbFromTemperature(3_000);
  const hot = benchmarkLinearRgbFromTemperature(20_000);
  assert.ok(cool[0] > cool[2]);
  assert.ok(hot[2] > hot[0]);
  assert.deepEqual(
    benchmarkLinearRgbFromTemperature(5_800),
    benchmarkLinearRgbFromTemperature(5_800),
  );
});

test("the bundled observed bright-star catalogue reconstructs the solar-anchor sky", async () => {
  const catalogueText = await readFile(
    new URL("../public/data/yale-bright-stars.csv", import.meta.url),
    "utf8",
  );
  const observedStars = parseObservedBrightStarCatalog(catalogueText);
  assert.equal(observedStars.length, 7_369);
  assert.equal(new Set(observedStars.map((star) => star.id)).size, observedStars.length);
  const sirius = observedStars.find((star) => star.displayName === "Sirius");
  assert.ok(sirius);
  const distanceParsec = Math.hypot(
    sirius.positionParsec.x + 8_277,
    sirius.positionParsec.y,
    sirius.positionParsec.z,
  );
  nearlyEqual(distanceParsec, 2.64, 1e-9);
  nearlyEqual(apparentMagnitude(sirius.absoluteVisualMagnitude, distanceParsec, 0), -1.46, 1e-10);
});

test("the bundled Gaia sample contains finite three-dimensional positions and velocities", async () => {
  const binary = await readFile(
    new URL("../public/data/gaia-dr3-bright-6d.bin", import.meta.url),
  );
  const arrayBuffer = binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength,
  );
  const stars = parseGaiaBrightStarCatalog(arrayBuffer);
  assert.equal(stars.length, 69_421);
  for (const star of stars.slice(0, 256)) {
    assert.ok(Number.isFinite(star.positionParsec.x));
    assert.ok(Number.isFinite(star.positionParsec.y));
    assert.ok(Number.isFinite(star.positionParsec.z));
    assert.ok(Number.isFinite(star.velocityKilometresPerSecond.x));
    assert.ok(Number.isFinite(star.velocityKilometresPerSecond.y));
    assert.ok(Number.isFinite(star.velocityKilometresPerSecond.z));
  }
});

test("moving through three-dimensional space changes nearby star directions far more than a distant galaxy", async () => {
  const catalogueText = await readFile(
    new URL("../public/data/yale-bright-stars.csv", import.meta.url),
    "utf8",
  );
  const nearbyStar = parseObservedBrightStarCatalog(catalogueText)
    .reduce((nearest, star) => {
      const starDistance = Math.hypot(
        star.positionParsec.x + 8_277,
        star.positionParsec.y,
        star.positionParsec.z,
      );
      const nearestDistance = Math.hypot(
        nearest.positionParsec.x + 8_277,
        nearest.positionParsec.y,
        nearest.positionParsec.z,
      );
      return starDistance < nearestDistance ? star : nearest;
    });
  const centaurusA = cataloguedExtragalacticSources.find(
    (source) => source.id === "centaurus-a",
  );
  assert.ok(centaurusA);
  const solarObserver = { x: -8_277, y: 0, z: 0 };
  const inwardObserver = { x: -5_054, y: 0, z: 0 };
  const directionFromObserver = (position, observer) =>
    projectRelativePositionToSky({
      x: position.x - observer.x,
      y: position.y - observer.y,
      z: position.z - observer.z,
    }).unitDirection;
  const angularSeparationDegrees = (first, second) =>
    Math.acos(Math.min(1, Math.max(-1,
      first.x * second.x + first.y * second.y + first.z * second.z,
    ))) * 180 / Math.PI;
  const nearbyShift = angularSeparationDegrees(
    directionFromObserver(nearbyStar.positionParsec, solarObserver),
    directionFromObserver(nearbyStar.positionParsec, inwardObserver),
  );
  const distantShift = angularSeparationDegrees(
    directionFromObserver(centaurusA.positionParsec, solarObserver),
    directionFromObserver(centaurusA.positionParsec, inwardObserver),
  );
  assert.ok(nearbyShift > 10);
  assert.ok(distantShift < 0.1);
  assert.ok(nearbyShift > distantShift * 100);
});

test("daylight visibility follows local star altitude and vanishes without an atmosphere", () => {
  assert.equal(daylightVisibilityPenaltyMagnitude(-18, "earth-clear"), 0);
  assert.ok(daylightVisibilityPenaltyMagnitude(0, "earth-clear") > 5);
  assert.ok(
    daylightVisibilityPenaltyMagnitude(30, "earth-clear") >
      daylightVisibilityPenaltyMagnitude(0, "earth-clear"),
  );
  assert.equal(daylightVisibilityPenaltyMagnitude(30, "space"), 0);
});

test("the local ground is a perspective plane that responds to camera yaw", () => {
  const texture = {
    width: 4,
    height: 4,
    pixels: new Uint8ClampedArray(
      Array.from({ length: 16 }, (_, index) => [
        index * 11,
        255 - index * 9,
        index * 5,
        255,
      ]).flat(),
    ),
  };
  const first = projectGroundTexturePixels(
    texture,
    { azimuthDegrees: 0, elevationDegrees: 10, horizontalFieldOfViewDegrees: 82 },
    120,
    70,
    0,
  );
  const rotated = projectGroundTexturePixels(
    texture,
    { azimuthDegrees: 37, elevationDegrees: 10, horizontalFieldOfViewDegrees: 82 },
    120,
    70,
    0,
  );
  const topRowAlpha = Array.from({ length: 120 }, (_, x) => first[x * 4 + 3]);
  const lowerHalfAlpha = Array.from(
    { length: 120 * 35 },
    (_, index) => first[((35 * 120) + index) * 4 + 3],
  );
  assert.ok(topRowAlpha.every((alpha) => alpha === 0));
  assert.ok(lowerHalfAlpha.some((alpha) => alpha > 0));
  assert.notDeepEqual(first, rotated);
});

test("the galaxy population tracer catalogue is fixed in three-dimensional space", () => {
  assert.equal(modelPopulationEmitters.length, 184_320);
  assert.equal(
    new Set(modelPopulationEmitters.map((star) => star.id)).size,
    modelPopulationEmitters.length,
  );
  for (const star of modelPopulationEmitters) {
    assert.equal(star.role, "model-population-tracer");
    assert.ok(Number.isFinite(star.positionParsec.x));
    assert.ok(Number.isFinite(star.positionParsec.y));
    assert.ok(Number.isFinite(star.positionParsec.z));
    assert.ok(star.velocityKilometresPerSecond);
    assert.ok(Number.isFinite(star.velocityKilometresPerSecond.x));
    assert.ok(Number.isFinite(star.velocityKilometresPerSecond.y));
    assert.ok(Number.isFinite(star.velocityKilometresPerSecond.z));
  }
});

test("stellar phase-space motion and observer leapfrog integration advance physical coordinates", () => {
  const source = modelPopulationEmitters[0];
  const future = pointSourcePositionAtTime(source, 10_000);
  assert.notDeepEqual(future, source.positionParsec);
  const restored = pointSourcePositionAtTime(
    { ...source, positionParsec: future },
    -10_000,
  );
  nearlyEqual(restored.x, source.positionParsec.x, 1e-9);
  nearlyEqual(restored.y, source.positionParsec.y, 1e-9);
  nearlyEqual(restored.z, source.positionParsec.z, 1e-9);

  const startPosition = { x: -8_277, y: 0, z: 0 };
  const advanced = integratePhaseSpaceLeapfrog(
    {
      positionParsec: startPosition,
      velocityKilometresPerSecond: circularVelocityAtPosition(startPosition),
    },
    10_000,
  );
  assert.ok(Math.hypot(advanced.positionParsec.y, advanced.positionParsec.x + 8_277) > 0);
  nearlyEqual(Math.hypot(advanced.positionParsec.x, advanced.positionParsec.y), 8_277, 1e-5);
});

test("catalogued and statistical extragalactic sources retain distance and angular scale", () => {
  assert.equal(cataloguedExtragalacticSources.length, 8);
  assert.equal(statisticalBackgroundGalaxies.length, 2_048);
  assert.equal(allExtragalacticSources.length, 2_056);
  assert.equal(new Set(allExtragalacticSources.map((source) => source.id)).size, 2_056);
  const projected = projectExtragalacticSources(
    cataloguedExtragalacticSources,
    { x: -8_277, y: 0, z: 0 },
    {
      azimuthDegrees: 121.174,
      elevationDegrees: -21.573,
      horizontalFieldOfViewDegrees: 90,
    },
    1_600,
    900,
  );
  const andromeda = projected.find((source) => source.id === "m31");
  assert.ok(andromeda);
  nearlyEqual(andromeda.distanceParsec, 770_000, 1e-6);
  nearlyEqual(andromeda.majorAngularDiameterDegrees, 3.17, 1e-9);
  assert.ok(andromeda.apparentVisualMagnitude >= 3.1);
});

test("deep-sky observation images stay bound to physical sky directions and angular scale", () => {
  assert.equal(deepSkyImageSources.length, 8);
  const projected = projectDeepSkyImageSources(
    deepSkyImageSources,
    { x: -8_277, y: 0, z: 0 },
    {
      azimuthDegrees: 209.0137,
      elevationDegrees: -19.3816,
      horizontalFieldOfViewDegrees: 90,
    },
    1_600,
    900,
  );
  const orion = projected.find((source) => source.id === "m42-image");
  assert.ok(orion);
  nearlyEqual(orion.distanceParsec, 460, 1e-9);
  nearlyEqual(orion.majorAngularDiameterDegrees, 59.95 / 60, 1e-9);
  assert.equal(orion.sourcePage, "https://www.eso.org/public/images/eso1723a/");
});

test("planetary atmosphere increases extinction toward the horizon and near infrared loses less light", () => {
  nearlyEqual(relativeAirMass(90), 1, 0.001);
  assert.ok(relativeAirMass(10) > relativeAirMass(60));
  const visible = atmosphericExtinctionMagnitude(15, "earth-clear", "camera");
  const nearInfrared = atmosphericExtinctionMagnitude(15, "earth-clear", "near-infrared");
  const hazy = atmosphericExtinctionMagnitude(15, "earth-hazy", "camera");
  assert.ok(nearInfrared < visible);
  assert.ok(hazy > visible);
  assert.equal(atmosphericExtinctionMagnitude(-1, "earth-clear", "camera"), Number.POSITIVE_INFINITY);
  assert.equal(atmosphericExtinctionMagnitude(5, "space", "camera"), 0);
});

test("the continuous Galaxy field naturally concentrates light and dust near the disc", () => {
  const inPlane = sampleGalacticStellarAndDustField({ x: -8_277, y: 0, z: 0 });
  const abovePlane = sampleGalacticStellarAndDustField({ x: -8_277, y: 0, z: 3_000 });
  assert.ok(inPlane.thinDiscEmissivity > abovePlane.thinDiscEmissivity);
  assert.ok(inPlane.dustRelativeDensity > abovePlane.dustRelativeDensity);

  const sun = { x: -8_277, y: 0, z: 0 };
  const centreRadiance = integrateGalaxyRadiance(sun, { x: 1, y: 0, z: 0 });
  const poleRadiance = integrateGalaxyRadiance(sun, { x: 0, y: 0, z: 1 });
  assert.ok(centreRadiance.red > poleRadiance.red);
  assert.ok(centreRadiance.visualExtinctionMagnitude > poleRadiance.visualExtinctionMagnitude);

  const planeExtinction = integrateVisualExtinctionMagnitude(
    sun,
    { x: -7_277, y: 0, z: 0 },
  );
  const poleExtinction = integrateVisualExtinctionMagnitude(
    sun,
    { x: -8_277, y: 0, z: 1_000 },
  );
  assert.ok(planeExtinction > poleExtinction);
});

test("camera display calibration keeps the high-latitude sky dark while preserving the Milky Way", () => {
  const width = 72;
  const height = 36;
  const pixels = renderGalaxyAllSkyRadiancePixels(
    { x: -8_277, y: 0, z: 0 },
    "camera",
    width,
    height,
    "observational",
  );
  const sample = (longitudeDegrees, latitudeDegrees) => {
    const x = Math.floor(((longitudeDegrees + 180) / 360) * width);
    const y = Math.min(height - 1, Math.floor(((90 - latitudeDegrees) / 180) * height));
    const offset = (y * width + x) * 4;
    return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
  };
  const luminance = ([red, green, blue]) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const galacticPole = sample(0, 87);
  const innerMilkyWay = sample(0, 0);
  const offPlane = sample(90, 30);
  assert.ok(Math.max(...galacticPole) <= 16);
  assert.ok(luminance(innerMilkyWay) > 35);
  assert.ok(luminance(innerMilkyWay) > 2.5 * luminance(offPlane));
});

test("at ten parsecs with no dust, apparent magnitude equals absolute magnitude", () => {
  nearlyEqual(apparentMagnitude(4.83, 10, 0), 4.83);
});

test("doubling distance quarters flux and increases magnitude by about 1.505", () => {
  const nearFlux = receivedFluxWattsPerSquareMetre(1, 10);
  const farFlux = receivedFluxWattsPerSquareMetre(1, 20);
  nearlyEqual(farFlux / nearFlux, 0.25);

  const magnitudeIncrease = apparentMagnitude(0, 20, 0) - apparentMagnitude(0, 10, 0);
  nearlyEqual(magnitudeIncrease, 5 * Math.log10(2));
  nearlyEqual(fluxRatioFromMagnitudeDifference(magnitudeIncrease), 0.25);
});

test("adaptive dust integration reproduces a constant three-dimensional field", () => {
  const coefficientPerParsec = 0.0025;
  const result = integrateDustExtinction(
    { x: 0, y: 0, z: 0 },
    { x: 3_000, y: 4_000, z: 0 },
    550,
    () => coefficientPerParsec,
  );
  const expectedOpticalDepth = coefficientPerParsec * 5_000;
  nearlyEqual(result.opticalDepth, expectedOpticalDepth, 1e-9);
  nearlyEqual(result.extinctionMagnitude, (2.5 / Math.log(10)) * expectedOpticalDepth, 1e-9);
  assert.ok(result.evaluatedSamples >= 5);
  assert.equal(result.converged, true);
});

test("unresolved radiance is integrated through the same three-dimensional ray and conserves the flux split", () => {
  const radiance = integrateUnresolvedSpectralRadiance(
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
    () => ({
      spectralEmissivityWattsPerSquareMetrePerSteradianPerNanometrePerParsec: 2,
      extinctionCoefficientPerParsec: 0,
    }),
    128,
  );
  nearlyEqual(radiance, 200, 1e-10);
  assert.equal(
    assertRadianceBudgetConserved({
      totalSpectralRadiance: 200,
      resolvedSpectralRadiance: 35,
      unresolvedSpectralRadiance: 165,
    }),
    true,
  );
  assert.throws(() =>
    assertRadianceBudgetConserved({
      totalSpectralRadiance: 200,
      resolvedSpectralRadiance: 35,
      unresolvedSpectralRadiance: 160,
    }),
  );
});

test("a static one-parsec source is observed one light-travel time in the past", () => {
  const observationTimeYears = 100;
  const emissionTime = solveRetardedEmissionTimeYears(
    observationTimeYears,
    { x: 0, y: 0, z: 0 },
    () => ({ x: 1, y: 0, z: 0 }),
  );
  nearlyEqual(
    observationTimeYears - emissionTime,
    1 / LIGHT_SPEED_PARSECS_PER_YEAR,
    1e-8,
  );
});

test("camera response computes expected electrons and noise without injecting random pixels", () => {
  const response = {
    apertureDiameterMetres: 0.2,
    exposureSeconds: 10,
    readNoiseElectronsRms: 3,
    darkCurrentElectronsPerSecond: 0.2,
    saturationElectrons: 1e9,
    pointSpreadFunctionArtifactId: "validated-camera-psf",
  };
  const signal = expectedCameraSignal(
    [
      { wavelengthNanometres: 500, photonFluxPerSquareMetrePerSecondPerNanometre: 100, quantumEfficiency: 0.5 },
      { wavelengthNanometres: 600, photonFluxPerSquareMetrePerSecondPerNanometre: 100, quantumEfficiency: 0.5 },
    ],
    response,
  );
  nearlyEqual(signal.expectedPhotoelectrons, 500 * Math.PI, 1e-10);
  nearlyEqual(signal.noiseVarianceElectronsSquared, signal.expectedPhotoelectrons + 2 + 9, 1e-10);
  assert.equal(signal.saturated, false);
});

test("dust integration fails closed when the error target is not reached", () => {
  assert.throws(
    () =>
      integrateDustExtinction(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        550,
        (position) => 1 + position.x ** 4,
        { relativeTolerance: 1e-15, maximumDepth: 0 },
      ),
    DustIntegrationConvergenceError,
  );
});

test("central black-hole point mass uses a physical inverse-square acceleration", () => {
  const massSolarMasses = 4.297e6;
  const radiusParsec = 100;
  const model = pointMassPotential("sagittarius-a-star", massSolarMasses);
  const evaluation = model.evaluate({ x: radiusParsec, y: 0, z: 0 }, 0);
  const expectedMagnitude =
    (GRAVITATIONAL_CONSTANT_PARSECS_CUBED_PER_SOLAR_MASS_MILLION_YEARS_SQUARED *
      massSolarMasses) /
    radiusParsec ** 2;
  nearlyEqual(evaluation.accelerationParsecPerMillionYearsSquared.x, -expectedMagnitude, 1e-12);
  nearlyEqual(evaluation.accelerationParsecPerMillionYearsSquared.y, 0);
});

test("bar pattern speed conversion keeps units explicit", () => {
  nearlyEqual(patternSpeedRadiansPerMillionYears(1), 0.001022712165045695, 1e-14);
});

test("a Jacobi integral uses the pattern speed bound to its rotating potential", () => {
  const base = pointMassPotential("test-centre", 1e9);
  const rotating = rigidlyRotatingPotential("test-rotating", base, {
    patternSpeedKilometresPerSecondPerKiloparsec: -37.5,
    referenceAngleRadians: 0.2,
    referenceTimeMillionYears: 0,
  });
  assert.equal(
    rotating.patternSpeedRadiansPerMillionYears,
    patternSpeedRadiansPerMillionYears(-37.5),
  );
  const value = jacobiIntegral(
    {
      positionParsec: { x: 1_000, y: 0, z: 0 },
      velocityParsecPerMillionYears: { x: 0, y: -200, z: 0 },
    },
    rotating,
    0,
  );
  assert.ok(Number.isFinite(value));
});

test("invariant drift needs a positive characteristic energy scale", () => {
  nearlyEqual(relativeInvariantDrift(0, 0.5, 10), 0.05);
  assert.throws(() => relativeInvariantDrift(0, 0.5, 0), RangeError);
});

test("missing scientific data fails closed with a typed error", () => {
  assert.throws(
    () =>
      requireProviderValue({
        status: "unavailable",
        provenanceId: "bar-phase-space",
        reason: "The validated particle asset is not connected.",
        requiredArtifact: "portail-phase-space-snapshot",
      }),
    (error) =>
      error instanceof PhysicsDataUnavailableError &&
      error.provenanceId === "bar-phase-space" &&
      error.requiredArtifact === "portail-phase-space-snapshot",
  );
});

test("a provider cannot label an unvalidated artifact as ready", () => {
  assert.throws(
    () =>
      requireProviderValue({
        status: "ready",
        provenanceId: "forged-ready-state",
        capability: {
          state: "loaded-unvalidated",
          artifactId: "unvalidated-artifact",
          validationReceiptIds: [],
          reason: "No receipt",
        },
        value: { unsafe: true },
      }),
    PhysicsDataUnavailableError,
  );
});

test("renderer unlock requires every physical capability to be validated", () => {
  const digest = "a".repeat(64);
  const metadata = {
    artifactId: "test-artifact",
    schemaVersion: "1.0.0",
    source: {
      title: "Test-only artifact",
      url: "https://example.invalid/test",
      version: "1",
      codeCommit: null,
      license: "test-only",
    },
    sha256: digest,
    frame: {
      id: "test-frame",
      origin: "test-origin",
      handedness: "right-handed",
      xAxis: "+x",
      yAxis: "+y",
      zAxis: "+z",
      referenceEpoch: "test-epoch",
    },
    units: { length: "parsec" },
    validity: {
      spatialDomain: "test-only",
      temporalDomain: "test-only",
      extrapolationPolicy: "forbidden",
    },
    uncertaintyVariantId: "test-variant",
    generationReceiptId: "generation-1",
    validationReceiptIds: ["validation-1"],
  };
  const receipt = {
    receiptId: "validation-1",
    artifactId: "test-artifact",
    createdAt: "2026-08-20T00:00:00Z",
    validatorVersion: "1.0.0",
    validatorCodeCommit: "abcdef1",
    inputSha256: digest,
    dependencyArtifacts: [],
    referenceDatasets: [
      { datasetId: "test-reference", version: "1", sha256: "b".repeat(64) },
    ],
    selectionFunctionIds: [],
    withheldValidationData: true,
    metrics: [
      { name: "test-metric", value: 0, unit: "dimensionless", acceptanceRule: "value = 0", passed: true },
    ],
    overallStatus: "passed",
  };
  const validated = evaluateArtifactCapability(
    { metadata, loadedSha256: digest },
    [receipt],
    {
      dependencySha256ByArtifactId: new Map(),
      referenceDatasetSha256ById: new Map([
        ["test-reference", "b".repeat(64)],
      ]),
    },
  );
  assert.equal(validated.state, "validated");

  const rejected = evaluateArtifactCapability(
    { metadata, loadedSha256: digest },
    [{ ...receipt, metrics: [{ ...receipt.metrics[0], passed: false }] }],
    {
      dependencySha256ByArtifactId: new Map(),
      referenceDatasetSha256ById: new Map([
        ["test-reference", "b".repeat(64)],
      ]),
    },
  );
  assert.equal(rejected.state, "rejected");
  assert.equal(
    evaluateArtifactCapability(
      { metadata, loadedSha256: "c".repeat(64) },
      [receipt],
    ).state,
    "rejected",
  );
  assert.equal(
    evaluateArtifactCapability(
      { metadata, loadedSha256: digest },
      [receipt],
      {
        dependencySha256ByArtifactId: new Map(),
        referenceDatasetSha256ById: new Map([
          ["test-reference", "c".repeat(64)],
        ]),
      },
    ).state,
    "rejected",
  );
  assert.equal(evaluateArtifactCapability(null, []).state, "artifact-missing");

  const evaluations = {
    "joint-potential": validated,
    "phase-space": validated,
    "stellar-population": validated,
    "dust-radiative-transfer": validated,
    "unresolved-radiance": validated,
    "light-cone-transform": validated,
    "observer-response": rejected,
  };
  assert.equal(mayUnlockRenderer(evaluations), false);
  evaluations["observer-response"] = validated;
  assert.equal(mayUnlockRenderer(evaluations), true);
});

test("the production renderer fails closed while any scientific artifact is missing", () => {
  assert.throws(
    () => requireProductionRendererUnlocked(),
    (error) =>
      error instanceof ProductionRendererLockedError &&
      error.blockers.length === 7 &&
      /科学制品/.test(error.message),
  );
});

test("a relocated probe observer cannot silently participate in time advancement", () => {
  const probe = createProbeObserver(
    { x: -8_277, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  );
  assert.equal(probe.mode, "probe");
  assert.throws(
    () => requireDynamicObserver(probe),
    DynamicObserverRequiredError,
  );
});

// Regression cases for the scientific and rendering defects corrected here.
const { meanSegmentTransmission } = await import('../lib/rendering/galaxy-radiance.ts');
const { localZenith, localToGalactic, galacticToLocal } = await import('../lib/rendering/local-frame.ts');
const { prepareGalaxyPointSources, projectPreparedGalaxyPointSources } = await import('../lib/rendering/galaxy-star-renderer.ts');
const { projectPlanetTerrainPixels } = await import('../lib/rendering/terrain-projection.ts');

test('uniform emitting dust slab agrees with its analytic solution and subdivision', () => {
  assert.equal(meanSegmentTransmission(0), 1);
  for (const depth of [1e-10, 0.01, 1, 12, 100]) {
    const full = meanSegmentTransmission(depth);
    const split = 0.5 * meanSegmentTransmission(depth / 2) * (1 + Math.exp(-depth / 2));
    assert.ok(Math.abs(full - split) < 1e-9);
    assert.ok(full > 0 && full <= 1);
  }
  assert.throws(() => meanSegmentTransmission(-1), RangeError);
});

test('local planetary frame rotates independently and preserves solar altitude', () => {
  const localDirection = {x:Math.cos(Math.PI/6),y:0,z:0.5};
  for (const inclination of [-75,0,22,75]) {
    const galacticDirection = localToGalactic(localDirection,inclination);
    const roundTrip = galacticToLocal(galacticDirection,inclination);
    for (const axis of ['x','y','z']) assert.ok(Math.abs(roundTrip[axis]-localDirection[axis]) < 1e-12);
    const zenith = localZenith(inclination);
    const dot = zenith.x*galacticDirection.x + zenith.y*galacticDirection.y + zenith.z*galacticDirection.z;
    assert.ok(Math.abs(Math.asin(dot)*180/Math.PI-30)<1e-10);
  }
});

test('cached stellar photometry never freezes live parallax or short time changes', () => {
  const emitter={id:'continuous-motion-test',role:'deterministic-benchmark-emitter',positionParsec:{x:10,y:0,z:0},velocityKilometresPerSecond:{x:0,y:100,z:0},absoluteVisualMagnitude:1,effectiveTemperatureKelvin:6000};
  const prepared=prepareGalaxyPointSources([emitter],{x:0,y:0,z:0},20,0);
  const camera={azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:82};
  const initial=projectPreparedGalaxyPointSources(prepared,camera,1000,600,{x:0,y:0,z:0},0)[0];
  const moved=projectPreparedGalaxyPointSources(prepared,camera,1000,600,{x:0,y:0.01,z:0},0)[0];
  const later=projectPreparedGalaxyPointSources(prepared,camera,1000,600,{x:0,y:0,z:0},1)[0];
  assert.ok(moved.canvasX < initial.canvasX);
  assert.ok(later.canvasX > initial.canvasX);
  assert.ok(Math.abs(moved.distanceParsec-Math.hypot(10,0.01))<1e-12);
});

test('far high-latitude dust rays resolve nearby extinction instead of skipping it', () => {
  const observer={x:-8277,y:0,z:0};
  const target={x:-8277,y:0,z:30000};
  const coarse=integrateVisualExtinctionMagnitude(observer,target,32);
  const reference=integrateVisualExtinctionMagnitude(observer,target,512);
  assert.ok(reference > 0.01);
  assert.ok(Math.abs(coarse-reference)/reference < 0.08);
});

test('panorama foreground stays transparent above the horizon and opaque below it', () => {
  const transparent={pixels:new Uint8ClampedArray(8*4*4),width:8,height:4};
  const ground={pixels:new Uint8ClampedArray(8*8*4).fill(128),width:8,height:8};
  for (const [elevation,expectedAlpha] of [[80,0],[-80,255]]) {
    const pixels=projectPlanetTerrainPixels(transparent,ground,{azimuthDegrees:20,elevationDegrees:elevation,horizontalFieldOfViewDegrees:25},16,10,22,0);
    for (let offset=3;offset<pixels.length;offset+=4) assert.equal(pixels[offset],expectedAlpha);
  }
});

test('planet-level camera projects different horizon bearings to the same horizon line', () => {
  const camera={azimuthDegrees:18,elevationDegrees:-4,horizontalFieldOfViewDegrees:82,upDirection:localZenith(22)};
  const projections=[-10,10,30].map(angle => projectDirectionPerspective(
    localToGalactic({x:Math.cos(angle*Math.PI/180),y:Math.sin(angle*Math.PI/180),z:0},22),camera,1000,700));
  assert.ok(projections.every(projection => Number.isFinite(projection.canvasY)));
  assert.ok(Math.max(...projections.map(p=>p.canvasY))-Math.min(...projections.map(p=>p.canvasY)) < 1e-8);
});

const { resolveQuickView } = await import('../lib/rendering/quick-view.ts');
test('galaxy shortcuts preserve the target and remove a blocking planetary horizon', () => {
  const zenith=localZenith(22);
  const camera={azimuthDegrees:15,elevationDegrees:-40,horizontalFieldOfViewDegrees:132};
  for(const position of [{x:-8277,y:0,z:0},{x:-166,y:1.5,z:0},{x:500,y:800,z:300},{x:8277,y:0,z:0}]){
    for(const sign of [-1,1]){
      const target={x:position.x*sign,y:position.y*sign,z:position.z*sign};
      const resolved=resolveQuickView(target,camera,zenith,true);
      const forward=createCameraBasis(resolved.camera).forward;
      const dot=(forward.x*target.x+forward.y*target.y+forward.z*target.z)/Math.hypot(target.x,target.y,target.z);
      assert.ok(dot>1-1e-10,'a shortcut must point at its stated target');
      assert.ok(resolved.switchToSpace || resolved.altitudeDegrees>=8,'it must not leave a blocked target behind the ground');
      assert.equal(resolved.camera.horizontalFieldOfViewDegrees,82);
    }
  }
});

test('looking at either Galactic pole also handles a blocked direction', () => {
  const camera={azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:82};
  const above=resolveQuickView({x:0,y:0,z:1},camera,localZenith(22),true);
  const below=resolveQuickView({x:0,y:0,z:-1},camera,localZenith(22),true);
  assert.equal(above.switchToSpace,false);
  assert.equal(below.switchToSpace,true);
  assert.equal(below.camera.elevationDegrees,-90);
});


test('live reprojection retains signed reference-extinction corrections', async()=>{
  const {prepareGalaxyPointSources,projectPreparedGalaxyPointSources}=await import('../lib/rendering/galaxy-star-renderer.ts');
  const emitter={id:'reference-extinction-probe',role:'observed-bright-star',positionParsec:{x:-5000,y:0,z:0},absoluteVisualMagnitude:0,effectiveTemperatureKelvin:5800};
  const observer={x:-5010,y:0,z:0};
  const prepared=prepareGalaxyPointSources([emitter],observer);
  assert.equal(prepared.length,1);
  assert.ok(prepared[0].extinctionMagnitude<0,'moving closer removes some reference dust');
  const camera={azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:82};
  const cached=projectPreparedGalaxyPointSources(prepared,camera,800,600);
  const live=projectPreparedGalaxyPointSources(prepared,camera,800,600,observer,0);
  assert.equal(live.length,1);
  nearlyEqual(live[0].apparentVisualMagnitude,cached[0].apparentVisualMagnitude,1e-10);
  assert.throws(()=>apparentMagnitude(0,10,-1),/non-negative/);
});
