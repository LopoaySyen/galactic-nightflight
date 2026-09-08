import test from 'node:test';
import assert from 'node:assert/strict';
import { stellarScintillation, scintillationAmplitude, starScintillationPhase } from '../lib/rendering/stellar-scintillation.ts';

test('vacuum and stars below the local horizon have no atmospheric scintillation', () => {
  for (const seconds of [0,.13,1,1000]) {
    assert.equal(stellarScintillation(seconds,1,15,'space','naked-eye'),1);
    assert.equal(stellarScintillation(seconds,1,-5,'earth-clear','naked-eye'),1);
  }
});
test('scintillation is stronger toward the horizon and reduced in camera modes', () => {
  const overhead=scintillationAmplitude(85,'earth-clear','naked-eye');
  const low=scintillationAmplitude(6,'earth-clear','naked-eye');
  assert.ok(low>overhead*2);
  assert.equal(low,scintillationAmplitude(6,'earth-hazy','naked-eye'));
  assert.ok(scintillationAmplitude(6,'earth-clear','camera')<low/2);
  assert.ok(scintillationAmplitude(6,'earth-clear','near-infrared')<low/2);
});
test('real-time stellar fluctuations are independent, bounded and stable for a catalogue identity', () => {
  const p=starScintillationPhase('hip-11767'),q=starScintillationPhase('hip-32349');
  assert.equal(p,starScintillationPhase('hip-11767',999));
  assert.notEqual(p,starScintillationPhase('gaia-dr3-bright-11767'));
  assert.notEqual(starScintillationPhase('thin-23'),starScintillationPhase('bar-23'));
  const values=Array.from({length:300},(_,i)=>stellarScintillation(i/30,p,3,'earth-clear','naked-eye'));
  assert.ok(Math.max(...values)-Math.min(...values)>.3);
  assert.ok(values.every(value=>value>.60&&value<1.4));
  assert.notEqual(stellarScintillation(.37,p,20,'earth-clear','naked-eye'),stellarScintillation(.37,q,20,'earth-clear','naked-eye'));
  assert.ok(Math.abs(values.reduce((a,b)=>a+b)/values.length-1)<.02);
});
