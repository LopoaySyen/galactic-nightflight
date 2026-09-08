import { lensedBackgroundDirection, type LensView } from '../physics/gravitational-lensing.ts';
import type { Vector3 } from "../physics/vector.ts";
import type { ObservationMode, ViewCamera } from "./contracts.ts";
import { createCameraBasis } from "./projection.ts";

const SOLAR_RADIUS_PARSEC = 8_277;
export const BAR_ANGLE_RADIANS = (27 * Math.PI) / 180;
const VISUAL_EXTINCTION_PER_PARSEC_AT_SOLAR_MIDPLANE = 0.00072;
const RAY_LENGTH_PARSEC = 32_000;
const RADIANCE_SEGMENTS = 96;

export type GalaxyColourGrade = "observational" | "immersive";

export interface GalacticFieldSample {
  thinDiscEmissivity: number;
  thickDiscEmissivity: number;
  barBulgeEmissivity: number;
  nuclearEmissivity: number;
  dustRelativeDensity: number;
}

export interface GalaxyRadianceResult {
  red: number;
  green: number;
  blue: number;
  visualExtinctionMagnitude: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function spiralArmField(radiusParsec: number, azimuthRadians: number): number {
  if (radiusParsec < 2400 || radiusParsec > 17000) return 0;
  const basePhase = 0.28 + Math.log(radiusParsec / SOLAR_RADIUS_PARSEC) / Math.tan(12.5 * Math.PI / 180);
  let response = 0;
  for (let arm = 0; arm < 4; arm++) {
    const angle = azimuthRadians - basePhase - arm * Math.PI / 2;
    const wrapped = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
    response += Math.exp(-0.5 * (wrapped / 0.105) ** 2);
  }
  return clamp(response, 0, 1.35);
}

/** Smooth, bounded, fixed 3-D density fluctuations. These are a phenomenological
 * cloud model, not measured cloud identities or a fitted dust posterior. */
function cloudDensityVariation(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const hash = (a: number, b: number, c: number) => {
    let value = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295 * 2 - 1;
  };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(
    mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx), mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),
    mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx), mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
}

export function sampleGalacticStellarAndDustField(
  positionParsec: Vector3,
): GalacticFieldSample {
  const radiusParsec = Math.hypot(positionParsec.x, positionParsec.y);
  const absoluteZParsec = Math.abs(positionParsec.z);
  const azimuthRadians = Math.atan2(positionParsec.y, positionParsec.x);
  const centralHole = 1 - Math.exp(-((radiusParsec / 1_650) ** 2));
  const spiralArms = spiralArmField(radiusParsec, azimuthRadians);

  const thinDiscEmissivity =
    centralHole *
    Math.exp((SOLAR_RADIUS_PARSEC - radiusParsec) / 2_600) *
    Math.exp(-absoluteZParsec / 300) *
    (0.76 + 0.42 * spiralArms);
  const thickDiscEmissivity =
    0.085 *
    Math.exp((SOLAR_RADIUS_PARSEC - radiusParsec) / 3_600) *
    Math.exp(-absoluteZParsec / 900);

  const cosineBar = Math.cos(BAR_ANGLE_RADIANS);
  const sineBar = Math.sin(BAR_ANGLE_RADIANS);
  const xBar = positionParsec.x * cosineBar + positionParsec.y * sineBar;
  const yBar = -positionParsec.x * sineBar + positionParsec.y * cosineBar;
  const boxyRadius =
    ((Math.abs(xBar) / 2_450) ** 4 +
      (Math.abs(yBar) / 760) ** 4 +
      (absoluteZParsec / 520) ** 4) **
    0.25;
  const barTaper = 1 / (1 + Math.exp((Math.abs(xBar) - 5_100) / 260));
  const barBulgeEmissivity = 6.8 * Math.exp(-boxyRadius) * barTaper;

  const nuclearDisc =
    54 * Math.exp(-radiusParsec / 210) * Math.exp(-absoluteZParsec / 43);
  const sphericalRadiusParsec = Math.hypot(radiusParsec, positionParsec.z);
  const nuclearCluster =
    1_100 / (1 + (sphericalRadiusParsec / 7.5) ** 2) ** 1.35;
  const nuclearEmissivity = nuclearDisc + nuclearCluster;

  const dustRelativeDensity = sampleGalacticDustDensity(positionParsec, radiusParsec, azimuthRadians, centralHole, spiralArms);

  return {
    thinDiscEmissivity,
    thickDiscEmissivity,
    barBulgeEmissivity,
    nuclearEmissivity,
    dustRelativeDensity,
  };
}

