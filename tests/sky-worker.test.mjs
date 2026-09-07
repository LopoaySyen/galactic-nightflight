import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

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
