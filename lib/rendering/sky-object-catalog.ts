import { deepSkyImageSources, type DeepSkyImageSource } from './deep-sky-image-catalog.ts';
import { cataloguedExtragalacticSources, type ExtragalacticSource } from './extragalactic-catalog.ts';
import type {ViewCamera} from './contracts.ts';
import {createCameraBasis} from './projection.ts';
import {galacticToFrame,planetaryFrame,type LocalFrame} from './local-frame.ts';
import type { Vector3 } from '../physics/vector.ts';

export interface DeepSkyTarget {
  id:string; name:string; aliases:string[]; kind:'星云'|'星团'|'星系';
  nameEn?:string; descriptionEn?:string; description:string; positionParsec:Vector3; image?:DeepSkyImageSource; galaxy?:ExtragalacticSource;
}
const aliases:Record<string,string[]>={
  m42:['M42','猎户座星云','Orion Nebula'],m45:['M45','昴宿星团','七姐妹星团','Pleiades'],
  'omega-centauri':['Omega Centauri','欧米茄星团'],m31:['M31','仙女座','Andromeda'],
  m33:['M33','三角座','Triangulum'],lmc:['LMC','Large Magellanic Cloud'],smc:['SMC','Small Magellanic Cloud'],
  m81:['M81','Bode'],m82:['M82','Cigar Galaxy'],ngc253:['NGC253','Sculptor Galaxy'],'centaurus-a':['Centaurus A','半人马座A'],
};
export const deepSkyTargets:DeepSkyTarget[] = deepSkyImageSources.map(image=>{
  const id=image.id.replace(/-image$/,'');
  const galaxy=cataloguedExtragalacticSources.find(source=>source.id===id);
  const kind=image.objectClass==='galaxy'?'星系':image.objectClass==='emission-nebula'?'星云':'星团';
  return {id,name:image.displayName,nameEn:image.displayNameEn,descriptionEn:image.descriptionEn,aliases:image.aliases??aliases[id]??[],kind,positionParsec:image.positionParsec,image,galaxy,
    description:image.description??(image.objectClass==='emission-nebula'?'星云是由气体和尘埃组成的云状天体。这里展示的是观测照片中的发光云气与暗部结构。':
      image.objectClass==='open-cluster'?'这是疏散星团：一群在空间中较松散聚集的恒星。照片也包含恒星周围的云气。':
      image.objectClass==='globular-cluster'?'这是球状星团：大量恒星密集聚集，整体呈近似球形。':
      '这是银河系外的星系，由大量恒星、气体与尘埃组成。相机模式展示观测照片，其他感光模式展示简化轮廓。')};
});
for(const galaxy of cataloguedExtragalacticSources){
  if(deepSkyTargets.some(target=>target.id===galaxy.id))continue;
  deepSkyTargets.push({id:galaxy.id,name:galaxy.displayName??galaxy.id,aliases:aliases[galaxy.id]??[],kind:'星系',
    description:'这是银河系外的星系。画面中的位置与大小由目录参数和当前观察位置计算，轮廓是近似显示。',
    positionParsec:galaxy.positionParsec,galaxy});
}
export const deepSkyTargetsById=new Map(deepSkyTargets.map(target=>[target.id,target]));

export interface DeepSkyHitArea {
  id:string; x:number;y:number;rightX:number;rightY:number;downX:number;downY:number;
  shape:'photo'|'ellipse';mask?:{width:number;height:number;pixels:Uint8ClampedArray};
}
/** Areas come directly from the current rendered frame, including image scale,
 * horizon visibility and loading state. Transparent photograph borders are not targets. */
export function pickDeepSkyTarget(areas:readonly DeepSkyHitArea[],x:number,y:number,minimumRadius:number):DeepSkyHitArea|null {
  let best:DeepSkyHitArea|null=null,bestScore=Infinity;
  for(const area of areas){
    const determinant=area.rightX*area.downY-area.rightY*area.downX;
    if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-9)continue;
    const dx=x-area.x,dy=y-area.y;
    const u=(dx*area.downY-dy*area.downX)/determinant,v=(dy*area.rightX-dx*area.rightY)/determinant;
    const tiny=Math.max(Math.hypot(area.rightX,area.rightY),Math.hypot(area.downX,area.downY))<minimumRadius;
    if(tiny){if(Math.hypot(dx,dy)>minimumRadius)continue;}
    else if(area.shape==='ellipse'){if(u*u+v*v>1)continue;}
    else {
      if(Math.abs(u)>=1||Math.abs(v)>=1)continue;
      if(area.mask){
        const mx=Math.min(area.mask.width-1,Math.floor((u+1)*.5*area.mask.width));
        const my=Math.min(area.mask.height-1,Math.floor((v+1)*.5*area.mask.height));
        if(area.mask.pixels[(my*area.mask.width+mx)*4+3]<20)continue;
      }
    }
    const score=Math.hypot(dx,dy);
    if(score<bestScore){best=area;bestScore=score;}
  }
  return best;
}

/** Query the same planetary horizon and panorama alpha as the visible ground. */
export function isSkyPointObscured(camera:ViewCamera,width:number,height:number,x:number,y:number,inclination:number,
  panorama?:{width:number;height:number;pixels:Uint8ClampedArray}|null,frame:LocalFrame=planetaryFrame(inclination)):boolean {
  const basis=createCameraBasis(camera),tangent=Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360);
  const cx=(2*x/width-1)*tangent,cy=(1-2*y/height)*tangent*height/width,length=Math.hypot(1,cx,cy);
  const ray=galacticToFrame({x:(basis.forward.x+cx*basis.right.x+cy*basis.up.x)/length,
    y:(basis.forward.y+cx*basis.right.y+cy*basis.up.y)/length,z:(basis.forward.z+cx*basis.right.z+cy*basis.up.z)/length},frame);
  if(ray.z<0)return true;
  if(!panorama)return false;
  const u=Math.atan2(ray.y,ray.x)/(2*Math.PI)+.5,v=.5-Math.asin(Math.max(-1,Math.min(1,ray.z)))/Math.PI;
  const px=u*panorama.width-.5,py=v*panorama.height-.5,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
  const alpha=(a:number,b:number)=>panorama.pixels[(Math.max(0,Math.min(panorama.height-1,b))*panorama.width+((a%panorama.width)+panorama.width)%panorama.width)*4+3];
  return (alpha(ix,iy)*(1-fx)+alpha(ix+1,iy)*fx)*(1-fy)+(alpha(ix,iy+1)*(1-fx)+alpha(ix+1,iy+1)*fx)*fy>128;
}
