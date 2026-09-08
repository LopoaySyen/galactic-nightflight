"""Original, quiet shoreline gestures for A Breathing Shore; no recorded effects."""
import numpy as np
from scipy import signal


# Enter after the piano statement, answer the shared theme, then recede in the coda.
# Each gesture has its own approach, crest and longer retreat, not a repeating loop.
SHORE_CUES = [
    dict(start=17.5, duration=13.0, crest=4.9, level=.0036),
    dict(start=78.0, duration=13.0, crest=5.7, level=.0042),
    dict(start=132.5, duration=16.0, crest=6.1, level=.0034),
]


def swell(time, crest, end):
    approach = np.sin(np.pi/2*np.clip(time/crest, 0, 1))**2
    retreat = np.cos(np.pi/2*np.clip((time-crest)/(end-crest), 0, 1))**2
    return approach*retreat


def render_shoreline(sample_count, sample_rate):
    rng = np.random.default_rng(10082026)
    bed = np.zeros((sample_count, 2), dtype=np.float32)

    def water(count, low, high):
        # Mostly shared water mass, with quiet independent edges for stable stereo.
        common = rng.normal(size=(count, 1))
        noise = .8*common+.2*rng.normal(size=(count, 2))
        sound = signal.sosfilt(signal.butter(3, [low, high], btype='bandpass',
                                          fs=sample_rate, output='sos'), noise, axis=0)
        return sound/np.sqrt(np.mean(sound**2))

    for index, cue in enumerate(SHORE_CUES):
        count = round(cue['duration']*sample_rate)
        time = np.arange(count)/sample_rate
        envelope = swell(time, cue['crest'], cue['duration'])
        # The low surge arrives first. Soft foam brightens near the crest, with
        # a thin, delayed wash slipping back afterwards. No sub-bass or sharp hiss.
        surge = water(count, 95, 580)
        foam = water(count, 580, 2250)
        wash = water(count, 280, 1150)
        drift = np.interp(time, np.linspace(0, cue['duration'], 22),
                          rng.uniform(.72, 1, 22))
        brightness = swell(time, cue['crest']+1.3, cue['duration'])
        backwash = swell(np.maximum(time-cue['crest'], 0), 2.5,
                         cue['duration']-cue['crest'])
        wave = (.76*surge*envelope[:, None]
                + .30*foam*(brightness*drift)[:, None]
                + .18*wash*backwash[:, None])
        # A slight shore angle, changing between gestures rather than sweeping pan.
        wave *= np.array([1.0, .94] if index != 1 else [.95, 1.0])
        start = round(cue['start']*sample_rate)
        count = min(count, sample_count-start)
        bed[start:start+count] += (wave[:count]*cue['level']).astype(np.float32)
    return bed