/** Dust-only rays must not evaluate the unrelated stellar emissivity model. */
export function sampleGalacticDustDensity(positionParsec: Vector3,
  radiusParsec = Math.hypot(positionParsec.x, positionParsec.y),
  azimuthRadians = Math.atan2(positionParsec.y, positionParsec.x),
  centralHole = 1 - Math.exp(-((radiusParsec / 1650) ** 2)),
  spiralArms = spiralArmField(radiusParsec, azimuthRadians),
): number {
  const absoluteZParsec = Math.abs(positionParsec.z);
  const dustMidplaneParsec =
    31 * Math.sin(2 * azimuthRadians + radiusParsec / 1_650) +
    17 * Math.sin(5 * azimuthRadians - radiusParsec / 820);
  const dustVerticalDensity = Math.exp(
    -Math.abs(positionParsec.z - dustMidplaneParsec) / 105,
  );
  const dustRadialDensity =
    centralHole * Math.exp((SOLAR_RADIUS_PARSEC - radiusParsec) / 3_500);
  const dustLaneStructure =
    0.56 +
    0.72 * spiralArms +
    0.24 *
      (0.5 +
        0.5 * Math.cos(7 * azimuthRadians - radiusParsec / 610)) **
      5;
  // Small-scale structure stays fixed in Galactic space as the observer moves.
  // Fade out the added detail away from the dusty layer, keeping the original
  // large-scale disc envelope and avoiding invented high-latitude nebulae.
  const cloudStructure = absoluteZParsec < 650
    ? clamp(1 + 1.1 * cloudDensityVariation(positionParsec.x / 220, positionParsec.y / 220, positionParsec.z / 85)
      + 0.55 * cloudDensityVariation(positionParsec.x / 73 + 13, positionParsec.y / 73 - 7, positionParsec.z / 39), 0.12, 2.5)
    : 1;
  return clamp(
    dustRadialDensity * dustVerticalDensity * dustLaneStructure * cloudStructure,
    0,
    28,
  );

}

export function integrateVisualExtinctionMagnitude(
  observerPositionParsec: Vector3,
  targetPositionParsec: Vector3,
  segments = 18,
): number {
  const ray = {
    x: targetPositionParsec.x - observerPositionParsec.x,
    y: targetPositionParsec.y - observerPositionParsec.y,
    z: targetPositionParsec.z - observerPositionParsec.z,
  };
  const distanceParsec = Math.hypot(ray.x, ray.y, ray.z);
  if (!(distanceParsec > 0)) return 0;
  const boundedSegments = Math.max(distanceParsec > 2000 ? 32 : 12, Math.ceil(Math.sqrt(Math.min(distanceParsec,60_000) / 5)), Math.floor(segments));
  const integrationLengthParsec = Math.min(distanceParsec, 60_000);
  let previousDistanceParsec = 0;
  const unitDirection = {
    x: ray.x / distanceParsec,
    y: ray.y / distanceParsec,
    z: ray.z / distanceParsec,
  };
  let extinctionMagnitude = 0;
  for (let index = 0; index < boundedSegments; index += 1) {
    const distanceEndParsec = integrationLengthParsec * ((index + 1) / boundedSegments) ** 2;
    const stepParsec = distanceEndParsec - previousDistanceParsec;
    const distanceAlongRayParsec = previousDistanceParsec + stepParsec / 2;
    previousDistanceParsec = distanceEndParsec;
    const position = {
      x: observerPositionParsec.x + unitDirection.x * distanceAlongRayParsec,
      y: observerPositionParsec.y + unitDirection.y * distanceAlongRayParsec,
      z: observerPositionParsec.z + unitDirection.z * distanceAlongRayParsec,
    };
    extinctionMagnitude +=
      sampleGalacticDustDensity(position) *
      VISUAL_EXTINCTION_PER_PARSEC_AT_SOLAR_MIDPLANE *
      stepParsec;
  }
  return clamp(extinctionMagnitude, 0, 35);
}

/** Mean transmission within a uniformly emitting and absorbing segment.
 * Uses expm1 to retain accuracy when optical depth is close to zero. */
export function meanSegmentTransmission(opticalDepth: number): number {
  if (!Number.isFinite(opticalDepth) || opticalDepth < 0) throw new RangeError("Optical depth must be finite and nonnegative.");
  return opticalDepth < 1e-8 ? 1 - opticalDepth / 2 : -Math.expm1(-opticalDepth) / opticalDepth;
}

