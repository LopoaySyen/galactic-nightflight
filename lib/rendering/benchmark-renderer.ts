import {
  projectRelativePositionToSky,
  relativePositionParsec,
} from "../physics/coordinates.ts";
import { apparentMagnitude } from "../physics/photometry.ts";
import type { Vector3 } from "../physics/vector.ts";
import type {
  PointSourceSample,
  ProjectedPointSource,
  ViewCamera,
} from "./contracts.ts";
import { projectDirectionPerspective } from "./projection.ts";
import { benchmarkLinearRgbFromTemperature } from "./spectrum.ts";

export function projectNumericalBenchmark(
  emitters: readonly PointSourceSample[],
  observerPositionParsec: Vector3,
  camera: ViewCamera,
  canvasWidth: number,
  canvasHeight: number,
): ProjectedPointSource[] {
  return emitters.flatMap((emitter) => {
    const relativePosition = relativePositionParsec(
      emitter.positionParsec,
      observerPositionParsec,
    );
    if (
      Math.hypot(
        relativePosition.x,
        relativePosition.y,
        relativePosition.z,
      ) < 1e-9
    ) {
      return [];
    }
    const sky = projectRelativePositionToSky(
      relativePosition,
    );
    const projected = projectDirectionPerspective(
      sky.unitDirection,
      camera,
      canvasWidth,
      canvasHeight,
    );
    if (!projected.visible) return [];

    return [
      {
        id: emitter.id,
        canvasX: projected.canvasX,
        canvasY: projected.canvasY,
        distanceParsec: sky.distanceParsec,
        apparentVisualMagnitude: apparentMagnitude(
          emitter.absoluteVisualMagnitude,
          sky.distanceParsec,
          0,
        ),
        linearRgb: benchmarkLinearRgbFromTemperature(
          emitter.effectiveTemperatureKelvin,
        ),
      },
    ];
  });
}
