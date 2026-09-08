import test from 'node:test';
import assert from 'node:assert/strict';
import {kerrIsco,kerrHorizon,kerrCircularOrbit,kerrDiscProfile,traceKerrRay,kerrRayInvariants,kerrCameraExposure} from '../lib/physics/kerr.ts';
import {thinDiscTemperature} from '../lib/physics/schwarzschild.ts';
import {compactObjects,compactObjectAtTime} from '../lib/rendering/compact-object-catalog.ts';
import {normalizeVector} from '../lib/physics/vector.ts';

test('Kerr radii, efficiency and differential frequency recover analytic limits',()=>{
  assert.equal(kerrIsco(0),6);assert.equal(kerrHorizon(0),2);
  assert.ok(Math.abs(kerrIsco(.9)-2.3208830418)<1e-9);
  assert.ok(Math.abs(kerrIsco(-.9)-8.7173522796)<1e-9);
  for(const a of [-.95,0,.7,.95]){
    const inner=kerrIsco(a);assert.ok(inner>kerrHorizon(a));
    assert.ok(kerrCircularOrbit(inner,a).omega>kerrCircularOrbit(80,a).omega);
    assert.ok(kerrCircularOrbit(inner,a).energy<1);
  }
});
test('Page–Thorne flux matches the independent Schwarzschild closed form',()=>{
  const p=kerrDiscProfile(4e6,0,.01);assert.equal(p.temperatures[0],0);
  for(const i of [100,300,600,1000]){
    const r=p.inner+i*(80-p.inner)/1023,reference=thinDiscTemperature(r/2,4e6,.01);
    assert.ok(Math.abs(p.temperatures[i*4]/reference-1)<2e-5);
  }
  for(const mass of [21.2,4e6,6.5e9])for(const a of [-.95,.7,.95]){
    const profile=kerrDiscProfile(mass,a,.01);assert.ok(profile.temperatures.every(Number.isFinite));
    assert.ok(Number.isFinite(kerrCameraExposure(mass,a,.01,true)));
  }
});
test('zero spin recovers the photon capture boundary; spin breaks left/right symmetry',()=>{
  const observer={x:-360,y:0,z:0};
  const trace=(b,a)=>{const sine=b*Math.sqrt(1-2/360)/360;return traceKerrRay(observer,{x:Math.sqrt(1-sine*sine),y:sine,z:0},a);};
  for(const sign of [-1,1]){assert.equal(trace(sign*5.19,0).captured,true);assert.equal(trace(sign*5.21,0).escaped,true);}
  assert.equal(trace(-5,.7).captured,true);assert.equal(trace(5,.7).escaped,true);
});
test('off-equator Kerr rays conserve separated integrals and converge under step refinement',()=>{
  const observer={x:-350,y:0,z:75},direction=normalizeVector({x:1,y:.045,z:-.25});
  for(const a of [-.9,0,.7,.9]){
    const coarse=traceKerrRay(observer,direction,a),fine=traceKerrRay(observer,direction,a,.0125);
    assert.equal(coarse.escaped,true);assert.equal(fine.escaped,true);assert.ok(coarse.hits.length>0);
    const invariants=kerrRayInvariants(coarse.ray,a);
    assert.ok(Math.abs(invariants.radial)<1e-6);assert.ok(Math.abs(invariants.polar)<1e-4);
    assert.ok(Math.abs(coarse.hits[0].radius/fine.hits[0].radius-1)<.0005);
    assert.ok(Math.abs(coarse.hits[0].g/fine.hits[0].g-1)<.0001);
  }
});
test('black hole ephemerides move from a fixed epoch, in both time directions',()=>{
  const [sgr,cyg,m87]=compactObjects;
  assert.ok(compactObjects.every(o=>o.spin!==0));
  assert.equal(compactObjectAtTime(sgr,1e6),sgr);
  for(const o of [cyg,m87]){
    assert.equal(compactObjectAtTime(o,0),o);
    const future=compactObjectAtTime(o,1e5),past=compactObjectAtTime(o,-1e5);
    assert.ok(Math.hypot(...['x','y','z'].map(k=>future.positionParsec[k]-o.positionParsec[k]))>10);
    const displacement=['x','y','z'].map(k=>(future.positionParsec[k]-o.positionParsec[k])*(past.positionParsec[k]-o.positionParsec[k]));
    assert.ok(displacement.reduce((a,b)=>a+b,0)<0);
    assert.deepEqual(compactObjectAtTime(o,1e5),future);
  }
});
test('azimuth remains on the Schwarzschild orbital plane across the polar coordinate singularity',()=>{
  const observer={x:-350,y:0,z:75};
  for(const y of [-.01,-.000001,0,.000001,.01]){
    const d=normalizeVector({x:1,y,z:-.25});
    const normal=normalizeVector({x:-observer.z*d.y,y:observer.z*d.x-observer.x*d.z,z:observer.x*d.y});
    const result=traceKerrRay(observer,d,0);assert.equal(result.escaped,true);
    const r=result.ray,sine=Math.sqrt(1-r.z*r.z);
    const planeError=normal.x*sine*Math.cos(r.phi)+normal.y*sine*Math.sin(r.phi)+normal.z*r.z;
    assert.ok(Math.abs(planeError)<1e-7);
  }
});
