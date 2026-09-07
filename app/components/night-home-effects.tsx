"use client";
import {useEffect,useRef,useState} from 'react';
import {createStarFlight} from '@/lib/landing/star-flight';
export function NightHomeEffects({language='zh',transitionKey=0,compact=false}:{language?:'zh'|'en';transitionKey?:number;compact?:boolean}){
  const en=language==='en',burstRef=useRef<()=>void>(()=>{});
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const controlsRef=useRef<(paused:boolean,fast:boolean)=>void>(()=>{});
  const [paused,setPaused]=useState(false),[fast,setFast]=useState(false),[reduced,setReduced]=useState(false),[available,setAvailable]=useState(true);
  useEffect(()=>{
    const canvas=canvasRef.current,hero=canvas?.closest<HTMLElement>('[data-flight-scene]'),root=canvas?.closest<HTMLElement>('.night-home');
    if(!canvas||!hero||!root)return;
    let renderer=createStarFlight(canvas);if(!renderer)setAvailable(false);
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    let userPaused=false,accelerated=false,visible=true,frame:number|null=null,previous=0,journey=0,speed=1.15;
    let pointerX=0,pointerY=0,steeringX=0,steeringY=0,burstStart=-10000;
    burstRef.current=()=>{burstStart=performance.now();};
    const stop=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;previous=0;};
    const draw=(time:number)=>{
      frame=null;const elapsed=previous?Math.min((time-previous)/1000,.05):0;previous=time;
      const passage=Math.max(0,Math.sin(Math.PI*Math.min(1,(time-burstStart)/1400)));
      speed+=((passage>0?1.15+passage*28:accelerated?7:1.15)-speed)*Math.min(1,elapsed*7);
      steeringX+=(pointerX-steeringX)*Math.min(1,elapsed*3);steeringY+=(pointerY-steeringY)*Math.min(1,elapsed*3);
      journey=(journey+elapsed*speed)%30;renderer?.draw(journey,speed,steeringX,steeringY);
      hero.style.setProperty('--flight-x',`${steeringX*8}px`);hero.style.setProperty('--flight-y',`${steeringY*5}px`);
      frame=requestAnimationFrame(draw);
    };
    const sync=()=>{
      const inactive=userPaused||media.matches||document.hidden||!visible;
      hero.classList.toggle('motion-paused',inactive);hero.classList.toggle('flight-accelerated',accelerated&&!inactive);setReduced(media.matches);
      if(inactive||!renderer)stop();else if(frame===null)frame=requestAnimationFrame(draw);
    };
    controlsRef.current=(paused,fast)=>{userPaused=paused;accelerated=fast;sync();};
    const pointer=(event:PointerEvent)=>{if(event.pointerType==='touch')return;const rect=hero.getBoundingClientRect();pointerX=(event.clientX-rect.left)/rect.width-.5;pointerY=(event.clientY-rect.top)/rect.height-.5;};
    const leave=()=>{pointerX=0;pointerY=0;};
    const resize=()=>renderer?.draw(journey,speed,steeringX,steeringY);
    const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;sync();},{threshold:.02});observer.observe(hero);
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
    const lost=(event:Event)=>{event.preventDefault();stop();renderer=null;setAvailable(false);};
    const restored=()=>{renderer=createStarFlight(canvas);setAvailable(!!renderer);sync();};
    canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
    hero.addEventListener('pointermove',pointer,{passive:true});hero.addEventListener('pointerleave',leave);
    media.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);renderer?.draw(0,1.15,0,0);sync();
    return()=>{stop();renderer?.dispose();observer.disconnect();resizeObserver.disconnect();controlsRef.current=()=>{};
      hero.removeEventListener('pointermove',pointer);hero.removeEventListener('pointerleave',leave);media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);};
  },[]);
  useEffect(()=>{controlsRef.current(paused,fast);},[paused,fast]);
  useEffect(()=>{if(transitionKey>0)burstRef.current();},[transitionKey]);
  return <><canvas ref={canvasRef} className="home-star-flight" aria-hidden="true"/>
    <div className={`home-flight-controls ${compact?"is-compact":""}`} aria-label={en?"Starflight animation":"首页穿行动画"}>
      {available&&!compact&&<button type="button" className="home-speed-toggle" aria-pressed={fast} disabled={paused||reduced} onClick={()=>setFast(value=>!value)}>{fast?(en?'Cruise speed':'返回慢航'):(en?'Accelerate':'加速穿行')}</button>}
      <button type="button" className="home-motion-toggle" disabled={reduced} aria-pressed={paused||reduced} onClick={()=>setPaused(value=>!value)}>{reduced?(en?'Reduced motion':'已遵循减少动画设置'):paused?(en?'Resume motion':'继续穿行'):(en?'Pause motion':'暂停穿行')}</button>
    </div></>;
}
