import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

test('the real hook continues dispatching while its inputs change every 32 ms', async () => {
  let now=0, nextTimer=0, cursor=0, jobs=0, inFlight=0, maximumInFlight=0;
  const activeLayers={points:0,radiance:0};let maxPerLayer=0;
  const timers=new Map(), slots=[], effects=[];
  const schedule=(fn,delay,repeat=false)=>{const id=++nextTimer;timers.set(id,{fn,at:now+delay,delay,repeat});return id;};
  const clock={setInterval:(fn,delay)=>schedule(fn,delay,true),clearInterval:id=>timers.delete(id),
    setTimeout:(fn,delay)=>schedule(fn,delay),clearTimeout:id=>timers.delete(id)};
  const advance=duration=>{const end=now+duration;while(true){const entry=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;
    const [id,timer]=entry;now=timer.at;if(timer.repeat)timer.at+=timer.delay;else timers.delete(id);timer.fn();}now=end;};
  const hooks={
    useRef(value){const index=cursor++;return slots[index]??(slots[index]={current:value});},
    useState(value){const index=cursor++;if(!slots[index])slots[index]={value};return[slots[index].value,next=>{slots[index].value=typeof next==='function'?next(slots[index].value):next;}];},
    useEffect(effect,dependencies){const index=cursor++,old=slots[index];if(!old||dependencies.some((value,i)=>!Object.is(value,old.dependencies[i]))){
      effects.push(()=>{old?.cleanup?.();slots[index]={dependencies,cleanup:effect()};});}},
  };
  class FakeWorker {
    postMessage(request){if('catalogue' in request||'cancel' in request)return;activeLayers[request.layer]++;maxPerLayer=Math.max(maxPerLayer,activeLayers[request.layer]);jobs++;inFlight++;maximumInFlight=Math.max(maximumInFlight,inFlight);
      schedule(()=>{if(this.stopped)return;inFlight--;activeLayers[request.layer]--;this.onmessage?.({data:{kind:'radiance',id:request.id,width:request.width,height:request.width/2,position:request.position,pixels:new Uint8ClampedArray(4)}});},120);}
    terminate(){this.stopped=true;}
  }
  const previous={window:globalThis.window,Worker:globalThis.Worker};
  globalThis.window=clock;globalThis.Worker=FakeWorker;globalThis.__playbackHookTestRuntime=hooks;
  try {
    const location=new URL('../app/components/use-sky-computation.ts',import.meta.url);
    const source=(await readFile(location,'utf8')).replace(/import \{ useEffect, useRef, useState \} from "react";/,
      'const {useEffect,useRef,useState}=globalThis.__playbackHookTestRuntime;').replaceAll('import.meta.url',JSON.stringify(location.href));
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const {useSkyComputation}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
    const catalogue=[];
    for(let frame=0;frame<60;frame++){
      // The deterministic harness explicitly starts one simulated component render per iteration.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      cursor=0;useSkyComputation(catalogue,{x:-8277+frame/20,y:0,z:0},frame*32,'camera','observational',true);
      while(effects.length)effects.shift()();advance(32);
    }
    assert.ok(jobs>=8,`continuous playback dispatched only ${jobs} jobs`);
    assert.ok(maximumInFlight<=2,'only one point job and one background job may run');
    assert.equal(maxPerLayer,1,'obsolete jobs must not accumulate in either queue');
  } finally {
    for(const slot of slots)slot?.cleanup?.();
    globalThis.window=previous.window;globalThis.Worker=previous.Worker;delete globalThis.__playbackHookTestRuntime;
  }
});
