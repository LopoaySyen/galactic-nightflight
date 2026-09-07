import test from 'node:test';
import assert from 'node:assert/strict';
import { flightPosition, flightCamera, smoothTravel } from '../lib/landing/flight-path.ts';
import { homeFeatures, homePhotos } from '../lib/landing/home-content.ts';

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const sub = (a, b) => a.map((value, i) => value - b[i]);

test('camera travel stays continuous through every path join in either direction', () => {
  let previous = flightPosition(0);
  for (let p = .001; p <= 3; p += .001) {
    const position = flightPosition(p);
    assert.ok(position[2] > previous[2]);
    assert.ok(Math.hypot(...sub(position, previous)) < .06);
    const camera = flightCamera(p, .2, -.15);
    for (const axis of [camera.forward, camera.right, camera.up]) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-10);
    assert.ok(Math.abs(dot(camera.forward, camera.up)) < 1e-10);
    assert.ok(Math.abs(dot(camera.right, camera.up)) < 1e-10);
    previous = position;
  }
  for (const join of [.75, 1.5, 2.25]) {
    const before = flightCamera(join - 1e-5), after = flightCamera(join + 1e-5);
    assert.ok(dot(before.forward, after.forward) > .999999);
  }
  assert.deepEqual(flightPosition(-1), flightPosition(0));
  assert.deepEqual(flightPosition(8), flightPosition(3));
});

test('persistent near and distant stars exhibit different perspective motion', () => {
  const a = flightCamera(.2), b = flightCamera(.23);
  const pointAlongView = distance => a.position.map((value, i) => value + a.forward[i] * distance + a.right[i] * 3);
  const projectedX = (point, camera) => dot(sub(point, camera.position), camera.right) / dot(sub(point, camera.position), camera.forward);
  const near = pointAlongView(7), far = pointAlongView(100);
  const motion = point => Math.abs(projectedX(point, b) - projectedX(point, a));
  assert.ok(motion(near) > motion(far) * 2);
});

test('scroll damping reaches the same position at different frame rates without overshooting', () => {
  const advance = fps => { let progress = 0; for (let i = 0; i < fps; i++) progress = smoothTravel(progress, 3, 1 / fps); return progress; };
  assert.ok(Math.abs(advance(30) - advance(144)) < 1e-10);
  assert.ok(advance(60) > 2.99 && advance(60) < 3);
  assert.ok(smoothTravel(3, 0, .05) > 0 && smoothTravel(3, 0, .05) < 3);
});

test('every feature uses a distinct photograph with a source credit', () => {
  const photos = homeFeatures.map(feature => homePhotos[feature.photo]);
  assert.equal(new Set(photos.map(photo => photo.image)).size, homeFeatures.length);
  for (const photo of photos) { assert.ok(photo.credit); assert.match(photo.source, /^https:\/\//); }
});
