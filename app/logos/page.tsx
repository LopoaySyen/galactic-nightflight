import type {Metadata} from 'next';
import Link from 'next/link';
export const metadata:Metadata={title:'标志候选 · 银河夜航'};
const options=[
  {id:'starboat',name:'星舟',number:'01',description:'一叶小舟，一颗领航的星。银河弧线环绕船身，偏浪漫，也最贴近“夜航”的名字。'},
  {id:'navigation',name:'引航',number:'02',description:'星芒与开放航线组成方向感鲜明的图形。轮廓紧凑，偏简洁、理性与探索。'},
  {id:'starsail',name:'星帆',number:'03',description:'让银河化为帆面，沿着星光向前。流线轻盈，色彩更丰富，偏艺术与沉浸。'},
];
export default function LogoOptions(){return <main className="logo-options-page"><nav><Link href="/">← 返回银河夜航</Link><Link href="/observe">进入观星平台 ↗</Link></nav>
  <header><p>银河夜航 · 标志候选</p><h1>三个方向，<br/>同一片银河。</h1><span>已选用第一款“星舟”作为网站标志。其余方案保留供设计回顾。</span></header>
  <div className="logo-options-grid">{options.map(option=><article key={option.id}><div className="logo-option-image"><img src={`/brand/logo-${option.id}.webp`} alt={`银河夜航标志候选：${option.name}`} width="1254" height="1254"/></div>
    <div className="logo-option-wordmark">银河夜航</div><div className="logo-option-copy"><small>{option.id==='starboat'?'已采用 · ':'备选 · '}方案 {option.number}</small><h2>{option.name}</h2><p>{option.description}</p><a href={`/brand/logo-${option.id}.png`} download>保存原图 ↓</a></div></article>)}</div>
  <footer><p>三款均由内置图像生成制作，并完成边缘清理；此处展示的是带深色背景的候选图。</p><a href="/brand/generation-notes.json" target="_blank" rel="noreferrer">查看完整生成提示词与说明 ↗</a></footer>
</main>;}
