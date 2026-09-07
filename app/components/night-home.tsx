"use client";
import Link from 'next/link';
import { useState } from 'react';
import { homeSections, type HomeLanguage } from '@/lib/landing/home-content';
import { HomeFeatures } from './home-features';
import { NightHomeEffects } from './night-home-effects';

export function NightHome({ language = 'zh' }: { language?: HomeLanguage }) {
  const en = language === 'en', T = (zh: string, english: string) => en ? english : zh;
  const [active, setActive] = useState(0);
  return <main className={`night-home nf-home ${en ? 'nf-english' : ''}`} lang={en ? 'en' : 'zh-CN'}>
    <NightHomeEffects language={language} onSectionChange={setActive}/>
    <header className="nf-header">
      <a href="#about" className="nf-brand"><img src="/brand/logo-starboat.webp" alt="" width="40" height="40"/><span>{T('银河夜航', 'Galactic Nightflight')}</span></a>
      <nav aria-label={T('首页栏目', 'Page sections')}>{homeSections.map((section, index) => <a key={section.id} href={`#${section.id}`} aria-current={active === index ? 'location' : undefined}>{section.label[language]}</a>)}</nav>
      <div className="nf-header-actions"><Link href={en ? '/' : '/en'} hrefLang={en ? 'zh-CN' : 'en'}>{en ? '中文' : 'EN'}</Link><Link href="/observe" className="nf-enter">{T('进入观星', 'Open observatory')}</Link></div>
    </header>

    <section id="about" data-home-section className="nf-chapter nf-intro" aria-labelledby="nf-title">
      <div className="nf-intro-content"><p className="nf-eyebrow">{en ? '银河夜航' : 'GALACTIC NIGHTFLIGHT'}</p>
        <h1 id="nf-title">{en ? <>Galactic<br/>Nightflight</> : '银河夜航'}</h1>
        <p className="nf-intro-lead">{T('从不同的位置，看同一个银河。', 'Explore the Milky Way from different positions.')}</p>
        <p className="nf-intro-description">{T('一个可以移动视点、推进时间、查询天体的三维观星平台。', 'A three-dimensional observatory with position controls, simulated time and searchable star catalogues.')}</p>
        <div className="nf-actions"><Link href="/observe" className="nf-primary">{T('进入观星平台', 'Open the observatory')} <span aria-hidden="true">↗</span></Link><a href="#features" className="nf-text-link">{T('了解功能', 'Explore features')} <span aria-hidden="true">↓</span></a></div>
      </div>
      <div className="nf-intro-bottom"><p>{T('实测星表 · 三维模型 · 深空影像', 'Observed catalogues · 3D models · Deep-sky images')}</p><a href="#features">{T('向下滚动', 'Scroll to explore')} <span aria-hidden="true">↓</span></a></div>
    </section>

    <section id="features" data-home-section className="nf-chapter nf-features" aria-labelledby="nf-features-title">
      <div className="nf-section-heading"><p className="nf-eyebrow" id="nf-features-title">{T('功能', 'Features')}</p><p>{T('选择一项，看看能做什么。', 'Choose a feature to learn more.')}</p></div>
      <HomeFeatures language={language}/>
    </section>

    <section id="guide" data-home-section className="nf-chapter nf-guide" aria-labelledby="nf-guide-title">
      <div className="nf-guide-heading"><p className="nf-eyebrow">{T('使用', 'Getting started')}</p><h2 id="nf-guide-title">{T('先从眼前的星空开始。', 'Start with the sky in front of you.')}</h2><p className="nf-body">{T('首次进入会有基本操作引导。之后也可以从底部工具栏重新打开「新手教程」。', 'A short guide introduces the controls on your first visit. Reopen it later from the tutorial button in the bottom toolbar.')}</p></div>
      <div className="nf-guide-grid">
        <article><h3>{T('转动视线', 'Look around')}</h3><p>{T('按住并拖动天幕，滚轮缩放。左侧按钮可以看向银河中心、外围或盘面上下。', 'Drag the sky to turn and scroll to zoom. The left toolbar points toward the centre, outer galaxy or galactic poles.')}</p></article>
        <article><h3>{T('移动观察位置', 'Move your position')}</h3><p>{T('打开「位置」，选择预设地点，或在银河图中自由选点。附近恒星会产生视差。', 'Open the position panel to use a preset or select a point on the galactic map. Nearby stars shift as you move.')}</p></article>
        <article><h3>{T('查看天体资料', 'Inspect an object')}</h3><p>{T('点击天体，或搜索它的名称，查看目录信息、当前距离和资料来源。', 'Select an object or search its name to see catalogue information, its current distance and data sources.')}</p></article>
      </div>
      <Link href="/observe" className="nf-text-link">{T('打开观星平台', 'Open the observatory')} <span aria-hidden="true">↗</span></Link>
    </section>

    <section id="open-source" data-home-section className="nf-chapter nf-source" aria-labelledby="nf-source-title">
      <div className="nf-source-copy"><p className="nf-eyebrow">{T('开源', 'Open source')}</p><h2 id="nf-source-title">{T('源码与数据来源', 'Source code and data')}</h2><p className="nf-body">{T('源码、运行说明和素材来源都在 GitHub。可以学习、修改、分享，也可以商业使用。', 'Find the source code, setup instructions and asset credits on GitHub. You can study, modify, share and use the project commercially.')}</p>
        <a href="https://github.com/LopoaySyen/galactic-nightflight" className="nf-repo" target="_blank" rel="noreferrer"><span><small>LopoaySyen</small>galactic-nightflight</span><span aria-hidden="true">↗</span></a>
        <p className="nf-note">{T('代码采用 MIT 许可证，可自由使用和修改，无需另行授权。分发时保留版权与许可声明。星表和照片的来源、使用条款单独列出。', 'The code uses the MIT License, with no separate author approval required. Retain copyright and permission notices when distributing. Catalogues and photographs have their own credits and terms.')}</p>
        <div className="nf-source-links"><a href="/legal/COMMERCIAL-LICENSING.md" target="_blank" rel="noreferrer">{T('使用许可', 'License')}</a><a href="/legal/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">{T('素材来源', 'Asset credits')}</a><a href="/data/SCIENCE_DISPLAY_UPDATE.md" target="_blank" rel="noreferrer">{T('模型说明', 'Model notes')}</a></div>
      </div>
      <aside className="nf-source-note"><h3>{T('哪些是观测，哪些是模拟？', 'What is observed, and what is simulated?')}</h3><p>{T('平台结合了实测恒星目录、统计模型和深空照片。运动、大气和成像仍有近似，不能把画面当作精密天文预测。具体限制保留在模型说明中。', 'The observatory combines measured star catalogues, statistical models and deep-sky photographs. Motion, atmosphere and imaging remain approximate. The model notes explain these limits.')}</p></aside>
    </section>
    <footer className="nf-footer"><span>© 2026 LopoaySyen · Galactic Nightflight</span><span>{T('首页影像为天文摄影，穿行动画为艺术呈现。', 'Homepage photographs show astronomical observations; travel effects are artistic.')}</span></footer>
  </main>;
}
