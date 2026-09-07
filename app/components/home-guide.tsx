"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { HomeLanguage } from '@/lib/landing/home-content';

const steps = [
  {
    id: 'look', image: '/guide/observatory.jpg', animation: '/guide/look.gif',
    title: { zh: '转动视线', en: 'Look around' },
    hint: { zh: '拖动天幕 · 滚轮缩放', en: 'Drag to turn · Scroll to zoom' },
    body: { zh: '按住并拖动天幕，滚轮缩放。左侧按钮可以看向银河中心、外围或盘面上下。', en: 'Drag the sky to turn and scroll to zoom. The left toolbar points toward the centre, outer galaxy or galactic poles.' },
    alt: { zh: '观星平台实际界面，左侧是方向按钮，底部是时间与观察工具', en: 'Actual observatory interface with direction buttons on the left and time and observing tools below' },
    caption: { zh: '太阳邻域的天幕与观察工具', en: 'The solar-neighbourhood sky and observing tools' },
  },
  {
    id: 'move', image: '/guide/position-jump.jpg', animation: '/guide/move.gif',
    title: { zh: '移动观察位置', en: 'Move your position' },
    hint: { zh: '选择地点 · 换一片星空', en: 'Choose a place · Find another sky' },
    body: { zh: '打开「位置跳转」，选择一个地点，或在银河图中自由选点。移动的是观察者，恒星的方向和亮度会随之重新计算。', en: 'Open “位置跳转” to choose a preset or a point on the galactic map. Moving the observer recalculates stellar directions and brightness.' },
    alt: { zh: '位置跳转操作截图：已选中内银河，右侧显示六个观察位置', en: 'Position controls with Inner galaxy selected and six observing presets on the right' },
    caption: { zh: '已从太阳邻域跳转至内银河', en: 'After a jump from the solar neighbourhood to the inner galaxy' },
  },
  {
    id: 'inspect', image: '/guide/star-details.jpg', animation: '/guide/inspect.gif',
    title: { zh: '查看天体资料', en: 'Inspect an object' },
    hint: { zh: '搜索名称 · 点选查看', en: 'Search by name · Select to inspect' },
    body: { zh: '点击天体，或搜索它的名称。选择结果后，查看目录信息、距当前观察者的距离和资料来源。', en: 'Select an object or search its name. Choose a result to inspect catalogue information, distance from your current position and data sources.' },
    alt: { zh: '天狼星资料操作截图，右侧展示目录编号、距离、亮度与温度估计', en: 'Sirius selected with catalogue identifiers, distance, brightness and estimated temperature in the side panel' },
    caption: { zh: '选中天狼星，查看实测资料', en: 'Sirius selected, with measured catalogue information' },
  },
] as const;

function subscribeMotion(change: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', change);
  document.addEventListener('visibilitychange', change);
  return () => { media.removeEventListener('change', change); document.removeEventListener('visibilitychange', change); };
}
function motionSnapshot() {
  return document.hidden ? 'hidden' : window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'ready';
}

export function HomeGuide({ language }: { language: HomeLanguage }) {
  const [selected, setSelected] = useState(0);
  const [playback, setPlayback] = useState<'auto' | 'play' | 'still'>('auto');
  const [inView, setInView] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const motion = useSyncExternalStore(subscribeMotion, motionSnapshot, () => 'hidden');
  const animate = inView && playback !== 'still' && (motion === 'ready' || (motion === 'reduced' && playback === 'play'));
  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const en = language === 'en';
  return <div className="nf-guide-demo">
    <div className="nf-guide-tabs" role="tablist" aria-label={en ? 'Choose an operation' : '选择操作'} aria-orientation="vertical">
      {steps.map((step, index) => <button key={step.id} id={`guide-${step.id}`} className="nf-guide-step" type="button" role="tab" aria-selected={selected === index} aria-controls={`guide-panel-${step.id}`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => {
        let next = index;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % steps.length;
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + steps.length - 1) % steps.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = steps.length - 1;
        else return;
        event.preventDefault(); setSelected(next); document.getElementById(`guide-${steps[next].id}`)?.focus();
      }}>
        <span className="nf-guide-step-title">{step.title[language]}<span aria-hidden="true">↗</span></span>
        <span className="nf-guide-step-hint">{step.hint[language]}</span>
        <span className="nf-guide-step-body">{step.body[language]}</span>
      </button>)}
    </div>
    <div className="nf-guide-preview" ref={previewRef}>
      {steps.map((step, index) => <figure key={step.id} id={`guide-panel-${step.id}`} className={`nf-guide-shot ${index === selected ? 'is-active' : ''}`} role="tabpanel" aria-labelledby={`guide-${step.id}`} aria-hidden={index !== selected} inert={index !== selected}>
        <a className="nf-guide-image-link" href={animate && index === selected ? step.animation : step.image} target="_blank" rel="noreferrer" aria-label={`${step.title[language]} · ${en ? 'View full-size demonstration' : '查看完整操作演示'}`}>
          <img src={animate && index === selected ? step.animation : step.image} width="1363" height="936" loading="lazy" decoding="async" alt={step.alt[language]}/>
          <span className="nf-guide-expand" aria-hidden="true">{en ? 'View full size' : '查看大图'} ↗</span>
        </a>
        <figcaption><span className="nf-guide-shot-label">{en ? 'RECORDED IN THE OBSERVATORY' : '实际操作录制'}</span><button type="button" className="nf-guide-playback" aria-pressed={animate} onClick={() => setPlayback(animate ? 'still' : 'play')}>{animate ? (en ? 'Show still image' : '显示静态图') : (en ? 'Play demonstration' : '播放演示')}</button><span className="nf-guide-caption">{step.caption[language]}</span></figcaption>
        <p className="nf-guide-mobile-copy">{step.body[language]}</p>
      </figure>)}
    </div>
  </div>;
}
