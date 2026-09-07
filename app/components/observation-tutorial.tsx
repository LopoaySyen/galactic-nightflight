"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {observationTutorialSteps} from '@/lib/rendering/observation-tutorial';
export function ObservationTutorial({step,onStep,onClose}:{step:number;onStep:(step:number)=>void;onClose:()=>void}){
  const content=observationTutorialSteps[step],dialogRef=useRef<HTMLDivElement>(null);
  const [layout,setLayout]=useState<{target:{left:number;top:number;width:number;height:number}|null;left:number;top:number}|null>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;dialogRef.current?.focus();
    return()=>{if(previous?.isConnected)previous.focus();};
  },[]);
  useLayoutEffect(()=>{
    const target=content.target?document.querySelector<HTMLElement>(content.target):null;
    target?.scrollIntoView({block:'nearest',behavior:'instant'});
    const measure=()=>{
      const width=window.innerWidth,height=window.innerHeight;
      const cardWidth=Math.min(420,width-32),cardHeight=dialogRef.current?.offsetHeight??300;
      const rect=target?.getBoundingClientRect();
      const visible=rect&&rect.width>0&&rect.height>0;
      let left=(width-cardWidth)/2,top=(height-cardHeight)/2;
      if(visible){
        if(width>900&&rect.right+cardWidth+36<width){left=rect.right+24;top=rect.top;}
        else if(width>900&&rect.left-cardWidth-24>16){left=rect.left-cardWidth-24;top=rect.top;}
        else top=rect.top>height*.5?rect.top-cardHeight-20:rect.bottom+20;
      }
      setLayout({target:visible?{left:Math.max(4,rect.left-6),top:Math.max(4,rect.top-6),width:Math.min(width-8,rect.width+12),height:Math.min(height-8,rect.height+12)}:null,
        left:Math.max(16,Math.min(width-cardWidth-16,left)),top:Math.max(16,Math.min(height-cardHeight-16,top))});
    };
    measure();const observer=new ResizeObserver(measure);if(target)observer.observe(target);if(dialogRef.current)observer.observe(dialogRef.current);
    window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[step,content.target]);
  return <div className="observation-tour-layer" onKeyDown={event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();onClose();}
    if(event.key==='Tab'){
      const controls=[...dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]];
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  }}>
    {layout?.target?<div className="observation-tour-highlight" style={layout.target}/>:<div className="observation-tour-dim"/>}
    <div ref={dialogRef} className="observation-tour-card" role="dialog" aria-modal="true" aria-labelledby="observation-tour-title" aria-describedby="observation-tour-body" tabIndex={-1}
      style={layout?{left:layout.left,top:layout.top}:{left:'50%',top:'50%',transform:'translate(-50%,-50%)'}}>
      <div className="observation-tour-heading"><span>新手教程 · 第 {step+1} 步，共 {observationTutorialSteps.length} 步</span><button type="button" onClick={onClose}>跳过引导</button></div>
      <progress max={observationTutorialSteps.length} value={step+1} aria-label="教程进度"/>
      <h2 id="observation-tour-title">{content.title}</h2><p id="observation-tour-body">{content.body}</p>
      <div className="observation-tour-actions"><button type="button" onClick={()=>onStep(step-1)} disabled={step===0}>上一步</button><button type="button" onClick={()=>step===observationTutorialSteps.length-1?onClose():onStep(step+1)}>{step===observationTutorialSteps.length-1?'开始观星':'下一步'}</button></div>
    </div>
  </div>;
}
