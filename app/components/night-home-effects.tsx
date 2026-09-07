"use client";
import { useEffect, useRef, useState } from 'react';
import { createStarFlight } from '@/lib/landing/star-flight';
import { homePhotos, homeSections, type HomeLanguage } from '@/lib/landing/home-content';
import { sectionTravel } from '@/lib/landing/section-travel';
import { smoothTravel } from '@/lib/landing/flight-path';

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

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const textureReady = () => { stage.classList.toggle('is-webgl', !!renderer?.hasPhoto()); schedule(); };
    let renderer: ReturnType<typeof createStarFlight> = null, frame: number | null = null;
    let userPaused = false, previousTime = 0, progress = 0, initialized = false, current = -1;
    let lastInput = 0, styledProgress = NaN;
    let stops: number[] = [], steeringX = 0, steeringY = 0;
    const inactive = () => userPaused || media.matches || document.hidden;
    const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; previousTime = 0; };
    const measure = () => { stops = sections.map(section => section.getBoundingClientRect().top + window.scrollY); renderer?.resize(); schedule(); };
    const draw = (time: number) => {
      frame = null;
      // Keep ambient motion quiet; reserve the faster cadence for interaction.
      const interval = time - lastInput < 300 ? 1000 / 60 : 1000 / 30;
      if (!inactive() && renderer && previousTime && time - previousTime < interval - 1) { frame = requestAnimationFrame(draw); return; }
      const elapsed = previousTime ? Math.max(0, Math.min((time - previousTime) / 1000, .05)) : 1 / 60;
      const first = previousTime === 0; previousTime = time;
      const state = sectionTravel(window.scrollY, stops);
      if (state.active !== current) { current = state.active; setActive(current); callbackRef.current(current); }
      if (!initialized) { progress = state.progress; initialized = true; }
      progress = inactive() ? state.progress : smoothTravel(progress, state.progress, elapsed);
      const ambientX = inactive() ? 0 : Math.sin(time * .00012) * .055;
      const ambientY = inactive() ? 0 : Math.cos(time * .0001) * .04;
      if (!document.hidden) renderer?.draw(media.matches ? 0 : progress, steeringX + ambientX, steeringY + ambientY, first || inactive());
      if (!Number.isFinite(styledProgress) || Math.abs(progress - styledProgress) > .0001) {
        root.style.setProperty('--chapter-progress', String(progress / 3));
        sections.forEach((section, index) => {
          const distance = Math.abs(progress - index);
          section.style.setProperty('--reading-opacity', String(media.matches ? 1 : Math.max(.22, 1 - Math.max(0, distance - .3) * .68)));
        });
        styledProgress = progress;
      }
      if (!inactive() && renderer) frame = requestAnimationFrame(draw);
    };
    function schedule() { if (!document.hidden && frame === null) frame = requestAnimationFrame(draw); }
    const sync = () => { stop(); styledProgress = NaN; setReduced(media.matches); root.classList.toggle('nf-motion-paused', userPaused || media.matches); stage.classList.toggle('is-webgl', !!renderer?.hasPhoto()); schedule(); };
    controlRef.current = value => { userPaused = value; sync(); };
    const scroll = () => { lastInput = performance.now(); schedule(); };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || inactive()) return;
      lastInput = performance.now();
      steeringX = (event.clientX / window.innerWidth - .5) * .45;
      steeringY = (event.clientY / window.innerHeight - .5) * .35;
    };
    const leave = () => { steeringX = 0; steeringY = 0; };
    const lost = (event: Event) => { event.preventDefault(); stop(); renderer?.dispose(); renderer = null; stage.classList.remove('is-webgl'); };
    const restored = () => { renderer = createStarFlight(canvas, textureReady); sync(); };
    const resize = new ResizeObserver(measure); resize.observe(root);
    window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', measure);
    root.addEventListener('pointermove', pointer, { passive: true }); root.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', sync); media.addEventListener('change', sync);
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
    measure(); sync();
    // Hydrate controls and paint the photograph before compiling graphics programs.
    const startScene = () => { renderer = createStarFlight(canvas, textureReady); sync(); };
    const idleStart = 'requestIdleCallback' in window ? window.requestIdleCallback(startScene, { timeout: 900 }) : null;
    const timedStart = idleStart === null ? window.setTimeout(startScene, 120) : null;
    return () => {
      if (idleStart !== null) window.cancelIdleCallback(idleStart);
      if (timedStart !== null) window.clearTimeout(timedStart);
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
      <img src="/brand/milky-way-4096.webp" srcSet={homePhotos[0].srcSet} sizes="100vw" alt="" className="nf-scene-fallback" fetchPriority="high"/>
      <canvas ref={canvasRef} className="nf-star-flight"/><div className="nf-space-shade"/>
    </div>
    <div className="nf-progress" aria-hidden="true"/>
    <div className="nf-scene-tools">{active === 2 ? <span className="nf-guide-scene-label">{en ? 'Recorded observatory demonstrations' : '观星平台操作演示'}</span> : <a href={photo.source} target="_blank" rel="noreferrer">{en ? 'Photo' : '摄影'}: {photo.credit} ↗</a>}<button type="button" aria-pressed={paused || reduced} disabled={reduced} onClick={() => setPaused(value => !value)}>{reduced ? (en ? 'Reduced motion' : '已减少动态效果') : paused ? (en ? 'Resume motion' : '继续动态效果') : (en ? 'Pause motion' : '暂停动态效果')}</button></div>
  </>;
}
