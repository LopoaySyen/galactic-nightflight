import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { sampleGalacticStellarAndDustField } from '../lib/rendering/galaxy-radiance.ts';
import { GALAXY_FIELD_CACHE as config } from '../lib/rendering/galaxy-field-cache.ts';

// Product asset generation, independent of observer positions and display modes.
const data = new Uint8Array(config.width * config.height * 4);
const keys = ['thinDiscEmissivity', 'thickDiscEmissivity', 'barBulgeEmissivity', 'dustRelativeDensity'];
const maxima = [0, 0, 0, 0];
for (let layer = 0; layer < config.depth; layer++) {
  const nz = layer / (config.depth - 1) * 2 - 1;
  const z = Math.sign(nz) * config.zScale * Math.expm1(Math.abs(nz) * config.zLog);
  const tileX = layer % config.columns * config.size;
  const tileY = Math.floor(layer / config.columns) * config.size;
  for (let y = 0; y < config.size; y++) {
    const py = (y / (config.size - 1) * 2 - 1) * config.extent;
    for (let x = 0; x < config.size; x++) {
      const px = (x / (config.size - 1) * 2 - 1) * config.extent;
      const field = sampleGalacticStellarAndDustField({ x: px, y: py, z });
      const offset = ((tileY + y) * config.width + tileX + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const value = field[keys[channel]];
        maxima[channel] = Math.max(maxima[channel], value);
        const encoded = Math.log1p(value / config.valueScales[channel]) / config.logRanges[channel];
        if (encoded > 1 + 1e-10) throw new Error(`Channel ${keys[channel]} exceeds its encoding range: ${value}`);
        data[offset + channel] = Math.round(encoded * 255);
      }
    }
  }
  if (layer % 8 === 0) console.log(`Galactic volume: ${layer + 1}/${config.depth} layers`);
}
const compressed = gzipSync(data, { level: 9 });
await writeFile(new URL('../public/data/galaxy-field-v1.bin.gz', import.meta.url), compressed);
console.log(JSON.stringify({ rawBytes: data.byteLength, compressedBytes: compressed.byteLength, maxima }));
