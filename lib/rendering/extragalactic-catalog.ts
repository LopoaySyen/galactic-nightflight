import { apparentMagnitude } from "../physics/photometry.ts";
import { projectRelativePositionToSky, relativePositionParsec } from "../physics/coordinates.ts";
import type { Vector3 } from "../physics/vector.ts";
import type { ViewCamera } from "./contracts.ts";
import { integrateVisualExtinctionMagnitude } from "./galaxy-radiance.ts";
import { projectDirectionPerspective } from "./projection.ts";
import { extendedSourceAxes, projectExtendedAxis } from "./extended-source-frame.ts";
import { scaleVector, subtractVector } from "../physics/vector.ts";

const SOLAR_POSITION_PARSEC = { x: -8_277, y: 0, z: 0 } as const;

export interface ExtragalacticSource {
  id: string;
  displayName?: string;
  positionParsec: Vector3;
  absoluteVisualMagnitude: number;
  majorPhysicalDiameterParsec: number;
  minorPhysicalDiameterParsec: number;
  positionAngleDegrees: number;
  colour: readonly [number, number, number];
  morphology: "spiral" | "elliptical" | "irregular";
  evidence: "catalogued-local-group" | "statistical-background";
}

export interface ProjectedExtragalacticSource extends ExtragalacticSource {
  canvasX: number;
  canvasY: number;
  majorCanvasX: number;
  majorCanvasY: number;
  minorCanvasX: number;
  minorCanvasY: number;
  distanceParsec: number;
  apparentVisualMagnitude: number;
  majorAngularDiameterDegrees: number;
  minorAngularDiameterDegrees: number;
  skyDirection: Vector3;
}

export type PreparedExtragalacticSource = Omit<
  ProjectedExtragalacticSource,
  "canvasX" | "canvasY" | "majorCanvasX" | "majorCanvasY" | "minorCanvasX" | "minorCanvasY"
>;

function positionFromGalacticDirection(
  longitudeDegrees: number,
  latitudeDegrees: number,
  distanceParsec: number,
): Vector3 {
  const longitudeRadians = (longitudeDegrees * Math.PI) / 180;
  const latitudeRadians = (latitudeDegrees * Math.PI) / 180;
  const cosineLatitude = Math.cos(latitudeRadians);
  return {
    x:
      SOLAR_POSITION_PARSEC.x +
      distanceParsec * cosineLatitude * Math.cos(longitudeRadians),
    y:
      SOLAR_POSITION_PARSEC.y +
      distanceParsec * cosineLatitude * Math.sin(longitudeRadians),
    z: SOLAR_POSITION_PARSEC.z + distanceParsec * Math.sin(latitudeRadians),
  };
}

function absoluteMagnitudeFromReference(
  apparentVisualMagnitude: number,
  distanceParsec: number,
) {
  return apparentVisualMagnitude - 5 * Math.log10(distanceParsec / 10);
}

function physicalDiameterFromReferenceAngle(
  angularDiameterDegrees: number,
  distanceParsec: number,
) {
  return (
    2 *
    distanceParsec *
    Math.tan((angularDiameterDegrees * Math.PI) / 360)
  );
}

function cataloguedSource(
  id: string,
  displayName: string,
  longitudeDegrees: number,
  latitudeDegrees: number,
  distanceParsec: number,
  apparentVisualMagnitude: number,
  majorAngularDiameterDegrees: number,
  minorAngularDiameterDegrees: number,
  positionAngleDegrees: number,
  colour: readonly [number, number, number],
  morphology: ExtragalacticSource["morphology"],
): ExtragalacticSource {
  return {
    id,
    displayName,
    positionParsec: positionFromGalacticDirection(
      longitudeDegrees,
      latitudeDegrees,
      distanceParsec,
    ),
    absoluteVisualMagnitude: absoluteMagnitudeFromReference(
      apparentVisualMagnitude,
      distanceParsec,
    ),
    majorPhysicalDiameterParsec: physicalDiameterFromReferenceAngle(
      majorAngularDiameterDegrees,
      distanceParsec,
    ),
    minorPhysicalDiameterParsec: physicalDiameterFromReferenceAngle(
      minorAngularDiameterDegrees,
      distanceParsec,
    ),
    positionAngleDegrees,
    colour,
    morphology,
    evidence: "catalogued-local-group",
  };
}

