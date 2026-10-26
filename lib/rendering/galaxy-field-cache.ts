import type { Vector3 } from "../physics/vector.ts";
import { BAR_ANGLE_RADIANS, type GalacticFieldSample } from "./galaxy-radiance.ts";

/** A position-independent cache of the existing phenomenological Galactic model.
 * RGB hold thin-disc, thick-disc and bar emissivity; A holds dust density.
 * The compact nuclear component remains analytic, so its 7.5 pc core never
 * gets spread over a roughly 125 pc horizontal cache cell. */
export const GALAXY_FIELD_CACHE = {
  size: 384,
  depth: 49,
  columns: 8,
  width: 3072,
  height: 2688,
  extent: 24000,
  zExtent: 8000,
  zScale: 60,
  zLog: Math.log1p(8000 / 60),
  valueScales: [0.02, 0.002, 0.01, 0.02],
  logRanges: [Math.log1p(16 / 0.02), Math.log1p(1 / 0.002), Math.log1p(7 / 0.01), Math.log1p(28 / 0.02)],
  path: "/data/galaxy-field-v1.bin.gz",
} as const;

export interface GalacticFieldCache {
  data: Uint8Array;
  width: number;
  height: number;
  sample(position: Vector3): GalacticFieldSample;
  sampleStellar(position: Vector3): GalacticFieldSample;
}

export function cachedNuclearEmissivity(position: Vector3, radius = Math.hypot(position.x, position.y)): number {
  const sphericalRadius = Math.hypot(radius, position.z);
  return 54 * Math.exp(-radius / 210) * Math.exp(-Math.abs(position.z) / 43)
    + 1100 / (1 + (sphericalRadius / 7.5) ** 2) ** 1.35;
}

/** Layout is shared with the GPU. Interpolate encoded values before decoding;
 * this keeps densities positive and makes linear texture filtering equivalent. */
