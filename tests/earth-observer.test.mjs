import assert from 'node:assert/strict';
import test from 'node:test';
import {earthObservation,earthSolarNoon,AU_PER_PARSEC} from '../lib/rendering/earth-observer.ts';
import {directionToSun} from '../lib/rendering/solar-star.ts';
import {dotProduct} from '../lib/physics/vector.ts';
import {resolveQuickView} from '../lib/rendering/quick-view.ts';
import {projectDirectionPerspective} from '../lib/rendering/projection.ts';
import {projectPlanetTerrainPixels} from '../lib/rendering/terrain-projection.ts';
import {isSkyPointObscured} from '../lib/rendering/sky-object-catalog.ts';
const settings={utcMillis:Date.parse('2026-03-20T12:00:00Z'),latitudeDegrees:0,longitudeDegrees:0};
const camera={azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:30};

test('Earth is about one AU from the Sun and resolves a half-degree disc, even at shifted Galactic epochs',()=>{
  for(const years of [0,100000,-100000]){
    const earth=earthObservation(settings,years),relative=directionToSun(earth.observerPosition,years);
    assert.ok(earth.distanceAu>.99&&earth.distanceAu<1.01);
    assert.ok(2*earth.angularRadiusDegrees>.53&&2*earth.angularRadiusDegrees<.54);
    assert.ok(Math.abs(Math.hypot(relative.x,relative.y,relative.z)*AU_PER_PARSEC-earth.distanceAu)<.00002);
    const view=resolveQuickView(earth.sunDirection,camera,earth.frame.zenith,false).camera;
    const point=projectDirectionPerspective(earth.sunDirection,view,1000,600);
    assert.ok(point.visible);assert.ok(Math.abs(point.canvasX-500)<1e-6);assert.ok(Math.abs(point.canvasY-300)<1e-6);
  }
});

test('Earth rotation and longitude change daylight; opposite seasons change apparent solar diameter',()=>{
  const noon=earthObservation(earthSolarNoon(settings));
  assert.ok(noon.altitudeDegrees>89.8);
  const midnight=earthObservation({...settings,utcMillis:settings.utcMillis+12*3600000});
  assert.ok(midnight.altitudeDegrees<-88);
  assert.ok(earthObservation({...settings,longitudeDegrees:180}).altitudeDegrees<-88);
  const winter=earthObservation({...settings,utcMillis:Date.parse('2026-01-03T12:00:00Z')});
  const summer=earthObservation({...settings,utcMillis:Date.parse('2026-07-04T12:00:00Z')});
  assert.ok(winter.distanceAu<.985&&summer.distanceAu>1.015);
  assert.ok(winter.angularRadiusDegrees>summer.angularRadiusDegrees*1.03);
  assert.ok(earthObservation({...settings,latitudeDegrees:89,utcMillis:Date.parse('2026-12-21T12:00:00Z')}).altitudeDegrees<-20);
});

test('Earth horizon, terrain rendering and picking share an orthonormal local frame',()=>{
  const transparent={width:2,height:2,pixels:new Uint8ClampedArray(16)};
  const ground={width:2,height:2,pixels:new Uint8ClampedArray(16).fill(255)};
  for(const latitude of [-89,-33.86,0,39.9,89]){
    const {frame}=earthObservation({...settings,latitudeDegrees:latitude,longitudeDegrees:116.4});
    const axes=[frame.xAxis,frame.yAxis,frame.zenith];
    for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs(dotProduct(axes[a],axes[b])-(a===b?1:0))<1e-8);
    for(const side of [1,-1]){
      const direction={x:frame.zenith.x*side,y:frame.zenith.y*side,z:frame.zenith.z*side};
      const view={...resolveQuickView(direction,camera,frame.zenith,false).camera,upDirection:frame.xAxis};
      const pixels=projectPlanetTerrainPixels(transparent,ground,view,3,3,22,1,0,frame);
      assert.equal(pixels[19],side===1?0:255);
      assert.equal(isSkyPointObscured(view,3,3,1.5,1.5,22,transparent,frame),side===-1);
    }
  }
});
