import test from 'node:test';
import assert from 'node:assert/strict';
import {observerPresets,cameraFacingGalacticCentre} from '../lib/rendering/observer-presets.ts';
import {projectDirectionPerspective} from '../lib/rendering/projection.ts';
import {rememberObservationTutorial,shouldShowObservationTutorial,tutorialStorageKey} from '../lib/rendering/observation-tutorial.ts';

const initialCamera={azimuthDegrees:37,elevationDegrees:22,horizontalFieldOfViewDegrees:48};
function assertCentreIsCentred(position,camera){
  const projected=projectDirectionPerspective({x:-position.x,y:-position.y,z:-position.z},camera,1440,900);
  assert.equal(projected.visible,true);
  assert.ok(Math.abs(projected.canvasX-720)<1e-8);
  assert.ok(Math.abs(projected.canvasY-450)<1e-8);
}

test('the six observing presets span the inner disc, outer disc, opposite side and vertical space',()=>{
  assert.equal(observerPresets.length,6);
  assert.equal(new Set(observerPresets.map(p=>p.id)).size,6);
  assert.equal(new Set(observerPresets.map(p=>JSON.stringify(p.position))).size,6);
  for(const preset of observerPresets){
    const distance=Math.hypot(preset.position.x,preset.position.y,preset.position.z);
    assert.ok(Number.isFinite(distance)&&distance>100&&distance<20000);
    assertCentreIsCentred(preset.position,cameraFacingGalacticCentre(preset.position,initialCamera));
  }
  assert.ok(observerPresets.some(p=>p.position.x>0));
  assert.ok(observerPresets.some(p=>p.position.z>=3000));
});

test('centre tracking stays centred throughout movement, preserving zoom and the local vertical',()=>{
  const upDirection={x:0,y:Math.sin(.4),z:Math.cos(.4)};
  const current={...initialCamera,upDirection};
  for(let step=0;step<64;step++){
    const angle=step*Math.PI/16;
    const position={x:8000*Math.cos(angle),y:8000*Math.sin(angle),z:1500*Math.sin(angle/2)};
    const camera=cameraFacingGalacticCentre(position,current);
    assertCentreIsCentred(position,camera);
    assert.equal(camera.horizontalFieldOfViewDegrees,48);
    assert.deepEqual(camera.upDirection,upDirection);
  }
  assert.deepEqual(current,{...initialCamera,upDirection},'tracking must not mutate the stored free view');
});

test('an observer exactly at the centre has a finite stable view instead of an undefined direction',()=>{
  const result=cameraFacingGalacticCentre({x:0,y:0,z:0},initialCamera);
  assert.deepEqual(result,initialCamera);
});

test('the first-visit tutorial is remembered after either completion or dismissal',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  assert.equal(shouldShowObservationTutorial(storage),true);
  rememberObservationTutorial(storage);
  assert.equal(values.get(tutorialStorageKey),'seen');
  assert.equal(shouldShowObservationTutorial(storage),false);
});

test('blocked browser storage cannot prevent opening or closing the tutorial',()=>{
  const blocked={getItem(){throw new Error('storage unavailable');},setItem(){throw new Error('storage unavailable');}};
  assert.equal(shouldShowObservationTutorial(blocked),true);
  assert.doesNotThrow(()=>rememberObservationTutorial(blocked));
});
