import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

test('background sky computation returns transferable pixels and prepared catalogues', async () => {
  const moduleUrl = new URL('../lib/rendering/sky-compute.worker.ts', import.meta.url).href;
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads');
    globalThis.self = { postMessage(data, options) { parentPort.postMessage(data, options?.transfer); } };
    import(${JSON.stringify(moduleUrl)}).then(() => parentPort.on('message', data => self.onmessage({data})));
  `, {eval:true});
  try {
    const response = new Promise((resolve,reject) => { let points; worker.on('message', message => { if(message.kind==='points') points=message; else resolve({...message,sources:points?.sources,galaxies:points?.galaxies}); }); worker.once('error',reject); });
    worker.postMessage({catalogue:[{id:'worker-observed-test',positionParsec:{x:-8267,y:0,z:0},absoluteVisualMagnitude:1,effectiveTemperatureKelvin:5800,role:'observed-bright-star'}]});
    worker.postMessage({id:42,position:{x:-8277,y:0,z:0},timeYears:0,mode:'camera',grade:'observational',width:64,catalogueVersion:1});
    const result = await response;
    assert.equal(result.id,42);
    assert.equal(result.pixels.length,64*32*4);
    assert.equal(result.sources.length,1);
    assert.equal(result.sources[0].distanceParsec,10);
    assert.ok(result.galaxies.length > 2000);
    assert.ok(result.pixels.some((value,index)=>index%4!==3 && value>20));
  } finally { await worker.terminate(); }
});

test('travel near the reported central position keeps stars and retains the sharper sky during playback', async () => {
  const moduleUrl = new URL('../lib/rendering/sky-compute.worker.ts', import.meta.url).href;
  const catalogueUrl = new URL('../lib/rendering/model-star-catalog.ts', import.meta.url).href;
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads');
    globalThis.self = { postMessage(data, options) { parentPort.postMessage(data, options?.transfer); } };
    Promise.all([import(${JSON.stringify(moduleUrl)}),import(${JSON.stringify(catalogueUrl)})]).then(([,catalogue]) => {
      self.onmessage({data:{catalogue:catalogue.modelPopulationEmitters}});
      parentPort.on('message', data => self.onmessage({data}));
    });
  `, {eval:true});
  const request = data => new Promise((resolve,reject) => {
    const messages=[];
    const receive=message=>{messages.push(message);if(message.kind!=='points'){
      worker.off('message',receive);worker.off('error',reject);resolve(messages);
    }};
    worker.on('message',receive);worker.once('error',reject);worker.postMessage(data);
  });
  try {
    const initial={id:1,position:{x:-166,y:1.5,z:0},timeYears:0,mode:'camera',grade:'observational',width:64,catalogueVersion:1};
    const first=await request(initial);
    assert.deepEqual(first.map(message=>message.kind),['points','radiance']);
    assert.ok(first[0].sources.filter(source=>source.apparentVisualMagnitude<12.4).length>1000);
    const playback=await request({...initial,id:2,timeYears:32,width:32});
    assert.deepEqual(playback.map(message=>message.kind),['ack']);
    assert.equal(playback[0].width,64,'playing must not replace a sharper cached sky with a blurred one');
    const moved=await request({...initial,id:3,position:{x:-173,y:1.5,z:0},timeYears:2000,width:32});
    assert.deepEqual(moved.map(message=>message.kind),['points','radiance']);
    assert.equal(moved[0].position.x,-173);
    assert.ok(moved[0].sources.filter(source=>source.apparentVisualMagnitude<12.4).length>1000);
    assert.equal(moved[0].sources[0].preparationTimeYears,2000);
    assert.notEqual(moved[0].sources[0].distanceParsec,first[0].sources[0].distanceParsec);
  } finally { await worker.terminate(); }
});

test('independent dust work returns a preview and can cancel obsolete fine detail', async () => {
  const moduleUrl = new URL('../lib/rendering/sky-compute.worker.ts', import.meta.url).href;
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads');
    globalThis.self = { postMessage(data, options) { parentPort.postMessage(data, options?.transfer); } };
    import(${JSON.stringify(moduleUrl)}).then(() => parentPort.on('message', data => self.onmessage({data})));
  `, {eval:true});
  try {
    const messages=[];
    const completed=new Promise((resolve,reject)=>{
      worker.on('message',message=>{
        messages.push(message);
        if(message.kind==='preview')worker.postMessage({cancel:true});
        if(message.kind==='ack'||message.kind==='radiance')resolve(message);
      });worker.once('error',reject);
    });
    worker.postMessage({id:77,position:{x:-8277,y:0,z:0},timeYears:0,mode:'camera',grade:'observational',width:384,catalogueVersion:0,layer:'radiance'});
    const result=await completed;
    assert.equal(messages[0].kind,'preview');assert.equal(messages[0].width,64);
    assert.equal(result.kind,'ack');assert.equal(result.width,0);
    assert.ok(!messages.some(message=>message.kind==='points'));
  }finally{await worker.terminate();}
});

test('cached volume refines without blurry previews and restores a previous stop without recomputation', {timeout:15000}, async () => {
  const moduleUrl=new URL('../lib/rendering/sky-compute.worker.ts',import.meta.url).href;
  const worker=new Worker(`
    const {parentPort}=require('node:worker_threads');
    globalThis.self={postMessage(data,options){parentPort.postMessage(data,options?.transfer);}};
    import(${JSON.stringify(moduleUrl)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));
  `,{eval:true});
  const request=(data,cancelImmediately=false)=>new Promise((resolve,reject)=>{
    const messages=[];
    const receive=message=>{
      messages.push(message);
      if(['radiance','ack','failed'].includes(message.kind)){
        worker.off('message',receive);worker.off('error',reject);resolve(messages);
      }
    };
    worker.on('message',receive);worker.once('error',reject);worker.postMessage(data);
    if(cancelImmediately)worker.postMessage({cancel:true});
  });
  try{
    const fieldData=new Uint8Array(gunzipSync(await readFile(new URL('../public/data/galaxy-field-v1.bin.gz',import.meta.url))));
    worker.postMessage({fieldData},[fieldData.buffer]);
    const first={id:10,position:{x:-8277,y:0,z:0},timeYears:0,mode:'camera',grade:'observational',width:64,catalogueVersion:0,layer:'radiance'};
    const a=await request(first);
    assert.deepEqual(a.map(message=>message.kind),['radiance']);
    assert.equal(a[0].coarsePixels.length,a[0].pixels.length);
    assert.ok(a[0].pixels.some((value,index)=>value!==a[0].coarsePixels[index]),'refinement must restore dust structure');
    const b=await request({...first,id:11,position:{x:-3500,y:400,z:60}});
    assert.notDeepEqual(b[0].pixels,a[0].pixels,'relocating must change the sky');
    // A real cache hit finishes before a following cancel. A new striped
    // integral yields and must be cancelled; no fragile wall-clock threshold.
    const restored=await request({...first,id:12},true);
    assert.deepEqual(restored.map(message=>message.kind),['radiance']);
    assert.deepEqual(restored[0].pixels,a[0].pixels);
    assert.deepEqual(restored[0].coarsePixels,a[0].coarsePixels);
    const infrared=await request({...first,id:13,mode:'near-infrared'});
    assert.notDeepEqual(infrared[0].pixels,a[0].pixels,'spectral modes must not share a refined frame');
    const cancelled=await request({...first,id:14,position:{x:8277,y:0,z:0},width:384},true);
    assert.equal(cancelled.at(-1).kind,'ack');
    assert.equal(cancelled.at(-1).width,0);
  }finally{await worker.terminate();}
});
