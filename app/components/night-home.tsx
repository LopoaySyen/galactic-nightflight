"use client";
import { HomeReading } from './home-reading';
import { useState } from 'react';
import { homeSections, type HomeLanguage } from '@/lib/landing/home-content';
import { HomeFeatures } from './home-features';
import { HomeGuide } from './home-guide';
import { NightHomeEffects } from './night-home-effects';

export function NightHome({ language = 'zh' }: { language?: HomeLanguage }) {
  const observeHref = language === 'en' ? '/observe?lang=en' : '/observe';
  const en = language === 'en', T = (zh: string, english: string) => en ? english : zh;
  const [active, setActive] = useState(0);
  return <main className={`night-home nf-home ${en ? 'nf-english' : ''}`} lang={en ? 'en' : 'zh-CN'}>
    <NightHomeEffects language={language} onSectionChange={setActive}/>
    <header className="nf-header">
      <a href="#about" className="nf-brand"><img src="/brand/logo-starboat.webp" alt="" width="40" height="40"/><span>{T('银河夜航', 'Galactic Nightflight')}</span></a>
      <nav aria-label={T('首页栏目', 'Page sections')}>{homeSections.map((section, index) => <a key={section.id} href={`#${section.id}`} aria-current={active === index ? 'location' : undefined}>{section.label[language]}</a>)}</nav>
      <div className="nf-header-actions"><a className="nf-language" aria-label={en ? '切换到中文首页' : 'Switch to English'} href={en ? '/' : '/en'} hrefLang={en ? 'zh-CN' : 'en'}>{en ? '中文' : 'English'}</a><a href={observeHref} className="nf-enter">{T('开始漫游', 'Explore the sky')}</a></div>
    </header>

    <section id="about" data-home-section className="nf-chapter nf-intro" aria-labelledby="nf-title">
      <div className="nf-intro-content"><p className="nf-eyebrow nf-intro-kicker">{en ? 'A journey through the Milky Way' : 'GALACTIC NIGHTFLIGHT'}</p>
        <h1 id="nf-title" aria-label={en ? 'Galactic Nightflight' : '银河夜航'}>{en ? <><span className="nf-wordmark-overline">Galactic</span><span className="nf-wordmark-script">Nightflight<span className="nf-wordmark-star" aria-hidden="true">✦</span></span></> : <><span className="nf-wordmark-first">银河</span><span className="nf-wordmark-second">夜航</span></>}</h1>
        <p className="nf-intro-lead"><span>{T('同一片银河，', 'One galaxy.')}</span><strong>{T('不同的星空。', 'Countless skies.')}</strong></p>
        <p className="nf-intro-description"><HomeReading language={language}>{T('如果站在银河另一处的星球上，抬头望见的是怎样的星空？', 'On a world elsewhere in the Milky Way, what would the night sky look like?')}</HomeReading></p>
        <div className="nf-actions"><a href={observeHref} className="nf-primary">{T('开始漫游', 'Start exploring')} <span aria-hidden="true">↗</span></a><a href="#features" className="nf-text-link">{T('看看怎么玩', 'Take a look around')} <span aria-hidden="true">↓</span></a></div>
      </div>
      <div className="nf-intro-bottom"><p><HomeReading language={language}>{T('从太阳附近出发，去看别处的夜空。', 'Start near the Sun. Find a sky of your own.')}</HomeReading></p><a href="#features">{T('向下滚动', 'Scroll to explore')} <span aria-hidden="true">↓</span></a></div>
    </section>

    <section id="features" data-home-section className="nf-chapter nf-features" aria-labelledby="nf-features-title">
      <div className="nf-section-heading"><p className="nf-eyebrow" id="nf-features-title"><HomeReading language={language}>{T('功能', 'Features')}</HomeReading></p><p><HomeReading language={language}>{T('位置、时间和大气，都由你选择。', 'Your place. Your time. Your sky.')}</HomeReading></p></div>
      <HomeFeatures language={language}/>
    </section>

    <section id="guide" data-home-section className="nf-chapter nf-guide" aria-labelledby="nf-guide-title">
      <div className="nf-guide-heading"><p className="nf-eyebrow"><HomeReading language={language}>{T('使用', 'Getting started')}</HomeReading></p><h2 id="nf-guide-title"><HomeReading language={language}>{T('选一个地方，抬头看看。', 'Pick a place. Look up.')}</HomeReading></h2><p className="nf-body"><HomeReading language={language}>{T('首次进入会有基本操作引导。之后也可以从底部工具栏重新打开「新手教程」。', 'A short guide introduces the controls on your first visit. Reopen it later from the tutorial button in the bottom toolbar.')}</HomeReading></p></div>
      <HomeGuide language={language}/>
      <a href={observeHref} className="nf-text-link">{T('打开观星平台', 'Open the observatory')} <span aria-hidden="true">↗</span></a>
    </section>

    <section id="open-source" data-home-section className="nf-chapter nf-source" aria-labelledby="nf-source-title">
      <div className="nf-source-copy"><p className="nf-eyebrow"><HomeReading language={language}>{T('开源', 'Open source')}</HomeReading></p><h2 id="nf-source-title"><HomeReading language={language}>{T('这片星空，也可以由你改写。', 'Make this sky your own.')}</HomeReading></h2><p className="nf-body"><HomeReading language={language}>{T('源码、运行说明和数据来源都在 GitHub。可以研究它如何工作，也可以动手改成你想要的样子。', 'The code, setup guide and data sources are on GitHub. See how it works, build on it, or take it in a new direction.')}</HomeReading></p>
        <a href="https://github.com/LopoaySyen/galactic-nightflight" className="nf-repo" target="_blank" rel="noreferrer"><span><small>LopoaySyen</small>galactic-nightflight</span><span aria-hidden="true">↗</span></a>
        <p className="nf-note"><HomeReading language={language}>{T('代码采用 MIT 许可证，可自由使用和修改，无需另行授权。分发时保留版权与许可声明。星表和照片的来源、使用条款单独列出。', 'The code uses the MIT License, with no separate author approval required. Retain copyright and permission notices when distributing. Catalogues and photographs have their own credits and terms.')}</HomeReading></p>
        <div className="nf-source-links"><a href="/legal/COMMERCIAL-LICENSING.md" target="_blank" rel="noreferrer">{T('使用许可', 'License')}</a><a href="/legal/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">{T('素材来源', 'Asset credits')}</a><a href="/data/SCIENCE_DISPLAY_UPDATE.md" target="_blank" rel="noreferrer">{T('模型说明', 'Model notes')}</a></div>
      </div>
      <aside className="nf-source-note"><h3><HomeReading language={language}>{T('哪些是观测，哪些是模拟？', 'What is observed, and what is simulated?')}</HomeReading></h3><p><HomeReading language={language}>{T('太阳附近有实测星表可用，远方星空则结合银河模型推算。地表和大气用于模拟异地观星的环境，并非某颗已知行星的实景。具体方法与限制见模型说明。', 'Measured star catalogues anchor the nearby sky; galactic models fill in the more distant view. Ground and atmosphere create an imagined observing environment, not a reconstruction of a particular planet.')}</HomeReading></p></aside>
    </section>
    <footer className="nf-footer"><span>© 2026 LopoaySyen · Galactic Nightflight</span></footer>
  </main>;
}
