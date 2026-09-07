import {
  addVector,
  dotProduct,
  rotateAroundZ,
  scaleVector,
  vectorLength,
  type Vector3,
} from "./vector.ts";

export interface PhaseSpaceState {
  positionParsec: Vector3;
  velocityParsecPerMillionYears: Vector3;
}

export interface PotentialEvaluation {
  potentialParsecSquaredPerMillionYearsSquared: number;
  accelerationParsecPerMillionYearsSquared: Vector3;
}

export interface PotentialModel {
  id: string;
  evaluate(positionParsec: Vector3, timeMillionYears: number): PotentialEvaluation;
}

export interface RigidlyRotatingPotentialModel extends PotentialModel {
  patternSpeedRadiansPerMillionYears: number;
  referenceAngleRadians: number;
  referenceTimeMillionYears: number;
}

export interface RigidRotationState {
  patternSpeedKilometresPerSecondPerKiloparsec: number;
  referenceAngleRadians: number;
  referenceTimeMillionYears: number;
}

const METRES_PER_PARSEC = 3.085677581491367e16;
const KILOGRAMS_PER_SOLAR_MASS = 1.98847e30;
const SECONDS_PER_MILLION_YEARS = 365.25 * 86_400 * 1e6;
const GRAVITATIONAL_CONSTANT_SI = 6.6743e-11;

export const GRAVITATIONAL_CONSTANT_PARSECS_CUBED_PER_SOLAR_MASS_MILLION_YEARS_SQUARED =
  (GRAVITATIONAL_CONSTANT_SI *
    KILOGRAMS_PER_SOLAR_MASS *
    SECONDS_PER_MILLION_YEARS ** 2) /
  METRES_PER_PARSEC ** 3;

export const PARSECS_PER_MILLION_YEARS_PER_KILOMETRE_PER_SECOND =
  (1_000 * SECONDS_PER_MILLION_YEARS) / METRES_PER_PARSEC;

export function pointMassPotential(
  id: string,
  massSolarMasses: number,
  centreParsec: Vector3 = { x: 0, y: 0, z: 0 },
): PotentialModel {
  if (!(massSolarMasses > 0) || !Number.isFinite(massSolarMasses)) {
    throw new RangeError("Point mass must be finite and greater than zero.");
  }
  const gravitationalMass =
    GRAVITATIONAL_CONSTANT_PARSECS_CUBED_PER_SOLAR_MASS_MILLION_YEARS_SQUARED *
    massSolarMasses;
  return {
    id,
    evaluate(positionParsec) {
      const offset = {
        x: positionParsec.x - centreParsec.x,
        y: positionParsec.y - centreParsec.y,
        z: positionParsec.z - centreParsec.z,
      };
      const radius = vectorLength(offset);
      if (!(radius > 0)) {
        throw new RangeError("A point-mass potential is singular at its centre.");
      }
      return {
        potentialParsecSquaredPerMillionYearsSquared: -gravitationalMass / radius,
        accelerationParsecPerMillionYearsSquared: scaleVector(
          offset,
          -gravitationalMass / radius ** 3,
        ),
      };
    },
  };
}

export function compositePotential(
  id: string,
  components: readonly PotentialModel[],
): PotentialModel {
  if (components.length === 0) {
    throw new RangeError("A composite potential needs at least one component.");
  }
  return {
    id,
    evaluate(positionParsec, timeMillionYears) {
      return components.reduce<PotentialEvaluation>(
        (total, component) => {
          const next = component.evaluate(positionParsec, timeMillionYears);
          return {
            potentialParsecSquaredPerMillionYearsSquared:
              total.potentialParsecSquaredPerMillionYearsSquared +
              next.potentialParsecSquaredPerMillionYearsSquared,
            accelerationParsecPerMillionYearsSquared: addVector(
              total.accelerationParsecPerMillionYearsSquared,
              next.accelerationParsecPerMillionYearsSquared,
            ),
          };
        },
        {
          potentialParsecSquaredPerMillionYearsSquared: 0,
          accelerationParsecPerMillionYearsSquared: { x: 0, y: 0, z: 0 },
        },
      );
    },
  };
}

export function patternSpeedRadiansPerMillionYears(
  kilometresPerSecondPerKiloparsec: number,
): number {
  return (
    (kilometresPerSecondPerKiloparsec *
      PARSECS_PER_MILLION_YEARS_PER_KILOMETRE_PER_SECOND) /
    1_000
  );
}

export function rigidlyRotatingPotential(
  id: string,
  potentialAtReferenceBarAngle: PotentialModel,
  rotation: RigidRotationState,
): RigidlyRotatingPotentialModel {
  const angularSpeed = patternSpeedRadiansPerMillionYears(
    rotation.patternSpeedKilometresPerSecondPerKiloparsec,
  );
  if (
    !Number.isFinite(rotation.referenceAngleRadians) ||
    !Number.isFinite(rotation.referenceTimeMillionYears)
  ) {
    throw new RangeError("A rotating potential needs a finite reference phase and time.");
  }
  return {
    id,
    patternSpeedRadiansPerMillionYears: angularSpeed,
    referenceAngleRadians: rotation.referenceAngleRadians,
    referenceTimeMillionYears: rotation.referenceTimeMillionYears,
    evaluate(positionParsec, timeMillionYears) {
      const angle =
        rotation.referenceAngleRadians +
        angularSpeed * (timeMillionYears - rotation.referenceTimeMillionYears);
      const barFramePosition = rotateAroundZ(positionParsec, -angle);
      const barFrameEvaluation = potentialAtReferenceBarAngle.evaluate(
        barFramePosition,
        0,
      );
      return {
        potentialParsecSquaredPerMillionYearsSquared:
          barFrameEvaluation.potentialParsecSquaredPerMillionYearsSquared,
        accelerationParsecPerMillionYearsSquared: rotateAroundZ(
          barFrameEvaluation.accelerationParsecPerMillionYearsSquared,
          angle,
        ),
      };
    },
  };
}

export function mechanicalEnergy(
  state: PhaseSpaceState,
  potential: PotentialModel,
  timeMillionYears: number,
): number {
  const potentialValue = potential.evaluate(
    state.positionParsec,
    timeMillionYears,
  ).potentialParsecSquaredPerMillionYearsSquared;
  return (
    0.5 * dotProduct(state.velocityParsecPerMillionYears, state.velocityParsecPerMillionYears) +
    potentialValue
  );
}

export function jacobiIntegral(
  state: PhaseSpaceState,
  rotatingPotential: RigidlyRotatingPotentialModel,
  timeMillionYears: number,
): number {
  const angularMomentumZ =
    state.positionParsec.x * state.velocityParsecPerMillionYears.y -
    state.positionParsec.y * state.velocityParsecPerMillionYears.x;
  return (
    mechanicalEnergy(state, rotatingPotential, timeMillionYears) -
    rotatingPotential.patternSpeedRadiansPerMillionYears * angularMomentumZ
  );
}

export function relativeInvariantDrift(
  referenceValue: number,
  measuredValue: number,
  characteristicEnergyScale: number,
): number {
  if (!(characteristicEnergyScale > 0) || !Number.isFinite(characteristicEnergyScale)) {
    throw new RangeError("Invariant drift needs a finite positive characteristic energy scale.");
  }
  return Math.abs(measuredValue - referenceValue) / characteristicEnergyScale;
}
