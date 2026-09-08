import { useObservationLanguage } from './observation-language';
import type {PointSourceSample} from '@/lib/rendering/contracts';
import type {Vector3} from '@/lib/physics/vector';
import {pointSourcePositionAtTime} from '@/lib/physics/kinematics';
import {starName,starAliases,polarisDescription} from '@/lib/rendering/star-identities';

const number=(value:number,digits=2)=>Number.isFinite(value)?value.toLocaleString('zh-CN',{maximumFractionDigits:digits}):'暂无数据';
export function StarDetail({source,observer,timeYears,onClose,onCentre}:{source:PointSourceSample;observer:Vector3;timeYears:number;onClose:()=>void;onCentre:()=>void}){
  const { t, language } = useObservationLanguage();
  const data=source.observedData;if(!data)return null;
  const position=pointSourcePositionAtTime(source,timeYears);
  const distance=Math.hypot(position.x-observer.x,position.y-observer.y,position.z-observer.z);
  const yale=data.catalog==='yale-hipparcos';
  const nearby=data.catalog==='nearby-simbad';
  const title=source.displayName?starName(source.displayName,language,source.id):yale&&data.catalogueIdentifier?t(`依巴谷 ${data.catalogueIdentifier}`):t('盖亚实测恒星');
  const aliases=starAliases(source.id,source.displayName).filter(name=>name!==title);
  return <aside className="star-detail" aria-label={t("选中恒星的数据")}>
    <div className="star-detail-heading"><div><span>{t("实测恒星")}</span><h2>{title}</h2>{source.displayName&&title!==source.displayName&&<small>{source.displayName}</small>}</div><button type="button" onClick={onClose} aria-label={t("关闭恒星详情")}>×</button></div>
    <p className="star-detail-source">{nearby?(language==='en'?'SIMBAD · Nearby stellar supplement':'SIMBAD · 近邻恒星补充星表'):yale?t('耶鲁亮星表 · 依巴谷距离'):t('盖亚第三批公开数据 · 明亮恒星样本')}</p>
    {source.id==='hip-11767'&&<p className="star-detail-summary">{polarisDescription[language]}</p>}
    {source.id==='hip-70890'&&<p className="star-detail-summary">{language==='en'?'Proxima Centauri is a red dwarf about 4.25 light-years from the Sun, and its closest stellar neighbour. At magnitude 11.13 it is too faint for unaided eyes from the solar neighbourhood. You can still locate it here, or use camera mode to see its light.':'比邻星是一颗红矮星，距太阳约 4.25 光年，是离太阳最近的恒星。在太阳邻域，它的视星等为 11.13，肉眼无法看见；你仍可定位它，或切换到感光模式观看星光。'}</p>}
    {!!aliases.length&&<p className="star-detail-aliases"><span>{language==='en'?'Also known as: ':'其他名称：'}</span>{aliases.join(' · ')}</p>}
    <dl>
      {data.catalogueIdentifier&&<div><dt>{t("依巴谷星表编号")}</dt><dd>{data.catalogueIdentifier}</dd></div>}
      {data.henryDraperIdentifier&&<div><dt>{t("亨利·德雷珀星表编号")}</dt><dd>{data.henryDraperIdentifier}</dd></div>}
      {data.catalog==='gaia-dr3'&&<div><dt>{t("本地样本序号")}</dt><dd>{source.id.replace('gaia-dr3-bright-','')}</dd></div>}
      <div><dt>{t("目录距离")}</dt><dd>{t(number(data.referenceDistanceParsec))}{t(" 秒差距")}</dd></div>
      <div><dt>{t("目录亮度")}</dt><dd>{t(number(data.referenceApparentMagnitude))}{t(" 星等")}</dd></div>
      {data.spectralType&&<div><dt>{t("光谱类型（源表原文）")}</dt><dd>{data.spectralType}</dd></div>}
      {data.rightAscensionDegrees!==undefined&&<div><dt>{language==='en'?'Right ascension (J2000)':'赤经（J2000）'}</dt><dd>{number(data.rightAscensionDegrees,4)}°</dd></div>}
      {data.declinationDegrees!==undefined&&<div><dt>{language==='en'?'Declination (J2000)':'赤纬（J2000）'}</dt><dd>{number(data.declinationDegrees,4)}°</dd></div>}
      <div><dt>{t("表面温度估计")}</dt><dd>{t(number(source.effectiveTemperatureKelvin,0))}{t(" 开尔文")}</dd></div>
      <div className="star-detail-current"><dt>{t("距当前观察者")}</dt><dd>{t(number(distance))}{t(" 秒差距")}<small>{t("约 ")}{t(number(distance*3.26156))}{t(" 光年")}</small></dd></div>
    </dl>
    <button type="button" className="star-centre" onClick={onCentre}>{t("将这颗星移到视野中央")}</button>
    <details><summary>{t("数据含义与来源")}</summary>
      <p>{t("目录距离是由观测数据推算的太阳附近参考距离；当前距离由模拟中的三维位置计算。秒差距是距离单位，1 秒差距约为 3.26 光年；数值越大表示越远，没有优劣之分。")}</p>
      <p>{t("星等衡量天体亮度，数值越小越亮，可以为负值。这里显示")}{yale||nearby?t('可见光'):t('盖亚宽光学波段')}{t("的目录值，不是当前画面的显示亮度。不同波段的星等不能直接比较。")}</p>
      {data.spectralType&&<p>{t("光谱类型按恒星光谱特征分类；上方保留源表的字母和数字写法，是类别，不是优劣评分。")}</p>}
      <p>{t("温度单位为开尔文，越大表示越热；")}{data.temperatureMethod==='colour-estimate'?t('此值由恒星颜色估算，不是直接温度测量。'):t('源于目录温度或颜色估计，当前精简文件未保留二者的逐星区分。')}</p>
      <p>{nearby?(language==='en'?'Motion is extrapolated from measured proper motion, radial velocity and parallax. The optical colour temperature is an approximate rendering estimate, especially for red and white dwarfs.':'运动由实测自行、径向速度与视差外推。颜色温度仅用于近似呈现星光，对红矮星和白矮星尤其不能当作精确测温。'):data.measuredVelocity?t('运动依据实测位置与速度外推。精简文件未保存官方恒星编号，本地样本序号不能作为官方编号查询。'):t('这颗星的位置和目录亮度有观测依据，动画中的速度来自族群模型，不能当作该星的实测运动。')}</p>
      <a href={nearby?'/data/nearby-stars-source.json':yale?'/data/bright-star-catalog-source.json':'/data/gaia-dr3-bright-6d-source.json'} target="_blank" rel="noreferrer">{t("查看数据来源与筛选说明")}</a>
      {!!aliases.length&&<p><a href={data.sourceUrl??'/data/chinese-star-names-source.json'} target="_blank" rel="noreferrer">{language==='en'?'Stellar name sources':'星名与别名来源'}</a></p>}
      {source.id==='hip-11767'&&polarisDescription.sources.map(link=><p key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></p>)}
    </details>
  </aside>;
}
