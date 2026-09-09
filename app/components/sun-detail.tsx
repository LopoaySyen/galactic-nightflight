import {useObservationLanguage} from './observation-language';
import {sunStar,directionToSun} from '@/lib/rendering/solar-star';
import type {Vector3} from '@/lib/physics/vector';

export function SunDetail({observer,timeYears,onClose,onCentre,onVisit,onReturn}:{observer:Vector3;timeYears:number;onClose:()=>void;onCentre:()=>void;onVisit:()=>void;onReturn?:()=>void}){
  const {language,locale}=useObservationLanguage(),en=language==='en';
  const direction=directionToSun(observer,timeYears),distance=direction?Math.hypot(direction.x,direction.y,direction.z):0;
  const format=(value:number)=>value.toLocaleString(locale,{maximumFractionDigits:3});
  return <aside className="star-detail" aria-label={en?'Sun details':'太阳资料'}>
    <div className="star-detail-heading"><div><span>{en?'OUR SOLAR SYSTEM’S STAR':'太阳系的恒星'}</span><h2>{en?'Sun':'太阳'}</h2><small>{en?'Sol':'Sun · Sol'}</small></div><button onClick={onClose} aria-label={en?'Close Sun details':'关闭太阳资料'}>×</button></div>
    <p className="star-detail-summary">{en?'The Sun is a G2 V main-sequence star. It produces energy by fusing hydrogen into helium in its core and supplies the light and heat that sustain life on Earth.':'太阳是一颗 G2 V 型主序星。核心中的氢聚变为氦，释放能量，为地球提供维持生命所需的光和热。'}</p>
    <dl>
      <div><dt>{en?'Mass':'质量'}</dt><dd>{en?'1 solar mass':'1 个太阳质量'}</dd></div>
      <div><dt>{en?'Radius':'半径'}</dt><dd>695,700 km</dd></div>
      <div><dt>{en?'Effective temperature':'有效温度'}</dt><dd>5,772 K</dd></div>
      <div><dt>{en?'Spectral type':'光谱类型'}</dt><dd>G2 V</dd></div>
      <div><dt>{en?'Absolute visual magnitude':'可见光绝对星等'}</dt><dd>{sunStar.absoluteVisualMagnitude}</dd></div>
      <div><dt>{en?'Visual magnitude from Earth':'从地球看太阳的视星等'}</dt><dd>≈ −26.74</dd></div>
      <div className="star-detail-current"><dt>{en?'Current distance':'距当前观察者'}</dt><dd>{direction?<>{distance<.001?`${format(distance*206264.806)} AU`:`${format(distance)} pc`}<small>{format(distance*3.26156)} {en?'light-years':'光年'}</small></>:en?'At the solar reference position':'位于太阳系参考位置'}</dd></div>
    </dl>
    {!direction&&<p className="object-unit-note">{en?'The solar-neighbourhood preset shares the Sun’s position at Galactic scale. There is no unique direction from this point; move 1 parsec away to see the Sun among the stars.':'“太阳邻域”在银河尺度上与太阳使用同一参考坐标，因此此处没有唯一的太阳方向。可以移到 1 秒差距外，回望星空中的太阳。'}</p>}
    <button className="star-centre" disabled={!direction} onClick={onCentre}>{en?'Centre the Sun':'定位太阳方向'}</button>
    <button className="star-centre" onClick={onVisit}>{en?'View the Sun from 1 parsec away':'从 1 秒差距外看太阳'}</button>
    {onReturn&&<button className="star-centre" onClick={onReturn}>{en?'End close-up and return':'结束近观并返回'}</button>}
    <details><summary>{en?'Data and model':'数据与模型说明'}</summary>
      <p>{en?'The absolute magnitude describes brightness at 10 parsecs. The −26.74 apparent magnitude applies near Earth, not at the current observer.':'绝对星等表示放在 10 秒差距处时的亮度；−26.74 是从地球附近看太阳的视星等，不是任意观察位置的亮度。'}</p>
      <p>{en?'The solar position follows the project’s Galactic reference and space-velocity extrapolation. It is not an Earth-orbit ephemeris. The adjustable star that lights a planetary atmosphere is a separate local environment setting.':'太阳位置沿用项目的银河参考坐标与空间速度外推，尚未计算地球公转星历。行星大气模式中可调整高度的“当地恒星”属于独立的环境设置。'}</p>
      <a href="/data/solar-star-source.md" target="_blank" rel="noreferrer">{en?'Parameters and sources ↗':'参数与来源 ↗'}</a>
    </details>
  </aside>;
}
