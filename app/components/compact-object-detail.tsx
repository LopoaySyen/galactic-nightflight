import type { CompactObject } from '@/lib/rendering/compact-object-catalog';
import type { Vector3 } from '@/lib/physics/vector';
import { useObservationLanguage } from './observation-language';
export function CompactObjectDetail({object,observer,onClose,onCentre,onVisit}:{object:CompactObject;observer:Vector3;onClose:()=>void;onCentre:()=>void;onVisit:()=>void}) {
  const {language}=useObservationLanguage(), en=language==='en';
  const distance=Math.hypot(object.positionParsec.x-observer.x,object.positionParsec.y-observer.y,object.positionParsec.z-observer.z);
  return <aside className="star-detail compact-object-detail" aria-label={en?'Black hole details':'黑洞资料'}>
    <div className="star-detail-heading"><div><span>{en?'BLACK HOLE':'黑洞 · 目录天体'}</span><h2>{en?object.nameEn:object.name}</h2></div><button onClick={onClose} aria-label={en?'Close black hole details':'关闭黑洞资料'}>×</button></div>
    <p>{en?object.descriptionEn:object.description}</p>
    <dl><div><dt>{en?'Adopted mass':'采用的质量'}</dt><dd>{object.massSolar.toLocaleString(en?'en-US':'zh-CN')}{en?' Suns':' 个太阳质量'}</dd></div>
      <div><dt>{en?'Current distance':'距当前观察者'}</dt><dd>{distance<.01?distance.toExponential(3):distance.toLocaleString(en?'en-US':'zh-CN',{maximumFractionDigits:2})} pc</dd></div></dl>
    <button className="star-centre" onClick={onCentre}>{en?'Locate in the sky':'定位黑洞方向'}</button>
    <button className="star-centre" onClick={onVisit}>{en?'Visit the gravitational close-up':'进入引力近景'}</button>
    <p className="object-unit-note">{en?'The close-up is a model: point-mass lensing, a Schwarzschild shadow and an illustrative accretion flow. It is not a full relativistic ray trace. Time is paused on arrival.':'近景为模型演示：点质量透镜、史瓦西阴影与示意吸积流，并非完整的广义相对论光线追踪。抵达后时间暂停。'}</p>
    {object.imagePath&&<figure><img src={object.imagePath} alt={en?'Event Horizon Telescope radio image':'事件视界望远镜射电观测图'} style={{width:'100%',borderRadius:12}}/><figcaption>{object.imageCredit}<br/>{en?'Radio reconstruction; not an optical photograph.':'射电观测重建图，不是可见光照片。'}</figcaption></figure>}
    <a href={object.sourceUrl} target="_blank" rel="noreferrer">{en?'Observations and source':'观测资料与来源 ↗'}</a>
  </aside>;
}
