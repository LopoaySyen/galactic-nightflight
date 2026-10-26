import assert from 'node:assert/strict';
import test from 'node:test';
import { createGalaxyRefinementDetail, GALAXY_REFINEMENT_LOG_LIMIT } from '../lib/rendering/galaxy-refinement.ts';

const image=(width,height,pixel)=>Uint8ClampedArray.from({length:width*height*4},(_,i)=>pixel(Math.floor(i/4)%width,Math.floor(i/4/width))[i%4]);
const gain=(detail,i)=>Math.exp((detail[i*4]-detail[i*4+1])/255*GALAXY_REFINEMENT_LOG_LIMIT);

test('refinement ignores a global exposure or white-balance change',()=>{
  const width=120,height=60;
  const coarse=image(width,height,(x,y)=>{const v=10+(x+y)%20;return [2*v,3*v,4*v,255];});
  for(const colour of [[4,6,8],[4,3,2]]){
    const refined=image(width,height,(x,y)=>{const v=10+(x+y)%20;return [...colour.map(c=>c*v),255];});
    const detail=createGalaxyRefinementDetail(refined,coarse,width,height);
    const maxChange=Math.max(...Array.from({length:width*height},(_,i)=>Math.abs(gain(detail,i)-1)));
    assert.ok(maxChange<0.006,`A broad lighting change must not enter the detail layer: ${maxChange}`);
  }
});

test('local dust contrast survives with bounded gain and no broad brightness lift',()=>{
  const width=120,height=60;
  const coarse=image(width,height,()=>[40,60,100,255]);
  const refined=image(width,height,(x,y)=>x===60&&y>=25&&y<=35?[4,6,10,255]:[40,60,100,255]);
  const detail=createGalaxyRefinementDetail(refined,coarse,width,height);
  assert.ok(gain(detail,30*width+60)<0.93,'A narrow dust lane must remain darker');
  for(let i=0;i<width*height;i++){
    const factor=gain(detail,i);
    assert.ok(factor>=1/1.12-1e-10&&factor<=1.12+1e-10);
  }
  const meanGain=Array.from({length:width*height},(_,i)=>gain(detail,i)).reduce((a,b)=>a+b,0)/(width*height);
  assert.ok(Math.abs(meanGain-1)<0.002,'Local detail must not lift the whole sky');
});

test('unchanged and near-black skies receive no brightness correction',()=>{
  const width=64,height=32;
  const coarse=image(width,height,()=>[0,1,3,255]);
  for(const refined of [coarse,image(width,height,()=>[20,1,40,255])]){
    const detail=createGalaxyRefinementDetail(refined,coarse,width,height);
    for(let i=0;i<width*height;i++)assert.equal(gain(detail,i),1);
  }
});

test('local detail wraps continuously across the longitude seam',()=>{
  const width=120,height=60;
  const coarse=image(width,height,()=>[80,80,80,255]);
  const refined=image(width,height,(x)=>x===0?[50,50,50,255]:[80,80,80,255]);
  const detail=createGalaxyRefinementDetail(refined,coarse,width,height);
  for(let x=1;x<10;x++)assert.equal(gain(detail,30*width+x),gain(detail,30*width+width-x));
});