export function integrateGalaxyRadiance(
  observerPositionParsec: Vector3,
  unitDirection: Vector3,
  observationMode: ObservationMode = "dark-adapted",
): GalaxyRadianceResult {
  let previousDistanceParsec = 0;
  let opticalDepthRed = 0;
  let opticalDepthGreen = 0;
  let opticalDepthBlue = 0;
  let radianceRed = 0;
  let radianceGreen = 0;
  let radianceBlue = 0;

  for (let index = 0; index < RADIANCE_SEGMENTS; index += 1) {
    const normalizedEnd = (index + 1) / RADIANCE_SEGMENTS;
    const distanceEndParsec = RAY_LENGTH_PARSEC * normalizedEnd ** 1.52;
    const stepParsec = distanceEndParsec - previousDistanceParsec;
    const distanceMidpointParsec = previousDistanceParsec + stepParsec / 2;
    previousDistanceParsec = distanceEndParsec;
    const position = {
      x: observerPositionParsec.x + unitDirection.x * distanceMidpointParsec,
      y: observerPositionParsec.y + unitDirection.y * distanceMidpointParsec,
      z: observerPositionParsec.z + unitDirection.z * distanceMidpointParsec,
    };
    if (Math.hypot(position.x, position.y) > 24_000 || Math.abs(position.z) > 8_000) {
      continue;
    }
    const field = sampleGalacticStellarAndDustField(position);
    const warmEmission = field.barBulgeEmissivity + field.nuclearEmissivity;
    // Young thin-disc light is bluer, the thick disc is warmer and the old
    // bar/bulge population is ivory rather than a uniform brown wash.
    const emissionRed =
      field.thinDiscEmissivity * 0.82 +
      field.thickDiscEmissivity * 1.12 +
      warmEmission * 1.14;
    const emissionGreen =
      field.thinDiscEmissivity * 0.98 +
      field.thickDiscEmissivity * 0.96 +
      warmEmission * 0.98;
    const emissionBlue =
      field.thinDiscEmissivity * 1.2 +
      field.thickDiscEmissivity * 0.72 +
      warmEmission * 0.76;
    const visualOpticalDepthStep = field.dustRelativeDensity *
      VISUAL_EXTINCTION_PER_PARSEC_AT_SOLAR_MIDPLANE * stepParsec / 1.085736;
    const redStep = visualOpticalDepthStep * (observationMode === "near-infrared" ? 0.16 : 0.76);
    const greenStep = visualOpticalDepthStep * (observationMode === "near-infrared" ? 0.26 : 1);
    const blueStep = visualOpticalDepthStep * (observationMode === "near-infrared" ? 0.43 : 1.32);
    radianceRed += emissionRed * Math.exp(-opticalDepthRed) * stepParsec * meanSegmentTransmission(redStep);
    radianceGreen += emissionGreen * Math.exp(-opticalDepthGreen) * stepParsec * meanSegmentTransmission(greenStep);
    radianceBlue += emissionBlue * Math.exp(-opticalDepthBlue) * stepParsec * meanSegmentTransmission(blueStep);
    opticalDepthRed += redStep;
    opticalDepthGreen += greenStep;
    opticalDepthBlue += blueStep;
  }

  return {
    red: radianceRed,
    green: radianceGreen,
    blue: radianceBlue,
    visualExtinctionMagnitude: opticalDepthGreen * 1.085736 / (observationMode === "near-infrared" ? 0.26 : 1),
  };
}

function displayResponse(
  radiance: GalaxyRadianceResult,
  observationMode: ObservationMode,
  colourGrade: GalaxyColourGrade = "observational",
) {
  const exposure =
    observationMode === "near-infrared"
      ? 0.00007
      : observationMode === "camera"
      ? 0.000052
      : observationMode === "dark-adapted"
        ? 0.000028
        : 0.000018;
  const blackPoint =
    observationMode === "near-infrared"
      ? 0.008
      : observationMode === "camera"
        ? 0.006
        : observationMode === "dark-adapted"
          ? 0.004
          : 0.003;
  const channel = (value: number) =>
    clamp((1 - Math.exp(-value * exposure) - blackPoint) / (1 - blackPoint), 0, 1);
  let red = channel(radiance.red);
  let green = channel(radiance.green);
  let blue = channel(radiance.blue);
  if (observationMode === "dark-adapted") {
    const luminance = 0.24 * red + 0.66 * green + 0.1 * blue;
    red = 0.08 * red + 0.92 * luminance;
    green = 0.08 * green + 0.92 * luminance;
    blue = 0.08 * blue + 0.92 * luminance;
  }
  if (observationMode === "camera") {
    // A fixed camera white balance, independent of observer position. The
    // input field's three broad bands are not a calibrated detector spectrum.
    red *= 0.86;
    blue *= 1.45;
    const luminance = 0.24 * red + 0.66 * green + 0.1 * blue;
    const saturation = colourGrade === "immersive" ? 1.12 : 0.58;
    red = clamp(luminance + saturation * (red - luminance), 0, 1);
    green = clamp(luminance + (saturation - 0.08) * (green - luminance), 0, 1);
    blue = clamp(
      luminance + (saturation + 0.12) * (blue - luminance) +
        (colourGrade === "immersive" ? 0.002 * (1 - luminance) : 0),
      0,
      1,
    );
  }
  if (observationMode === "near-infrared") {
    const infraredLuminance = 0.5 * red + 0.34 * green + 0.16 * blue;
    red = clamp(infraredLuminance * 1.16, 0, 1);
    green = clamp(infraredLuminance * 0.68 + green * 0.2, 0, 1);
    blue = clamp(infraredLuminance * 0.42 + blue * 0.18, 0, 1);
  }
  return { red, green, blue };
}

