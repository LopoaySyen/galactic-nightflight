import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { GALAXY_FIELD_CACHE as config, createGalacticFieldCache } from '../lib/rendering/galaxy-field-cache.ts';
import { sampleGalacticStellarAndDustField, sampleGalacticDustDensity, integrateGalaxyRadiance } from '../lib/rendering/galaxy-radiance.ts';

const bytes = gunzipSync(await readFile(new URL('../public/data/galaxy-field-v1.bin.gz', import.meta.url)));
const cache = createGalacticFieldCache(bytes);
const channels = ['thinDiscEmissivity', 'thickDiscEmissivity', 'barBulgeEmissivity', 'dustRelativeDensity'];
const hybrid = position => {
  const field = cache.sampleStellar(position);
  field.dustRelativeDensity = sampleGalacticDustDensity(position);
  return field;
};

test('cache loading accepts browser-decoded gzip and application/gzip hosting', async (context) => {
  const compressed = await readFile(new URL('../public/data/galaxy-field-v1.bin.gz', import.meta.url));
  for (const [variant, body] of [['decoded', bytes], ['compressed', compressed]]) {
    context.mock.method(globalThis, 'fetch', async () => new Response(body));
    const loader = await import(`../lib/rendering/galaxy-field-cache.ts?hosting=${variant}`);
    const loaded = await loader.loadGalacticFieldCache();
    assert.equal(loaded.data.byteLength, bytes.byteLength);
    assert.deepEqual(loaded.sample({ x: -8277, y: 0, z: 0 }), cache.sample({ x: -8277, y: 0, z: 0 }));
    context.mock.restoreAll();
  }
});

test('the shipped cache has its declared dimensions and finite samples on the integration boundary', () => {
  assert.equal(bytes.length, config.width * config.height * 4);
  assert.throws(() => createGalacticFieldCache(bytes.subarray(4)), /unexpected size/);
  for (const position of [{ x: 24000, y: 0, z: 0 }, { x: -24000, y: 0, z: 0 },
    { x: 0, y: 24000, z: 0 }, { x: 0, y: -24000, z: 0 },
    { x: 0, y: 0, z: 8000 }, { x: 0, y: 0, z: -8000 }]) {
    assert.ok(Object.values(cache.sample(position)).every(value => Number.isFinite(value) && value >= 0));
  }
  for (const position of [{ x: 24001, y: 0, z: 0 }, { x: 0, y: 0, z: 8001 }]) {
    assert.ok(Object.values(cache.sample(position)).every(value => value === 0));
  }
});

test('the nuclear light remains analytic below the cache cell size', () => {
  for (const position of [{ x: 0, y: 0, z: 0 }, { x: 0.01, y: 0, z: 0 },
    { x: 7.5, y: 0, z: 0 }, { x: 40, y: -23, z: 3 }, { x: -166, y: 1.5, z: 0 }]) {
    assert.equal(cache.sample(position).nuclearEmissivity, sampleGalacticStellarAndDustField(position).nuclearEmissivity);
  }
  assert.ok(cache.sample({ x: 0, y: 0, z: 0 }).nuclearEmissivity > 2 * cache.sample({ x: 7.5, y: 0, z: 0 }).nuclearEmissivity);
});

test('moving across horizontal cells and atlas-row slice boundaries does not pop', () => {
  const cellX = (137 / (config.size - 1) * 2 - 1) * config.extent;
  const normalizedZ = 32 / (config.depth - 1) * 2 - 1;
  const layerZ = config.zScale * Math.expm1(normalizedZ * config.zLog);
  for (const [axis, point] of [['x', { x: cellX, y: 117, z: 29 }],
    ['z', { x: -8277, y: 12, z: layerZ }], ['z', { x: -3500, y: 13, z: 0 }]]) {
    const before = cache.sample({ ...point, [axis]: point[axis] - 0.0001 });
    const after = cache.sample({ ...point, [axis]: point[axis] + 0.0001 });
    for (const channel of channels) assert.ok(Math.abs(before[channel] - after[channel]) < 0.0001, channel);
  }
});

