import type { AtmospherePreset } from './planet-atmosphere.ts';
import { relativeAirMass } from './planet-atmosphere.ts';
import type { ObservationMode } from './contracts.ts';

/** A bounded display approximation of atmospheric scintillation, not a measured
 * turbulence profile. Real seconds are independent of the galactic simulation.
 * See public/data/stellar-scintillation.md for the physical scope and sources. */
export function starScintillationPhase(id: string, fallbackIndex = 0): number {
  const identifier = Number(id.match(/\d+$/)?.[0] ?? fallbackIndex);
  const family = ['hip','gaia','thin','thick','bar','nuclear','halo'].indexOf(id.split('-')[0]);
  return (identifier * 2.399963229728653 + (family+1)*Math.SQRT2) % (2 * Math.PI);
}
export function scintillationAmplitude(altitude: number, atmosphere: AtmospherePreset, mode: ObservationMode): number {
  if (atmosphere === 'space' || altitude <= 0) return 0;
  const response = mode === 'camera' ? .28 : mode === 'near-infrared' ? .18 : 1;
  // Haze affects extinction elsewhere; haze alone does not imply more turbulence.
  return .085 * Math.min(4.6, relativeAirMass(altitude) ** .65) * response;
}
export function stellarScintillation(seconds: number, phase: number, altitude: number, atmosphere: AtmospherePreset, mode: ObservationMode): number {
  const amplitude = scintillationAmplitude(altitude, atmosphere, mode);
  if (!amplitude) return 1;
  const wave = .55 * Math.sin(2*Math.PI*seconds*(1.2+.10*phase)+phase)
    + .30 * Math.sin(2*Math.PI*seconds*(2.9+.16*phase)+2.31*phase)
    + .15 * Math.sin(2*Math.PI*seconds*(6.8+.13*phase)+4.17*phase);
  return 1 + amplitude * wave;
}

// The GPU uses the same small, independent frequency mixture as the fallback.
export const scintillationGlsl = `
float atmosphericPulse(float seconds, float phase, float airMass, float mode) {
  float response = mode > 2.5 ? 0.18 : mode > 1.5 ? 0.28 : 1.0;
  float amplitude = 0.085 * min(4.6, pow(airMass,0.65)) * response;
  float wave = 0.55*sin(6.283185307*seconds*(1.2+0.10*phase)+phase)
    + 0.30*sin(6.283185307*seconds*(2.9+0.16*phase)+2.31*phase)
    + 0.15*sin(6.283185307*seconds*(6.8+0.13*phase)+4.17*phase);
  return 1.0 + amplitude * wave;
}`;
