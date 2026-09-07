import type {PointSourceSample} from '@/lib/rendering/contracts';
import type {Vector3} from '@/lib/physics/vector';
import {pointSourcePositionAtTime} from '@/lib/physics/kinematics';
import {starName} from '@/lib/rendering/observed-star-interaction';

const number=(value:number,digits=2)=>Number.isFinite(value)?value.toLocaleString('zh-CN',{maximumFractionDigits:digits}):'暂无数据';
export function StarDetail({source,observer,timeYears,onClose,onCentre}:{source:PointSourceSample;observer:Vector3;timeYears:number;onClose:()=>void;onCentre:()=>void}){
  const data=source.observedData;if(!data)return null;
  const position=pointSourcePositionAtTime(source,timeYears);
  const distance=Math.hypot(position.x-observer.x,position.y-observer.y,position.z-observer.z);
  const yale=data.catalog==='yale-hipparcos';
  const title=source.displayName?starName(source.displayName):yale&&data.catalogueIdentifier?`依巴谷 ${data.catalogueIdentifier}`:'盖亚实测恒星';
  return <aside className="star-detail" aria-label="选中恒星的数据">
    <div className="star-detail-heading"><div><span>实测恒星</span><h2>{title}</h2>{source.displayName&&title!==source.displayName&&<small>{source.displayName}</small>}</div><button type="button" onClick={onClose} aria-label="关闭恒星详情">×</button></div>
    <p className="star-detail-source">{yale?'耶鲁亮星表 · 依巴谷距离':'盖亚第三批公开数据 · 明亮恒星样本'}</p>
    <dl>
      {data.catalogueIdentifier&&<div><dt>依巴谷星表编号</dt><dd>{data.catalogueIdentifier}</dd></div>}
      {data.henryDraperIdentifier&&<div><dt>亨利·德雷珀星表编号</dt><dd>{data.henryDraperIdentifier}</dd></div>}
      {!yale&&<div><dt>本地样本序号</dt><dd>{source.id.replace('gaia-dr3-bright-','')}</dd></div>}
      <div><dt>目录距离</dt><dd>{number(data.referenceDistanceParsec)} 秒差距</dd></div>
      <div><dt>目录亮度</dt><dd>{number(data.referenceApparentMagnitude)} 星等</dd></div>
      {data.spectralType&&<div><dt>光谱类型（源表原文）</dt><dd>{data.spectralType}</dd></div>}
      <div><dt>表面温度估计</dt><dd>{number(source.effectiveTemperatureKelvin,0)} 开尔文</dd></div>
      <div className="star-detail-current"><dt>距当前观察者</dt><dd>{number(distance)} 秒差距<small>约 {number(distance*3.26156)} 光年</small></dd></div>
    </dl>
    <button type="button" className="star-centre" onClick={onCentre}>将这颗星移到视野中央</button>
    <details><summary>数据含义与来源</summary>
      <p>目录距离是由观测数据推算的太阳附近参考距离；当前距离由模拟中的三维位置计算。秒差距是距离单位，1 秒差距约为 3.26 光年；数值越大表示越远，没有优劣之分。</p>
      <p>星等衡量天体亮度，数值越小越亮，可以为负值。这里显示{yale?'可见光':'盖亚宽光学波段'}的目录值，不是当前画面的显示亮度。不同波段的星等不能直接比较。</p>
      {data.spectralType&&<p>光谱类型按恒星光谱特征分类；上方保留源表的字母和数字写法，是类别，不是优劣评分。</p>}
      <p>温度单位为开尔文，越大表示越热；{yale?'此值由恒星颜色估算，不是直接温度测量。':'源于目录温度或颜色估计，当前精简文件未保留二者的逐星区分。'}</p>
      <p>{data.measuredVelocity?'运动依据实测位置与速度外推。精简文件未保存官方恒星编号，本地样本序号不能作为官方编号查询。':'这颗星的位置和目录亮度有观测依据，动画中的速度来自族群模型，不能当作该星的实测运动。'}</p>
      <a href={yale?'/data/bright-star-catalog-source.json':'/data/gaia-dr3-bright-6d-source.json'} target="_blank" rel="noreferrer">查看数据来源与筛选说明</a>
    </details>
  </aside>;
}