export const cataloguedExtragalacticSources: readonly ExtragalacticSource[] = [
  cataloguedSource("lmc", "大麦哲伦云", 280.47, -32.89, 49_600, 0.9, 10.75, 9.17, 170, [0.68, 0.8, 1], "irregular"),
  cataloguedSource("smc", "小麦哲伦云", 302.8, -44.3, 62_800, 2.7, 5.2, 3.5, 45, [0.68, 0.78, 1], "irregular"),
  cataloguedSource("m31", "仙女座星系", 121.174, -21.573, 770_000, 3.1, 3.17, 1.0, 35, [1, 0.78, 0.56], "spiral"),
  cataloguedSource("m33", "三角座星系", 133.61, -31.33, 840_000, 5.7, 1.18, 0.7, 23, [0.66, 0.82, 1], "spiral"),
  cataloguedSource("m81", "波德星系", 142.09, 40.9, 3_630_000, 6.9, 0.45, 0.23, 157, [1, 0.8, 0.61], "spiral"),
  cataloguedSource("m82", "雪茄星系", 141.41, 40.57, 3_600_000, 8.4, 0.18, 0.07, 65, [1, 0.62, 0.48], "irregular"),
  cataloguedSource("ngc253", "玉夫座星系", 97.36, -87.96, 3_500_000, 7.1, 0.46, 0.11, 52, [1, 0.75, 0.56], "spiral"),
  cataloguedSource("centaurus-a", "半人马座A星系", 309.52, 19.42, 3_800_000, 6.8, 0.43, 0.33, 35, [1, 0.69, 0.48], "elliptical"),
];

function haltonValue(index: number, base: number): number {
  let fraction = 1;
  let result = 0;
  let remaining = index;
  while (remaining > 0) {
    fraction /= base;
    result += fraction * (remaining % base);
    remaining = Math.floor(remaining / base);
  }
  return result;
}

function createStatisticalBackgroundGalaxy(index: number): ExtragalacticSource {
  const verticalCoordinate = 1 - 2 * haltonValue(index, 2);
  const longitudeRadians = 2 * Math.PI * haltonValue(index, 3);
  const planarScale = Math.sqrt(Math.max(0, 1 - verticalCoordinate ** 2));
  const distanceParsec = 10_000_000 * 80 ** haltonValue(index, 5);
  const luminosityCoordinate = haltonValue(index, 7);
  const majorPhysicalDiameterParsec = 2_000 + 55_000 * haltonValue(index, 11) ** 1.7;
  const morphologyCoordinate = haltonValue(index, 13);
  const morphology =
    morphologyCoordinate < 0.64
      ? "spiral"
      : morphologyCoordinate < 0.87
        ? "elliptical"
        : "irregular";
  const absoluteVisualMagnitude = -17.2 - 5.1 * luminosityCoordinate;
  return {
    id: `background-galaxy-${index}`,
    positionParsec: {
      x: distanceParsec * planarScale * Math.cos(longitudeRadians),
      y: distanceParsec * planarScale * Math.sin(longitudeRadians),
      z: distanceParsec * verticalCoordinate,
    },
    absoluteVisualMagnitude,
    majorPhysicalDiameterParsec,
    minorPhysicalDiameterParsec:
      majorPhysicalDiameterParsec * (0.18 + 0.76 * haltonValue(index, 17)),
    positionAngleDegrees: 180 * haltonValue(index, 19),
    colour:
      morphology === "elliptical"
        ? [1, 0.74, 0.5]
        : morphology === "irregular"
          ? [0.62, 0.78, 1]
          : [0.75, 0.84, 1],
    morphology,
    evidence: "statistical-background",
  };
}

