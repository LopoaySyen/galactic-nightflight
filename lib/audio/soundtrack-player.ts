import { CROSSFADE_SECONDS, DEFAULT_MUSIC_VOLUME, SoundtrackSequence, soundtrackZone, randomSilenceSeconds, type Soundtrack, type SoundtrackZone } from './soundtrack-selection.ts';

export type MusicState = {
  status: 'waiting' | 'loading' | 'playing' | 'silence' | 'paused' | 'error';
  enabled: boolean;
  track: Soundtrack | null; zone: SoundtrackZone; volume: number; muted: boolean;
  error: boolean;
};
type Position = { x: number; y: number; z: number };
type Voice = { audio: HTMLAudioElement; gain: GainNode; source: MediaElementAudioSourceNode; track: Soundtrack };

/** Stream compressed files; only the incoming and outgoing pieces play together. */
export class SoundtrackPlayer {
  state: MusicState = { status: 'waiting', enabled: true, track: null, zone: 'solar', volume: DEFAULT_MUSIC_VOLUME, muted: false, error: false };
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: Voice | null = null;
  private incoming: Voice | null = null;
  private voices = new Set<Voice>();
  private cleanupTimers = new Set<ReturnType<typeof setTimeout>>();
  private regionTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private regionCandidate: SoundtrackZone | null = null;
  private position: Position = { x: -8277, y: 0, z: 0 };
  private sequence = new SoundtrackSequence();
  private request = 0;
  private wantsPlayback = true;
  private disposed = false;
  private notify: (state: MusicState) => void;
  private makeAudio: () => HTMLAudioElement;
  private makeContext: () => AudioContext;
  private random: () => number;

