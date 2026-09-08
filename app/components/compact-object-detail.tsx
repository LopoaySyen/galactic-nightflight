import type { CompactObject } from '@/lib/rendering/compact-object-catalog';
import type { Vector3 } from '@/lib/physics/vector';
import {useMemo} from 'react';
import {kerrDiscProfile,gravitationalSeconds} from '@/lib/physics/kerr';
import { useObservationLanguage } from './observation-language';
interface CompactObjectDetailProps {
  object:CompactObject; observer:Vector3; onClose:()=>void; onCentre:()=>void; onVisit:()=>void; onFaceOn:()=>void;
  accretionLog:number; onAccretionChange:(value:number)=>void; bolometric:boolean; onBandChange:(value:boolean)=>void;
  artistic:boolean; onArtisticChange:(value:boolean)=>void; skyExposure:number; onSkyExposureChange:(value:number)=>void;
  onSpinChange:(value:number)=>void; flowing:boolean; onFlowChange:(value:boolean)=>void; flowSpeed:number; onFlowSpeedChange:(value:number)=>void;
}
export function CompactObjectDetail({object,observer,onClose,onCentre,onVisit,onFaceOn,accretionLog,onAccretionChange,bolometric,onBandChange,artistic,onArtisticChange,skyExposure,onSkyExposureChange,onSpinChange,flowing,onFlowChange,flowSpeed,onFlowSpeedChange}:CompactObjectDetailProps) {
  const {language}=useObservationLanguage(), en=language==='en';
  const distance=Math.hypot(object.positionParsec.x-observer.x,object.positionParsec.y-observer.y,object.positionParsec.z-observer.z);
  const profile=useMemo(()=>kerrDiscProfile(object.massSolar,object.spin,10**accretionLog),[object.massSolar,object.spin,accretionLog]);
  const period=2*Math.PI*(10**1.5+object.spin)*gravitationalSeconds(object.massSolar);
  const periodLabel=period<60?`${period.toPrecision(3)} ${en?'s':'秒'}`:period<86400?`${(period/3600).toPrecision(3)} ${en?'h':'小时'}`:`${(period/86400).toPrecision(3)} ${en?'days':'天'}`;
  return <aside className="star-detail compact-object-detail" aria-label={en?'Black hole details':'黑洞资料'}>
    <div className="star-detail-heading"><div><span>{en?'BLACK HOLE':'黑洞 · 目录天体'}</span><h2>{en?object.nameEn:object.name}</h2></div><button onClick={onClose} aria-label={en?'Close black hole details':'关闭黑洞资料'}>×</button></div>
    <p>{en?object.descriptionEn:object.description}</p>
    <dl><div><dt>{en?'Adopted mass':'采用的质量'}</dt><dd>{object.massSolar.toLocaleString(en?'en-US':'zh-CN')}{en?' Suns':' 个太阳质量'}</dd></div>
      <div><dt>{en?'Current distance':'距当前观察者'}</dt><dd>{distance<.01?distance.toExponential(3):distance.toLocaleString(en?'en-US':'zh-CN',{maximumFractionDigits:2})} pc</dd></div></dl>
    <button className="star-centre" onClick={onCentre}>{en?'Locate in the sky':'定位黑洞方向'}</button>
    <div className="black-hole-views"><button className="star-centre" onClick={onVisit}>{en?'Edge-on close-up':'进入引力近景'}</button><button className="star-centre" onClick={onFaceOn}>{en?'Above the disc':'俯看吸积盘'}</button></div>
    <label className="planetarium-range"><span><b>{en?'Black hole spin':'黑洞自旋'}</b><output>{object.spin.toFixed(2)}</output></span><input aria-label={en?'Black hole spin':'黑洞自旋'} type="range" min="-.95" max=".95" step=".01" value={object.spin} onChange={event=>onSpinChange(Number(event.target.value))}/></label>
    <p className="object-unit-note">{en?'A model parameter: positive spin co-rotates with the disc; negative spin is retrograde.':'自旋为模型设定：正值与吸积盘同向，负值为反向。'}</p>
    <div className="black-hole-views" aria-label={en?'Rendering style':'画面风格'}><button className="star-centre" aria-pressed={artistic} onClick={()=>onArtisticChange(true)}>{en?'Artistic view':'艺术呈现'}</button><button className="star-centre" aria-pressed={!artistic} onClick={()=>onArtisticChange(false)}>{en?'Physical radiation':'物理辐射'}</button></div>
    {artistic?<>
      <p className="object-unit-note">{en?'Amber filaments, a fading outer edge and separately exposed starlight. Light bending still follows the physical model.':'暖色流纹、柔和外缘，星空独立曝光。光线弯曲仍遵循物理模型。'}</p>
      <label className="planetarium-range"><span><b>{en?'Background starlight':'背景星光'}</b><output>{skyExposure>0?'+':''}{skyExposure.toFixed(1)} {en?'stops':'级'}</output></span><input aria-label={en?'Background starlight':'背景星光'} type="range" min="-2" max="5" step=".1" value={skyExposure} onChange={event=>onSkyExposureChange(Number(event.target.value))}/></label>
      <button className="star-centre" aria-pressed={flowing} onClick={()=>onFlowChange(!flowing)}>{flowing?(en?'Pause disc motion':'暂停盘面流动'):(en?'Resume disc motion':'继续盘面流动')}</button>
      <label className="planetarium-range"><span><b>{en?'Disc motion speed':'盘面流动速度'}</b><output>{flowSpeed.toFixed(2)}×</output></span><input aria-label={en?'Disc motion speed':'盘面流动速度'} type="range" min=".25" max="4" step=".25" value={flowSpeed} onChange={event=>onFlowSpeedChange(Number(event.target.value))}/></label>
      <p className="object-unit-note">{en?'The inner disc flows faster. Motion uses a presentation clock; the timeline below moves objects through the Galaxy.':'内侧流动更快，外侧更慢。盘面按演示时钟流动；下方时间轴控制天体在银河中的位置。'}</p>
    </>:<>
      <div className="black-hole-views" aria-label={en?'Radiation band':'辐射波段'}><button className="star-centre" aria-pressed={bolometric} onClick={()=>onBandChange(true)}>{en?'Total radiation':'总辐射'}</button><button className="star-centre" aria-pressed={!bolometric} onClick={()=>onBandChange(false)}>{en?'Visible spectrum':'可见光'}</button></div>
      <p className="object-unit-note">{bolometric?(en?'Brightness shows radiation across all wavelengths; thermal colours are illustrative, not naked-eye colours.':'亮度显示所有波长的辐射总和，以热谱色调着色，不代表肉眼颜色。'):(en?'Visible light through three camera response bands.':'按相机三个响应波段计算可见光。')}</p>
    </>}
    <label className="planetarium-range"><span><b>{en?'Accretion luminosity / Eddington limit':'吸积光度 / 爱丁顿极限'}</b><output>{(100*10**accretionLog).toPrecision(2)}%</output></span><input type="range" min="-6" max="-1" step=".1" value={accretionLog} onChange={event=>onAccretionChange(Number(event.target.value))}/></label>
    <details className="black-hole-model"><summary>{en?'Physical model and observations':'物理模型与观测资料'}</summary>
    <p className="object-unit-note">{en?'Kerr spacetime · inner disc radius:':'克尔时空 · 盘内缘：'} {profile.inner.toFixed(2)} GM/c² · {en?'peak temperature':'最高盘温'} {Math.round(profile.peak).toLocaleString()} K</p>
    <p className="object-unit-note">{en?'Orbital period at 10 GM/c²:':'10 GM/c² 处的理论公转周期：'}{periodLabel}{en?'. At 1×, the display takes 30 seconds per orbit there.':'。演示速度 1× 时，此处每 30 秒转一圈。'}</p>
    <p className="object-unit-note">{object.motion==='galactic-origin'?(en?'Sagittarius A* defines the origin of this Galactic reference frame.':'人马座 A* 定义本项目的银河中心原点，因此在该坐标系中保持原位。'):object.motion==='galactic-orbit'?(en?'Space motion is propagated in the Galactic potential; the short binary orbit is not resolved.':'根据空间速度和银河引力势推进位置；尚未解析短周期双星轨道。'):(en?'Travels with its host galaxy using a radial-motion approximation.':'采用宿主星系径向运动近似，随 M87 星系移动。')}</p>
    <p className="object-unit-note">{en?'Kerr null geodesics include frame dragging. A zero-torque relativistic thin disc supplies thermal emission. Flow filaments are artistic tracers, not a magnetohydrodynamic simulation. Default spins are illustrative, not precise measurements.':'克尔光线追踪包含自旋引起的时空拖曳；无内缘力矩的相对论薄盘提供热辐射。流纹用于呈现轨道运动，尚未模拟磁流体湍流。默认自旋是演示参数，不代表精确测量。'}</p>
    <a href="/data/black-hole-physics.md" target="_blank" rel="noreferrer">{en?'Equations, numerical accuracy and model limits ↗':'方程、数值精度与适用范围 ↗'}</a>
    {object.imagePath&&<figure><img src={object.imagePath} alt={en?'Event Horizon Telescope radio image':'事件视界望远镜射电观测图'} style={{width:'100%',borderRadius:12}}/><figcaption>{object.imageCredit}<br/>{en?'Radio reconstruction; not an optical photograph.':'射电观测重建图，不是可见光照片。'}</figcaption></figure>}
    <a href={object.sourceUrl} target="_blank" rel="noreferrer">{en?'Observations and source':'观测资料与来源 ↗'}</a>
    </details>
  </aside>;
}
