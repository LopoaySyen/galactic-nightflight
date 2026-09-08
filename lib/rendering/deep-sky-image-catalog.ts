import expandedImages from '../../public/data/deep-sky-expansion.json' with { type: 'json' };
import { projectRelativePositionToSky, relativePositionParsec } from "../physics/coordinates.ts";
import type { Vector3 } from "../physics/vector.ts";
import type { ViewCamera } from "./contracts.ts";
import { equatorialDirectionToGalactic } from "./observed-star-catalog.ts";
import { normalizeVector } from "../physics/vector.ts";
import { projectDirectionPerspective } from "./projection.ts";
import { equatorialTangentAxes, projectExtendedAxis } from "./extended-source-frame.ts";

const SOLAR_POSITION_PARSEC = { x: -8_277, y: 0, z: 0 } as const;

export interface DeepSkyImageSource {
  id: string;
  displayName: string;
  displayNameEn?: string;
  aliases?: string[];
  description?: string;
  descriptionEn?: string;
  redshift?: number;
  objectClass: "emission-nebula" | "open-cluster" | "globular-cluster" | "galaxy";
  imagePath: string;
  positionParsec: Vector3;
  majorPhysicalDiameterParsec: number;
  minorPhysicalDiameterParsec: number;
  positionAngleDegrees: number;
  imageRightUnit?: Vector3;
  imageUpUnit?: Vector3;
  enhancedScaleMultiplier: number;
  cameraOpacity: number;
  creditShort: string;
  sourcePage: string;
}

export interface ProjectedDeepSkyImage extends DeepSkyImageSource {
  canvasX: number;
  canvasY: number;
  skyDirection: Vector3;
  distanceParsec: number;
  imageRightCanvasX: number;
  imageRightCanvasY: number;
  imageDownCanvasX: number;
  imageDownCanvasY: number;
  majorAngularDiameterDegrees: number;
  minorAngularDiameterDegrees: number;
}

function positionFromGalacticDirection(
  longitudeDegrees: number,
  latitudeDegrees: number,
  distanceParsec: number,
): Vector3 {
  const longitudeRadians = (longitudeDegrees * Math.PI) / 180;
  const latitudeRadians = (latitudeDegrees * Math.PI) / 180;
  const cosineLatitude = Math.cos(latitudeRadians);
  return {
    x: SOLAR_POSITION_PARSEC.x + distanceParsec * cosineLatitude * Math.cos(longitudeRadians),
    y: SOLAR_POSITION_PARSEC.y + distanceParsec * cosineLatitude * Math.sin(longitudeRadians),
    z: SOLAR_POSITION_PARSEC.z + distanceParsec * Math.sin(latitudeRadians),
  };
}

function physicalDiameterFromReferenceAngle(
  angularDiameterDegrees: number,
  distanceParsec: number,
): number {
  return 2 * distanceParsec * Math.tan((angularDiameterDegrees * Math.PI) / 360);
}

