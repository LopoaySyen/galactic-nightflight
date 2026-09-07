import { requireProviderValue, type ProviderState } from "../physics/providers.ts";

export interface SpectralResponsePoint {
  wavelengthNanometres: number;
  relativeSensitivity: number;
}

export interface HumanVisionResponseArtifact {
  mode: "photopic" | "scotopic";
  spectralResponse: readonly SpectralResponsePoint[];
  pointSourceDetectionThreshold: number;
  diffuseDetectionThreshold: number;
  glareKernelArtifactId: string;
  displayCalibrationArtifactId: string;
}

export function requireHumanVisionResponse(
  provider: ProviderState<HumanVisionResponseArtifact>,
): HumanVisionResponseArtifact {
  const response = requireProviderValue(provider);
  validateSpectralResponse(response.spectralResponse);
  if (
    !(response.pointSourceDetectionThreshold > 0) ||
    !(response.diffuseDetectionThreshold > 0)
  ) {
    throw new RangeError("Human-vision detection thresholds must be positive.");
  }
  return response;
}

export function integrateHumanVisionStimulus(
  spectralSignal: readonly SpectralResponsePoint[],
  response: HumanVisionResponseArtifact,
): number {
  validateSpectralResponse(spectralSignal);
  validateSpectralResponse(response.spectralResponse);
  if (spectralSignal.length !== response.spectralResponse.length) {
    throw new RangeError("Signal and response must use the same wavelength grid.");
  }
  let integral = 0;
  for (let index = 1; index < spectralSignal.length; index += 1) {
    const leftWavelength = spectralSignal[index - 1].wavelengthNanometres;
    const rightWavelength = spectralSignal[index].wavelengthNanometres;
    if (leftWavelength !== response.spectralResponse[index - 1].wavelengthNanometres || rightWavelength !== response.spectralResponse[index].wavelengthNanometres) {
      throw new RangeError("Signal and response wavelength samples do not align.");
    }
    const left = spectralSignal[index - 1].relativeSensitivity * response.spectralResponse[index - 1].relativeSensitivity;
    const right = spectralSignal[index].relativeSensitivity * response.spectralResponse[index].relativeSensitivity;
    integral += 0.5 * (left + right) * (rightWavelength - leftWavelength);
  }
  return integral;
}

function validateSpectralResponse(points: readonly SpectralResponsePoint[]): void {
  if (points.length < 2) throw new RangeError("A spectral response needs at least two samples.");
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!(point.wavelengthNanometres > 0) || !(point.relativeSensitivity >= 0)) {
      throw new RangeError("Spectral response values must be finite and non-negative.");
    }
    if (index > 0 && point.wavelengthNanometres <= points[index - 1].wavelengthNanometres) {
      throw new RangeError("Spectral wavelengths must be strictly increasing.");
    }
  }
}

