import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkyPointerController } from '../lib/rendering/sky-pointer.ts';
const down={pointerId:7,pointerType:'mouse',clientX:100,clientY:200,buttons:1,button:0,isPrimary:true};

test('a single click ends before picking; subsequent unpressed motion cannot pan',()=>{
  const pointer=createSkyPointerController();
  assert.equal(pointer.begin(down),true);
  assert.equal(pointer.move({...down,clientX:102}),null);
  const click=pointer.end({...down,buttons:0});
  assert.equal(click.dragged,false);
  assert.equal(pointer.activePointerId,null);
  assert.throws(()=>{throw new Error('catalogue lookup failed')});
  assert.equal(pointer.move({...down,clientX:500,buttons:0}),null);
  assert.equal(pointer.end(down),null,'duplicate global and local pointerup must not create another click');
});

test('missed pointerup, cancellation, and non-primary buttons cannot leave a latched drag',()=>{
  const pointer=createSkyPointerController();
  for(const cancel of [()=>pointer.move({...down,clientX:400,buttons:0}),()=>pointer.cancel()]){
    pointer.begin(down);assert.ok(pointer.move({...down,clientX:150}));cancel();
    assert.equal(pointer.activePointerId,null);assert.equal(pointer.move({...down,clientX:800,buttons:0}),null);
  }
  assert.equal(pointer.begin({...down,button:2,buttons:2}),false);
  assert.equal(pointer.begin({...down,isPrimary:false}),false);
});

test('dragging requires a held button and a movement threshold; a completed drag cannot become a click',()=>{
  const pointer=createSkyPointerController();pointer.begin(down);
  assert.equal(pointer.move({...down,clientX:104}),null);
  assert.deepEqual(pointer.move({...down,clientX:110}),{deltaX:10,deltaY:0,started:true});
  assert.deepEqual(pointer.move({...down,clientX:113,clientY:205}),{deltaX:3,deltaY:5,started:false});
  assert.equal(pointer.end({...down,clientX:113,clientY:205}).dragged,true);
  assert.equal(pointer.move({...down,clientX:200,buttons:0}),null);
});

test('touch taps work and unrelated pointers cannot move or finish the active pointer',()=>{
  const pointer=createSkyPointerController();pointer.begin({...down,pointerType:'touch'});
  assert.equal(pointer.move({...down,pointerId:8,clientX:500}),null);
  assert.equal(pointer.end({...down,pointerId:8}),null);
  assert.equal(pointer.end({...down,clientX:101}).pointerType,'touch');
});
