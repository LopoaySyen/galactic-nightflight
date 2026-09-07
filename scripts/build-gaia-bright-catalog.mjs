import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { integrateVisualExtinctionMagnitude } from "../lib/rendering/galaxy-radiance.ts";

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "public/data/gaia-dr3-bright-6d.bin";
const manifestPath = process.argv[4] ?? "public/data/gaia-dr3-bright-6d-source.json";

if (!inputPath) {
  throw new Error("Usage: node scripts/build-gaia-bright-catalog.mjs <input.csv> [output.bin] [manifest.json]");
}

const SOLAR_POSITION_PARSEC = { x: -8_277, y: 0, z: 0 };
const SOLAR_VELOCITY_KILOMETRES_PER_SECOND = { x: 11.1, y: 244.24, z: 7.25 };
const EQUATORIAL_TO_GALACTIC = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];
const FLOATS_PER_SOURCE = 9;
const HEADER_BYTES = 16;

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

function rotateEquatorialVectorToGalactic(vector) {
  return {
    x: EQUATORIAL_TO_GALACTIC[0][0] * vector.x + EQUATORIAL_TO_GALACTIC[0][1] * vector.y + EQUATORIAL_TO_GALACTIC[0][2] * vector.z,
    y: EQUATORIAL_TO_GALACTIC[1][0] * vector.x + EQUATORIAL_TO_GALACTIC[1][1] * vector.y + EQUATORIAL_TO_GALACTIC[1][2] * vector.z,
    z: EQUATORIAL_TO_GALACTIC[2][0] * vector.x + EQUATORIAL_TO_GALACTIC[2][1] * vector.y + EQUATORIAL_TO_GALACTIC[2][2] * vector.z,
  };
}

function temperatureFromGaiaColour(blueMinusRedMagnitude) {
  const approximateBlueMinusVisualMagnitude =
    0.78 * clamp(blueMinusRedMagnitude, -0.55, 4.2) - 0.02;
  return clamp(
    4_600 *
      (1 / (0.92 * approximateBlueMinusVisualMagnitude + 1.7) +
        1 / (0.92 * approximateBlueMinusVisualMagnitude + 0.62)),
    2_300,
    40_000,
  );
}

const commaSeparatedValues = await readFile(inputPath, "utf8");
const rows = commaSeparatedValues.trim().split(/\r?\n/);
const records = [];

