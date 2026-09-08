import type { Vector3 } from "../physics/vector.ts";

export type RenderScope =
  | "production-galaxy"
  | "galaxy-prediction"
  | "numerical-benchmark";

export type ObservationMode =
  | "naked-eye"
  | "dark-adapted"
  | "camera"
  | "near-infrared";

export interface ViewCamera {
  azimuthDegrees: number;
  elevationDegrees: number;
  horizontalFieldOfViewDegrees: number;
  /** Optional local vertical; landscape cameras stay level with the planet. */
  upDirection?: Vector3;
}

export interface PointSourceSample {
  id: string;
  positionParsec: Vector3;
  velocityKilometresPerSecond?: Vector3;
  absoluteVisualMagnitude: number;
  effectiveTemperatureKelvin: number;
  role:
    | "deterministic-benchmark-emitter"
    | "observed-bright-star"
    | "model-population-tracer";
  displayName?: string;
  sourceCatalog?: string;
  referenceVisualExtinctionMagnitude?: number;
  observedData?: {
    catalog: "yale-hipparcos" | "gaia-dr3" | "nearby-simbad";
    sourceUrl?: string;
    catalogueIdentifier?: string;
    henryDraperIdentifier?: string;
    rightAscensionDegrees?: number;
    declinationDegrees?: number;
    referenceDistanceParsec: number;
    referenceApparentMagnitude: number;
    spectralType?: string;
    temperatureMethod: "colour-estimate" | "catalogue-or-colour";
    measuredVelocity: boolean;
  };
}

export interface ProjectedPointSource {
  id: string;
  canvasX: number;
  canvasY: number;
  distanceParsec: number;
  apparentVisualMagnitude: number;
  linearRgb: readonly [number, number, number];
  extinctionMagnitude?: number;
  displayName?: string;
  role?: PointSourceSample["role"];
  skyDirection?: Vector3;
}
