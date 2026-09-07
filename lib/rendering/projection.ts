import {
  dotProduct,
  normalizeVector,
  type Vector3,
} from "../physics/vector.ts";
import type { ViewCamera } from "./contracts.ts";

export interface CameraBasis {
  forward: Vector3;
  right: Vector3;
  up: Vector3;
}

export interface PerspectiveProjection {
  visible: boolean;
  canvasX: number;
  canvasY: number;
  forwardCosine: number;
}

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function createCameraBasis(camera: ViewCamera): CameraBasis {
  const azimuth = degreesToRadians(camera.azimuthDegrees);
  const elevation = degreesToRadians(camera.elevationDegrees);
  const cosineElevation = Math.cos(elevation);

  const basis = {
    forward: {
      x: cosineElevation * Math.cos(azimuth),
      y: cosineElevation * Math.sin(azimuth),
      z: Math.sin(elevation),
    },
    right: { x: -Math.sin(azimuth), y: Math.cos(azimuth), z: 0 },
    up: {
      x: -Math.sin(elevation) * Math.cos(azimuth),
      y: -Math.sin(elevation) * Math.sin(azimuth),
      z: Math.cos(elevation),
    },
  };
  if (camera.upDirection) {
    const zenith = camera.upDirection;
    const forward = basis.forward;
    const right = { x: zenith.y*forward.z-zenith.z*forward.y,
      y: zenith.z*forward.x-zenith.x*forward.z, z: zenith.x*forward.y-zenith.y*forward.x };
    if (Math.hypot(right.x,right.y,right.z) > 1e-6) {
      basis.right = normalizeVector(right);
      basis.up = {
        x: forward.y*basis.right.z-forward.z*basis.right.y,
        y: forward.z*basis.right.x-forward.x*basis.right.z,
        z: forward.x*basis.right.y-forward.y*basis.right.x,
      };
    }
  }
  return basis;
}

export function projectDirectionPerspective(
  unitDirection: Vector3,
  camera: ViewCamera,
  canvasWidth: number,
  canvasHeight: number,
): PerspectiveProjection {
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) {
    throw new RangeError("Canvas dimensions must be positive.");
  }
  if (
    !(camera.horizontalFieldOfViewDegrees > 0) ||
    !(camera.horizontalFieldOfViewDegrees < 180)
  ) {
    throw new RangeError("Horizontal field of view must be between 0 and 180 degrees.");
  }

  return createPerspectiveProjector(camera, canvasWidth, canvasHeight)(unitDirection);
}

/** Reuse the camera basis and lens factors for an entire catalogue. */
export function createPerspectiveProjector(camera: ViewCamera, canvasWidth: number, canvasHeight: number) {
  const basis = createCameraBasis(camera);
  const tangentHorizontal = Math.tan(degreesToRadians(camera.horizontalFieldOfViewDegrees / 2));
  const tangentVertical = tangentHorizontal * canvasHeight / canvasWidth;
  return (unitDirection: Vector3): PerspectiveProjection => {
  const direction = normalizeVector(unitDirection);
  const forwardCosine = dotProduct(direction, basis.forward);
  if (forwardCosine <= 0) {
    return {
      visible: false,
      canvasX: Number.NaN,
      canvasY: Number.NaN,
      forwardCosine,
    };
  }

  const normalizedX =
    dotProduct(direction, basis.right) / (forwardCosine * tangentHorizontal);
  const normalizedY =
    dotProduct(direction, basis.up) / (forwardCosine * tangentVertical);
  const visible = Math.abs(normalizedX) <= 1 && Math.abs(normalizedY) <= 1;

  return {
    visible,
    canvasX: ((normalizedX + 1) / 2) * canvasWidth,
    canvasY: ((1 - normalizedY) / 2) * canvasHeight,
    forwardCosine,
  };
  };
}
