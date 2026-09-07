import type { PointSourceSample } from "../rendering/contracts.ts";
import type { Vector3 } from "./vector.ts";

export const PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND = 1.022712165e-6;
const CIRCULAR_SPEED_KILOMETRES_PER_SECOND = 232;

export interface PhaseSpaceState {
  positionParsec: Vector3;
  velocityKilometresPerSecond: Vector3;
}

export function circularVelocityAtPosition(
  positionParsec: Vector3,
): Vector3 {
  const radiusParsec = Math.hypot(positionParsec.x, positionParsec.y);
  if (!(radiusParsec > 0)) return { x: 0, y: 0, z: 0 };
  const speed =
    CIRCULAR_SPEED_KILOMETRES_PER_SECOND *
    (1 - Math.exp(-radiusParsec / 700));
  return {
    x: (positionParsec.y / radiusParsec) * speed,
    y: (-positionParsec.x / radiusParsec) * speed,
    z: 0,
  };
}

function flatRotationCurveAccelerationParsecPerYearSquared(
  positionParsec: Vector3,
): Vector3 {
  const planarRadiusParsec = Math.hypot(positionParsec.x, positionParsec.y);
  if (!(planarRadiusParsec > 20)) return { x: 0, y: 0, z: 0 };
  const circularSpeedParsecPerYear =
    CIRCULAR_SPEED_KILOMETRES_PER_SECOND *
    (1 - Math.exp(-planarRadiusParsec / 700)) *
    PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND;
  const planarAcceleration =
    -(circularSpeedParsecPerYear ** 2) / planarRadiusParsec;
  const verticalFrequencyPerYear = 7.4e-8;
  return {
    x: planarAcceleration * (positionParsec.x / planarRadiusParsec),
    y: planarAcceleration * (positionParsec.y / planarRadiusParsec),
    z: -(verticalFrequencyPerYear ** 2) * positionParsec.z,
  };
}

export function integratePhaseSpaceLeapfrog(
  state: PhaseSpaceState,
  elapsedYears: number,
): PhaseSpaceState {
  if (!Number.isFinite(elapsedYears)) {
    throw new RangeError("Elapsed time must be finite.");
  }
  if (elapsedYears === 0) return state;
  const accelerationStart = flatRotationCurveAccelerationParsecPerYearSquared(
    state.positionParsec,
  );
  const velocityStartParsecPerYear = {
    x:
      state.velocityKilometresPerSecond.x *
      PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND,
    y:
      state.velocityKilometresPerSecond.y *
      PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND,
    z:
      state.velocityKilometresPerSecond.z *
      PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND,
  };
  const halfVelocity = {
    x: velocityStartParsecPerYear.x + 0.5 * accelerationStart.x * elapsedYears,
    y: velocityStartParsecPerYear.y + 0.5 * accelerationStart.y * elapsedYears,
    z: velocityStartParsecPerYear.z + 0.5 * accelerationStart.z * elapsedYears,
  };
  const positionParsec = {
    x: state.positionParsec.x + halfVelocity.x * elapsedYears,
    y: state.positionParsec.y + halfVelocity.y * elapsedYears,
    z: state.positionParsec.z + halfVelocity.z * elapsedYears,
  };
  const accelerationEnd =
    flatRotationCurveAccelerationParsecPerYearSquared(positionParsec);
  const velocityEndParsecPerYear = {
    x: halfVelocity.x + 0.5 * accelerationEnd.x * elapsedYears,
    y: halfVelocity.y + 0.5 * accelerationEnd.y * elapsedYears,
    z: halfVelocity.z + 0.5 * accelerationEnd.z * elapsedYears,
  };
  return {
    positionParsec,
    velocityKilometresPerSecond: {
      x:
        velocityEndParsecPerYear.x /
        PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND,
      y:
        velocityEndParsecPerYear.y /
        PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND,
      z:
        velocityEndParsecPerYear.z /
        PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND,
    },
  };
}

export function pointSourcePositionAtTime(
  source: PointSourceSample,
  elapsedYears: number,
): Vector3 {
  const velocity = source.velocityKilometresPerSecond;
  if (!velocity || elapsedYears === 0) return source.positionParsec;
  const displacementScale =
    elapsedYears * PARSEC_PER_YEAR_PER_KILOMETRE_PER_SECOND;
  return {
    x: source.positionParsec.x + velocity.x * displacementScale,
    y: source.positionParsec.y + velocity.y * displacementScale,
    z: source.positionParsec.z + velocity.z * displacementScale,
  };
}
