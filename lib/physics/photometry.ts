export function apparentMagnitude(
  absoluteMagnitude: number,
  distanceParsec: number,
  dustExtinctionMagnitude: number,
): number {
  if (!(distanceParsec > 0) || !Number.isFinite(distanceParsec)) {
    throw new RangeError("Star-observer distance must be finite and greater than zero.");
  }
  if (!(dustExtinctionMagnitude >= 0) || !Number.isFinite(dustExtinctionMagnitude)) {
    throw new RangeError("Dust extinction in magnitudes must be finite and non-negative.");
  }
  return (
    absoluteMagnitude +
    5 * Math.log10(distanceParsec / 10) +
    dustExtinctionMagnitude
  );
}

export function fluxRatioFromMagnitudeDifference(
  magnitudeDifference: number,
): number {
  return 10 ** (-0.4 * magnitudeDifference);
}

export function receivedFluxWattsPerSquareMetre(
  luminosityWatts: number,
  distanceMetres: number,
): number {
  if (!(luminosityWatts >= 0) || !Number.isFinite(luminosityWatts)) {
    throw new RangeError("Luminosity must be finite and non-negative.");
  }
  if (!(distanceMetres > 0) || !Number.isFinite(distanceMetres)) {
    throw new RangeError("Distance must be finite and greater than zero.");
  }
  return luminosityWatts / (4 * Math.PI * distanceMetres * distanceMetres);
}

