import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import records from '../public/data/nearby-stars.json' with {type:'json'};
import {nearbyStars, includeNearbyStars} from '../lib/rendering/nearby-star-catalog.ts';
import {parseObservedBrightStarCatalog} from '../lib/rendering/observed-star-catalog.ts';
import {parseGaiaBrightStarCatalog} from '../lib/rendering/gaia-bright-star-catalog.ts';
import {buildSkySearchIndex,searchSkyObjects} from '../lib/rendering/sky-search.ts';
import {prepareGalaxyPointSources} from '../lib/rendering/galaxy-star-renderer.ts';
import {pickObservedStar} from '../lib/rendering/observed-star-interaction.ts';
import {resolveQuickView} from '../lib/rendering/quick-view.ts';
const sun={x:-8277,y:0,z:0}, zenith={x:0,y:0,z:1};
const proxima=nearbyStars.find(star=>star.id==='hip-70890');
const index=buildSkySearchIndex(nearbyStars);

test('Proxima aliases and real catalogue identifiers all locate one measured star',()=>{
  for(const query of ['比邻星','比鄰星','Proxima','Proxima Centauri','半人马座αC','Alpha Centauri C','HIP 70890','GJ551','Gaia DR3 5853498713190525696']) {
    const result=searchSkyObjects(index,query)[0];
    assert.equal(result?.id,proxima.id,query);
    assert.equal(result.title,'比邻星');
    assert.equal(result.titleEn,'Proxima Centauri');
  }
  for(const query of ['巴纳德星',"Barnard's Star",'Wolf 359','沃尔夫359','拉兰德21185','罗斯154','罗斯128','蒂加登星']) assert.ok(searchSkyObjects(index,query).length,query);
});

test('Proxima retains observed distance, sky direction and full measured motion',()=>{
  const d=proxima.observedData.referenceDistanceParsec;
  assert.ok(Math.abs(d*3.26156-4.2465)<.001);
  const p=proxima.positionParsec;
  assert.ok(Math.abs(Math.hypot(p.x-sun.x,p.y,p.z)-d)<1e-8);
  const longitude=(Math.atan2(p.y,p.x-sun.x)*180/Math.PI+360)%360;
  const latitude=Math.asin(p.z/d)*180/Math.PI;
  assert.ok(Math.abs(longitude-313.939862)<.00001);
  assert.ok(Math.abs(latitude+1.927149)<.00001);
  const v=proxima.velocityKilometresPerSecond;
  const relative=[v.x-11.1,v.y-244.24,v.z-7.25];
  const radial=relative.reduce((sum,value,i)=>sum+value*[p.x-sun.x,p.y,p.z][i]/d,0);
  assert.ok(Math.abs(radial-(-20.578199))<1e-6);
  const tangent=Math.sqrt(relative.reduce((sum,value)=>sum+value*value,0)-radial*radial);
  assert.ok(Math.abs(tangent-.00474047*d*Math.hypot(-3781.741,769.465))<1e-6);
  assert.equal(proxima.observedData.measuredVelocity,true);
});

test('a searchable Proxima is invisible to naked eyes but pickable in camera mode',()=>{
  const prepared=prepareGalaxyPointSources([proxima],sun,16.5);
  assert.ok(Math.abs(prepared[0].apparentVisualMagnitude-11.13)<1e-7);
  const p=proxima.positionParsec;
  const camera=resolveQuickView({x:p.x-sun.x,y:p.y,z:p.z},{azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:5},zenith,false).camera;
  const pick=mode=>pickObservedStar(prepared,camera,sun,0,1000,600,500,300,12,zenith,'space',mode,-18);
  assert.equal(pick('naked-eye'),null);
  assert.equal(pick('dark-adapted'),null);
  assert.equal(pick('camera')?.id,proxima.id);
  assert.equal(searchSkyObjects(index,'比邻星')[0]?.id,proxima.id);
});

test('the same catalogue feeds rendering and search without duplicating nearby Gaia stars',async()=>{
  const yale=parseObservedBrightStarCatalog(await readFile(new URL('../public/data/yale-bright-stars.csv',import.meta.url),'utf8'));
  const bytes=await readFile(new URL('../public/data/gaia-dr3-bright-6d.bin',import.meta.url));
  const gaia=parseGaiaBrightStarCatalog(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const original=[...yale,...gaia], merged=includeNearbyStars(original);
  assert.equal(merged.length,original.length+119);
  assert.equal(new Set(merged.map(star=>star.id)).size,merged.length);
  assert.equal(includeNearbyStars(merged).length,merged.length);
  for(const record of records.filter(record=>record.replacesGaiaId)) {
    assert.ok(gaia.some(star=>star.id===record.replacesGaiaId));
    assert.ok(!merged.some(star=>star.id===record.replacesGaiaId));
    assert.equal(merged.filter(star=>star.id===record.id).length,1);
  }
  const barnard=searchSkyObjects(buildSkySearchIndex(merged),'巴纳德星')[0];
  assert.equal(barnard.id,'hip-87937');
  assert.equal(searchSkyObjects(buildSkySearchIndex(merged),'北极星')[0].id,'hip-11767');
});
