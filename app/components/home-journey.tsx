"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {journeyThemes,featureSlides,nextSlide,type HomeLanguage} from '@/lib/landing/journey-slides';
import {NightHomeEffects} from './night-home-effects';

export function HomeJourney({language='zh',features=false}:{language?:HomeLanguage;features?:boolean}){
  const en=language==='en',count=features?featureSlides.length:journeyThemes.length;
  const [index,setIndex]=useState(0),[transition,setTransition]=useState(0),[travelling,setTravelling]=useState(false),[auto,setAuto]=useState(true),[reduce,setReduce]=useState(false);
  const sceneRef=useRef<HTMLElement>(null),touchRef=useRef<{x:number;y:number}|null>(null),deadline=useRef<ReturnType<typeof setTimeout>|null>(null);
  const change=(target:number)=>{if(target===index)return;setIndex(target);setTransition(value=>value+1);setTravelling(true);if(deadline.current)clearTimeout(deadline.current);deadline.current=setTimeout(()=>setTravelling(false),1400);};
  const changeRef=useRef(change);useEffect(()=>{changeRef.current=change;});
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>setReduce(media.matches);sync();media.addEventListener('change',sync);
    return()=>{media.removeEventListener('change',sync);if(deadline.current)clearTimeout(deadline.current);};
  },[]);
  useEffect(()=>{
    if(!auto||reduce)return;
    const timer=setInterval(()=>{const rect=sceneRef.current?.getBoundingClientRect();if(document.hidden||!rect||rect.bottom<60||rect.top>window.innerHeight-60||sceneRef.current?.contains(document.activeElement))return;changeRef.current(nextSlide(index,1,count));},11000);
    return()=>clearInterval(timer);
  },[auto,reduce,index,count]);
  const selectedTheme=features?featureSlides[index].theme:index,theme=journeyThemes[selectedTheme];
  const controls=<div className="journey-controls"><div className="journey-tabs" role="tablist" aria-label={en?'Choose a chapter':'选择主题'}>{Array.from({length:count},(_,i)=><button key={i} id={`${features?'feature':'hero'}-tab-${i}`} type="button" role="tab" aria-selected={i===index} aria-controls={`${features?'feature':'hero'}-panel`} tabIndex={i===index?0:-1} onClick={()=>change(i)} onKeyDown={event=>{let target:number|null=null;if(event.key==='ArrowRight')target=nextSlide(i,1,count);if(event.key==='ArrowLeft')target=nextSlide(i,-1,count);if(event.key==='Home')target=0;if(event.key==='End')target=count-1;if(target!==null){event.preventDefault();change(target);document.getElementById(`${features?'feature':'hero'}-tab-${target}`)?.focus();}}}><span>{String(i+1).padStart(2,'0')}</span>{!features&&journeyThemes[i].name[language]}</button>)}</div>
    <div className="journey-buttons"><button type="button" aria-label={en?'Previous slide':'上一张'} onClick={()=>change(nextSlide(index,-1,count))}>←</button><button type="button" aria-label={en?'Next slide':'下一张'} onClick={()=>change(nextSlide(index,1,count))}>→</button><button type="button" className="journey-auto" aria-pressed={auto&&!reduce} disabled={reduce} onClick={()=>setAuto(value=>!value)}>{auto&&!reduce?(en?'Pause slides':'暂停自动切换'):(en?'Play slides':'自动切换')}</button></div></div>;
  const pictureLayers=<div className="journey-pictures" aria-hidden="true">{journeyThemes.map((item,i)=><img key={item.id} className={`journey-picture ${selectedTheme===i?'is-current':''}`} src={item.image} srcSet={item.srcSet} sizes={features?'(max-width: 800px) 100vw, 60vw':'104vw'} alt="" loading={i===0&&!features?'eager':'lazy'} fetchPriority={i===0&&!features?'high':'auto'}/> )}</div>;
  return <section ref={sceneRef} data-flight-scene className={`${features?'feature-journey':'home-hero'} ${travelling?'is-travelling':''}`} aria-roledescription={en?'carousel':'轮播图'} aria-label={features?(en?'Explore the features':'功能介绍幻灯片'):(en?'Galactic journeys':'星际主题幻灯片')}
    onTouchStart={event=>{const touch=event.touches[0];if(touch)touchRef.current={x:touch.clientX,y:touch.clientY};}} onTouchEnd={event=>{const start=touchRef.current,touch=event.changedTouches[0];touchRef.current=null;if(!start||!touch)return;const horizontal=touch.clientX-start.x,vertical=touch.clientY-start.y;if(Math.abs(horizontal)>65&&Math.abs(horizontal)>Math.abs(vertical)*1.5)change(nextSlide(index,horizontal<0?1:-1,count));}}>
    {pictureLayers}<div className="journey-shade"/><NightHomeEffects language={language} transitionKey={transition} compact={features}/><div className="journey-passage" aria-hidden="true"/>
    <div className={features?'feature-journey-copy':'home-hero-copy'} id={`${features?'feature':'hero'}-panel`} role="tabpanel" aria-labelledby={`${features?'feature':'hero'}-tab-${index}`} aria-live={auto?'off':'polite'}>
      {features?<><p className="home-section-label">{en?'Ways to explore':'功能介绍'} / {String(index+1).padStart(2,'0')}</p><h2 key={index}>{featureSlides[index].title[language]}</h2><p className="feature-journey-body">{featureSlides[index].body[language]}</p><p className="feature-journey-detail">{featureSlides[index].detail[language]}</p></>:
      <><p className="home-eyebrow">{theme.name[language]} / {en?'A journey through the night':'一场星际夜航'}</p><h1 id="home-title">{en?<>Galactic<br/>Nightflight</>:'银河夜航'}</h1><p className="home-english-name">{en?'银河夜航':'GALACTIC NIGHTFLIGHT'}</p><p key={index} className="home-hero-poem">{theme.line[language]}</p><p className="home-hero-description">{theme.description[language]}</p><div className="home-hero-actions"><Link className="home-primary" href="/observe">{en?'Enter the observatory':'开始今夜的航行'} <span aria-hidden="true">↗</span></Link><a className="home-text-link" href="#about">{en?'Discover the project':'先了解一下'}</a></div></>}
      {features&&controls}
    </div>
    {!features&&<div className="hero-chapters">{controls}</div>}
    <a className="journey-photo-credit" href={theme.source} target="_blank" rel="noreferrer">{en?'Photo':'照片'}: {theme.credit} ↗</a>
  </section>;
}
