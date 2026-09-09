import {useObservationLanguage} from './observation-language';
import {sunStar,directionToSun} from '@/lib/rendering/solar-star';
import {earthSolarNoon,EARTH_MIN_DATE,EARTH_MAX_DATE,type EarthSettings,type EarthObservation} from '@/lib/rendering/earth-observer';
import type {Vector3} from '@/lib/physics/vector';

export function SunDetail({observer,timeYears,onClose,onCentre,onVisit,onEarth,earthSettings,earthView,onEarthChange,onReturn}:{observer:Vector3;timeYears:number;onClose:()=>void;onCentre:()=>void;onVisit:()=>void;onEarth:()=>void;earthSettings:EarthSettings|null;earthView:EarthObservation|null;onEarthChange:(settings:EarthSettings,centre?:boolean)=>void;onReturn?:()=>void}){
  const {language,locale}=useObservationLanguage(),en=language==='en';
  const direction=earthView?.sunDirection??directionToSun(observer,timeYears),distance=earthView?earthView.distanceAu/(648000/Math.PI):direction?Math.hypot(direction.x,direction.y,direction.z):0;
  const format=(value:number)=>value.toLocaleString(locale,{maximumFractionDigits:3});
  return <aside className="star-detail" aria-label={en?'Sun details':'太阳资料'}>
    <div className="star-detail-heading"><div><span>{en?'OUR SOLAR SYSTEM’S STAR':'太阳系的恒星'}</span><h2>{en?'Sun':'太阳'}</h2><small>{en?'Sol':'Sun · Sol'}</small></div><button onClick={onClose} aria-label={en?'Close Sun details':'关闭太阳资料'}>×</button></div>
    <p className="star-detail-summary">{en?'The Sun is a G2 V main-sequence star. It produces energy by fusing hydrogen into helium in its core and supplies the light and heat that sustain life on Earth.':'太阳是一颗 G2 V 型主序星。核心中的氢聚变为氦，释放能量，为地球提供维持生命所需的光和热。'}</p>
    {earthSettings&&earthView&&<section className="earth-observer-controls" aria-label={en?'Earth observing location':'地球观测位置'}>
      <h3>{en?'Observe from Earth':'站在地球看太阳'}</h3>
      <label>{en?'Date and time (UTC)':'日期与时间（UTC）'}<input type="datetime-local" aria-label={en?'Earth date and time (UTC)':'地球日期与时间（UTC）'} min="1900-01-01T00:00" max="2100-12-31T23:59" value={new Date(earthSettings.utcMillis).toISOString().slice(0,16)} onChange={event=>{const millis=Date.parse(event.target.value+'Z');if(Number.isFinite(millis)&&millis>=EARTH_MIN_DATE&&millis<=EARTH_MAX_DATE)onEarthChange({...earthSettings,utcMillis:millis});}}/></label>
      <div className="earth-coordinate-inputs">
        <label>{en?'Latitude (°N)':'纬度（北纬为正）'}<input key={'lat'+earthSettings.latitudeDegrees} type="number" min="-90" max="90" step="0.0001" aria-label={en?'Earth latitude':'地球纬度'} defaultValue={earthSettings.latitudeDegrees} onBlur={event=>{const value=Number(event.target.value);const latitude=Number.isFinite(value)?Math.max(-90,Math.min(90,value)):earthSettings.latitudeDegrees;event.target.value=String(latitude);onEarthChange({...earthSettings,latitudeDegrees:latitude});}}/></label>
        <label>{en?'Longitude (°E)':'经度（东经为正）'}<input key={'lon'+earthSettings.longitudeDegrees} type="number" min="-180" max="180" step="0.0001" aria-label={en?'Earth longitude':'地球经度'} defaultValue={earthSettings.longitudeDegrees} onBlur={event=>{const value=Number(event.target.value);const longitude=Number.isFinite(value)?Math.max(-180,Math.min(180,value)):earthSettings.longitudeDegrees;event.target.value=String(longitude);onEarthChange({...earthSettings,longitudeDegrees:longitude});}}/></label>
      </div>
      <div className="earth-clock-actions"><button onClick={()=>onEarthChange({...earthSettings,utcMillis:Date.now()},true)}>{en?'Now':'当前时间'}</button><button onClick={()=>onEarthChange(earthSolarNoon(earthSettings),true)}>{en?'Local solar noon':'当地正午'}</button></div>
      <p className="object-unit-note">{en?'UTC is 8 hours behind Beijing time. Coordinates are a sample location, not your detected location.':'北京时间比 UTC 快 8 小时。初始经纬度是示例，不是自动定位。'}</p>
      <dl><div><dt>{en?'Solar altitude':'太阳高度'}</dt><dd>{earthView.altitudeDegrees.toFixed(2)}°</dd></div><div><dt>{en?'Azimuth (north = 0°)':'方位角（正北为 0°）'}</dt><dd>{earthView.azimuthDegrees.toFixed(2)}°</dd></div><div><dt>{en?'Angular diameter':'日面视直径'}</dt><dd>{(2*earthView.angularRadiusDegrees).toFixed(3)}°</dd></div></dl>
      {earthView.altitudeDegrees<0&&<p role="status">{en?'The Sun is below the horizon at this location and time. You can jump to local solar noon; polar night may still hide it.':'此时此地的太阳位于地平线下。可以跳到当地正午；如果处于极夜，正午也看不见太阳。'}</p>}
    </section>}
    <dl>
      <div><dt>{en?'Mass':'质量'}</dt><dd>{en?'1 solar mass':'1 个太阳质量'}</dd></div>
      <div><dt>{en?'Radius':'半径'}</dt><dd>695,700 km</dd></div>
      <div><dt>{en?'Effective temperature':'有效温度'}</dt><dd>5,772 K</dd></div>
      <div><dt>{en?'Spectral type':'光谱类型'}</dt><dd>G2 V</dd></div>
      <div><dt>{en?'Absolute visual magnitude':'可见光绝对星等'}</dt><dd>{sunStar.absoluteVisualMagnitude}</dd></div>
      <div><dt>{en?'Visual magnitude from Earth':'从地球看太阳的视星等'}</dt><dd>≈ −26.74</dd></div>
      <div className="star-detail-current"><dt>{en?'Current distance':'距当前观察者'}</dt><dd>{direction?<>{distance<.001?`${format(distance*206264.806)} AU`:`${format(distance)} pc`}<small>{format(distance*3.26156)} {en?'light-years':'光年'}</small></>:en?'At the solar reference position':'位于太阳系参考位置'}</dd></div>
    </dl>
    {!direction&&<p className="object-unit-note">{en?'The solar-neighbourhood preset is a Galactic reference point. Enter Earth observation to use the Earth’s orbital position and see the solar disc from about 1 AU away.':'“太阳邻域”是银河尺度的参考点。进入地球观测后，会使用地球公转位置，从约 1 个天文单位外看见太阳的日面。'}</p>}
    {!earthSettings&&<button className="star-centre" onClick={onEarth}>{en?'Observe the Sun from Earth':'在地球上看太阳'}</button>}
    <button className="star-centre" onClick={onCentre}>{!direction?(en?'Go to Earth and centre the Sun':'前往地球并定位太阳'):(en?'Centre the Sun':'定位太阳方向')}</button>
    <button className="star-centre" onClick={onVisit}>{en?'View the Sun from 1 parsec away':'从 1 秒差距外看太阳'}</button>
    {onReturn&&<button className="star-centre" onClick={onReturn}>{en?'End close-up and return':'结束近观并返回'}</button>}
    <details><summary>{en?'Data and model':'数据与模型说明'}</summary>
      <p>{en?'The absolute magnitude describes brightness at 10 parsecs. The −26.74 apparent magnitude applies near Earth, not at the current observer.':'绝对星等表示放在 10 秒差距处时的亮度；−26.74 是从地球附近看太阳的视星等，不是任意观察位置的亮度。'}</p>
      <p>{en?'Earth observation uses Astronomy Engine for Earth’s orbit, topocentric solar direction, precession, nutation and the local horizon. The displayed altitude is geometric (no atmospheric refraction). Galactic time stays paused while the Earth calendar changes. Terrain is illustrative, not a map of the selected location.':'地球观测使用 Astronomy Engine 计算地球公转、站心太阳方向、岁差、章动和当地地平线。高度为几何高度，尚未加入大气折射。调整地球日历时，银河时间保持暂停。地貌是示意素材，不是所选位置的实景。'}</p>
      <a href="/data/solar-star-source.md" target="_blank" rel="noreferrer">{en?'Parameters and sources ↗':'参数与来源 ↗'}</a>
    </details>
  </aside>;
}
