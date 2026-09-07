import type { PointSourceSample } from "./contracts.ts";

const HEADER_BYTES = 16;
const EXPECTED_MAGIC = "G3B6D001";

export function parseGaiaBrightStarCatalog(buffer: ArrayBuffer): PointSourceSample[] {
  if (buffer.byteLength < HEADER_BYTES) throw new RangeError("Gaia catalogue header is missing.");
  const bytes = new Uint8Array(buffer, 0, 8);
  const magic = String.fromCharCode(...bytes);
  if (magic !== EXPECTED_MAGIC) throw new RangeError("Gaia catalogue magic is invalid.");
  const view = new DataView(buffer);
  const sourceCount = view.getUint32(8, true);
  const floatsPerSource = view.getUint32(12, true);
  if (floatsPerSource !== 9) throw new RangeError("Gaia catalogue record layout is unsupported.");
  const expectedBytes = HEADER_BYTES + sourceCount * floatsPerSource * 4;
  if (buffer.byteLength !== expectedBytes) throw new RangeError("Gaia catalogue byte length is invalid.");

  const stars: PointSourceSample[] = [];
  let byteOffset = HEADER_BYTES;
  for (let index = 0; index < sourceCount; index += 1) {
    const values = Array.from({ length: floatsPerSource }, () => {
      const value = view.getFloat32(byteOffset, true);
      byteOffset += 4;
      return value;
    });
    if (!values.every(Number.isFinite)) continue;
    const distanceParsec = Math.hypot(values[0] + 8277, values[1], values[2]);
    if (!(distanceParsec > 0)) continue;
    stars.push({
      id: `gaia-dr3-bright-${index + 1}`,
      positionParsec: { x: values[0], y: values[1], z: values[2] },
      velocityKilometresPerSecond: { x: values[3], y: values[4], z: values[5] },
      absoluteVisualMagnitude: values[6],
      effectiveTemperatureKelvin: values[7],
      referenceVisualExtinctionMagnitude: values[8],
      role: "observed-bright-star",
      sourceCatalog: "Gaia Data Release 3 bright six-dimensional sample",
      observedData: {
        catalog: "gaia-dr3",
        referenceDistanceParsec: distanceParsec,
        referenceApparentMagnitude: values[6] + 5 * Math.log10(distanceParsec / 10),
        temperatureMethod: "catalogue-or-colour",
        measuredVelocity: true,
      },
    });
  }
  return stars;
}