function galacticObject(
  source: Omit<DeepSkyImageSource, "positionParsec" | "majorPhysicalDiameterParsec" | "minorPhysicalDiameterParsec"> & {
    imageCentreEquatorial?: {rightAscensionDegrees:number;declinationDegrees:number;northLeftDegrees:number};
    longitudeDegrees: number;
    latitudeDegrees: number;
    distanceParsec: number;
    majorAngularDiameterDegrees: number;
    minorAngularDiameterDegrees: number;
  },
): DeepSkyImageSource {
  const photograph = source.imageCentreEquatorial;
  const position = positionFromGalacticDirection(source.longitudeDegrees, source.latitudeDegrees, source.distanceParsec);
  let imageRightUnit: Vector3 | undefined, imageUpUnit: Vector3 | undefined;
  if (photograph) {
    const direction = normalizeVector(equatorialDirectionToGalactic(photograph.rightAscensionDegrees, photograph.declinationDegrees));
    const { north, east } = equatorialTangentAxes(direction);
    const angle = photograph.northLeftDegrees * Math.PI / 180;
    imageRightUnit = {x:-east.x*Math.cos(angle)-north.x*Math.sin(angle),y:-east.y*Math.cos(angle)-north.y*Math.sin(angle),z:-east.z*Math.cos(angle)-north.z*Math.sin(angle)};
    imageUpUnit = {x:-east.x*Math.sin(angle)+north.x*Math.cos(angle),y:-east.y*Math.sin(angle)+north.y*Math.cos(angle),z:-east.z*Math.sin(angle)+north.z*Math.cos(angle)};
    position.x = SOLAR_POSITION_PARSEC.x + direction.x * source.distanceParsec;
    position.y = direction.y * source.distanceParsec; position.z = direction.z * source.distanceParsec;
  }
  return {
    ...source, imageRightUnit, imageUpUnit,
    positionParsec: position,
    majorPhysicalDiameterParsec: physicalDiameterFromReferenceAngle(
      source.majorAngularDiameterDegrees,
      source.distanceParsec,
    ),
    minorPhysicalDiameterParsec: physicalDiameterFromReferenceAngle(
      source.minorAngularDiameterDegrees,
      source.distanceParsec,
    ),
  };
}

export const deepSkyImageSources: readonly DeepSkyImageSource[] = [
  ...expandedImages.map(source=>galacticObject({...source,objectClass:source.objectClass as DeepSkyImageSource["objectClass"]})),
  galacticObject({
    id: "m42-image",
    displayName: "猎户座大星云 M42",
    objectClass: "emission-nebula",
    imagePath: "/deep-sky/orion-nebula-wide.jpg",
    imageCentreEquatorial: {rightAscensionDegrees:83.7844167,declinationDegrees:-5.4787,northLeftDegrees:0.2},
    longitudeDegrees: 209.0137,
    latitudeDegrees: -19.3816,
    distanceParsec: 460,
    majorAngularDiameterDegrees: 59.95 / 60,
    minorAngularDiameterDegrees: 46.56 / 60,
    positionAngleDegrees: -12,
    enhancedScaleMultiplier: 4,
    cameraOpacity: 0.85,
    creditShort: "ESO/G. Beccari",
    sourcePage: "https://www.eso.org/public/images/eso1723a/",
  }),
  galacticObject({
    id: "m45-image",
    displayName: "昴星团 M45",
    objectClass: "open-cluster",
    imagePath: "/deep-sky/pleiades.webp",
    longitudeDegrees: 166.57,
    latitudeDegrees: -23.52,
    distanceParsec: 136.4,
    majorAngularDiameterDegrees: 2,
    minorAngularDiameterDegrees: 1.55,
    positionAngleDegrees: 8,
    enhancedScaleMultiplier: 2.3,
    cameraOpacity: 0.4,
    creditShort: "NASA、ESA、AURA/Caltech、Palomar Observatory",
    sourcePage: "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-45/",
  }),
  galacticObject({
    id: "omega-centauri-image",
    displayName: "半人马座欧米茄星团",
    objectClass: "globular-cluster",
    imagePath: "/deep-sky/omega-centauri-wide.jpg",
    imageCentreEquatorial: {rightAscensionDegrees:201.6969583,declinationDegrees:-47.4795389,northLeftDegrees:0},
    longitudeDegrees: 309.1,
    latitudeDegrees: 14.97,
    distanceParsec: 4_800,
    majorAngularDiameterDegrees: 0.848,
    minorAngularDiameterDegrees: 0.848,
    positionAngleDegrees: 0,
    enhancedScaleMultiplier: 7,
    cameraOpacity: 0.72,
    creditShort: "ESO/INAF-VST/OmegaCAM",
    sourcePage: "https://www.eso.org/public/images/eso1119b/",
  }),
  galacticObject({
    id: "m31-image",
    displayName: "仙女座星系 M31",
    objectClass: "galaxy",
    imagePath: "/deep-sky/andromeda-wide.jpg",
    imageCentreEquatorial: {rightAscensionDegrees:10.75225,declinationDegrees:41.2608694,northLeftDegrees:1.9},
    longitudeDegrees: 121.174,
    latitudeDegrees: -21.573,
    distanceParsec: 770_000,
    majorAngularDiameterDegrees: 362 / 60,
    minorAngularDiameterDegrees: 234.12 / 60,
    positionAngleDegrees: 35,
    enhancedScaleMultiplier: 1.8,
    cameraOpacity: 0.82,
    creditShort: "NASA、ESA、Digitized Sky Survey 2",
    sourcePage: "https://esahubble.org/images/heic1502b/",
  }),
];