for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
  const columns = rows[rowIndex].split(",").map(Number);
  if (columns.length < 11 || columns.some((value, index) => index < 10 && !Number.isFinite(value))) {
    continue;
  }
  const [
    rightAscensionDegrees,
    declinationDegrees,
    galacticLongitudeDegrees,
    galacticLatitudeDegrees,
    parallaxMilliarcseconds,
    properMotionRightAscensionMilliarcsecondsPerYear,
    properMotionDeclinationMilliarcsecondsPerYear,
    radialVelocityKilometresPerSecond,
    apparentGaiaMagnitude,
    blueMinusRedMagnitude,
    catalogTemperatureKelvin,
  ] = columns;
  const distanceParsec = 1_000 / parallaxMilliarcseconds;
  if (!(distanceParsec > 0) || distanceParsec > 20_000) continue;

  const longitudeRadians = (galacticLongitudeDegrees * Math.PI) / 180;
  const latitudeRadians = (galacticLatitudeDegrees * Math.PI) / 180;
  const cosineLatitude = Math.cos(latitudeRadians);
  const positionParsec = {
    x: SOLAR_POSITION_PARSEC.x + distanceParsec * cosineLatitude * Math.cos(longitudeRadians),
    y: SOLAR_POSITION_PARSEC.y + distanceParsec * cosineLatitude * Math.sin(longitudeRadians),
    z: distanceParsec * Math.sin(latitudeRadians),
  };

  const rightAscensionRadians = (rightAscensionDegrees * Math.PI) / 180;
  const declinationRadians = (declinationDegrees * Math.PI) / 180;
  const cosineDeclination = Math.cos(declinationRadians);
  const sineDeclination = Math.sin(declinationRadians);
  const cosineRightAscension = Math.cos(rightAscensionRadians);
  const sineRightAscension = Math.sin(rightAscensionRadians);
  const radialBasis = {
    x: cosineDeclination * cosineRightAscension,
    y: cosineDeclination * sineRightAscension,
    z: sineDeclination,
  };
  const rightAscensionBasis = {
    x: -sineRightAscension,
    y: cosineRightAscension,
    z: 0,
  };
  const declinationBasis = {
    x: -sineDeclination * cosineRightAscension,
    y: -sineDeclination * sineRightAscension,
    z: cosineDeclination,
  };
  const tangentialVelocityScale = 0.00474047 * distanceParsec;
  const heliocentricEquatorialVelocity = {
    x:
      radialVelocityKilometresPerSecond * radialBasis.x +
      tangentialVelocityScale *
        (properMotionRightAscensionMilliarcsecondsPerYear * rightAscensionBasis.x +
          properMotionDeclinationMilliarcsecondsPerYear * declinationBasis.x),
    y:
      radialVelocityKilometresPerSecond * radialBasis.y +
      tangentialVelocityScale *
        (properMotionRightAscensionMilliarcsecondsPerYear * rightAscensionBasis.y +
          properMotionDeclinationMilliarcsecondsPerYear * declinationBasis.y),
    z:
      radialVelocityKilometresPerSecond * radialBasis.z +
      tangentialVelocityScale *
        (properMotionRightAscensionMilliarcsecondsPerYear * rightAscensionBasis.z +
          properMotionDeclinationMilliarcsecondsPerYear * declinationBasis.z),
  };
  const heliocentricGalacticVelocity = rotateEquatorialVectorToGalactic(
    heliocentricEquatorialVelocity,
  );
  const velocityKilometresPerSecond = {
    x: heliocentricGalacticVelocity.x + SOLAR_VELOCITY_KILOMETRES_PER_SECOND.x,
    y: heliocentricGalacticVelocity.y + SOLAR_VELOCITY_KILOMETRES_PER_SECOND.y,
    z: heliocentricGalacticVelocity.z + SOLAR_VELOCITY_KILOMETRES_PER_SECOND.z,
  };
  const absoluteGaiaMagnitude =
    apparentGaiaMagnitude - 5 * Math.log10(distanceParsec / 10);
  const effectiveTemperatureKelvin = Number.isFinite(catalogTemperatureKelvin)
    ? clamp(catalogTemperatureKelvin, 2_300, 40_000)
    : temperatureFromGaiaColour(blueMinusRedMagnitude);
  const referenceVisualExtinctionMagnitude = integrateVisualExtinctionMagnitude(
    SOLAR_POSITION_PARSEC,
    positionParsec,
    distanceParsec < 800 ? 8 : 12,
  );
  records.push([
    positionParsec.x,
    positionParsec.y,
    positionParsec.z,
    velocityKilometresPerSecond.x,
    velocityKilometresPerSecond.y,
    velocityKilometresPerSecond.z,
    absoluteGaiaMagnitude,
    effectiveTemperatureKelvin,
    referenceVisualExtinctionMagnitude,
  ]);
}

const output = Buffer.allocUnsafe(HEADER_BYTES + records.length * FLOATS_PER_SOURCE * 4);
output.write("G3B6D001", 0, "ascii");
output.writeUInt32LE(records.length, 8);
output.writeUInt32LE(FLOATS_PER_SOURCE, 12);
let byteOffset = HEADER_BYTES;
for (const record of records) {
  for (const value of record) {
    output.writeFloatLE(value, byteOffset);
    byteOffset += 4;
  }
}
await writeFile(outputPath, output);

const query = await readFile(new URL("./gaia-dr3-bright-6d.adql", import.meta.url), "utf8");
const manifest = {
  title: "Gaia 第三批数据发布明亮恒星六维样本",
  release: "Gaia Data Release 3",
  sourcePage: "https://www.cosmos.esa.int/web/gaia/dr3",
  archiveEndpoint: "https://gea.esac.esa.int/tap-server/tap/sync",
  retrievalQuery: query.trim(),
  selection: {
    magnitudeRange: "Gaia G 波段 6.5 至 8.5 星等",
    parallaxSignalToNoiseMinimum: 5,
    renormalisedUnitWeightErrorMaximum: 1.4,
    requiresRadialVelocity: true,
  },
  sourceCount: records.length,
  recordLayout: [
    "银河中心横向位置（秒差距）",
    "银河中心纵向位置（秒差距）",
    "银河盘垂直位置（秒差距）",
    "横向速度（千米每秒）",
    "纵向速度（千米每秒）",
    "垂直速度（千米每秒）",
    "Gaia G 波段绝对星等",
    "有效温度（开尔文）",
    "太阳视点模型消光（星等）"
  ],
  sha256: createHash("sha256").update(output).digest("hex"),
  limitations: [
    "这是浏览器实时渲染使用的明亮、完整六维子样本，不是约十太字节的完整 Gaia 数据发布。",
    "Gaia 对最亮恒星存在饱和与缺失，因此 6.5 星等以内继续由耶鲁亮星表补足。",
    "没有发布有效温度的恒星使用 Gaia 蓝减红颜色近似温度；该值只用于显示颜色。"
  ]
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ sourceCount: records.length, bytes: output.length, sha256: manifest.sha256 }));
