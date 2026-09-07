"use client";
import { useState } from 'react';
import { homeFeatures, homePhotos, type HomeLanguage } from '@/lib/landing/home-content';

export function HomeFeatures({ language }: { language: HomeLanguage }) {
  const [selected, setSelected] = useState(0);
  const feature = homeFeatures[selected], photo = homePhotos[feature.photo], en = language === 'en';
  return <div className="nf-feature-explorer">
    <div className="nf-feature-tabs" role="tablist" aria-label={en ? 'Explore features' : '选择功能'}>
      {homeFeatures.map((item, index) => <button key={item.id} id={`feature-${item.id}`} type="button" role="tab" aria-selected={index === selected} tabIndex={index === selected ? 0 : -1} aria-controls="feature-details" onClick={() => setSelected(index)} onKeyDown={event => {
        let target = index;
        if (event.key === 'ArrowRight') target = (index + 1) % homeFeatures.length;
        else if (event.key === 'ArrowLeft') target = (index + homeFeatures.length - 1) % homeFeatures.length;
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = homeFeatures.length - 1;
        else return;
        event.preventDefault(); setSelected(target); document.getElementById(`feature-${homeFeatures[target].id}`)?.focus();
      }}>{item.label[language]}</button>)}
    </div>
    <div id="feature-details" role="tabpanel" aria-labelledby={`feature-${feature.id}`} className="nf-feature-layout">
      <div className="nf-feature-copy" key={feature.id}>
        <h2>{feature.title[language]}</h2><p className="nf-body">{feature.body[language]}</p>
        <ul className="nf-feature-points">{feature.points[language].map(point => <li key={point}>{point}</li>)}</ul>
        <p className="nf-note">{feature.detail[language]}</p>
      </div>
      <figure className={`nf-feature-image nf-image-${feature.id}`}>
        <img key={photo.image} src={photo.image} srcSet={photo.srcSet} sizes="(max-width: 800px) 90vw, 50vw" alt={photo.name[language]} loading="lazy"/>
        <figcaption>{en ? 'Photographic reference' : '摄影参考'} · {photo.name[language]}<a href={photo.source} target="_blank" rel="noreferrer">{photo.credit} ↗</a></figcaption>
      </figure>
    </div>
  </div>;
}