export function projectDeepSkyImageSources(
  sources: readonly DeepSkyImageSource[],
  observerPositionParsec: Vector3,
  camera: ViewCamera,
  canvasWidth: number,
  canvasHeight: number,
): ProjectedDeepSkyImage[] {
  const projectedSources: ProjectedDeepSkyImage[] = [];
  for (const source of sources) {
    const relativePosition = relativePositionParsec(source.positionParsec, observerPositionParsec);
    if (Math.hypot(relativePosition.x,relativePosition.y,relativePosition.z) < 1e-6) continue;
    const sky = projectRelativePositionToSky(relativePosition);
    const projection = projectDirectionPerspective(
      sky.unitDirection,
      camera,
      canvasWidth,
      canvasHeight,
    );
    if (!Number.isFinite(projection.canvasX) || !Number.isFinite(projection.canvasY)) continue;
    const focalLength = canvasWidth / (2 * Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360));
    const angle = source.positionAngleDegrees * Math.PI / 180;
    let rightX = focalLength * source.majorPhysicalDiameterParsec / (2*sky.distanceParsec) * Math.cos(angle);
    let rightY = focalLength * source.majorPhysicalDiameterParsec / (2*sky.distanceParsec) * Math.sin(angle);
    let downX = -focalLength * source.minorPhysicalDiameterParsec / (2*sky.distanceParsec) * Math.sin(angle);
    let downY = focalLength * source.minorPhysicalDiameterParsec / (2*sky.distanceParsec) * Math.cos(angle);
    if(source.imageRightUnit && source.imageUpUnit) {
      const right=projectExtendedAxis(relativePosition,source.imageRightUnit,source.majorPhysicalDiameterParsec,camera,canvasWidth,canvasHeight);
      const up=projectExtendedAxis(relativePosition,source.imageUpUnit,source.minorPhysicalDiameterParsec,camera,canvasWidth,canvasHeight);
      rightX=right.x;rightY=right.y;downX=-up.x;downY=-up.y;
    }
    if(![rightX,rightY,downX,downY].every(Number.isFinite)) continue;
    const halfWidth=Math.abs(rightX)+Math.abs(downX),halfHeight=Math.abs(rightY)+Math.abs(downY);
    if(projection.canvasX+halfWidth<0||projection.canvasX-halfWidth>canvasWidth||projection.canvasY+halfHeight<0||projection.canvasY-halfHeight>canvasHeight)continue;
    projectedSources.push({
      ...source,
      canvasX: projection.canvasX,
      canvasY: projection.canvasY,
      skyDirection: sky.unitDirection,
      distanceParsec: sky.distanceParsec,
      imageRightCanvasX:rightX,imageRightCanvasY:rightY,imageDownCanvasX:downX,imageDownCanvasY:downY,
      majorAngularDiameterDegrees:
        (2 * Math.atan(source.majorPhysicalDiameterParsec / (2 * sky.distanceParsec)) * 180) /
        Math.PI,
      minorAngularDiameterDegrees:
        (2 * Math.atan(source.minorPhysicalDiameterParsec / (2 * sky.distanceParsec)) * 180) /
        Math.PI,
    });
  }
  return projectedSources;
}
