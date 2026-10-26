import type { PointSourceSample, ObservationMode } from "./contracts.ts";
import type { Vector3 } from "../physics/vector.ts";
import { renderGalaxyAllSkyRadiancePixels, sampleGalacticDustDensity, type GalaxyColourGrade, type GalacticFieldSampler } from "./galaxy-radiance.ts";
import { createGalacticFieldCache, type GalacticFieldCache } from "./galaxy-field-cache.ts";
import { prepareGalaxyPointSources, type PreparedGalaxyPointSource } from "./galaxy-star-renderer.ts";
import { allExtragalacticSources, prepareExtragalacticSources, type PreparedExtragalacticSource } from "./extragalactic-catalog.ts";

export interface SkyComputeRequest {
  id: number;
  position: Vector3;
  timeYears: number;
  mode: ObservationMode;
  grade: GalaxyColourGrade;
  width: number;
  catalogueVersion: number;
  layer?: "points" | "radiance";
  moving?: boolean;
  coarsePixels?: Uint8ClampedArray;
}
export interface SkyComputeResult {
  id: number;
  position: Vector3;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  mode: ObservationMode;
  grade: GalaxyColourGrade;
  coarsePixels?: Uint8ClampedArray;
}
export interface SkyPointResult {
  id: number;
  position: Vector3;
  sources: PreparedGalaxyPointSource[];
  galaxies: PreparedExtragalacticSource[];
}
export type SkyWorkerMessage = ({kind:"points"} & SkyPointResult) | ({kind:"radiance"|"preview"} & SkyComputeResult) | {kind:"ack";id:number;width:number} | {kind:"failed";id:number};

let emitters: PointSourceSample[] = [];
let radianceKey = "";
let radiancePixels:Uint8ClampedArray = new Uint8ClampedArray(0);
let preparationKey = "";
let preparedPosition:Vector3 | null = null;
let preparedTimeYears = 0;
let radiancePosition:Vector3 | null = null;
let cachedWidth=0;
let coarsePixels:Uint8ClampedArray|undefined;
let fieldCache:GalacticFieldCache|null=null;
// Whole refined views complement the reusable volume. Revisiting a stop is free.
const recentFrames=new Map<string,SkyComputeResult>();
const frameKey=(request:SkyComputeRequest)=>[request.position.x,request.position.y,request.position.z,request.mode,request.grade].join("|");
function deliver(result:SkyComputeResult,id:number){
  const pixels=result.pixels.slice(),coarse=result.coarsePixels?.slice();
  const transfer=[pixels.buffer,...(coarse?[coarse.buffer]:[])];
  self.postMessage({...result,id,kind:"radiance",pixels,coarsePixels:coarse} satisfies SkyWorkerMessage,{transfer});
}
let sources: PreparedGalaxyPointSource[] = [];
let galaxies: PreparedExtragalacticSource[] = [];
const separation = (a:Vector3|null,b:Vector3) => a ? Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z) : Infinity;

let radianceGeneration = 0;
self.onmessage = (event: MessageEvent<{ catalogue: PointSourceSample[] } | {fieldData:Uint8Array} | {cancel:true} | SkyComputeRequest>) => {
  if("fieldData" in event.data){
    fieldCache=createGalacticFieldCache(event.data.fieldData);
    radianceGeneration++;radianceKey="";recentFrames.clear();return;
  }
  if ("catalogue" in event.data) {
    emitters = event.data.catalogue;
    preparationKey = "";
    return;
  }
  if ("cancel" in event.data) { radianceGeneration++; return; }
  const request = event.data;
  void compute(request).catch(() => self.postMessage({kind:"failed",id:request.id} satisfies SkyWorkerMessage));
};

