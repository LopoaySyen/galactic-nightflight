import type {ObservationMode, ProjectedPointSource, ViewCamera} from './contracts.ts';
import type {Vector3} from '../physics/vector.ts';
import type {PreparedGalaxyPointSource} from './galaxy-star-renderer.ts';
import {projectPreparedGalaxyPointSources} from './galaxy-star-renderer.ts';
import {altitudeFromSkyDirection, atmosphericExtinctionMagnitude, daylightVisibilityPenaltyMagnitude, type AtmospherePreset} from './planet-atmosphere.ts';

export const commonStarNames: Record<string,string> = {
  'Rigil Kentaurus':'南门二 A',Toliman:'南门二 B',Procyon:'南河三',Polaris:'北极星',
  Sirius:'天狼星',Canopus:'老人星',Arcturus:'大角星',Vega:'织女星',Capella:'五车二',
  Rigel:'参宿七',Betelgeuse:'参宿四',Altair:'牛郎星',Aldebaran:'毕宿五',Antares:'心宿二',
  Spica:'角宿一',Pollux:'北河三',Fomalhaut:'北落师门',Deneb:'天津四',Regulus:'轩辕十四',
};
export const starName=(name?:string,language:'zh'|'en'='zh')=>name ? (language==='en'?name:commonStarNames[name]??name) : (language==='en'?'Observed star':'实测恒星');
export function observedStarMagnitude(source:ProjectedPointSource,zenith:Vector3,atmosphere:AtmospherePreset,mode:ObservationMode,sunAltitude:number):number {
  if(!source.skyDirection)return Infinity;
  return source.apparentVisualMagnitude+atmosphericExtinctionMagnitude(altitudeFromSkyDirection(source.skyDirection,zenith),atmosphere,mode)
    +daylightVisibilityPenaltyMagnitude(sunAltitude,atmosphere);
}
export const starMagnitudeLimit=(mode:ObservationMode)=>mode==='camera'?12.4:mode==='near-infrared'?12:mode==='dark-adapted'?7.1:6.2;

/** Only observational entries can be selected, using the same current camera,
 * position, time and atmospheric visibility as the rendered stars. */
export function pickObservedStar(sources:readonly PreparedGalaxyPointSource[],camera:ViewCamera,position:Vector3,timeYears:number,
  width:number,height:number,x:number,y:number,radius:number,zenith:Vector3,atmosphere:AtmospherePreset,mode:ObservationMode,sunAltitude:number):ProjectedPointSource|null {
  const projected=projectPreparedGalaxyPointSources(sources.filter(source=>source.role==='observed-bright-star'),camera,width,height,position,timeYears);
  let best:ProjectedPointSource|null=null,bestScore=Infinity;
  for(const source of projected){
    const distanceSquared=(source.canvasX-x)**2+(source.canvasY-y)**2;
    if(!Number.isFinite(distanceSquared)||distanceSquared>radius*radius)continue;
    const magnitude=observedStarMagnitude(source,zenith,atmosphere,mode,sunAltitude);
    if(!Number.isFinite(magnitude)||magnitude>starMagnitudeLimit(mode))continue;
    // Close, brighter stars win ties; a nearby faint source cannot steal a bright core.
    const score=distanceSquared+Math.max(0,magnitude+2)*2;
    if(score<bestScore){best=source;bestScore=score;}
  }
  return best;
}

export function drawObservedStarLabels(context:CanvasRenderingContext2D,sources:readonly ProjectedPointSource[],
  pixelRatio:number,width:number,height:number,zenith:Vector3,atmosphere:AtmospherePreset,mode:ObservationMode,sunAltitude:number,language:'zh'|'en'='zh'):void {
  const visible=sources.filter(source=>source.role==='observed-bright-star'&&source.displayName&&Number.isFinite(source.canvasX)&&Number.isFinite(source.canvasY))
    .map(source=>({source,magnitude:observedStarMagnitude(source,zenith,atmosphere,mode,sunAltitude)}))
    .filter(item=>Number.isFinite(item.magnitude)&&item.magnitude<=Math.min(5,starMagnitudeLimit(mode)))
    .sort((a,b)=>a.magnitude-b.magnitude);
  const occupied:Array<{x:number;y:number;width:number;height:number}>=[];
  context.save();
  try{
    context.globalCompositeOperation='source-over';context.globalAlpha=1;context.filter='none';
    context.font=`${14*pixelRatio}px system-ui, sans-serif`;context.textBaseline='middle';
    context.fillStyle='rgba(221,231,245,0.88)';context.shadowColor='#010309';context.shadowBlur=4*pixelRatio;
    for(const {source} of visible){
      if(occupied.length>=24)break;
      const label=starName(source.displayName,language);const textWidth=context.measureText(label).width;
      const x=Math.min(width-textWidth-8*pixelRatio,source.canvasX+10*pixelRatio),y=source.canvasY-12*pixelRatio;
      const box={x:x-4*pixelRatio,y:y-10*pixelRatio,width:textWidth+8*pixelRatio,height:22*pixelRatio};
      if(box.x<0||box.y<0||box.y+box.height>height||occupied.some(other=>box.x<other.x+other.width&&box.x+box.width>other.x&&box.y<other.y+other.height&&box.y+box.height>other.y))continue;
      context.fillText(label,x,y);occupied.push(box);
    }
  }finally{context.restore();}
}
