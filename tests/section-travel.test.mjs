import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionTravel, travelSpeed } from '../lib/landing/section-travel.ts';

test('navigation and scrolling use measured section positions, including unequal mobile heights', () => {
  const stops = [0, 800, 2100, 3200];
  assert.deepEqual(sectionTravel(-40, stops), { progress: 0, active: 0 });
  stops.forEach((position, index) => assert.deepEqual(sectionTravel(position, stops), { progress: index, active: index }));
  assert.deepEqual(sectionTravel(1450, stops), { progress: 1.5, active: 2 });
  assert.deepEqual(sectionTravel(9000, stops), { progress: 3, active: 3 });
  for (let y = 3199; y > 0; y -= 13) assert.ok(sectionTravel(y, stops).progress >= sectionTravel(y - 13, stops).progress);
});

test('travel responds to either scroll direction and stays bounded on distant navigation jumps', () => {
  assert.equal(travelSpeed(.02, 1 / 60), travelSpeed(-.02, 1 / 60));
  assert.ok(travelSpeed(.02, 1 / 60) > travelSpeed(0, 1 / 60));
  assert.equal(travelSpeed(3, 0), 30.35);
  assert.deepEqual(sectionTravel(NaN, []), { progress: 0, active: 0 });
});
