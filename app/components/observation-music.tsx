'use client';

import { useEffect, useRef, useState } from 'react';
import { useObservationLanguage } from './observation-language';
import { SoundtrackPlayer, type MusicState } from '@/lib/audio/soundtrack-player';
import { DEFAULT_MUSIC_VOLUME, soundtracks, zoneNames, type SoundtrackZone } from '@/lib/audio/soundtrack-selection';

const STORAGE_KEY = 'nightflight-music-settings';
const INITIAL_STATE: MusicState = { status: 'waiting', enabled: true, track: null, zone: 'solar', volume: DEFAULT_MUSIC_VOLUME, muted: false, error: false };

export function ObservationMusic({ position }: { position: { x: number; y: number; z: number } }) {
  const { language } = useObservationLanguage();
  const en = language === 'en';
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<MusicState>(INITIAL_STATE);
  const player = useRef<SoundtrackPlayer | null>(null);
  const root = useRef<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const livePosition = useRef(position);
  useEffect(() => {
    const music = new SoundtrackPlayer(setState);
    player.current = music;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && typeof saved.volume === 'number') music.setVolume(saved.volume);
      if (saved && typeof saved.muted === 'boolean') music.setMuted(saved.muted);
      if (saved?.enabled === false) music.pause();
    } catch { /* Private browsing may disable preference storage. */ }
    music.updatePosition(livePosition.current);
    music.startAutomatically();
    const wake = () => music.resumeAfterGesture();
    document.addEventListener('pointerup', wake, { passive: true });
    document.addEventListener('keydown', wake);
    return () => {
      document.removeEventListener('pointerup', wake);
      document.removeEventListener('keydown', wake);
      music.dispose(); player.current = null;
    };
  }, []);
  useEffect(() => { livePosition.current = position; player.current?.updatePosition(position); }, [position]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const saveSettings = () => {
    const music = player.current;
    if (!music) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: music.state.volume, muted: music.state.muted, enabled: music.state.enabled })); } catch { /* Playback remains available. */ }
  };
  const playing = state.status === 'playing' || state.status === 'loading';
  const trackTitle = state.status === 'silence' ? (en ? 'A moment for the stars' : '把这一刻留给星空') : state.track ? (en ? state.track.titleEn : state.track.title) : (en ? 'A little music for the night' : '让音乐轻轻浸入夜空');
  const subtitle = state.status === 'silence' ? (en ? 'A quiet pause · music will return naturally' : '片刻留白 · 音乐稍后自然归来')
    : state.status === 'waiting' ? (en ? 'Music is on · it will join you as you explore' : '配乐已开启 · 开始观星时轻轻进入')
    : state.status === 'paused' ? (en ? 'Music is off' : '配乐已关闭')
    : state.status === 'loading' ? (en ? 'Preparing the night…' : '正在准备音乐…')
    : state.track ? `${en ? zoneNames[state.track.zone][1] : state.track.character} · ${Math.floor(state.track.durationSeconds / 60)}:${String(Math.round(state.track.durationSeconds % 60)).padStart(2, '0')}`
    : (en ? 'Quiet piano · one shared melody' : '静谧钢琴 · 同一个旋律动机');
  return <section ref={root} className="observation-music" aria-label={en ? 'Stargazing music' : '星空配乐'} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className={`music-trigger${playing ? ' is-playing' : ''}`} aria-expanded={open} aria-controls="nightflight-music-panel" onClick={() => setOpen(value => !value)}>
      <span className="music-signal" aria-hidden="true"><i/><i/><i/></span>
      <span>{en ? 'Night music' : '星空配乐'}</span>
    </button>
    {open && <div className="music-panel" id="nightflight-music-panel">
      <div className="music-heading"><span>{en ? 'THIRTEEN NIGHT SKIES' : '十三片夜空'}</span><button type="button" aria-label={en ? 'Close music panel' : '收起配乐面板'} onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></div>
      <p className="music-region">{zoneNames[state.zone][en ? 1 : 0]} · {en ? 'Random music for this location' : '随位置随机选曲'}</p>
      <div className="music-now" aria-live="polite"><strong>{trackTitle}</strong><small>{subtitle}</small></div>
      <div className="music-transport">
        <button className="music-play" type="button" aria-pressed={state.enabled} onClick={() => { if (state.enabled) player.current?.pause(); else void player.current?.play(); saveSettings(); }}>{state.enabled ? (en ? 'Turn music off' : '关闭配乐') : (en ? 'Turn music on' : '开启配乐')}</button>
        <button type="button" disabled={state.status === 'loading'} onClick={() => { void player.current?.next(); saveSettings(); }} aria-label={en ? 'Another piece for this location' : '换一首适合此处的配乐'}>{state.status === 'silence' ? (en ? 'Play now' : '现在听一首') : (en ? 'Next' : '换一首')} <span aria-hidden="true">↝</span></button>
      </div>
      <div className="music-volume"><button type="button" aria-pressed={state.muted} aria-label={state.muted ? (en ? 'Unmute music' : '取消配乐静音') : (en ? 'Mute music' : '配乐静音')} onClick={() => { player.current?.setMuted(!state.muted); saveSettings(); }}>{state.muted ? (en ? 'Muted' : '已静音') : (en ? 'Sound' : '音量')}</button><input type="range" min="0" max="100" step="1" value={Math.round(state.volume * 100)} aria-label={en ? 'Music volume' : '配乐音量'} aria-valuetext={`${Math.round(state.volume * 100)}%`} onChange={event => { player.current?.setVolume(Number(event.target.value) / 100); saveSettings(); }}/><output>{Math.round(state.volume * 100)}%</output></div>
      {state.error && <p role="alert" className="music-error">{en ? 'This piece could not play. Try Play or Next.' : '这首暂时未能播放，请点击开启配乐或换一首。'}</p>}
      <p className="music-hint">{en ? 'Softly on by default, with unhurried pauses between pieces.' : '默认轻声开启。曲目间随机留白，让星空也有安静的时刻。'}</p>
      <details className="music-library"><summary>{en ? 'Explore all 13 pieces' : '听听全部 13 首'}<span aria-hidden="true">＋</span></summary>
        <p>{en ? 'Preview a piece; location-based random music and quiet pauses follow.' : '点选曲目试听；之后继续随位置随机选曲与留白。'}</p>
        <div className="music-track-list">{(Object.keys(zoneNames) as SoundtrackZone[]).map(zone => <div key={zone} className="music-group"><h3>{zoneNames[zone][en ? 1 : 0]}</h3>{soundtracks.filter(track => track.zone === zone).map(track => <button type="button" key={track.id} aria-pressed={state.track?.id === track.id} onClick={() => { void player.current?.play(track); saveSettings(); }}><span><small>{track.id.slice(0, 2)}</small>{en ? track.titleEn : track.title}</span><span aria-hidden="true">{state.track?.id === track.id && playing ? '♫' : '▷'}</span></button>)}</div>)}</div>
        <p><a href="/music/CREDITS.md" target="_blank" rel="noreferrer">{en ? 'Music and instrument credits' : '音乐与音色来源'}</a></p>
      </details>
    </div>}
  </section>;
}