  constructor(notify: (state: MusicState) => void, makeAudio = () => new Audio(), makeContext = () => new AudioContext(), random = Math.random) {
    this.notify = notify; this.makeAudio = makeAudio; this.makeContext = makeContext;
    this.random = random;
  }
  private ensureContext() {
    if (!this.context) {
      this.context = this.makeContext(); this.master = this.context.createGain();
      this.master.gain.value = this.state.muted ? 0 : this.state.volume;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }
  /** Try on mount. Suspended autoplay remains enabled, awaiting a normal gesture. */
  startAutomatically() {
    if (this.disposed || !this.state.enabled || this.state.status !== 'waiting') return;
    const ticket = ++this.request;
    try {
      const context = this.ensureContext();
      void context.resume().then(() => {
        if (ticket === this.request && this.wantsPlayback && !this.disposed && context.state === 'running') void this.play();
      }).catch(() => { /* A later trusted gesture retries in the same context. */ });
    } catch { this.wantsPlayback = false; this.emit({ status: 'error', enabled: false, error: true }); }
  }
  resumeAfterGesture() {
    if (this.state.enabled && this.state.status === 'waiting' && !this.disposed) void this.play();
  }
  private emit(update: Partial<MusicState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...update };
    this.notify(this.state);
  }
  setVolume(value: number) {
    const volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_MUSIC_VOLUME;
    this.emit({ volume }); this.applyVolume();
  }
  setMuted(muted: boolean) { this.emit({ muted }); this.applyVolume(); }
  private applyVolume() {
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.state.muted ? 0 : this.state.volume, this.context.currentTime, .12);
  }
  private release(voice: Voice) {
    voice.audio.ontimeupdate = null; voice.audio.onended = null; voice.audio.onerror = null;
    voice.audio.pause(); voice.audio.removeAttribute('src'); voice.audio.load();
    voice.source.disconnect(); voice.gain.disconnect(); this.voices.delete(voice);
  }
  private retire(voice: Voice, seconds: number) {
    const timer = setTimeout(() => { this.release(voice); this.cleanupTimers.delete(timer); }, seconds * 1000 + 100);
    this.cleanupTimers.add(timer);
  }
  private fade(voice: Voice, target: number, seconds: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    voice.gain.gain.cancelAndHoldAtTime(now);
    voice.gain.gain.linearRampToValueAtTime(target, now + seconds);
  }
  private clearSilence() {
    if (this.silenceTimer !== null) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }
  private beginSilence(voice: Voice) {
    if (voice !== this.active || !this.wantsPlayback || this.incoming || this.disposed) return;
    this.cleanupTimers.forEach(clearTimeout); this.cleanupTimers.clear();
    for (const current of this.voices) this.release(current);
    this.active = null;
    this.clearSilence();
    this.emit({ status: 'silence', track: null });
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      if (this.wantsPlayback && !this.disposed) void this.next();
    }, randomSilenceSeconds(this.random) * 1000);
  }
  updatePosition(position: Position) {
    this.position = { ...position };
    const next = soundtrackZone(position, this.state.zone);
    if (next === this.state.zone) {
      if (this.regionTimer) clearTimeout(this.regionTimer);
      this.regionTimer = null; this.regionCandidate = null; return;
    }
    if (!this.wantsPlayback) { this.emit({ zone: next }); return; }
    if (next === this.regionCandidate) return;
    if (this.regionTimer) clearTimeout(this.regionTimer);
    this.regionCandidate = next;
    this.regionTimer = setTimeout(() => {
      this.regionTimer = null; this.regionCandidate = null;
      const zone = soundtrackZone(this.position, this.state.zone);
      if (zone === this.state.zone) return;
      this.emit({ zone });
      if (this.wantsPlayback && (this.state.status === 'playing' || this.state.status === 'loading')) void this.next();
    }, 3500);
  }
  async play(track?: Soundtrack) {
    if (this.disposed) return;
    this.wantsPlayback = true;
    this.clearSilence();
    this.emit({ enabled: true });
    const ticket = ++this.request;
    if (this.incoming) { this.release(this.incoming); this.incoming = null; }
    this.cleanupTimers.forEach(clearTimeout); this.cleanupTimers.clear();
    for (const voice of this.voices) if (voice !== this.active) this.release(voice);
    try {
      this.ensureContext();
      // Called directly from the user's click, preserving mobile audio activation.
      const resumed = this.context!.resume();
      const selected = track ?? (this.state.status === 'paused' && this.active?.track.zone === this.state.zone
        ? this.active.track : this.sequence.next(this.state.zone, this.position));
      if (this.active?.track.id === selected.id) {
        await Promise.all([resumed, this.active.audio.play()]);
        if (ticket !== this.request || !this.wantsPlayback) return;
        this.fade(this.active, 1, 1.5); this.emit({ status: 'playing', error: false }); return;
      }
      const audio = this.makeAudio(); audio.preload = 'auto'; audio.src = selected.src;
      const source = this.context!.createMediaElementSource(audio);
      const gain = this.context!.createGain(); gain.gain.value = 0;
      source.connect(gain); gain.connect(this.master!);
      const voice: Voice = { audio, source, gain, track: selected };
      this.voices.add(voice); this.incoming = voice;
      this.emit({ status: this.active && !this.active.audio.paused ? 'playing' : 'loading', error: false });
      await Promise.all([resumed, audio.play()]);
      if (ticket !== this.request || !this.wantsPlayback || this.disposed) {
        if (this.voices.has(voice)) this.release(voice); return;
      }
      const previous = this.active;
      this.active = voice; this.incoming = null;
      this.fade(voice, 1, previous ? CROSSFADE_SECONDS : 4);
      if (previous) { this.fade(previous, 0, CROSSFADE_SECONDS); this.retire(previous, CROSSFADE_SECONDS); }
      this.sequence.markPlayed(selected);
      audio.onended = () => this.beginSilence(voice);
      audio.onerror = () => {
        if (this.active !== voice) return;
        this.pause(); this.emit({ status: 'error', error: true });
      };
      this.emit({ status: 'playing', track: selected, error: false });
    } catch (error) {
      if (ticket !== this.request || this.disposed) return;
      if (this.incoming) { this.release(this.incoming); this.incoming = null; }
      const stillPlaying = this.active && !this.active.audio.paused && !this.active.audio.ended;
      if (!stillPlaying && error instanceof Error && error.name === 'NotAllowedError') {
        this.emit({ status: 'waiting', enabled: true, error: false }); return;
      }
      if (!stillPlaying) this.wantsPlayback = false;
      this.emit({ status: stillPlaying ? 'playing' : 'error', enabled: !!stillPlaying, error: true });
    }
  }
  next() { return this.play(this.sequence.next(this.state.zone, this.position)); }
  pause() {
    this.wantsPlayback = false; ++this.request;
    this.clearSilence();
    if (this.regionTimer) clearTimeout(this.regionTimer);
    this.regionTimer = null; this.regionCandidate = null;
    if (this.incoming) { this.release(this.incoming); this.incoming = null; }
    this.cleanupTimers.forEach(clearTimeout); this.cleanupTimers.clear();
    for (const voice of this.voices) {
      if (voice !== this.active) this.release(voice);
      else voice.audio.pause();
    }
    this.emit({ status: 'paused', enabled: false });
  }
  dispose() {
    this.pause(); this.disposed = true;
    for (const voice of this.voices) this.release(voice);
    this.active = null; void this.context?.close();
  }
}
