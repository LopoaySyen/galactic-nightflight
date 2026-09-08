import type { CompactObject } from '@/lib/rendering/compact-object-catalog';
import type { Vector3 } from '@/lib/physics/vector';
import {thinDiscTemperature} from '@/lib/physics/schwarzschild';
import { useObservationLanguage } from './observation-language';
interface CompactObjectDetailProps {
  object:CompactObject; observer:Vector3; onClose:()=>void; onCentre:()=>void; onVisit:()=>void; onFaceOn:()=>void;
  accretionLog:number; onAccretionChange:(value:number)=>void; bolometric:boolean; onBandChange:(value:boolean)=>void;
  artistic:boolean; onArtisticChange:(value:boolean)=>void; skyExposure:number; onSkyExposureChange:(value:number)=>void;
}
export function CompactObjectDetail({object,observer,onClose,onCentre,onVisit,onFaceOn,accretionLog,onAccretionChange,bolometric,onBandChange,artistic,onArtisticChange,skyExposure,onSkyExposureChange}:CompactObjectDetailProps) {
  const {language}=useObservationLanguage(), en=language==='en';
  const distance=Math.hypot(object.positionParsec.x-observer.x,object.positionParsec.y-observer.y,object.positionParsec.z-observer.z);
  return <aside className="star-detail compact-object-detail" aria-label={en?'Black hole details':'黑洞资料'}>
    <div className="star-detail-heading"><div><span>{en?'BLACK HOLE':'黑洞 · 目录天体'}</span><h2>{en?object.nameEn:object.name}</h2></div><button onClick={onClose} aria-label={en?'Close black hole details':'关闭黑洞资料'}>×</button></div>
    <p>{en?object.descriptionEn:object.description}</p>
    <dl><div><dt>{en?'Adopted mass':'采用的质量'}</dt><dd>{object.massSolar.toLocaleString(en?'en-US':'zh-CN')}{en?' Suns':' 个太阳质量'}</dd></div>
      <div><dt>{en?'Current distance':'距当前观察者'}</dt><dd>{distance<.01?distance.toExponential(3):distance.toLocaleString(en?'en-US':'zh-CN',{maximumFractionDigits:2})} pc</dd></div></dl>
    <button className="star-centre" onClick={onCentre}>{en?'Locate in the sky':'定位黑洞方向'}</button>
    <div className="black-hole-views"><button className="star-centre" onClick={onVisit}>{en?'Edge-on close-up':'进入引力近景'}</button><button className="star-centre" onClick={onFaceOn}>{en?'Above the disc':'俯看吸积盘'}</button></div>
    <div className="black-hole-views" aria-label={en?'Rendering style':'画面风格'}><button className="star-centre" aria-pressed={artistic} onClick={()=>onArtisticChange(true)}>{en?'Artistic view':'艺术呈现'}</button><button className="star-centre" aria-pressed={!artistic} onClick={()=>onArtisticChange(false)}>{en?'Physical radiation':'物理辐射'}</button></div>
    {artistic?<>
      <p className="object-unit-note">{en?'Amber filaments, a fading outer edge and separately exposed starlight. Light bending still follows the physical model.':'暖色流纹、柔和外缘，星空独立曝光。光线弯曲仍遵循物理模型。'}</p>
      <label className="planetarium-range"><span><b>{en?'Background starlight':'背景星光'}</b><output>{skyExposure>0?'+':''}{skyExposure.toFixed(1)} {en?'stops':'级'}</output></span><input aria-label={en?'Background starlight':'背景星光'} type="range" min="-2" max="5" step=".1" value={skyExposure} onChange={event=>onSkyExposureChange(Number(event.target.value))}/></label>
    </>:<>
      <div className="black-hole-views" aria-label={en?'Radiation band':'辐射波段'}><button className="star-centre" aria-pressed={bolometric} onClick={()=>onBandChange(true)}>{en?'Total radiation':'总辐射'}</button><button className="star-centre" aria-pressed={!bolometric} onClick={()=>onBandChange(false)}>{en?'Visible spectrum':'可见光'}</button></div>
      <p className="object-unit-note">{bolometric?(en?'Brightness shows radiation across all wavelengths; thermal colours are illustrative, not naked-eye colours.':'亮度显示所有波长的辐射总和，以热谱色调着色，不代表肉眼颜色。'):(en?'Visible light through three camera response bands.':'按相机三个响应波段计算可见光。')}</p>
    </>}
    <label className="planetarium-range"><span><b>{en?'Accretion luminosity / Eddington limit':'吸积光度 / 爱丁顿极限'}</b><output>{(100*10**accretionLog).toPrecision(2)}%</output></span><input type="range" min="-6" max="-1" step=".1" value={accretionLog} onChange={event=>onAccretionChange(Number(event.target.value))}/></label>
    <details className="black-hole-model"><summary>{en?'Physical model and observations':'物理模型与观测资料'}</summary>
    <p className="object-unit-note">{en?'Spin 0 · steady, opaque thin disc. Temperature at 10 Schwarzschild radii:':'自旋为 0 · 稳态不透明薄盘。在 10 倍史瓦西半径处，盘温约为：'} {Math.round(thinDiscTemperature(10,object.massSolar,10**accretionLog)).toLocaleString()} K</p>
    <p className="object-unit-note">{en?'Light follows Schwarzschild null geodesics. Orbital motion, gravitational redshift and Planck emission determine the image. The chosen accretion rate defines a theoretical disc, not a reconstruction of this object’s current flow.':'光线沿史瓦西时空的测地线传播，轨道运动、引力红移与普朗克热辐射共同决定图像。吸积率由你设定，呈现理论薄盘，不是该天体当前吸积流的重建。'}</p>
    <a href="/data/black-hole-physics.md" target="_blank" rel="noreferrer">{en?'Equations, numerical accuracy and model limits ↗':'方程、数值精度与适用范围 ↗'}</a>
    {object.imagePath&&<figure><img src={object.imagePath} alt={en?'Event Horizon Telescope radio image':'事件视界望远镜射电观测图'} style={{width:'100%',borderRadius:12}}/><figcaption>{object.imageCredit}<br/>{en?'Radio reconstruction; not an optical photograph.':'射电观测重建图，不是可见光照片。'}</figcaption></figure>}
    <a href={object.sourceUrl} target="_blank" rel="noreferrer">{en?'Observations and source':'观测资料与来源 ↗'}</a>
    </details>
  </aside>;
}
