import catalog from '../../public/music/catalog.json' with { type: 'json' };

export type SoundtrackZone = 'core' | 'disc' | 'solar' | 'outer';
export type Soundtrack = {
  id: string; title: string; titleEn: string; zone: SoundtrackZone;
  bpm: number; meter: number; durationSeconds: number; src: string; character: string;
};
export const soundtracks = catalog as Soundtrack[];
export const DEFAULT_MUSIC_VOLUME = .12;
export const CROSSFADE_SECONDS = 8;
export const MIN_SILENCE_SECONDS = 25;
export const MAX_SILENCE_SECONDS = 95;
export function randomSilenceSeconds(random: () => number = Math.random): number {
  return MIN_SILENCE_SECONDS + Math.floor(random() * (MAX_SILENCE_SECONDS - MIN_SILENCE_SECONDS + 1));
}
export const zoneNames = {
  core: ['银心与内银河', 'Galactic heart'], disc: ['银河旋臂', 'Spiral arms'],
  solar: ['太阳邻域', 'Solar neighbourhood'], outer: ['银河外围', 'Outer reaches'],
} as const;

type Position = { x: number; y: number; z: number };
/** Artistic regions in the same parsec coordinates as the observing scene.
 * Wider exit thresholds keep small movements at a boundary from changing music.
 */
export function soundtrackZone(position: Position, previous?: SoundtrackZone): SoundtrackZone {
  const radius = Math.hypot(position.x, position.y, position.z);
  const solarDistance = Math.hypot(position.x + 8277, position.y, position.z);
  if (solarDistance < (previous === 'solar' ? 1600 : 1200)) return 'solar';
  if (radius < (previous === 'core' ? 4800 : 4300)) return 'core';
  if (radius > (previous === 'outer' ? 11500 : 12500) || Math.abs(position.z) > (previous === 'outer' ? 1800 : 2200)) return 'outer';
  return 'disc';
}

/** A fresh weighted draw each time, excluding only the immediately preceding piece. */
export class SoundtrackSequence {
  private lastId: string | null = null;
  private random: () => number;
  constructor(random: () => number = Math.random) { this.random = random; }
  markPlayed(track: Soundtrack) { this.lastId = track.id; }
  next(zone: SoundtrackZone, position: Position): Soundtrack {
    const pool = soundtracks.filter(track => track.zone === zone);
    const candidates = pool.filter(track => track.id !== this.lastId);
    // Within the inner galaxy, quicker pieces become more likely near the centre.
    const warmth = Math.max(0, 1 - Math.hypot(position.x, position.y, position.z) / 5000);
    const slowest = Math.min(...pool.map(track => track.bpm));
    const range = Math.max(1, Math.max(...pool.map(track => track.bpm)) - slowest);
    const weights = candidates.map(track => zone === 'core' ? 1 + warmth * 1.5 * (track.bpm - slowest) / range : 1);
    let ticket = this.random() * weights.reduce((sum, weight) => sum + weight, 0);
    const selected = candidates.find((_, index) => { ticket -= weights[index]; return ticket < 0; }) ?? candidates[candidates.length - 1];
    return selected;
  }
}