export function renderGalaxyRadiancePixels(
  observerPositionParsec: Vector3,
  camera: ViewCamera,
  observationMode: ObservationMode,
  width: number,
  height: number,
  colourGrade: GalaxyColourGrade = "observational",
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const basis = createCameraBasis(camera);
  const tangentHorizontal = Math.tan(
    (camera.horizontalFieldOfViewDegrees * Math.PI) / 360,
  );
  const tangentVertical = tangentHorizontal * (height / width);
  const baseNight =
    observationMode === "near-infrared"
      ? [3, 1, 4]
      : observationMode === "camera"
        ? [0, 1, 3]
        : [0, 1, 2];
  const displayGain =
    observationMode === "near-infrared"
      ? 188
      : observationMode === "camera"
        ? 190
        : observationMode === "dark-adapted"
          ? 135
          : 105;

  for (let y = 0; y < height; y += 1) {
    const normalizedY = 1 - (2 * (y + 0.5)) / height;
    for (let x = 0; x < width; x += 1) {
      const normalizedX = (2 * (x + 0.5)) / width - 1;
      const cameraX = normalizedX * tangentHorizontal;
      const cameraY = normalizedY * tangentVertical;
      const directionLength = Math.hypot(1, cameraX, cameraY);
      const direction = {
        x:
          (basis.forward.x +
            cameraX * basis.right.x +
            cameraY * basis.up.x) /
          directionLength,
        y:
          (basis.forward.y +
            cameraX * basis.right.y +
            cameraY * basis.up.y) /
          directionLength,
        z:
          (basis.forward.z +
            cameraX * basis.right.z +
            cameraY * basis.up.z) /
          directionLength,
      };
      const response = displayResponse(
        integrateGalaxyRadiance(observerPositionParsec, direction, observationMode),
        observationMode,
        colourGrade,
      );
      const pixelOffset = (y * width + x) * 4;
      pixels[pixelOffset] = clamp(
        Math.round(baseNight[0] + displayGain * response.red ** 0.78),
        0,
        255,
      );
      pixels[pixelOffset + 1] = clamp(
        Math.round(baseNight[1] + displayGain * response.green ** 0.78),
        0,
        255,
      );
      pixels[pixelOffset + 2] = clamp(
        Math.round(baseNight[2] + displayGain * response.blue ** 0.78),
        0,
        255,
      );
      pixels[pixelOffset + 3] = 255;
    }
  }
  return pixels;
}

