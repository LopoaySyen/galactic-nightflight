import assert from 'node:assert/strict';
import test from 'node:test';
import { integrateGalaxyRadiance } from '../lib/rendering/galaxy-radiance.ts';

const nucleusOnly = emissivity => position => ({
  thinDiscEmissivity: 0, thickDiscEmissivity: 0, barBulgeEmissivity: 0,
  nuclearEmissivity: emissivity(position), dustRelativeDensity: 0,
});

test('a compact emitting core keeps its analytic brightness while approaching and turning', () => {
  const sigma = 7.5;
  const field = nucleusOnly(p => Math.exp(-(p.x * p.x + p.y * p.y + p.z * p.z) / (2 * sigma * sigma)));
  for (const distance of [100, 166, 300, 1000, 8277]) {
    // Include the old vertical-grid transition and both sides of the midplane.
    for (const impact of [-12, -7.5, -3, 0, 3, 7.5, 12]) {
      const dz = impact / distance;
      const direction = { x: Math.sqrt(1 - dz * dz), y: 0, z: dz };
      const actual = integrateGalaxyRadiance({ x: -distance, y: 0, z: 0 }, direction, 'camera', field);
      const expected = Math.sqrt(2 * Math.PI) * sigma * Math.exp(-impact * impact / (2 * sigma * sigma));
      assert.ok(Math.abs(actual.green / 0.98 / expected - 1) < 0.015,
        `Core brightness at ${distance} pc, impact ${impact} pc: ${actual.green / 0.98} vs ${expected}`);
    }
  }
});

test('the actual nuclear cluster has no false off-centre brightness bands', () => {
  const field = nucleusOnly(p => 1100 / (1 + (p.x * p.x + p.y * p.y + p.z * p.z) / 56.25) ** 1.35);
  for (const distance of [100, 166, 300, 1000]) {
    let previous = Infinity;
    for (let angle = 0; angle <= 4; angle += 0.25) {
      const radians = angle * Math.PI / 180;
      const direction = { x: Math.cos(radians), y: 0, z: Math.sin(radians) };
      const signal = integrateGalaxyRadiance({ x: -distance, y: 0, z: 0 }, direction, 'camera', field).green;
      assert.ok(signal < previous * 1.005, `False bright band at ${distance} pc, ${angle} degrees`);
      previous = signal;
    }
  }
});
