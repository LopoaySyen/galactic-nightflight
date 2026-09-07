import type { PointSourceSample, ObservationMode } from "./contracts.ts";
import type { Vector3 } from "../physics/vector.ts";
import { renderGalaxyAllSkyRadiancePixels, type GalaxyColourGrade } from "./galaxy-radiance.ts";
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
}
export interface SkyComputeResult {
  id: number;
  position: Vector3;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
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
let radiancePixels = new Uint8ClampedArray(0);
let preparationKey = "";
let preparedPosition:Vector3 | null = null;
let preparedTimeYears = 0;
let radiancePosition:Vector3 | null = null;
let cachedWidth=0;
let sources: PreparedGalaxyPointSource[] = [];
let galaxies: PreparedExtragalacticSource[] = [];
const separation = (a:Vector3|null,b:Vector3) => a ? Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z) : Infinity;

let radianceGeneration = 0;
self.onmessage = (event: MessageEvent<{ catalogue: PointSourceSample[] } | {cancel:true} | SkyComputeRequest>) => {
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
  const nextRadianceKey=[mode,grade].join("|");
  const radianceDistance=separation(radiancePosition,position);
  if(nextRadianceKey!==radianceKey || cachedWidth<width || radianceDistance>=5 || (width>=384 && radianceDistance>1e-9)) {
    const generation=++radianceGeneration;
    // Independent background work can show a quick sky before the point catalogue
    // finishes. Yield between strips so an obsolete refinement can be cancelled.
    const levels = request.layer === "radiance" && width > 128 ? [64, 128, width]
      : request.layer === "radiance" && width > 64 ? [64, width] : [width];
    for (const level of levels) {
      if(level < width && nextRadianceKey===radianceKey && radianceDistance<5 && cachedWidth>=level) continue;
      const pixels=new Uint8ClampedArray(level*level/2*4);
      for(let row=0;row<level/2;row+=4) {
        if(generation!==radianceGeneration) {
          self.postMessage({kind:"ack",id:request.id,width:0} satisfies SkyWorkerMessage); return;
        }
        renderGalaxyAllSkyRadiancePixels(position,mode,level,level/2,grade,{start:row,end:Math.min(row+4,level/2),pixels});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(level < width) {
        self.postMessage({kind:"preview",id:request.id,position,width:level,height:level/2,pixels} satisfies SkyWorkerMessage,{transfer:[pixels.buffer]});
      } else radiancePixels=pixels;
    }
    radiancePosition=position; radianceKey=nextRadianceKey; cachedWidth=width;
  } else {
    self.postMessage({kind:"ack",id:request.id,width:cachedWidth} satisfies SkyWorkerMessage);
    return;
  }
  // Keep one worker-side cached copy; transfer a separate buffer to the UI.
  const pixels = radiancePixels.slice();
  const result: SkyWorkerMessage = { kind:"radiance", id: request.id, position:radiancePosition ?? position, width, height, pixels };
  self.postMessage(result, { transfer: [pixels.buffer] });
}
