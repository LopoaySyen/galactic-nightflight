import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildSkySearchIndex,searchSkyObjects} from '../lib/rendering/sky-search.ts';
import {deepSkyTargets,deepSkyTargetsById,pickDeepSkyTarget,isSkyPointObscured} from '../lib/rendering/sky-object-catalog.ts';
import {parseObservedBrightStarCatalog} from '../lib/rendering/observed-star-catalog.ts';
import {projectDeepSkyImageSources} from '../lib/rendering/deep-sky-image-catalog.ts';
import {resolveQuickView} from '../lib/rendering/quick-view.ts';
import {pointSourcePositionAtTime} from '../lib/physics/kinematics.ts';
import {projectDirectionPerspective} from '../lib/rendering/projection.ts';
const observer={x:-8277,y:0,z:0},zenith={x:0,y:0,z:1};
const catalogue=parseObservedBrightStarCatalog(await readFile(new URL('../public/data/yale-bright-stars.csv',import.meta.url),'utf8'));
const index=buildSkySearchIndex(catalogue);

test('Chinese names, English names and both real catalogue IDs find the same Sirius record',()=>{
  for(const query of ['天狼星','sIrIuS','  HIP 32349  ','ＨＩＰ　３２３４９','依巴谷32349','HD 48915','亨利·德雷珀48915']){
    const result=searchSkyObjects(index,query)[0];assert.equal(result?.id,'hip-32349',query);assert.equal(result.kind,'star');
  }
  assert.equal(searchSkyObjects(index,'南门二').length,2);
  assert.equal(searchSkyObjects(index,'not a real bundled object').length,0);
  assert.ok(searchSkyObjects(index,'').length<=12);
});

test('search includes actual deep-sky objects and excludes virtual stars and invented Gaia IDs',()=>{
  for(const [query,id] of [['猎户座','m42'],['M 42','m42'],['Pleiades','m45'],['欧米茄星团','omega-centauri'],['Andromeda','m31']]){
    assert.equal(searchSkyObjects(index,query)[0]?.id,id,query);
  }
  const source=catalogue[0];
  const virtual={...source,id:'virtual',displayName:'VirtualTest',role:'model-population-tracer'};
  const gaia={...source,id:'gaia-dr3-bright-17',displayName:undefined,observedData:{...source.observedData,catalog:'gaia-dr3',catalogueIdentifier:undefined,henryDraperIdentifier:undefined}};
  const localIndex=buildSkySearchIndex([virtual,gaia]);
  assert.equal(searchSkyObjects(localIndex,'VirtualTest').length,0);
  assert.equal(searchSkyObjects(localIndex,'盖亚样本 17')[0]?.id,gaia.id);
  assert.equal(searchSkyObjects(localIndex,'Gaia DR3 17').length,0);
  assert.equal(searchSkyObjects(localIndex,'HIP 17').length,0);
  assert.equal(deepSkyTargets.length,new Set(deepSkyTargets.map(target=>target.id)).size);
});

test('a searched star is centred using its current motion and the current observer, not reference sky coordinates',()=>{
  const entry=searchSkyObjects(index,'天狼星')[0],source=catalogue.find(source=>source.id===entry.id);
  const moved={x:-7200,y:300,z:200},position=pointSourcePositionAtTime(source,25000);
  const direction={x:position.x-moved.x,y:position.y-moved.y,z:position.z-moved.z};
  const target=resolveQuickView(direction,{azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:30},zenith,false);
  const projected=projectDirectionPerspective(direction,target.camera,1000,600);
  assert.ok(Math.abs(projected.canvasX-500)<1e-6);assert.ok(Math.abs(projected.canvasY-300)<1e-6);
});

test('nebula and cluster picking follows the actual projected photograph after observer movement',()=>{
  for(const id of ['m42','m45','omega-centauri','m31']){
    const source=deepSkyTargetsById.get(id).image;
    for(const position of [observer,{x:-10740,y:168.6,z:0}]){
      const direction={x:source.positionParsec.x-position.x,y:source.positionParsec.y-position.y,z:source.positionParsec.z-position.z};
      const camera=resolveQuickView(direction,{azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:12},zenith,false).camera;
      const p=projectDeepSkyImageSources([source],position,camera,1000,600)[0];
      const area={id,x:p.canvasX,y:p.canvasY,rightX:p.imageRightCanvasX,rightY:p.imageRightCanvasY,downX:p.imageDownCanvasX,downY:p.imageDownCanvasY,shape:'photo'};
      assert.equal(pickDeepSkyTarget([area],p.canvasX,p.canvasY,7)?.id,id);
      assert.equal(pickDeepSkyTarget([area],p.canvasX+.25*area.rightX,p.canvasY+.25*area.rightY,7)?.id,id);
    }
  }
});

test('transparent borders, outside ellipses, hidden layers and invalid geometry do not steal clicks',()=>{
  const pixels=new Uint8ClampedArray(4*4*4);pixels[(2*4+2)*4+3]=255;
  const area={id:'m42',x:100,y:100,rightX:30,rightY:20,downX:-20,downY:30,shape:'photo',mask:{width:4,height:4,pixels}};
  assert.equal(pickDeepSkyTarget([area],100,100,7)?.id,'m42');
  assert.equal(pickDeepSkyTarget([area],100-.8*30,100-.8*20,7),null);
  assert.equal(pickDeepSkyTarget([],100,100,7),null);
  assert.equal(pickDeepSkyTarget([{...area,rightX:NaN}],100,100,7),null);
  const ellipse={...area,shape:'ellipse',rightX:40,rightY:0,downX:0,downY:20};
  assert.equal(pickDeepSkyTarget([ellipse],130,115,7),null);
  assert.equal(pickDeepSkyTarget([ellipse],115,105,7)?.id,'m42');
});

test('clicking ground or an opaque mountain cannot select a source behind it',()=>{
  const camera={azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:60};
  assert.equal(isSkyPointObscured(camera,1000,600,500,500,0),true);
  assert.equal(isSkyPointObscured(camera,1000,600,500,100,0),false);
  const pixels=new Uint8ClampedArray(8*4*4).fill(255);
  assert.equal(isSkyPointObscured(camera,1000,600,500,100,0,{width:8,height:4,pixels}),true);
  pixels.fill(0);
  assert.equal(isSkyPointObscured(camera,1000,600,500,100,0,{width:8,height:4,pixels}),false);
});
