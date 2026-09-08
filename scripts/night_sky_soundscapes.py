"""Quiet, original harmonic and air gestures; no external sound recordings."""
import numpy as np
from scipy import signal


def render_soundscape(cues, sample_count, sample_rate, seed):
    rng = np.random.default_rng(seed)
    mix = np.zeros((sample_count,2),dtype=np.float32)
    for cue in cues:
        count = round(cue['duration']*sample_rate)
        time = np.arange(count)/sample_rate
        progress = time/cue['duration']
        envelope = np.sin(np.pi*progress)**2
        if cue['kind'] == 'harmonic-glow':
            mono = np.zeros(count)
            for i,note in enumerate(cue['notes']):
                frequency = 440*2**((note-69)/12)
                phase = 2*np.pi*frequency*time
                mono += (np.sin(phase)+.045*np.sin(2*phase))*(1 if i==0 else .62)
            mono /= np.sqrt(np.mean(mono**2))
            sound = np.stack([mono,mono],axis=1)
        else:
            leaf = cue['kind']=='leaf-air'
            common = rng.normal(size=(count,1))
            noise = .82*common+.18*rng.normal(size=(count,2))
            low, high = (430,1750) if leaf else (140,780)
            sound = signal.sosfilt(signal.butter(3,[low,high],btype='bandpass',
                                                fs=sample_rate,output='sos'),noise,axis=0)
            sound /= np.sqrt(np.mean(sound**2))
            # Leaves flutter unevenly inside a single soft gust; the sail is slower.
            control_count = 24 if leaf else 9
            motion = np.interp(progress,np.linspace(0,1,control_count),
                               rng.uniform(.35 if leaf else .65,1,control_count))
            sound *= motion[:,None]
        sound *= (envelope*cue['level'])[:,None]
        start = round(cue['start']*sample_rate)
        count = min(count,sample_count-start)
        mix[start:start+count] += sound[:count].astype(np.float32)
    return mix
