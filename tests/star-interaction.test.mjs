import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseObservedBrightStarCatalog} from '../lib/rendering/observed-star-catalog.ts';
import {prepareGalaxyPointSources,projectPreparedGalaxyPointSources} from '../lib/rendering/galaxy-star-renderer.ts';
import {pickObservedStar,drawObservedStarLabels} from '../lib/rendering/observed-star-interaction.ts';
import {blendDeepSkyPhoto} from '../lib/rendering/deep-sky-composite.ts';
import {deepSkyImageSources,projectDeepSkyImageSources} from '../lib/rendering/deep-sky-image-catalog.ts';
import {resolveQuickView} from '../lib/rendering/quick-view.ts';
const observer={x:-8277,y:0,z:0},zenith={x:0,y:0,z:1};

test('picking a catalogue star returns its real source record and follows live parallax',async()=>{
  const stars=parseObservedBrightStarCatalog(await readFile(new URL('../public/data/yale-bright-stars.csv',import.meta.url),'utf8'));
  const sirius=stars.find(source=>source.displayName==='Sirius');
  assert.equal(sirius.observedData.catalogueIdentifier,'32349');
  assert.equal(sirius.observedData.referenceApparentMagnitude,-1.46);
  assert.equal(sirius.observedData.measuredVelocity,false);
  const prepared=prepareGalaxyPointSources([sirius],observer,16.5);
  const direction={x:sirius.positionParsec.x-observer.x,y:sirius.positionParsec.y,z:sirius.positionParsec.z};
  const camera=resolveQuickView(direction,{azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:5},zenith,false).camera;
  const hit=pickObservedStar(prepared,camera,observer,0,1000,600,500,300,12,zenith,'space','camera',-18);
  assert.equal(hit.id,sirius.id);
  const moved={...observer,y:observer.y+1};
  assert.equal(pickObservedStar(prepared,camera,moved,0,1000,600,500,300,12,zenith,'space','camera',-18),null);
  assert.equal(pickObservedStar([{...prepared[0],role:'model-population-tracer'}],camera,observer,0,1000,600,500,300,12,zenith,'space','camera',-18),null);
  assert.equal(pickObservedStar(prepared,camera,observer,0,1000,600,900,300,12,zenith,'space','camera',-18),null);
});

test('name overlay skips malformed coordinates, avoids collisions and restores canvas state',()=>{
  const written=[];let depth=0;
  const context={save(){depth++},restore(){depth--},measureText(){return{width:60}},fillText(text,x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));written.push(text)}};
  const source={id:'real',canvasX:200,canvasY:100,distanceParsec:10,apparentVisualMagnitude:0,linearRgb:[1,1,1],role:'observed-bright-star',skyDirection:zenith,displayName:'Sirius'};
  drawObservedStarLabels(context,[source,{...source,id:'overlap',displayName:'Vega'},{...source,canvasX:NaN},{...source,canvasX:500,role:'model-population-tracer'}],1,1000,600,zenith,'space','camera',-18);
  assert.deepEqual(written,['天狼星']);assert.equal(depth,0);
  const broken={id:'bad',distanceParsec:1,apparentVisualMagnitude:NaN,absoluteVisualMagnitude:NaN,extinctionMagnitude:0,linearRgb:[1,1,1],emitterPositionParsec:observer,preparationTimeYears:0};
  assert.deepEqual(projectPreparedGalaxyPointSources([broken],{azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:82},1000,600,observer,0),[]);
});

test('photo blending has transparent outer pixels and preserves the central structure',()=>{
  const width=80,height=60,pixels=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<pixels.length;i+=4){pixels[i]=8;pixels[i+1]=10;pixels[i+2]=15;pixels[i+3]=255;}
  const centre=(30*width+40)*4;pixels.set([180,120,100,255],centre);
  const output=blendDeepSkyPhoto(pixels,width,height,'immersive');
  for(let x=0;x<width;x++){assert.equal(output[x*4+3],0);assert.equal(output[((height-1)*width+x)*4+3],0);}
  for(let y=0;y<height;y++){assert.equal(output[(y*width)*4+3],0);assert.equal(output[(y*width+width-1)*4+3],0);}
  assert.ok(output[centre]>160);assert.equal(output[centre+3],255);
});