export function createGalacticFieldCache(data: Uint8Array): GalacticFieldCache {
  const config = GALAXY_FIELD_CACHE;
  if (data.byteLength !== config.width * config.height * 4) {
    throw new Error("The Galactic field cache has an unexpected size.");
  }
  const stride = config.width * 4;
  let stellarPlane: Float32Array | undefined;
  // The smooth stellar disc separates into a horizontal coefficient and an
  // analytic height profile. Decode that one plane lazily for CPU refinement:
  // 1.69 MiB avoids repeated log/exp decoding of the full volume on every ray.
  const prepareStellarPlane = () => {
    if (stellarPlane) return stellarPlane;
    stellarPlane = new Float32Array(config.size * config.size * 3);
    const layer = (config.depth - 1) / 2;
    const tileX = layer % config.columns * config.size;
    const tileY = Math.floor(layer / config.columns) * config.size;
    const decode = config.logRanges.map((range, c) => Float64Array.from({ length: 256 }, (_, v) => Math.expm1(v / 255 * range) * config.valueScales[c]));
    for (let y = 0; y < config.size; y++) for (let x = 0; x < config.size; x++) {
      const source = ((tileY + y) * config.width + tileX + x) * 4;
      const target = (y * config.size + x) * 3;
      for (let c = 0; c < 3; c++) stellarPlane[target + c] = decode[c][data[source + c]];
    }
    return stellarPlane;
  };
  const cosBar = Math.cos(BAR_ANGLE_RADIANS), sinBar = Math.sin(BAR_ANGLE_RADIANS);
  return {
    data,
    width: config.width,
    height: config.height,
    sample(position) {
      if (position.x * position.x + position.y * position.y > config.extent * config.extent || Math.abs(position.z) > config.zExtent) {
        return { thinDiscEmissivity: 0, thickDiscEmissivity: 0, barBulgeEmissivity: 0, nuclearEmissivity: 0, dustRelativeDensity: 0 };
      }
      const gx = (position.x / config.extent + 1) * 0.5 * (config.size - 1);
      const gy = (position.y / config.extent + 1) * 0.5 * (config.size - 1);
      const gz = (Math.sign(position.z) * Math.log1p(Math.abs(position.z) / config.zScale) / config.zLog + 1) * 0.5 * (config.depth - 1);
      const x0 = Math.min(config.size - 2, Math.floor(gx));
      const y0 = Math.min(config.size - 2, Math.floor(gy));
      const z0 = Math.min(config.depth - 2, Math.floor(gz));
      const tx = gx - x0, ty = gy - y0, tz = gz - z0;
      const sliceOffset = (z: number) => ((Math.floor(z / config.columns) * config.size + y0) * config.width
        + (z % config.columns) * config.size + x0) * 4;
      const low = sliceOffset(z0), high = sliceOffset(z0 + 1);
      const channel = (c: number) => {
        const a = data[low + c] * (1 - tx) + data[low + 4 + c] * tx;
        const b = data[low + stride + c] * (1 - tx) + data[low + stride + 4 + c] * tx;
        const d = data[high + c] * (1 - tx) + data[high + 4 + c] * tx;
        const e = data[high + stride + c] * (1 - tx) + data[high + stride + 4 + c] * tx;
        const encoded = ((a * (1 - ty) + b * ty) * (1 - tz) + (d * (1 - ty) + e * ty) * tz) / 255;
        return Math.expm1(encoded * config.logRanges[c]) * config.valueScales[c];
      };
      return {
        thinDiscEmissivity: channel(0),
        thickDiscEmissivity: channel(1),
        barBulgeEmissivity: channel(2),
        nuclearEmissivity: cachedNuclearEmissivity(position),
        dustRelativeDensity: channel(3),
      };
    },
    sampleStellar(position) {
      const radius = Math.hypot(position.x, position.y);
      const z = Math.abs(position.z);
      if (radius > config.extent || z > config.zExtent) {
        return { thinDiscEmissivity: 0, thickDiscEmissivity: 0, barBulgeEmissivity: 0, nuclearEmissivity: 0, dustRelativeDensity: 0 };
      }
      const plane = prepareStellarPlane();
      const gx = (position.x / config.extent + 1) * 0.5 * (config.size - 1);
      const gy = (position.y / config.extent + 1) * 0.5 * (config.size - 1);
      const x = Math.min(config.size - 2, Math.floor(gx)), y = Math.min(config.size - 2, Math.floor(gy));
      const tx = gx - x, ty = gy - y;
      const offset = (y * config.size + x) * 3, row = config.size * 3;
      const channel = (c: number) => (plane[offset + c] * (1 - tx) + plane[offset + 3 + c] * tx) * (1 - ty)
        + (plane[offset + row + c] * (1 - tx) + plane[offset + row + 3 + c] * tx) * ty;
      let bar = channel(2);
      if (bar > 0 && z !== 0) {
        const xBar = position.x * cosBar + position.y * sinBar;
        const yBar = -position.x * sinBar + position.y * cosBar;
        const horizontalBar = (xBar / 2450) ** 4 + (yBar / 760) ** 4;
        bar *= Math.exp(horizontalBar ** 0.25 - (horizontalBar + (z / 520) ** 4) ** 0.25);
      }
      return {
        thinDiscEmissivity: channel(0) * Math.exp(-z / 300),
        thickDiscEmissivity: channel(1) * Math.exp(-z / 900),
        barBulgeEmissivity: bar,
        nuclearEmissivity: cachedNuclearEmissivity(position, radius),
        dustRelativeDensity: 0,
      };
    },
  };
}

let loading: Promise<GalacticFieldCache> | undefined;

/** The URL is versioned and can use the ordinary browser HTTP cache. The same
 * decoded volume serves every observer position, mode and viewing direction. */
export function loadGalacticFieldCache(): Promise<GalacticFieldCache> {
  if (!loading) {
    loading = (async () => {
      const response = await fetch(GALAXY_FIELD_CACHE.path, { cache: "force-cache" });
      if (!response.ok || !response.body) throw new Error("The Galactic field cache could not be loaded.");
      let bytes = new Uint8Array(await response.arrayBuffer());
      // Vite serves .gz with Content-Encoding:gzip, which fetch already decodes.
      // Static hosts may serve the same asset as application/gzip instead.
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        bytes = new Uint8Array(await new Response(new Response(bytes).body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
      }
      return createGalacticFieldCache(bytes);
    })().catch(error => { loading = undefined; throw error; });
  }
  return loading;
}
