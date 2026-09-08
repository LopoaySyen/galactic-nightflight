import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { soundtracks, SoundtrackSequence, soundtrackZone, DEFAULT_MUSIC_VOLUME, randomSilenceSeconds, MIN_SILENCE_SECONDS, MAX_SILENCE_SECONDS } from '../lib/audio/soundtrack-selection.ts';
import { SoundtrackPlayer } from '../lib/audio/soundtrack-player.ts';

const solar = { x: -8277, y: 0, z: 0 };
const core = { x: -1000, y: 0, z: 300 };

test('13 complete local recordings cover each region with at least three alternatives', () => {
  assert.equal(soundtracks.length, 13);
  assert.equal(new Set(soundtracks.map(track => track.id)).size, 13);
  for (const zone of ['core', 'disc', 'solar', 'outer']) assert.ok(soundtracks.filter(t => t.zone === zone).length >= 3);
  for (const track of soundtracks) {
    assert.ok(track.durationSeconds > 120);
    const file = new URL('../public' + track.src, import.meta.url);
    assert.ok(statSync(file).size > 2_000_000);
    assert.equal(readFileSync(file).subarray(0, 3).toString(), 'ID3');
  }
});

test('solar atmosphere is local in 3D, and region boundaries have hysteresis', () => {
  assert.equal(soundtrackZone(solar), 'solar');
  assert.equal(soundtrackZone({ x: 8277, y: 0, z: 0 }), 'disc');
  assert.equal(soundtrackZone({ ...solar, z: 3000 }), 'outer');
  assert.equal(soundtrackZone(core), 'core');
  assert.equal(soundtrackZone({ x: -3500, y: 0, z: 0 }), 'core');
  assert.equal(soundtrackZone({ x: -16000, y: 0, z: 0 }), 'outer');
  assert.equal(soundtrackZone({ x: -4500, y: 0, z: 0 }, 'core'), 'core');
  assert.equal(soundtrackZone({ x: -4500, y: 0, z: 0 }, 'disc'), 'disc');
  assert.equal(soundtrackZone({ x: -8277, y: 1400, z: 0 }, 'solar'), 'solar');
  assert.equal(soundtrackZone({ x: -8277, y: 1400, z: 0 }, 'disc'), 'disc');
});

test('each selection is a new draw; A B A is allowed without exhausting a region', () => {
  for (const zone of ['core', 'disc', 'solar', 'outer']) {
    const sequence = new SoundtrackSequence(() => 0);
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const track = sequence.next(zone, solar);
      assert.equal(track.zone, zone);
      ids.push(track.id); sequence.markPlayed(track);
    }
    assert.notEqual(ids[0], ids[1]); assert.equal(ids[0], ids[2]);
  }
});

test('different random values can select every local piece, including the slower core scores', () => {
  for (const zone of ['core', 'disc', 'solar', 'outer']) {
    const selected = new Set();
    for (let i = 0; i < 100; i++) selected.add(new SoundtrackSequence(() => i / 100).next(zone, core).id);
    assert.equal(selected.size, soundtracks.filter(track => track.zone === zone).length);
  }
  assert.equal(randomSilenceSeconds(() => 0), MIN_SILENCE_SECONDS);
  assert.equal(randomSilenceSeconds(() => .999999), MAX_SILENCE_SECONDS);
  assert.notEqual(randomSilenceSeconds(() => .1), randomSilenceSeconds(() => .8));
});

function harness(random = () => 0) {
  const audios = [], gains = [], events = [];
  let pending = null;
  const context = {
    currentTime: 0, state: 'running', destination: {}, closed: false,
    resume: async () => {}, close: async () => { context.closed = true; },
    createGain: () => {
      const param = { value: 1, ramps: [], setTargetAtTime(v) { this.value = v; }, cancelAndHoldAtTime() {}, linearRampToValueAtTime(v, time) { this.ramps.push([v, time]); } };
      const node = { gain: param, connect() {}, disconnect() {} }; gains.push(node); return node;
    },
    createMediaElementSource: () => ({ connect() {}, disconnect() {} }),
  };
  const makeAudio = () => {
    const delay = pending; pending = null;
    const audio = { paused: true, ended: false, duration: 140, currentTime: 0, src: '',
      ontimeupdate: null, onended: null, onerror: null,
      play() { this.paused = false; return delay ?? Promise.resolve(); },
      pause() { this.paused = true; }, removeAttribute() { this.src = ''; }, load() {} };
    audios.push(audio); return audio;
  };
  const player = new SoundtrackPlayer(state => events.push(state), makeAudio, () => context, random);
  return { player, audios, gains, events, context, delayNext(promise) { pending = promise; } };
}
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('music is enabled by default and starts automatically when the browser permits it', async () => {
  const h = harness();
  assert.equal(h.audios.length, 0);
  assert.equal(h.player.state.enabled, true);
  assert.equal(h.player.state.volume, DEFAULT_MUSIC_VOLUME);
  h.player.startAutomatically(); await settle();
  assert.equal(h.player.state.status, 'playing');
  assert.equal(h.gains[0].gain.value, .12);
  h.player.setVolume(.23); h.player.setMuted(true);
  assert.equal(h.gains[0].gain.value, 0);
  assert.equal(h.player.state.volume, .23);
  h.player.setMuted(false); assert.equal(h.gains[0].gain.value, .23);
  h.player.dispose(); assert.equal(h.context.closed, true);
});

