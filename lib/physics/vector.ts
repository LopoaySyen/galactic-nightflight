export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export function addVector(left: Vector3, right: Vector3): Vector3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

export function subtractVector(left: Vector3, right: Vector3): Vector3 {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

export function scaleVector(vector: Vector3, scale: number): Vector3 {
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
}

export function dotProduct(left: Vector3, right: Vector3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function vectorLength(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalizeVector(vector: Vector3): Vector3 {
  const length = vectorLength(vector);
  if (!(length > 0)) {
    throw new RangeError("A zero-length vector has no direction.");
  }
  return scaleVector(vector, 1 / length);
}

export function rotateAroundZ(vector: Vector3, angleRadians: number): Vector3 {
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  return {
    x: cosine * vector.x - sine * vector.y,
    y: sine * vector.x + cosine * vector.y,
    z: vector.z,
  };
}

