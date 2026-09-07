const PLANCK_CONSTANT_JOULE_SECONDS = 6.62607015e-34;
const LIGHT_SPEED_METRES_PER_SECOND = 299_792_458;
const BOLTZMANN_CONSTANT_JOULES_PER_KELVIN = 1.380649e-23;

export function planckSpectralRadiance(
  wavelengthMetres: number,
  temperatureKelvin: number,
): number {
  if (!(wavelengthMetres > 0) || !(temperatureKelvin > 0)) {
    throw new RangeError("Wavelength and temperature must be positive.");
  }
  const exponent =
    (PLANCK_CONSTANT_JOULE_SECONDS * LIGHT_SPEED_METRES_PER_SECOND) /
    (wavelengthMetres * BOLTZMANN_CONSTANT_JOULES_PER_KELVIN * temperatureKelvin);
  return (
    (2 * PLANCK_CONSTANT_JOULE_SECONDS * LIGHT_SPEED_METRES_PER_SECOND ** 2) /
    (wavelengthMetres ** 5 * Math.expm1(exponent))
  );
}

const gaussian = (value: number, centre: number, width: number) =>
  Math.exp(-0.5 * ((value - centre) / width) ** 2);

const benchmarkColourCache = new Map<
  number,
  readonly [number, number, number]
>();

export function benchmarkLinearRgbFromTemperature(
  temperatureKelvin: number,
): readonly [number, number, number] {
  if (!(temperatureKelvin >= 2_000) || !(temperatureKelvin <= 50_000)) {
    throw new RangeError("Benchmark temperature must be between 2,000 K and 50,000 K.");
  }
  const cached = benchmarkColourCache.get(temperatureKelvin);
  if (cached) return cached;

  let red = 0;
  let green = 0;
  let blue = 0;
  for (let wavelengthNanometres = 390; wavelengthNanometres <= 710; wavelengthNanometres += 10) {
    const radiance = planckSpectralRadiance(
      wavelengthNanometres * 1e-9,
      temperatureKelvin,
    );
    red += radiance * gaussian(wavelengthNanometres, 610, 48);
    green += radiance * gaussian(wavelengthNanometres, 545, 38);
    blue += radiance * gaussian(wavelengthNanometres, 455, 34);
  }
  const maximum = Math.max(red, green, blue);
  const colour = [red / maximum, green / maximum, blue / maximum] as const;
  benchmarkColourCache.set(temperatureKelvin, colour);
  return colour;
}