test('cached large-scale emissivity stays close to the analytic Galactic field', () => {
  const absolute = [0, 0, 0, 0], reference = [0, 0, 0, 0];
  for (const radius of [300, 1000, 3500, 8277, 12000, 16000]) {
    for (const azimuth of [0, 0.37, 1.3, 2.5, 3.2, 4.5, 5.7]) {
      for (const z of [0, 23, 106, 333, 1100, 3000]) {
        const position = { x: Math.cos(azimuth) * radius, y: Math.sin(azimuth) * radius, z };
        const exact = sampleGalacticStellarAndDustField(position), cached = cache.sample(position);
        for (let i = 0; i < channels.length; i++) {
          absolute[i] += Math.abs(exact[channels[i]] - cached[channels[i]]);
          reference[i] += exact[channels[i]];
        }
      }
    }
  }
  // Small dust clouds are deliberately recovered by settled refinement. Their
  // density error is not a claim about the final, integrated image error.
  for (let i = 0; i < channels.length; i++) {
    assert.ok(absolute[i] / reference[i] < [0.02, 0.01, 0.015, 0.20][i], channels[i]);
  }
});

test('moving and refined radiance agree with the reference at representative observer positions', () => {
  const positions = [
    { x: -8277, y: 0, z: 0 }, { x: -8277, y: 0, z: 3000 }, { x: -8277, y: 0, z: -3000 },
    { x: -3500, y: 0, z: 0 }, { x: -16000, y: 0, z: 0 }, { x: -166, y: 1.5, z: 0 }, { x: 0, y: 0, z: 0 },
  ];
  for (const mode of ['camera', 'near-infrared']) for (const position of positions) {
    let denominator = 0, movingError = 0, refinedError = 0;
    for (let azimuth = 0; azimuth < 12; azimuth++) for (const elevation of [-0.45, 0, 0.45]) {
      const angle = azimuth / 12 * Math.PI * 2;
      const direction = { x: Math.cos(angle) * Math.cos(elevation), y: Math.sin(angle) * Math.cos(elevation), z: Math.sin(elevation) };
      const exact = integrateGalaxyRadiance(position, direction, mode);
      const moving = integrateGalaxyRadiance(position, direction, mode, cache.sample);
      const refined = integrateGalaxyRadiance(position, direction, mode, hybrid);
      for (const channel of ['red', 'green', 'blue']) {
        denominator += exact[channel];
        movingError += Math.abs(moving[channel] - exact[channel]);
        refinedError += Math.abs(refined[channel] - exact[channel]);
      }
    }
    const context = `${mode} ${JSON.stringify(position)}`;
    assert.ok(movingError / denominator < 0.075, `moving integral changed: ${context}`);
    assert.ok(refinedError / denominator < 0.01, `refinement lost precision: ${context}`);
    // In weakly attenuated infrared rays, unrelated interpolation errors may
    // cancel in the moving result. Require absolute accuracy, not an artificial
    // guarantee that every subset becomes closer after restoring exact dust.
    if (mode === 'camera') assert.ok(refinedError < movingError, `refinement must improve the cached integral: ${context}`);
  }
});

test('disc-aware ray spacing integrates a thin emitting layer without missing or overshooting it', () => {
  // This has an independent analytic integral. A fixed distance grid can miss
  // the 100 pc layer when viewed from 3000 pc above it, producing visible rings.
  const height = 100;
  const field = position => ({ thinDiscEmissivity: Math.exp(-Math.abs(position.z) / height),
    thickDiscEmissivity: 0, barBulgeEmissivity: 0, nuclearEmissivity: 0, dustRelativeDensity: 0 });
  const primitive = z => -height * Math.sign(z) * Math.expm1(-Math.abs(z) / height);
  const paths = [[3000, -1], [3000, -0.75], [3000, -0.4], [1000, -0.4],
    [300, -0.03], [300, -0.02], [300, -0.015], [-3000, 1], [-3000, 0.4], [-300, 0.02], [0, 0], [300, 0]];
  for (const [z, dz] of paths) {
    const observer = { x: -8277, y: 0, z };
    const direction = { x: Math.sqrt(1 - dz * dz), y: 0, z: dz };
    const exact = dz === 0 ? 32000 * Math.exp(-Math.abs(z) / height)
      : (primitive(z + 32000 * dz) - primitive(z)) / dz;
    const radiance = integrateGalaxyRadiance(observer, direction, 'camera', field);
    for (const [channel, spectrum] of [['red', 0.82], ['green', 0.98], ['blue', 1.2]]) {
      assert.ok(Math.abs(radiance[channel] / spectrum - exact) / exact < 0.004,
        `thin layer integration ${channel}: start ${z} pc, direction z=${dz}`);
    }
    assert.equal(radiance.visualExtinctionMagnitude, 0);
  }
});
