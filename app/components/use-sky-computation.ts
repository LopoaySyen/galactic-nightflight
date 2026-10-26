"use client";
import { useEffect, useRef, useState } from "react";
import type { PointSourceSample, ObservationMode } from "@/lib/rendering/contracts";
import type { GalaxyColourGrade } from "@/lib/rendering/galaxy-radiance";
import type { Vector3 } from "@/lib/physics/vector";
import type { SkyComputeRequest, SkyComputeResult, SkyPointResult, SkyWorkerMessage } from "@/lib/rendering/sky-compute.worker";
import type { GalacticFieldCache } from "@/lib/rendering/galaxy-field-cache";

export function useSkyComputation(emitters: PointSourceSample[], position: Vector3,
  timeYears: number, mode: ObservationMode, grade: GalaxyColourGrade, moving: boolean,
  fieldCache:GalacticFieldCache|null=null,
  captureCoarseSky?:(request:SkyComputeRequest)=>Uint8ClampedArray|null) {
  const [result, setResult] = useState<SkyComputeResult | null>(null);
  const [points, setPoints] = useState<SkyPointResult | null>(null);
  const [state, setState] = useState<"updating" | "ready" | "failed">("updating");
  const pointsWorkerRef = useRef<Worker | null>(null);
  const radianceWorkerRef = useRef<Worker | null>(null);
  const fieldCacheRef=useRef(fieldCache);
  const changedAtRef=useRef(0);
  const captureRef=useRef(captureCoarseSky);
  useEffect(()=>{captureRef.current=captureCoarseSky;},[captureCoarseSky]);
  const latestRef = useRef<SkyComputeRequest | null>(null);
  const sequenceRef = useRef(0);
  const versionRef = useRef(0);
  const pumpRef = useRef(() => {});

  useEffect(() => {
    // Separate queues: a large point catalogue must never delay the dust preview.
    const queues = (["points", "radiance"] as const).map(layer => ({layer,
      worker:new Worker(new URL("../../lib/rendering/sky-compute.worker.ts", import.meta.url),{type:"module"}),
      active:null as SkyComputeRequest|null, sentKey:"", ready:false, failed:false, cancelled:false,
    }));
    pointsWorkerRef.current=queues[0].worker;
    radianceWorkerRef.current=queues[1].worker;
    const key=(request:SkyComputeRequest,layer:"points"|"radiance")=>
      [request.position.x,request.position.y,request.position.z,request.mode,request.width,
        layer==="points"?request.timeYears:request.grade,layer==="points"?request.catalogueVersion:fieldCacheRef.current?1:0].join("|");
    const report=()=>setState(queues.some(queue=>queue.failed)?"failed":queues.every(queue=>queue.ready)?"ready":"updating");
    pumpRef.current=()=>{
      const latest=latestRef.current;if(!latest)return;
      for(const queue of queues){
        if(queue.failed)continue;
        const waitingForStop=queue.layer==="radiance"&&!!fieldCacheRef.current&&
          (latest.moving||performance.now()-changedAtRef.current<250);
        if(queue.active){
          const previous=queue.active;
          const moved=Math.hypot(previous.position.x-latest.position.x,previous.position.y-latest.position.y,previous.position.z-latest.position.z);
          const stalePosition=fieldCacheRef.current?moved>1e-9:previous.width>=384&&moved>=5;
          if(queue.layer==="radiance" && !queue.cancelled &&
            (waitingForStop||stalePosition||previous.mode!==latest.mode||previous.grade!==latest.grade)){
            queue.cancelled=true;queue.worker.postMessage({cancel:true});
          }
          continue;
        }
        if(waitingForStop){queue.ready=true;continue;}
        const nextKey=key(latest,queue.layer);
        if(queue.sentKey===nextKey)continue;
        queue.sentKey=nextKey;queue.ready=false;queue.cancelled=false;
        const coarsePixels=queue.layer==="radiance"&&fieldCacheRef.current?captureRef.current?.(latest):null;
        queue.active={...latest,layer:queue.layer,coarsePixels:coarsePixels??undefined};
        queue.worker.postMessage(queue.active,coarsePixels?[coarsePixels.buffer]:[]);
      }
      report();
    };
    for(const queue of queues){
      queue.worker.onmessage=(event:MessageEvent<SkyWorkerMessage>)=>{
        const message=event.data;
        if(message.id!==queue.active?.id)return;
        const desired=latestRef.current;
        const fresh='position' in message && !!desired &&
          Math.hypot(message.position.x-desired.position.x,message.position.y-desired.position.y,message.position.z-desired.position.z)<5 &&
          queue.active?.mode===desired.mode && (queue.layer==='points'?queue.active?.catalogueVersion===desired.catalogueVersion:queue.active?.grade===desired.grade);
        if(message.kind==="points"){if(fresh)setPoints(message);return;}
        if(message.kind==="preview"){
          if(fresh&&!fieldCacheRef.current)setResult(previous=>previous&&previous.mode===message.mode&&previous.grade===message.grade&&previous.width>message.width?previous:message);
          return;
        }
        if(message.kind==="radiance"&&fresh)setResult(message);
        if(message.kind==="failed")queue.failed=true;
        const latest=latestRef.current;
        queue.ready=!!latest && queue.sentKey===key(latest,queue.layer) && message.kind!=="failed" && message.width>=latest.width;
        queue.active=null;
        if(!queue.ready)queue.sentKey="";
        report();pumpRef.current();
      };
      queue.worker.onerror=()=>{queue.failed=true;queue.active=null;report();};
    }
    const timer=window.setInterval(()=>pumpRef.current(),80);
    return()=>{window.clearInterval(timer);for(const queue of queues)queue.worker.terminate();pointsWorkerRef.current=null;radianceWorkerRef.current=null;};
  }, []);

  useEffect(()=>{
    fieldCacheRef.current=fieldCache;
    if(fieldCache&&radianceWorkerRef.current){
      const fieldData=fieldCache.data.slice();
      radianceWorkerRef.current.postMessage({fieldData},[fieldData.buffer]);
    }
  },[fieldCache]);

  useEffect(()=>{
    versionRef.current++;
    pointsWorkerRef.current?.postMessage({catalogue:emitters});
  },[emitters]);
  useEffect(()=>{
    const previous=latestRef.current;
    if(!previous||previous.position.x!==position.x||previous.position.y!==position.y||previous.position.z!==position.z||previous.mode!==mode||previous.grade!==grade||previous.moving!==moving)changedAtRef.current=performance.now();
    latestRef.current={id:++sequenceRef.current,position,timeYears,mode,grade,
      moving,width:moving?128:384,catalogueVersion:versionRef.current};
  },[emitters,position,timeYears,mode,grade,moving]);
  return {result,points,state};
}
