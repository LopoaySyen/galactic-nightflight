import { lensedPointImages, type LensView } from '../physics/gravitational-lensing.ts';
import { projectRelativePositionToSky, relativePositionParsec } from "../physics/coordinates.ts";
import { apparentMagnitude } from "../physics/photometry.ts";
import { pointSourcePositionAtTime } from "../physics/kinematics.ts";
import type { Vector3 } from "../physics/vector.ts";
import type { PointSourceSample, ProjectedPointSource, ViewCamera } from "./contracts.ts";
import { integrateVisualExtinctionMagnitude } from "./galaxy-radiance.ts";
import { createCameraBasis } from "./projection.ts";
import { benchmarkLinearRgbFromTemperature } from "./spectrum.ts";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const referenceExtinctionCache = new WeakMap<PointSourceSample, number>();

/** Re-anchor measured brightness when the dust model changes; a binary
 * catalogue's stored reference belonged to the model used at export time. */
function currentReferenceExtinction(emitter: PointSourceSample): number {
  const cached = referenceExtinctionCache.get(emitter);
  if (cached !== undefined) return cached;
  const distance = Math.hypot(emitter.positionParsec.x + 8277, emitter.positionParsec.y, emitter.positionParsec.z);
  const value = integrateVisualExtinctionMagnitude({ x: -8277, y: 0, z: 0 }, emitter.positionParsec,
    distance < 800 ? 8 : distance < 4000 ? 12 : 18);
  referenceExtinctionCache.set(emitter, value);
  return value;
}

export interface PreparedGalaxyPointSource {
  id: string;
  distanceParsec: number;
  apparentVisualMagnitude: number;
  linearRgb: readonly [number, number, number];
  extinctionMagnitude: number;
  displayName?: string;
  role: PointSourceSample["role"];
  skyDirection: Vector3;
  emitterPositionParsec: Vector3;
  velocityKilometresPerSecond?: Vector3;
  absoluteVisualMagnitude: number;
  preparationTimeYears: number;
}

/**
 * Runs geometry, motion, photometry and the three-dimensional dust integral.
 * The result is independent of the camera, so looking around does not repeat
 * tens of thousands of line-of-sight integrations.
 */
export function prepareGalaxyPointSources(
  emitters: readonly PointSourceSample[],
  observerPositionParsec: Vector3,
  preliminaryMagnitudeLimit = 13.8,
  simulationTimeYears = 0,
): PreparedGalaxyPointSource[] {
  const preparedSources: PreparedGalaxyPointSource[] = [];
  const solarSeparation = Math.hypot(observerPositionParsec.x + 8277, observerPositionParsec.y, observerPositionParsec.z);
  const blendCoordinate = clamp((solarSeparation - 100) / 900, 0, 1);
  const localCatalogueWeight = 1 - blendCoordinate ** 2 * (3 - 2 * blendCoordinate);
  for (const emitter of emitters) {
    if (emitter.solarNeighbourhoodOnly && localCatalogueWeight <= 0) continue;
    const catalogueMagnitude = emitter.solarNeighbourhoodOnly ? -2.5 * Math.log10(localCatalogueWeight) : 0;
    const emitterPositionParsec = pointSourcePositionAtTime(
      emitter,
      simulationTimeYears,
    );
    const relativePosition = relativePositionParsec(
      emitterPositionParsec,
      observerPositionParsec,
    );
    const distanceParsec = Math.hypot(
      relativePosition.x,
      relativePosition.y,
      relativePosition.z,
    );
    if (!(distanceParsec > 1e-8)) continue;
    const unextinguishedMagnitude = apparentMagnitude(
      emitter.absoluteVisualMagnitude + catalogueMagnitude,
      distanceParsec,
      0,
    );
    if (unextinguishedMagnitude > preliminaryMagnitudeLimit) continue;
    const sky = projectRelativePositionToSky(relativePosition);
    const currentExtinctionMagnitude = integrateVisualExtinctionMagnitude(
      observerPositionParsec,
      emitterPositionParsec,
      distanceParsec < 800 ? 8 : distanceParsec < 4_000 ? 12 : 18,
    );
    const extinctionMagnitude =
      emitter.role === "observed-bright-star"
        ? currentExtinctionMagnitude -
          currentReferenceExtinction(emitter)
        : currentExtinctionMagnitude;
    const apparentVisualMagnitude = unextinguishedMagnitude + extinctionMagnitude;
    const sourceRgb = benchmarkLinearRgbFromTemperature(
      emitter.effectiveTemperatureKelvin,
    );
    const reddeningStrength = clamp(extinctionMagnitude / 6, -0.45, 1);
    const reddenedRgb = [
      sourceRgb[0] * (1 + 0.32 * reddeningStrength),
      sourceRgb[1] * (1 - 0.08 * reddeningStrength),
      sourceRgb[2] * (1 - 0.58 * reddeningStrength),
    ] as const;
    const maximumChannel = Math.max(...reddenedRgb, 1e-8);
    preparedSources.push({
      id: emitter.id,
      emitterPositionParsec,
      velocityKilometresPerSecond: emitter.velocityKilometresPerSecond,
      absoluteVisualMagnitude: emitter.absoluteVisualMagnitude + catalogueMagnitude,
      preparationTimeYears: simulationTimeYears,
      distanceParsec,
      apparentVisualMagnitude,
      linearRgb: reddenedRgb.map((channel) => channel / maximumChannel) as [
        number,
        number,
        number,
      ],
      extinctionMagnitude,
      displayName: emitter.displayName,
      role: emitter.role,
      skyDirection: sky.unitDirection,
    });
  }
  return preparedSources;
}