export const statisticalBackgroundGalaxies: readonly ExtragalacticSource[] =
  Array.from({ length: 2_048 }, (_, offset) =>
    createStatisticalBackgroundGalaxy(offset + 1),
  );

export const allExtragalacticSources: readonly ExtragalacticSource[] = [
  ...cataloguedExtragalacticSources,
  ...statisticalBackgroundGalaxies,
];

/** Photometry and Milky Way dust attenuation cached independently of the camera. */
export function prepareExtragalacticSources(
  sources: readonly ExtragalacticSource[],
  observerPositionParsec: Vector3,
): PreparedExtragalacticSource[] {
  return sources.map((source) => {
    const relative = relativePositionParsec(source.positionParsec, observerPositionParsec);
    const sky = projectRelativePositionToSky(relative);
    const dustProbeDistanceParsec = Math.min(30_000, sky.distanceParsec);
    const dustTarget = {
      x: observerPositionParsec.x + sky.unitDirection.x * dustProbeDistanceParsec,
      y: observerPositionParsec.y + sky.unitDirection.y * dustProbeDistanceParsec,
      z: observerPositionParsec.z + sky.unitDirection.z * dustProbeDistanceParsec,
    };
    const extinctionMagnitude = integrateVisualExtinctionMagnitude(
      observerPositionParsec,
      dustTarget,
      18,
    );
    return {
      ...source,
      distanceParsec: sky.distanceParsec,
      apparentVisualMagnitude: apparentMagnitude(
        source.absoluteVisualMagnitude,
        sky.distanceParsec,
        extinctionMagnitude,
      ),
      majorAngularDiameterDegrees:
        (2 *
          Math.atan(source.majorPhysicalDiameterParsec / (2 * sky.distanceParsec)) *
          180) /
        Math.PI,
      minorAngularDiameterDegrees:
        (2 *
          Math.atan(source.minorPhysicalDiameterParsec / (2 * sky.distanceParsec)) *
          180) /
        Math.PI,
      skyDirection: sky.unitDirection,
    };
  });
}

export function projectPreparedExtragalacticSources(
  sources: readonly PreparedExtragalacticSource[],
  camera: ViewCamera,
  canvasWidth: number,
  canvasHeight: number,
  liveObserverPosition?: Vector3,
): ProjectedExtragalacticSource[] {
  const projectedSources: ProjectedExtragalacticSource[] = [];
  for (const source of sources) {
    const relative = liveObserverPosition ? subtractVector(source.positionParsec, liveObserverPosition) : scaleVector(source.skyDirection, source.distanceParsec);
    const projection = projectDirectionPerspective(
      relative,
      camera,
      canvasWidth,
      canvasHeight,
    );
    if (!projection.visible) continue;
    const axes = extendedSourceAxes(subtractVector(source.positionParsec, SOLAR_POSITION_PARSEC), source.positionAngleDegrees);
    const major = projectExtendedAxis(relative, axes.major, source.majorPhysicalDiameterParsec, camera, canvasWidth, canvasHeight);
    const minor = projectExtendedAxis(relative, axes.minor, source.minorPhysicalDiameterParsec, camera, canvasWidth, canvasHeight);
    if (![major.x, major.y, minor.x, minor.y].every(Number.isFinite)) continue;
    projectedSources.push({
      ...source,
      skyDirection: projectRelativePositionToSky(relative).unitDirection,
      majorCanvasX: major.x, majorCanvasY: major.y, minorCanvasX: minor.x, minorCanvasY: minor.y,
      canvasX: projection.canvasX,
      canvasY: projection.canvasY,
    });
  }
  return projectedSources;
}

export function projectExtragalacticSources(
  sources: readonly ExtragalacticSource[],
  observerPositionParsec: Vector3,
  camera: ViewCamera,
  canvasWidth: number,
  canvasHeight: number,
  liveObserverPosition?: Vector3,
): ProjectedExtragalacticSource[] {
  return projectPreparedExtragalacticSources(
    prepareExtragalacticSources(sources, observerPositionParsec),
    camera,
    canvasWidth,
    canvasHeight,
  );
}
