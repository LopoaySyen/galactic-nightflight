import type {Vector3} from '../physics/vector.ts';
import type {ViewCamera} from './contracts.ts';

export const observerPresets:readonly {id:string;name:string;description:string;position:Vector3}[]=[
  {id:'solar',name:'太阳邻域',description:'熟悉星座的参考起点',position:{x:-8277,y:0,z:0}},
  {id:'inner-disc',name:'内银河',description:'向银河内部深入',position:{x:-3500,y:0,z:0}},
  {id:'near-bulge',name:'核球附近',description:'靠近中心，略高于盘面',position:{x:-1000,y:0,z:300}},
  {id:'outer-disc',name:'外盘深处',description:'从稀疏的外围回望',position:{x:-16000,y:0,z:0}},
  {id:'above-disc',name:'盘面上方',description:'离开盘面，俯望银河',position:{x:-8277,y:0,z:3000}},
  {id:'far-side',name:'银河对侧',description:'来到太阳的另一侧',position:{x:8277,y:0,z:0}},
];

/** Derive the target each frame from the live observer, preserving zoom. */
export function cameraFacingGalacticCentre(observer:Vector3,current:ViewCamera):ViewCamera {
  const distance=Math.hypot(observer.x,observer.y,observer.z);
  if(!Number.isFinite(distance)||distance<1e-9)return {...current};
  return {...current,azimuthDegrees:Math.atan2(-observer.y,-observer.x)*180/Math.PI,
    elevationDegrees:Math.asin(Math.max(-1,Math.min(1,-observer.z/distance)))*180/Math.PI};
}
