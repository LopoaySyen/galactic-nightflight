import test from 'node:test';
import assert from 'node:assert/strict';
import {traceNullOrbit,stepNullOrbit,PHOTON_CAPTURE_IMPACT,schwarzschildRayTable,sampleOrbitRadius,thinDiscFlux,thinDiscTemperature,discFrequencyShift,SCHWARZSCHILD_EFFICIENCY,blackHoleCameraExposure,rayIntersectsDisc} from '../lib/physics/schwarzschild.ts';
import {planckSpectralRadiance} from '../lib/rendering/spectrum.ts';
import {compactObjects,compactViewObserver} from '../lib/rendering/compact-object-catalog.ts';

test('close-up moves use the live origin while long galactic jumps await a matching sky',()=>{
  const hole=compactObjects.find(object=>object.id==='cygnus-x1').positionParsec;
  const previous={...hole,z:hole.z+1e-10};
  const current={...hole,x:hole.x+1e-10};
  assert.equal(compactViewObserver(current,previous),current);
  const solar={x:-8277,y:0,z:0};
  assert.equal(compactViewObserver(current,solar),solar);
  assert.equal(compactViewObserver({...solar,z:.1},solar),solar);
  assert.equal(compactViewObserver(current,undefined),current);
});

test('Schwarzschild rays obey capture threshold and the weak-field bending limit',()=>{
  assert.ok(Math.abs(PHOTON_CAPTURE_IMPACT-2.59807621135)<1e-10);
  assert.ok(traceNullOrbit(2.55,180,30).captured);
  assert.ok(traceNullOrbit(2.65,180,30).escaped);
  const b=60,r=1e6,ray=traceNullOrbit(b,r,10,.001);
  const bending=ray.phi+Math.asin(b/r)-Math.PI;
  assert.ok(Math.abs(bending/(2/b)-1)<.06);
});

test('null-orbit invariant is conserved and smaller steps converge',()=>{
  const b=3,r=180;let u=1/r,v=Math.sqrt(1/b**2-u*u+u**3);
  for(let i=0;i<800;i++){
    [u,v]=stepNullOrbit(u,v,.005);
    assert.ok(Math.abs(v*v+u*u-u*u*u-1/b**2)<1e-10);
  }
  const reference=traceNullOrbit(b,r,10,.0005).phi;
  const coarse=Math.abs(traceNullOrbit(b,r,10,.04).phi-reference);
  const fine=Math.abs(traceNullOrbit(b,r,10,.01).phi-reference);
  assert.ok(fine<coarse*.15);
});

test('packed ray table agrees with direct integration at disc intersections',()=>{
  const table=schwarzschildRayTable(180);
  for(const b of [2,2.7,3,6,20])for(const phi of [.3,1,2,3,4]){
    const ray=traceNullOrbit(b,180,phi,.0005),sample=sampleOrbitRadius(table,b,phi);
    if(ray.captured||ray.escaped)continue;
    const radius=1/ray.u;
    if(radius>=3&&radius<=40)assert.ok(Math.abs(sample/radius-1)<.012,`${b}, ${phi}: ${sample} / ${radius}`);
  }
  assert.equal(rayIntersectsDisc(table,6,{x:0,y:0,z:1},{x:1,y:0,z:0}),true);
  assert.equal(rayIntersectsDisc(table,2,{x:0,y:0,z:1},{x:1,y:0,z:0}),false);
});

test('zero-torque relativistic disc has the correct ISCO, efficiency and temperature scalings',()=>{
  assert.equal(thinDiscFlux(3,4e6,1e15),0);
  assert.equal(thinDiscFlux(2,4e6,1e15),0);
  assert.ok(thinDiscFlux(4,4e6,1e15)>0);
  assert.ok(Math.abs(SCHWARZSCHILD_EFFICIENCY-.0571909584)<1e-10);
  assert.ok(Math.abs(thinDiscTemperature(10,4e6,.016)/thinDiscTemperature(10,4e6,.001)-2)<1e-10);
  assert.ok(Math.abs(thinDiscTemperature(10,64e6,.01)/thinDiscTemperature(10,4e6,.01)-.5)<1e-10);
});

test('emitter motion and gravity shift frequency while preserving Planck intensity invariance',()=>{
  assert.ok(Math.abs(discFrequencyShift(6,0,1e12)-Math.sqrt(.75))<1e-12);
  assert.ok(discFrequencyShift(6,5,180)>discFrequencyShift(6,-5,180));
  for(const g of [.5,.8,1.3]){
    const observed=planckSpectralRadiance(550e-9,g*10000);
    const transferred=g**5*planckSpectralRadiance(g*550e-9,10000);
    assert.ok(Math.abs(observed/transferred-1)<1e-12);
  }
  assert.ok(blackHoleCameraExposure(21.2,.01)<blackHoleCameraExposure(4e6,.01));
  assert.ok(blackHoleCameraExposure(4e6,.01)<blackHoleCameraExposure(6.5e9,.01));
});