export function renderGalaxyAllSkyRadiancePixels(
  observerPositionParsec: Vector3,
  observationMode: ObservationMode,
  width: number,
  height: number,
  colourGrade: GalaxyColourGrade = "observational",
  rows?: { start: number; end: number; pixels: Uint8ClampedArray },
): Uint8ClampedArray {
  const pixels = rows?.pixels ?? new Uint8ClampedArray(width * height * 4);
  const baseNight =
    observationMode === "near-infrared"
      ? [3, 1, 4]
      : observationMode === "camera"
        ? [0, 1, 3]
        : [0, 1, 2];
  const displayGain =
    observationMode === "near-infrared"
      ? 188
      : observationMode === "camera"
        ? 190
        : observationMode === "dark-adapted"
          ? 135
          : 105;
  for (let y = rows?.start ?? 0; y < (rows?.end ?? height); y += 1) {
    const latitudeRadians = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const cosineLatitude = Math.cos(latitudeRadians);
    for (let x = 0; x < width; x += 1) {
      const longitudeRadians = -Math.PI + ((x + 0.5) / width) * 2 * Math.PI;
      const direction = {
        x: cosineLatitude * Math.cos(longitudeRadians),
        y: cosineLatitude * Math.sin(longitudeRadians),
        z: Math.sin(latitudeRadians),
      };
      const response = displayResponse(
        integrateGalaxyRadiance(observerPositionParsec, direction, observationMode),
        observationMode,
        colourGrade,
      );
      const pixelOffset = (y * width + x) * 4;
      pixels[pixelOffset] = clamp(
        Math.round(baseNight[0] + displayGain * response.red ** 0.78),
        0,
        255,
      );
      pixels[pixelOffset + 1] = clamp(
        Math.round(baseNight[1] + displayGain * response.green ** 0.78),
        0,
        255,
      );
      pixels[pixelOffset + 2] = clamp(
        Math.round(baseNight[2] + displayGain * response.blue ** 0.78),
        0,
        255,
      );
      pixels[pixelOffset + 3] = 255;
    }
  }
  return pixels;
}

export function projectGalacticAllSkyPixelsToView(
  allSkyPixels: Uint8ClampedArray,
  allSkyWidth: number,
  allSkyHeight: number,
  camera: ViewCamera,
  viewWidth: number,
  viewHeight: number,
  lens: LensView | null = null,
): Uint8ClampedArray {
  const viewPixels = new Uint8ClampedArray(viewWidth * viewHeight * 4);
  const basis = createCameraBasis(camera);
  const tangentHorizontal = Math.tan(
    (camera.horizontalFieldOfViewDegrees * Math.PI) / 360,
  );
  const tangentVertical = tangentHorizontal * (viewHeight / viewWidth);
  for (let y = 0; y < viewHeight; y += 1) {
    const normalizedY = 1 - (2 * (y + 0.5)) / viewHeight;
    for (let x = 0; x < viewWidth; x += 1) {
      const normalizedX = (2 * (x + 0.5)) / viewWidth - 1;
      const cameraX = normalizedX * tangentHorizontal;
      const cameraY = normalizedY * tangentVertical;
      const directionLength = Math.hypot(1, cameraX, cameraY);
      const directionX =
        (basis.forward.x +
          cameraX * basis.right.x +
          cameraY * basis.up.x) /
        directionLength;
      const directionY =
        (basis.forward.y +
          cameraX * basis.right.y +
          cameraY * basis.up.y) /
        directionLength;
      const directionZ =
        (basis.forward.z +
          cameraX * basis.right.z +
          cameraY * basis.up.z) /
        directionLength;
      const direction=lensedBackgroundDirection({x:directionX,y:directionY,z:directionZ},lens);
      if(!direction){viewPixels[(y*viewWidth+x)*4+3]=255;continue;}
      const longitudeRadians = Math.atan2(direction.y, direction.x);
      const latitudeRadians = Math.asin(clamp(direction.z, -1, 1));
      const sourceX =
        ((longitudeRadians + Math.PI) / (2 * Math.PI)) * allSkyWidth - 0.5;
      const sourceY =
        ((Math.PI / 2 - latitudeRadians) / Math.PI) * allSkyHeight - 0.5;
      const x0 = ((Math.floor(sourceX) % allSkyWidth) + allSkyWidth) % allSkyWidth;
      const x1 = (x0 + 1) % allSkyWidth;
      const y0 = clamp(Math.floor(sourceY), 0, allSkyHeight - 1);
      const y1 = clamp(y0 + 1, 0, allSkyHeight - 1);
      const mixX = sourceX - Math.floor(sourceX);
      const mixY = sourceY - Math.floor(sourceY);
      const targetOffset = (y * viewWidth + x) * 4;
      for (let channelIndex = 0; channelIndex < 4; channelIndex += 1) {
        const topLeft = allSkyPixels[(y0 * allSkyWidth + x0) * 4 + channelIndex];
        const topRight = allSkyPixels[(y0 * allSkyWidth + x1) * 4 + channelIndex];
        const bottomLeft = allSkyPixels[(y1 * allSkyWidth + x0) * 4 + channelIndex];
        const bottomRight = allSkyPixels[(y1 * allSkyWidth + x1) * 4 + channelIndex];
        const top = topLeft + (topRight - topLeft) * mixX;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * mixX;
        viewPixels[targetOffset + channelIndex] = Math.round(
          top + (bottom - top) * mixY,
        );
      }
    }
  }
  return viewPixels;
}
