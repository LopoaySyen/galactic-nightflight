export type Point3 = readonly [number, number, number];
const stations: readonly Point3[] = [[0, 0, 0], [3.8, -1.3, 21], [-3.4, 1.8, 44], [2.4, -.8, 68], [0, 1.2, 92]];
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
const unit = (v: Point3): Point3 => { const d = Math.hypot(...v) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function flightPosition(progress: number): Point3 {
  const u = clamp(progress, 0, 3) / 3 * (stations.length - 1), i = Math.min(stations.length - 2, Math.floor(u)), t = u - i;
  const a = stations[Math.max(0, i - 1)], b = stations[i], c = stations[i + 1], d = stations[Math.min(stations.length - 1, i + 2)];
  return [0, 1, 2].map(axis => .5 * ((2 * b[axis]) + (-a[axis] + c[axis]) * t + (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t * t + (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t * t * t)) as unknown as Point3;
}

export function flightCamera(progress: number, swayX = 0, swayY = 0) {
  const base = flightPosition(progress), ahead = flightPosition(Math.min(3, progress + .055)), behind = flightPosition(Math.max(0, progress - .055));
  const forward = unit([ahead[0] - behind[0] + swayX * .35, ahead[1] - behind[1] + swayY * .25, ahead[2] - behind[2]]);
  const right = unit(cross([0, 1, 0], forward)), up = unit(cross(forward, right));
  return { position: [base[0] + swayX * .42, base[1] + swayY * .3, base[2]] as Point3, forward, right, up };
}

/** Frame-rate independent low-pass, shared by scroll and anchor navigation. */
export function smoothTravel(current: number, target: number, seconds: number) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, seconds) / .13));
}
