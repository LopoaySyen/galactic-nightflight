import { requireProviderValue, type ProviderState } from "../physics/providers.ts";

export interface CameraBandSample {
  wavelengthNanometres: number;
  photonFluxPerSquareMetrePerSecondPerNanometre: number;
  quantumEfficiency: number;
}

export interface CameraResponseArtifact {
  apertureDiameterMetres: number;
  exposureSeconds: number;
  readNoiseElectronsRms: number;
  darkCurrentElectronsPerSecond: number;
  saturationElectrons: number;
  pointSpreadFunctionArtifactId: string;
}

export interface CameraSignalExpectation {
  expectedPhotoelectrons: number;
  noiseVarianceElectronsSquared: number;
  saturated: boolean;
}

export function requireCameraResponse(
  provider: ProviderState<CameraResponseArtifact>,
): CameraResponseArtifact {
  const response = requireProviderValue(provider);
  for (const value of [
    response.apertureDiameterMetres,
    response.exposureSeconds,
    response.saturationElectrons,
  ]) {
    if (!(value > 0) || !Number.isFinite(value)) {
      throw new RangeError("Camera aperture, exposure and saturation must be positive.");
    }
  }
  if (!(response.readNoiseElectronsRms >= 0) || !(response.darkCurrentElectronsPerSecond >= 0)) {
    throw new RangeError("Camera noise parameters must be non-negative.");
  }
  return response;
}

export function expectedCameraSignal(
  spectralSamples: readonly CameraBandSample[],
  response: CameraResponseArtifact,
): CameraSignalExpectation {
  if (spectralSamples.length < 2) {
    throw new RangeError("Camera integration needs at least two spectral samples.");
  }
  const collectingAreaSquareMetres =
    Math.PI * (response.apertureDiameterMetres / 2) ** 2;
  let photonRatePerSquareMetrePerSecond = 0;
  for (let index = 1; index < spectralSamples.length; index += 1) {
    const left = spectralSamples[index - 1];
    const right = spectralSamples[index];
    if (
      !(right.wavelengthNanometres > left.wavelengthNanometres) ||
      !(left.photonFluxPerSquareMetrePerSecondPerNanometre >= 0) ||
      !(right.photonFluxPerSquareMetrePerSecondPerNanometre >= 0) ||
      !(left.quantumEfficiency >= 0 && left.quantumEfficiency <= 1) ||
      !(right.quantumEfficiency >= 0 && right.quantumEfficiency <= 1)
    ) {
      throw new RangeError("Camera spectral samples are invalid.");
    }
    const leftDetected = left.photonFluxPerSquareMetrePerSecondPerNanometre * left.quantumEfficiency;
    const rightDetected = right.photonFluxPerSquareMetrePerSecondPerNanometre * right.quantumEfficiency;
    photonRatePerSquareMetrePerSecond +=
      0.5 * (leftDetected + rightDetected) *
      (right.wavelengthNanometres - left.wavelengthNanometres);
  }
  const expectedPhotoelectrons =
    photonRatePerSquareMetrePerSecond * collectingAreaSquareMetres * response.exposureSeconds;
  const darkElectrons = response.darkCurrentElectronsPerSecond * response.exposureSeconds;
  const noiseVarianceElectronsSquared =
    expectedPhotoelectrons + darkElectrons + response.readNoiseElectronsRms ** 2;
  return {
    expectedPhotoelectrons,
    noiseVarianceElectronsSquared,
    saturated: expectedPhotoelectrons >= response.saturationElectrons,
  };
}

