import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {galacticDiscOverview,cameraFacingGalacticCentre} from '../lib/rendering/observer-presets.ts';
import {projectDirectionPerspective} from '../lib/rendering/projection.ts';
import {modelPopulationEmitters,observedRenderingAnchors} from '../lib/rendering/model-star-catalog.ts';
import {parseGaiaBrightStarCatalog} from '../lib/rendering/gaia-bright-star-catalog.ts';
import {parseObservedBrightStarCatalog} from '../lib/rendering/observed-star-catalog.ts';
import {prepareGalaxyPointSources,projectPreparedGalaxyPointSources} from '../lib/rendering/galaxy-star-renderer.ts';
import {enclosedDarkMatterMass,galacticAcceleration,galacticCircularSpeed} from '../lib/physics/galactic-gravity.ts';
import {lensView,lensedPointImages,lensedBackgroundDirection,einsteinAngleRadians} from '../lib/physics/gravitational-lensing.ts';
import {compactObjects} from '../lib/rendering/compact-object-catalog.ts';
import {deepSkyTargetsById} from '../lib/rendering/sky-object-catalog.ts';
import {buildSkySearchIndex,searchSkyObjects} from '../lib/rendering/sky-search.ts';
import {normalizeVector,dotProduct} from '../lib/physics/vector.ts';
import {pickObservedStar} from '../lib/rendering/observed-star-interaction.ts';
const sun={x:-8277,y:0,z:0};

test('above and below move outside the disc and centre the same physical Galactic centre',()=>{
  for(const position of [sun,{x:4500,y:-1200,z:100}])for(const side of [1,-1]){
    const overview=galacticDiscOverview(position,side);
    assert.equal(Math.sign(overview.position.z),side);
    assert.ok(Math.abs(overview.position.z)>=3000);
    const ray=normalizeVector({x:-overview.position.x,y:-overview.position.y,z:-overview.position.z});
    const centre=projectDirectionPerspective(ray,overview.camera,1200,700);
    assert.ok(centre.visible);assert.ok(Math.abs(centre.canvasX-600)<1e-7);assert.ok(Math.abs(centre.canvasY-350)<1e-7);
    assert.ok(Math.abs(overview.camera.elevationDegrees)<90);
  }
});

