"use client";
import { HomeReading } from './home-reading';
import { useState } from 'react';
import { homeFeatures, homePhotos, type HomeLanguage } from '@/lib/landing/home-content';

export function HomeFeatures({ language }: { language: HomeLanguage }) {
  const [selected, setSelected] = useState(0), en = language === 'en';
  return <div className="nf-feature-explorer">
    <div className="nf-feature-tabs" role="tablist" aria-label={en ? 'Explore features' : '选择功能'}>
      {homeFeatures.map((item, index) => <button key={item.id} id={`feature-${item.id}`} type="button" role="tab" aria-selected={index === selected} tabIndex={index === selected ? 0 : -1} aria-controls={`feature-panel-${item.id}`} onClick={() => setSelected(index)} onKeyDown={event => {
        let target = index;
        if (event.key === 'ArrowRight') target = (index + 1) % homeFeatures.length;
        else if (event.key === 'ArrowLeft') target = (index + homeFeatures.length - 1) % homeFeatures.length;
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = homeFeatures.length - 1;
        else return;
        event.preventDefault(); setSelected(target); document.getElementById(`feature-${homeFeatures[target].id}`)?.focus();
      }}><span>{item.label[language]}</span></button>)}
    </div>
    <div className="nf-feature-stage">
      {homeFeatures.map((feature, index) => {
        const photo = homePhotos[feature.photo], active = selected === index;
        return <div key={feature.id} id={`feature-panel-${feature.id}`} role="tabpanel" aria-labelledby={`feature-${feature.id}`} aria-hidden={!active} inert={!active} className={`nf-feature-panel ${active ? 'is-active' : ''}`}>
          <figure className={`nf-feature-image nf-image-${feature.id}`}>
            <img src={photo.image} srcSet={photo.srcSet} sizes="(max-width: 800px) 100vw, 75vw" alt={photo.name[language]} loading="lazy" decoding="async"/>
            <figcaption>{en ? 'Photo' : '摄影'} · {photo.name[language]}<a href={photo.source} target="_blank" rel="noreferrer">{photo.credit} ↗</a></figcaption>
          </figure>
          <div className="nf-feature-copy"><h2><HomeReading language={language}>{feature.title[language]}</HomeReading></h2><p className="nf-body"><HomeReading language={language}>{feature.body[language]}</HomeReading></p>
            <div className="nf-feature-points">{feature.points[language].map(point => <span key={point}>{point}</span>)}</div>
            <p className="nf-note"><HomeReading language={language}>{feature.detail[language]}</HomeReading></p>
          </div>
        </div>;
      })}
    </div>
  </div>;
}
