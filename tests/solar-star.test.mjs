import test from 'node:test';
import assert from 'node:assert/strict';
import {sunStar,directionToSun,solarViewingPosition} from '../lib/rendering/solar-star.ts';
import {includeNearbyStars} from '../lib/rendering/nearby-star-catalog.ts';
import {buildSkySearchIndex,searchSkyObjects} from '../lib/rendering/sky-search.ts';
import {prepareGalaxyPointSources,projectPreparedGalaxyPointSources} from '../lib/rendering/galaxy-star-renderer.ts';
import {pickObservedStar,drawObservedStarLabels} from '../lib/rendering/observed-star-interaction.ts';
import {pointSourcePositionAtTime} from '../lib/physics/kinematics.ts';
import {resolveQuickView} from '../lib/rendering/quick-view.ts';
const zenith={x:0,y:0,z:1},initialCamera={azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:30};

test('solar aliases share one catalogue record with no invented catalogue identifiers',()=>{
  const catalog=includeNearbyStars([]),merged=includeNearbyStars(catalog),index=buildSkySearchIndex(merged);
  assert.equal(merged.filter(s=>s.id==='sun').length,1);
  for(const query of ['太阳','太陽','Sun','sUn','Sol','日']){
    const result=searchSkyObjects(index,query)[0];assert.equal(result.id,'sun');assert.equal(result.title,'太阳');assert.equal(result.titleEn,'Sun');
    assert.ok(!/Gaia|HIP|样本序号/.test(result.subtitle));
  }
  assert.equal(sunStar.observedData.catalogueIdentifier,undefined);
  assert.equal(sunStar.observedData.rightAscensionDegrees,undefined);
});
test('the coincident solar preset has no artificial star direction or singular rendering',()=>{
  for(const time of [0,100000,-100000]){
    const observer=pointSourcePositionAtTime(sunStar,time);
    assert.equal(directionToSun(observer,time),null);
    assert.equal(prepareGalaxyPointSources([sunStar],observer,16.5,time).length,0);
  }
});
test('viewing from one parsec centres and picks the Sun at the current epoch',()=>{
  for(const time of [0,100000,-100000]){
    const observer=solarViewingPosition(time),direction=directionToSun(observer,time);
    assert.ok(Math.abs(Math.hypot(direction.x,direction.y,direction.z)-1)<1e-10);
    const camera=resolveQuickView(direction,initialCamera,zenith,false).camera;
    const prepared=prepareGalaxyPointSources([sunStar],observer,16.5,time);
    assert.ok(Math.abs(prepared[0].apparentVisualMagnitude-(-.17))<.01);
    const projected=projectPreparedGalaxyPointSources(prepared,camera,1000,600,observer,time);
    assert.equal(projected[0].id,'sun');assert.ok(Math.abs(projected[0].canvasX-500)<1e-6);assert.ok(Math.abs(projected[0].canvasY-300)<1e-6);
    assert.equal(pickObservedStar(prepared,camera,observer,time,1000,600,500,300,12,zenith,'space','camera',-18)?.id,'sun');
  }
});
test('the solar label remains available for camera-visible light fainter than ordinary name overlays',()=>{
  const observer={...sunStar.positionParsec,z:100},direction=directionToSun(observer,0);
  const camera=resolveQuickView(direction,initialCamera,zenith,false).camera;
  const sources=projectPreparedGalaxyPointSources(prepareGalaxyPointSources([sunStar],observer,16.5),camera,1000,600,observer,0);
  const labels=[],ctx={save(){},restore(){},measureText(){return {width:28};},fillText(text){labels.push(text);}};
  assert.ok(sources[0].apparentVisualMagnitude>5);
  drawObservedStarLabels(ctx,sources,1,1000,600,zenith,'space','camera',-18,'zh');assert.deepEqual(labels,['太阳']);
  labels.length=0;drawObservedStarLabels(ctx,sources,1,1000,600,zenith,'space','naked-eye',-18,'zh');assert.deepEqual(labels,[]);
});