async function compute(request: SkyComputeRequest) {
  const { position, timeYears, mode, grade, width } = request;
  const height = width / 2;
  const nextPreparationKey = [mode,request.catalogueVersion].join("|");
  const positionChange=separation(preparedPosition,position);
  const timeChange=Math.abs(timeYears-preparedTimeYears);
  const exactWhenSettled=width>=384 && (positionChange>1e-9 || timeChange>1e-9);
  if(request.layer !== "radiance" && (nextPreparationKey!==preparationKey || positionChange>=1 || timeChange>=1000 || exactWhenSettled)) {
    sources=prepareGalaxyPointSources(emitters,position,mode==="camera" || mode==="near-infrared" ? 16.5:11,timeYears);
    galaxies=prepareExtragalacticSources(allExtragalacticSources,position);
    preparedPosition=position; preparedTimeYears=timeYears; preparationKey=nextPreparationKey;
    // Deliver points before the more expensive continuous-sky integral.
    self.postMessage({kind:"points",id:request.id,position,sources,galaxies} satisfies SkyWorkerMessage);
  }
  if(request.layer === "points") {
    self.postMessage({kind:"ack",id:request.id,width} satisfies SkyWorkerMessage);
    return;
  }
  const saved=recentFrames.get(frameKey(request));
  if(saved&&saved.width>=width&&(separation(radiancePosition,position)>1e-9||radianceKey!==[mode,grade].join("|"))){
    recentFrames.delete(frameKey(request));recentFrames.set(frameKey(request),saved);
    radiancePosition=saved.position;radianceKey=[mode,grade].join("|");cachedWidth=saved.width;
    radiancePixels=saved.pixels;coarsePixels=saved.coarsePixels;
    deliver(saved,request.id);return;
  }
  const nextRadianceKey=[mode,grade].join("|");
  const radianceDistance=separation(radiancePosition,position);
  if(nextRadianceKey!==radianceKey || cachedWidth<width || radianceDistance>=5 || (width>=384 && radianceDistance>1e-9)) {
    const generation=++radianceGeneration;
    // Independent background work can show a quick sky before the point catalogue
    // finishes. Yield between strips so an obsolete refinement can be cancelled.
    const levels = fieldCache ? [width] : request.layer === "radiance" && width > 128 ? [64, 128, width]
      : request.layer === "radiance" && width > 64 ? [64, width] : [width];
    const cachedSampler=fieldCache?.sample;
    // Retain the precomputed smooth stellar components, but restore the complete
    // 3-D cloud model at rest. The compact nucleus remains analytic in both paths.
    const detailedSampler:GalacticFieldSampler|undefined=fieldCache?position=>{
      const field=fieldCache!.sampleStellar(position);
      field.dustRelativeDensity=sampleGalacticDustDensity(position);return field;
    }:undefined;
    for (const level of levels) {
      if(level < width && nextRadianceKey===radianceKey && radianceDistance<5 && cachedWidth>=level) continue;
      const pixels=new Uint8ClampedArray(level*level/2*4);
      const suppliedCoarse=level===width&&request.coarsePixels?.length===pixels.length?request.coarsePixels:undefined;
      const coarse=suppliedCoarse??(cachedSampler?new Uint8ClampedArray(pixels.length):undefined);
      for(let row=0;row<level/2;row+=4) {
        if(generation!==radianceGeneration) {
          self.postMessage({kind:"ack",id:request.id,width:0} satisfies SkyWorkerMessage); return;
        }
        const end=Math.min(row+4,level/2);
        if(coarse&&!suppliedCoarse)renderGalaxyAllSkyRadiancePixels(position,mode,level,level/2,grade,{start:row,end,pixels:coarse},cachedSampler);
        renderGalaxyAllSkyRadiancePixels(position,mode,level,level/2,grade,{start:row,end,pixels},detailedSampler);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(generation!==radianceGeneration){self.postMessage({kind:"ack",id:request.id,width:0} satisfies SkyWorkerMessage);return;}
      if(level < width) {
        self.postMessage({kind:"preview",id:request.id,position,mode,grade,width:level,height:level/2,pixels} satisfies SkyWorkerMessage,{transfer:[pixels.buffer]});
      } else {radiancePixels=pixels;coarsePixels=coarse;}
    }
    radiancePosition=position; radianceKey=nextRadianceKey; cachedWidth=width;
  } else {
    self.postMessage({kind:"ack",id:request.id,width:cachedWidth} satisfies SkyWorkerMessage);
    return;
  }
  // Keep one worker-side cached copy; transfer a separate buffer to the UI.
  const result:SkyComputeResult={id:request.id,position:radiancePosition??position,mode,grade,width,height,pixels:radiancePixels,coarsePixels};
  recentFrames.set(frameKey(request),result);
  while(recentFrames.size>6)recentFrames.delete(recentFrames.keys().next().value!);
  deliver(result,request.id);
}
