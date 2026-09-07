"use client";
import { useEffect, useRef, useState } from 'react';
import { createStarFlight } from '@/lib/landing/star-flight';
import { homePhotos, homeSections, type HomeLanguage } from '@/lib/landing/home-content';
import { sectionTravel, travelSpeed } from '@/lib/landing/section-travel';

const chapterPhotos = [0, 0, 1, 2];

export function NightHomeEffects({ language = 'zh', onSectionChange }: { language?: HomeLanguage; onSectionChange: (index: number) => void }) {
  const stageRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const controlRef = useRef<(value: boolean) => void>(() => {});
  const callbackRef = useRef(onSectionChange);
  const [paused, setPaused] = useState(false), [reduced, setReduced] = useState(false), [active, setActive] = useState(0);
  useEffect(() => { callbackRef.current = onSectionChange; }, [onSectionChange]);

  useEffect(() => {
    const stage = stageRef.current, canvas = canvasRef.current, root = stage?.closest<HTMLElement>('.nf-home');
    if (!stage || !canvas || !root) return;
    const sections = homeSections.map(section => root.querySelector<HTMLElement>(`#${section.id}`)!);
    const images = Array.from(stage.querySelectorAll<HTMLElement>('[data-travel-photo]'));
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let renderer = createStarFlight(canvas), frame: number | null = null;
    let userPaused = false, previousTime = 0, previousProgress = 0, cruise = 0, speed = .35, current = -1, dirty = true;
    let stops: number[] = [], steeringX = 0, steeringY = 0;
    const inactive = () => userPaused || media.matches || document.hidden;
    const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; previousTime = 0; };
    const measure = () => { stops = sections.map(section => section.getBoundingClientRect().top + window.scrollY); dirty = true; schedule(); };
    const draw = (time: number) => {
      frame = null;
      const elapsed = previousTime ? Math.max(1 / 120, Math.min((time - previousTime) / 1000, .05)) : 1 / 60;
      const first = previousTime === 0; previousTime = time;
      const state = sectionTravel(window.scrollY, stops);
      if (state.active !== current) { current = state.active; setActive(current); callbackRef.current(current); }
      const progress = inactive() ? state.active : state.progress;
      const delta = first ? 0 : progress - previousProgress;
      speed += (travelSpeed(delta, elapsed) - speed) * Math.min(1, elapsed * 9);
      if (dirty || Math.abs(delta) > .00001) {
        const from = Math.floor(progress), to = Math.min(3, from + 1), fraction = progress - from;
        const blend = fraction * fraction * (3 - 2 * fraction);
        images.forEach((image, index) => {
          const weight = (chapterPhotos[from] === index ? 1 - blend : 0) + (chapterPhotos[to] === index ? blend : 0);
          image.style.opacity = String(weight);
          const depth = progress - [0, 2, 3][index];
          image.style.transform = inactive() ? 'none' : `translate3d(${-depth * 2}%,0,0) scale(${Math.max(.82, Math.min(1.65, 1.06 + depth * .21))})`;
        });
        root.style.setProperty('--chapter-progress', String(state.progress / 3));
        dirty = false;
      }
      stage.style.setProperty('--travel-strength', inactive() ? '0' : String(Math.min(.6, speed / 38)));
      if (!inactive()) cruise = (cruise + elapsed * .35) % 30;
      if (!document.hidden) renderer?.draw(cruise + (inactive() ? 0 : progress * 8), inactive() ? .35 : speed, steeringX, steeringY);
      previousProgress = progress;
      if (!inactive() && renderer) frame = requestAnimationFrame(draw);
    };
    function schedule() { if (!document.hidden && frame === null) frame = requestAnimationFrame(draw); }
    const sync = () => { stop(); setReduced(media.matches); root.classList.toggle('nf-motion-paused', userPaused || media.matches); dirty = true; schedule(); };
    controlRef.current = value => { userPaused = value; sync(); };
    const scroll = () => { dirty = true; schedule(); };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || inactive()) return;
      steeringX = (event.clientX / window.innerWidth - .5) * .45;
      steeringY = (event.clientY / window.innerHeight - .5) * .35;
    };
    const leave = () => { steeringX = 0; steeringY = 0; };
    const lost = (event: Event) => { event.preventDefault(); stop(); renderer = null; };
    const restored = () => { renderer = createStarFlight(canvas); sync(); };
    const resize = new ResizeObserver(measure); resize.observe(root);
    window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', measure);
    root.addEventListener('pointermove', pointer, { passive: true }); root.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', sync); media.addEventListener('change', sync);
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
    measure(); sync();
    return () => {
      stop(); resize.disconnect(); renderer?.dispose(); controlRef.current = () => {};
      window.removeEventListener('scroll', scroll); window.removeEventListener('resize', measure);
      root.removeEventListener('pointermove', pointer); root.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', sync); media.removeEventListener('change', sync);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, []);
  useEffect(() => { controlRef.current(paused); }, [paused]);
  const photo = homePhotos[chapterPhotos[active]], en = language === 'en';
  return <>
    <div ref={stageRef} className="nf-backdrop" aria-hidden="true">
      {homePhotos.map((item, index) => <img key={item.image} data-travel-photo src={item.image} srcSet={item.srcSet} sizes="110vw" alt="" className={`nf-travel-photo ${index === 0 ? 'is-first' : ''}`} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'}/>)}
      <div className="nf-space-shade"/><canvas ref={canvasRef} className="nf-star-flight"/><div className="nf-speed-glow"/>
    </div>
    <div className="nf-progress" aria-hidden="true"/>
    <div className="nf-scene-tools"><a href={photo.source} target="_blank" rel="noreferrer">{en ? 'Photo' : '摄影'}: {photo.credit} ↗</a><button type="button" aria-pressed={paused || reduced} disabled={reduced} onClick={() => setPaused(value => !value)}>{reduced ? (en ? 'Reduced motion' : '已减少动态效果') : paused ? (en ? 'Resume motion' : '继续动态效果') : (en ? 'Pause motion' : '暂停动态效果')}</button></div>
  </>;
}