test('blocked autoplay waits for an ordinary gesture and cannot override a user turning music off', async () => {
  for (const disable of [false, true]) {
    const h = harness(); let unlock;
    h.context.state = 'suspended';
    h.context.resume = () => new Promise(done => { unlock = () => { h.context.state = 'running'; done(); }; });
    h.player.startAutomatically();
    assert.equal(h.player.state.status, 'waiting');
    assert.equal(h.player.state.enabled, true);
    assert.equal(h.audios.length, 0);
    if (disable) h.player.pause();
    h.context.resume = async () => { h.context.state = 'running'; };
    h.player.resumeAfterGesture(); unlock(); await settle();
    assert.equal(h.player.state.status, disable ? 'paused' : 'playing');
    assert.equal(h.audios.length, disable ? 0 : 1);
    h.player.dispose();
  }
});

test('a media autoplay rejection is a waiting state, not an error or an off switch', async () => {
  const h = harness();
  const error = new Error('gesture required'); error.name = 'NotAllowedError';
  h.delayNext(Promise.reject(error)); await h.player.play();
  assert.equal(h.player.state.status, 'waiting');
  assert.equal(h.player.state.error, false); assert.equal(h.player.state.enabled, true);
  h.player.resumeAfterGesture(); await settle();
  assert.equal(h.player.state.status, 'playing'); h.player.dispose();
});

test('changing regions waits for a stable destination, then crossfades without a hard cut', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(); await h.player.play();
  h.player.updatePosition(core); t.mock.timers.tick(2000); h.player.updatePosition(solar);
  t.mock.timers.tick(4000); assert.equal(h.player.state.zone, 'solar');
  h.player.updatePosition(core); t.mock.timers.tick(3500); await settle();
  assert.equal(h.player.state.track.zone, 'core');
  assert.equal(h.audios[0].paused, false);
  assert.deepEqual(h.gains[1].gain.ramps.at(-1), [0, 8]);
  assert.deepEqual(h.gains[2].gain.ramps.at(-1), [1, 8]);
  t.mock.timers.tick(8100); assert.equal(h.audios[0].paused, true);
  h.player.dispose();
});

test('natural endings leave silence, movement cannot cut it short, and the next draw uses the new location', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(); await h.player.play();
  h.audios[0].ended = true; h.audios[0].onended();
  assert.equal(h.player.state.status, 'silence');
  assert.equal(h.player.state.enabled, true);
  assert.ok(h.audios.every(audio => audio.paused));
  h.player.updatePosition(core); t.mock.timers.tick(3500); await settle();
  assert.equal(h.player.state.zone, 'core'); assert.equal(h.player.state.status, 'silence');
  t.mock.timers.tick(MIN_SILENCE_SECONDS * 1000 - 3501); await settle();
  assert.equal(h.audios.length, 1);
  t.mock.timers.tick(1); await settle();
  assert.equal(h.player.state.status, 'playing'); assert.equal(h.player.state.track.zone, 'core');
  h.player.dispose();
});

test('turning music off during silence cancels its wakeup; Next explicitly skips a gap', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(); await h.player.play(); h.audios[0].onended();
  await h.player.next(); assert.equal(h.player.state.status, 'playing');
  h.audios.at(-1).onended(); h.player.pause();
  t.mock.timers.tick(MAX_SILENCE_SECONDS * 1000 + 1000); await settle();
  assert.equal(h.player.state.enabled, false); assert.equal(h.audios.length, 2);
  assert.ok(h.audios.every(audio => audio.paused)); h.player.dispose();
});

test('rapid next clicks cannot accumulate audible tracks and pause stops every voice', async () => {
  const h = harness(); await h.player.play();
  for (let i = 0; i < 6; i++) {
    await h.player.next();
    assert.ok(h.audios.filter(audio => !audio.paused).length <= 2);
  }
  h.player.pause();
  assert.ok(h.audios.every(audio => audio.paused));
  h.player.dispose();
});

test('a late play promise cannot resurrect playback after pause or disposal', async () => {
  for (const action of ['pause', 'dispose']) {
    const h = harness(); let resolve;
    h.delayNext(new Promise(done => { resolve = done; }));
    const start = h.player.play(); h.player[action](); resolve(); await start;
    assert.ok(h.audios.every(audio => audio.paused));
    assert.notEqual(h.player.state.status, 'playing');
    if (action !== 'dispose') h.player.dispose();
  }
});

test('a failed next piece keeps the current piece, and a failed start is retryable', async () => {
  const h = harness();
  h.delayNext(Promise.reject(new Error('blocked'))); await h.player.play();
  assert.equal(h.player.state.status, 'error');
  await h.player.play(); const first = h.player.state.track.id;
  h.delayNext(Promise.reject(new Error('network'))); await h.player.next();
  assert.equal(h.player.state.status, 'playing');
  assert.equal(h.player.state.track.id, first);
  assert.equal(h.player.state.error, true);
  await h.player.next(); assert.notEqual(h.player.state.track.id, first);
  h.player.dispose();
});
