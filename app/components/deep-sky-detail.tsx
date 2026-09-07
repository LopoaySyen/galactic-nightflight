import type {DeepSkyTarget} from '@/lib/rendering/sky-object-catalog';
import type {Vector3} from '@/lib/physics/vector';
const number=(value:number)=>value.toLocaleString('zh-CN',{maximumFractionDigits:2});
export function DeepSkyDetail({target,observer,onClose,onCentre}:{target:DeepSkyTarget;observer:Vector3;onClose:()=>void;onCentre:()=>void}){
  const referenceDistance=Math.hypot(target.positionParsec.x+8277,target.positionParsec.y,target.positionParsec.z);
  const distance=Math.hypot(target.positionParsec.x-observer.x,target.positionParsec.y-observer.y,target.positionParsec.z-observer.z);
  return <aside className="star-detail deep-sky-detail" aria-label="选中星云、星团或星系的资料">
    <div className="star-detail-heading"><div><span>{target.kind} · 目录天体</span><h2>{target.name}</h2></div><button type="button" onClick={onClose} aria-label="关闭天体详情">×</button></div>
    <p>{target.description}</p>
    <p className="object-unit-note">光年是光在一年中传播的距离。下列数值越大表示越远，没有优劣之分；参考距离从太阳附近计算，当前距离从你的观察位置计算。</p>
    <dl><div><dt>采用的参考距离</dt><dd>约 {number(referenceDistance*3.26156)} 光年</dd></div>
      <div className="star-detail-current"><dt>距当前观察者</dt><dd>约 {number(distance*3.26156)} 光年</dd></div></dl>
    {target.aliases.length>0&&<p className="star-detail-source">其他名称与目录写法：{target.aliases.join(' / ')}</p>}
    <button type="button" className="star-centre" onClick={onCentre}>居中并放大观察</button>
    {target.image?<div className="object-source"><p>照片署名：{target.image.creditShort}</p>
      <a href={target.image.sourcePage} target="_blank" rel="noreferrer">查看原始观测照片与说明 ↗</a>
      <p>照片是从太阳附近观测得到的二维图像，当前三维穿行中的内部形态仍是近似。照片中的星点不能逐个当成已载入的恒星资料。</p></div>:
      <p className="object-source">此天体采用目录参数绘制简化轮廓，当前没有绑定观测照片。</p>}
    <a className="object-model-link" href="/data/SCIENCE_DISPLAY_UPDATE.md" target="_blank" rel="noreferrer">查看模型与数据说明</a>
  </aside>;
}