test('wide-field photographs use their actual field and have finite sky-aligned projected axes',()=>{
  for(const [id,widthDegrees] of [['omega-centauri-image',.848],['m42-image',59.95/60],['m31-image',362/60]]){
    const source=deepSkyImageSources.find(source=>source.id===id);
    const direction={x:source.positionParsec.x-observer.x,y:source.positionParsec.y,z:source.positionParsec.z};
    const camera=resolveQuickView(direction,{azimuthDegrees:0,elevationDegrees:0,horizontalFieldOfViewDegrees:10},zenith,false).camera;
    const projected=projectDeepSkyImageSources([source],observer,camera,1000,600)[0];
    assert.ok(Math.abs(projected.majorAngularDiameterDegrees-widthDegrees)<1e-7);
    assert.ok([projected.imageRightCanvasX,projected.imageRightCanvasY,projected.imageDownCanvasX,projected.imageDownCanvasY].every(Number.isFinite));
    const determinant=projected.imageRightCanvasX*projected.imageDownCanvasY-projected.imageRightCanvasY*projected.imageDownCanvasX;
    assert.ok(Math.abs(determinant)>1);
  }
});

test('M31 photograph and non-photographic outline retain the same celestial orientation after movement',async()=>{
  const {cataloguedExtragalacticSources,prepareExtragalacticSources,projectPreparedExtragalacticSources}=await import('../lib/rendering/extragalactic-catalog.ts');
  const {projectExtendedAxis}=await import('../lib/rendering/extended-source-frame.ts');
  const m31=cataloguedExtragalacticSources.find(source=>source.id==='m31');
  const photo=deepSkyImageSources.find(source=>source.id==='m31-image');
  // Position angle is east of north; the image header places north 1.9 degrees left of vertical.
  const angle=(35+1.9)*Math.PI/180;
  const photoMajor={x:-photo.imageRightUnit.x*Math.sin(angle)+photo.imageUpUnit.x*Math.cos(angle),
    y:-photo.imageRightUnit.y*Math.sin(angle)+photo.imageUpUnit.y*Math.cos(angle),
    z:-photo.imageRightUnit.z*Math.sin(angle)+photo.imageUpUnit.z*Math.cos(angle)};
  for(const position of [observer,{x:-10740,y:168.6,z:0},{x:-5000,y:2000,z:600}]){
    const camera={azimuthDegrees:100.5,elevationDegrees:-17.6,horizontalFieldOfViewDegrees:104};
    const outline=projectPreparedExtragalacticSources(prepareExtragalacticSources([m31],observer),camera,1200,800,position)[0];
    assert.ok(outline);
    const relative={x:photo.positionParsec.x-position.x,y:photo.positionParsec.y-position.y,z:photo.positionParsec.z-position.z};
    const axis=projectExtendedAxis(relative,photoMajor,m31.majorPhysicalDiameterParsec,camera,1200,800);
    const dot=(axis.x*outline.majorCanvasX+axis.y*outline.majorCanvasY)/(Math.hypot(axis.x,axis.y)*Math.hypot(outline.majorCanvasX,outline.majorCanvasY));
    assert.ok(dot>.9999,`photograph and outline orientation disagree: ${dot}`);
  }
});

test('observational photo colours reduce saturation without changing luminance or geometry',()=>{
  const pixels=new Uint8ClampedArray(40*40*4),offset=(20*40+20)*4;
  pixels.set([210,60,100,255],offset);
  const subdued=blendDeepSkyPhoto(pixels,40,40,'observational'),enhanced=blendDeepSkyPhoto(pixels,40,40,'immersive');
  const luminance=image=>.2126*(image[offset]/255)**2.2+.7152*(image[offset+1]/255)**2.2+.0722*(image[offset+2]/255)**2.2;
  assert.ok(Math.abs(luminance(subdued)-luminance(enhanced))<.003);
  assert.ok(subdued[offset]-subdued[offset+1]<enhanced[offset]-enhanced[offset+1]);
  for(let index=3;index<pixels.length;index+=4)assert.equal(subdued[index],enhanced[index]);
});

test('photos screen against the visible sky and are below the terrain; dark photographic pixels cannot occlude the sky',async()=>{
  const css=await readFile(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.match(css,/\.sky-photo-layer\s*\{[^}]*mix-blend-mode:\s*screen/);
  const photoOrder=Number(css.match(/\.sky-photo-layer\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  const terrainOrder=Number(css.match(/\.sky-terrain-layer\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  assert.ok(photoOrder<terrainOrder);
  const scene=await readFile(new URL('../app/components/planetarium-scene.tsx',import.meta.url),'utf8');
  assert.match(scene,/photoContext\.drawImage\(image/);
  assert.doesNotMatch(scene,/context\.rotate\(\(galaxy\.positionAngleDegrees/);
});