test('catalogue selection cannot create the screenshot’s dense solar island at an off-plane observer',async()=>{
  const bytes=await readFile(new URL('../public/data/gaia-dr3-bright-6d.bin',import.meta.url));
  const gaia=parseGaiaBrightStarCatalog(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const yale=parseObservedBrightStarCatalog(await readFile(new URL('../public/data/yale-bright-stars.csv',import.meta.url),'utf8'));
  const catalogue=[...yale,...gaia],anchors=observedRenderingAnchors(catalogue);
  assert.ok(anchors.length>5000&&anchors.length<10000);
  assert.ok(anchors.filter(star=>!star.solarNeighbourhoodOnly).length<500);
  const localFaint=anchors.find(star=>star.solarNeighbourhoodOnly);
  assert.ok(prepareGalaxyPointSources([localFaint],sun,20).length===1);
  assert.ok(prepareGalaxyPointSources([localFaint],{...sun,z:1000},20).length===0);
  assert.ok(observedRenderingAnchors(catalogue,localFaint.id).find(star=>star.id===localFaint.id).solarNeighbourhoodOnly!==true);
  assert.ok(anchors.some(star=>star.id==='hip-11767'));
  assert.ok(!anchors.some(star=>star.observedData.catalog==='gaia-dr3'));
  assert.ok(observedRenderingAnchors(catalogue,gaia[0].id).some(star=>star.id===gaia[0].id));
  assert.equal(searchSkyObjects(buildSkySearchIndex(catalogue),'Gaia sample 1')[0]?.id,gaia[0].id);
  const observer={x:-7089,y:0,z:2569},camera={azimuthDegrees:60.2,elevationDegrees:-61.1,horizontalFieldOfViewDegrees:140};
  const project=stars=>projectPreparedGalaxyPointSources(prepareGalaxyPointSources(stars,observer,12.4),camera,2000,1000,observer,0);
  const island=points=>points.filter(p=>p.canvasX>1100&&p.canvasX<1300&&p.canvasY>700&&p.canvasY<900).length;
  assert.ok(island(project(anchors))<island(project(catalogue))*.03);
  const model=project(modelPopulationEmitters);
  assert.ok(model.filter(p=>p.canvasX<800).length>model.filter(p=>p.canvasX>1000).length);
});

test('dark halo provides inward gravity and a plausible solar circular speed',()=>{
  assert.equal(enclosedDarkMatterMass(0),0);
  assert.ok(enclosedDarkMatterMass(16000)>enclosedDarkMatterMass(8000));
  const total=galacticAcceleration(sun),baryons=galacticAcceleration(sun,false);
  assert.ok(total.x>baryons.x&&baryons.x>0);
  assert.ok(galacticCircularSpeed(sun)>210&&galacticCircularSpeed(sun)<250);
  assert.ok(galacticAcceleration({x:3000,y:100,z:300}).z<0);
  const inner=galacticAcceleration({x:.01,y:0,z:0}),outer=galacticAcceleration({x:.02,y:0,z:0});
  assert.ok(Math.abs(inner.x/outer.x-4)<.01);
});

test('point-mass lens has two images, preserves foreground sources and follows mass-distance scaling',()=>{
  const lens=lensView({positionParsec:{x:1,y:0,z:0},massSolar:4e6},{x:0,y:0,z:0});
  const theta=einsteinAngleRadians(4e6,1,1000),direction=normalizeVector({x:1,y:theta,z:0});
  assert.deepEqual(lensedPointImages(direction,.5,lens),[{direction,magnification:1}]);
  const images=lensedPointImages(direction,1000,lens);
  assert.equal(images.length,2);assert.ok(images[0].direction.y>0&&images[1].direction.y<0);
  const positive=images[0].direction.y/images[0].direction.x,negative=images[1].direction.y/images[1].direction.x;
  assert.ok(Math.abs(positive*negative+theta*theta)<1e-14);
  assert.ok(Math.abs(images[0].magnification-images[1].magnification-1)<1e-9);
  assert.ok(Math.abs(einsteinAngleRadians(16e6,1,1000)/theta-2)<1e-12);
  const close=lensView({positionParsec:{x:.0001,y:0,z:0},massSolar:4e6},{x:0,y:0,z:0});
  assert.equal(lensedBackgroundDirection({x:1,y:0,z:0},close),null);
  assert.ok(dotProduct(lensedBackgroundDirection(normalizeVector({x:1,y:.2,z:0}),close),{x:1,y:0,z:0})>0);
});

test('black holes and added photographs are searchable with local assets and observational provenance',async()=>{
  const index=buildSkySearchIndex([]);
  for(const [query,id] of [['Sgr A*','sgr-a-star'],['银河中心黑洞','sgr-a-star'],['Cyg X-1','cygnus-x1'],['M87*','m87-star'],['船底座星云','carina'],['Helix Nebula','helix'],['Whirlpool Galaxy','m51'],['爱因斯坦环','molten-ring']]){
    assert.equal(searchSkyObjects(index,query)[0]?.id,id,query);
  }
  for(const id of ['carina','helix','m51','molten-ring']){
    const target=deepSkyTargetsById.get(id);
    await access(new URL('../public'+target.image.imagePath,import.meta.url));
    assert.ok(target.image.sourcePage.startsWith('https://'));assert.ok(target.image.creditShort);
    const camera=cameraFacingGalacticCentre({x:sun.x-target.positionParsec.x,y:-target.positionParsec.y,z:-target.positionParsec.z},{azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:5});
    assert.ok(Number.isFinite(camera.elevationDegrees));
  }
  assert.equal(deepSkyTargetsById.get('molten-ring').image.redshift,1.4796);
  for(const object of compactObjects)if(object.imagePath)await access(new URL('../public'+object.imagePath,import.meta.url));
});

test('both lensed star images remain selectable at their displayed directions',()=>{
  const observer={x:0,y:0,z:0},camera={azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:1};
  const lens=lensView({positionParsec:{x:1,y:0,z:0},massSolar:4e6},observer);
  const source={id:'lensed-star',role:'observed-bright-star',emitterPositionParsec:{x:1000,y:.8,z:0},
    absoluteVisualMagnitude:-5,extinctionMagnitude:0,linearRgb:[1,1,1],preparationTimeYears:0};
  const projected=projectPreparedGalaxyPointSources([source],camera,1200,700,observer,0,lens);
  assert.equal(projected.length,2);
  for(const image of projected){
    const hit=pickObservedStar([source],camera,observer,0,1200,700,image.canvasX,image.canvasY,3,{x:0,y:0,z:1},'space','camera',-18,lens);
    assert.equal(hit.id,'lensed-star');
    const again=projectDirectionPerspective(image.skyDirection,camera,1200,700);
    assert.ok(Math.abs(again.canvasX-image.canvasX)<1e-8);
  }
});