export function projectPreparedGalaxyPointSources(
  preparedSources: readonly PreparedGalaxyPointSource[],
  camera: ViewCamera,
  canvasWidth: number,
  canvasHeight: number,
  liveObserverPositionParsec?: Vector3,
  liveTimeYears?: number,
  lens: LensView | null = null,
): ProjectedPointSource[] {
  const projectedSources: ProjectedPointSource[] = [];
  const basis = createCameraBasis(camera);
  const tangentX = Math.tan(camera.horizontalFieldOfViewDegrees * Math.PI / 360);
  const tangentY = tangentX * canvasHeight / canvasWidth;
  for (const source of preparedSources) {
    if (!Number.isFinite(source.absoluteVisualMagnitude) || !Number.isFinite(source.extinctionMagnitude)
      || !source.linearRgb.every(Number.isFinite)) continue;
    const dt = ((liveTimeYears ?? source.preparationTimeYears)-source.preparationTimeYears)*1.022712165e-6;
    const velocity = source.velocityKilometresPerSecond;
    const x = liveObserverPositionParsec ? source.emitterPositionParsec.x+(velocity?.x??0)*dt-liveObserverPositionParsec.x : source.skyDirection.x;
    const y = liveObserverPositionParsec ? source.emitterPositionParsec.y+(velocity?.y??0)*dt-liveObserverPositionParsec.y : source.skyDirection.y;
    const z = liveObserverPositionParsec ? source.emitterPositionParsec.z+(velocity?.z??0)*dt-liveObserverPositionParsec.z : source.skyDirection.z;
    const length = Math.hypot(x,y,z);
    if(length<1e-8) continue;
    const distanceParsec=liveObserverPositionParsec ? length : source.distanceParsec;
    for(const image of lensedPointImages({x:x/length,y:y/length,z:z/length},distanceParsec,lens)) {
    const direction=image.direction;
    const front=direction.x*basis.forward.x+direction.y*basis.forward.y+direction.z*basis.forward.z;
    if(!Number.isFinite(front)||front<=0)continue;
    const screenX=(direction.x*basis.right.x+direction.y*basis.right.y+direction.z*basis.right.z)/(front*tangentX);
    const screenY=(direction.x*basis.up.x+direction.y*basis.up.y+direction.z*basis.up.z)/(front*tangentY);
    if(Math.abs(screenX)>1||Math.abs(screenY)>1)continue;
    projectedSources.push({
      id:source.id, role:source.role, displayName:source.displayName,
      canvasX:(screenX+1)*canvasWidth/2,canvasY:(1-screenY)*canvasHeight/2,
      distanceParsec,
      // Observed sources store a signed correction relative to solar-reference
      // extinction, not an absolute dust column. Keep the physical API non-negative.
      apparentVisualMagnitude:(liveObserverPositionParsec ? apparentMagnitude(source.absoluteVisualMagnitude,distanceParsec,0)+source.extinctionMagnitude : source.apparentVisualMagnitude)-2.5*Math.log10(Math.max(image.magnification,1e-7)),
      extinctionMagnitude:source.extinctionMagnitude,linearRgb:source.linearRgb,
      skyDirection:direction,
    });
  }
  }
  return projectedSources;
}

export function projectGalaxyPointSources(
  emitters: readonly PointSourceSample[],
  observerPositionParsec: Vector3,
  camera: ViewCamera,
  canvasWidth: number,
  canvasHeight: number,
  preliminaryMagnitudeLimit = 13.8,
  simulationTimeYears = 0,
): ProjectedPointSource[] {
  return projectPreparedGalaxyPointSources(
    prepareGalaxyPointSources(
      emitters,
      observerPositionParsec,
      preliminaryMagnitudeLimit,
      simulationTimeYears,
    ),
    camera,
    canvasWidth,
    canvasHeight,
  );
}
