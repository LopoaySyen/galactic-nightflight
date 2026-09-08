"""Thirteen Night Skies, quiet piano edition.
Original scores; Yamaha C5 samples by Alexander Holm, Salamander, CC BY 3.0.
Requires numpy, scipy and ffmpeg. All source samples are bundled locally.
"""
from pathlib import Path
from fractions import Fraction
from functools import lru_cache
import argparse
import json
import subprocess
import tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile
from coastal_soundscape import SHORE_CUES, render_shoreline
from night_sky_arrangements import ARRANGEMENTS
from night_sky_soundscapes import render_soundscape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'public/music'
SAMPLES = ROOT/'scripts/assets/salamander'
SR = 32000
MOTIF = [62, 69, 64, 66, 64]
REGIONAL_MOTIFS = {
    'core': [62, 66, 69, 71, 69],   # opening out: D F# A B A
    'disc': [69, 64, 66, 62, 64],   # wandering: A E F# D E
    'solar': [66, 64, 62, 64, 69],  # a close answer: F# E D E A
    'outer': [62, 69, 64, 62],      # an unfilled fifth: D A E D
}
VARIANTS = ['original', 'rising-sequence', 'inversion', 'fragment', 'answer']

def vary(notes, variant):
    """Diatonic transformations preserve the family without repeating a jingle."""
    scale = [38+12*octave+step for octave in range(5) for step in [0,2,4,5,7,9,11]]
    degrees = [scale.index(note) for note in notes]
    if variant == 'rising-sequence': degrees = [degree+2 for degree in degrees]
    elif variant == 'inversion': degrees = [2*degrees[0]-degree for degree in degrees]
    elif variant == 'fragment': degrees = degrees[:3]
    elif variant == 'head': degrees = degrees[:2]
    elif variant == 'retrograde': degrees = degrees[::-1]
    elif variant == 'answer': degrees = degrees[2:]+degrees[:2]
    result = [scale[degree] for degree in degrees]
    while max(result) > 74: result = [note-12 for note in result]
    while min(result) < 50: result = [note+12 for note in result]
    return result
HARMONIES = {'D':[50,57], 'B':[47,54], 'G':[43,50], 'A':[45,52], 'E':[40,47], 'F':[42,49]}
SCORES = [
 ('01-stellar-tides','万星潮汐','Stellar Tides','core',60,4,32,'DBGA', [66,69,71,69,66,64,62], 'warm'),
 ('02-golden-orbits','金色公转','Golden Orbits','core',63,3,44,'GADB', [62,66,69,66,64,61,62], 'soft'),
 ('03-nebula-lanterns','星云灯海','Nebula Lanterns','core',56,4,32,'BEDA', [64,66,69,71,69,66,64], 'warm'),
 ('04-heart-of-light','光的心室','Heart of Light','core',66,4,36,'DGBA', [69,71,74,71,69,66,62], 'warm'),
 ('05-spiral-letters','旋臂来信','Letters from the Spiral','disc',52,4,28,'DGBE', [66,64,62,59,62,64,66], 'soft'),
 ('06-dust-sails','尘埃之帆','Sails of Dust','disc',50,3,36,'BEGA', [69,66,64,62,59,62,64], 'distant'),
 ('07-blue-crossing','蓝色渡口','Blue Crossing','disc',54,4,28,'EDGB', [64,69,66,64,62,61,62], 'soft'),
 ('08-small-blue-home','小小蓝色家园','Small Blue Home','solar',54,4,28,'DGAB', [62,64,66,69,66,64,62], 'warm'),
 ('09-leaves-in-starlight','星光下的叶脉','Leaves in Starlight','solar',58,3,40,'GBDA', [66,69,66,64,62,64,66], 'soft'),
 ('10-breathing-shore','呼吸的海岸','A Breathing Shore','solar',48,4,28,'DBGE', [69,66,64,62,59,57,62], 'warm'),
 ('11-distant-snow','远日之雪','Snow Beyond the Sun','outer',44,4,24,'DEBG', [69,64,62,59,57], 'distant'),
 ('12-unanswered-light','无人应答的光','Unanswered Light','outer',42,4,24,'BEDA', [64,66,62,59,57], 'distant'),
 ('13-last-lighthouse','最后一座灯塔','The Last Lighthouse','outer',46,3,36,'DGBE', [62,69,66,64,59,62], 'soft'),
]

def load_samples():
    result = {}
    for path in sorted(SAMPLES.glob('*.mp3')):
        note,octave = path.stem[:-1],int(path.stem[-1])
        midi = (octave+1)*12+{'C':0,'Ds':3,'Fs':6,'A':9}[note]
        raw = subprocess.run(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-ac','2','-f','f32le','-'],capture_output=True,check=True).stdout
        result[midi] = np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()
    if len(result)!=13: raise ValueError('The 13 attributed piano source samples are required.')
    return result

BANK = {}

@lru_cache(maxsize=160)
def piano_sample(midi, colour):
    nearest = min(BANK,key=lambda key:abs(key-midi))
    ratio = Fraction(2**((nearest-midi)/12)).limit_denominator(1024)
    sound = signal.resample_poly(BANK[nearest],ratio.numerator,ratio.denominator,axis=0)
    cutoff = {'warm':1850,'soft':1500,'distant':1150}[colour]
    # Remove the hard hammer edge and upper sparkle before reverberation.
    sound = signal.sosfilt(signal.butter(3,cutoff,fs=SR,output='sos'),sound,axis=0)
    sound = signal.sosfilt(signal.butter(2,65,fs=SR,btype='highpass',output='sos'),sound,axis=0)
    attack = min(len(sound),int(.035*SR))
    sound[:attack] *= np.sin(np.linspace(0,np.pi/2,attack))[:,None]**2
    sound *= .65/max(.001,float(np.max(np.abs(sound))))
    return sound.astype(np.float32)

def render(index, score, stems=False):
    sid,title,en,zone,bpm,meter,bars,progression,answer,colour = score
    coastal = sid == '10-breathing-shore'
    arrangement = ARRANGEMENTS.get(sid)
    if arrangement:
        colour = arrangement['colour']
    rng = np.random.default_rng(8200+index*73)
    beat = 60/bpm
    bar = beat*meter
    length = bars*bar+12
    mix = np.zeros((int(length*SR),2),dtype=np.float32)
    events = []
    phrase_notes = []
    def add(midi,start,duration,level,kind='piano'):
        start = max(0,start+rng.uniform(-.025,.025))
        at = int(start*SR)
        count = min(int(duration*SR),len(mix)-at)
        if count<=0: return
        if kind=='piano':
            source = piano_sample(midi,colour)
            count = min(count,len(source))
            sound = source[:count].copy()
            release = min(int(1.4*SR),count)
            sound[-release:] *= np.cos(np.linspace(0,np.pi/2,release))[:,None]**2
        else:
            t = np.arange(count)/SR
            p = 2*np.pi*(440*2**((midi-69)/12))*t
            wave = np.sin(p)+.055*np.sin(2*p)
            env = np.sin(np.pi*np.minimum(t/duration,1))**2
            sound = np.stack([wave*env,wave*env],axis=1).astype(np.float32)
        # Narrow natural stereo; no random panning or artificial beating.
        middle = sound.mean(axis=1,keepdims=True)
        sound = middle*.45+sound*.55
        mix[at:at+count] += sound*level
        events.append({'time':round(start,3),'midi':midi,'duration':round(count/SR,3),'voice':kind,'level':round(level,4)})

    if arrangement:
        phrases = arrangement['phrases']
        for number, phrase in enumerate(phrases):
            source = phrase['source']
            if source == 'M':
                melody = vary(MOTIF, phrase['variant']); theme = 'shared'
            elif source == 'R':
                melody = vary(REGIONAL_MOTIFS[zone], phrase['variant']); theme = 'regional'
            elif source == 'A':
                melody = answer[:len(phrase['rhythm'])]; theme = 'piece-answer'
            else:
                melody = source; theme = 'piece-coda'
            melody = [note+phrase['register'] for note in melody]
            assert len(melody)==len(phrase['rhythm']), (sid, number, melody)
            start = phrase['start']
            end = phrases[number+1]['start']-1 if number+1<len(phrases) else length-6
            # A note can lean into the middle of a sentence, then let its last
            # syllable fall away. No fixed velocity or repeated beat pattern.
            contour = [.88,1,.84,.94,.72,.64,.6]
            for j,(note,offset) in enumerate(zip(melody,phrase['rhythm'])):
                when = start+offset*beat
                duration = min(phrase['sustain'],end-when)
                assert duration>1.4, (sid, number, when, end)
                level = (.255 if zone=='core' else .235)*phrase['level']*contour[j]*rng.uniform(.93,1)
                if j==len(melody)-1:
                    level *= .83
                add(note,when,duration,level)
            chord_name = phrase['chord']
            if chord_name:
                root, fifth = HARMONIES[chord_name]
                add(root,start+.9*beat,7.2,.082*phrase['level'])
                if phrase['voicing']=='open':
                    add(fifth,start+2.1*beat,6.1,.05*phrase['level'])
                elif phrase['voicing']=='third':
                    third = 3 if chord_name in ('B','E','F') else 4
                    add(root+12+third,start+3.3*beat,5.7,.047*phrase['level'])
                elif phrase['voicing']=='answer':
                    add(fifth,start+6.3*beat,5.6,.052*phrase['level'])
            phrase_notes.append(dict(start=start,theme=theme,variation=phrase['variant'],
                notes=melody,positions=phrase['rhythm'],harmony=chord_name,
                accompaniment=phrase['voicing'] if chord_name else 'solo',level=phrase['level']))

    phrase_bars = 4 if zone=='core' else 6
    phrase_starts = [] if arrangement else list(range(0,bars-2,phrase_bars))
    shared_phrase = min(len(phrase_starts)-2, 2+index%3)
    for phrase,b in enumerate(phrase_starts):
        start = b*bar+2+(index%3)*.6
        chord = HARMONIES[progression[phrase%4]]
        arc = .86+.14*np.sin(np.pi*phrase/max(1,len(phrase_starts)-1))
        # Regional material opens each piece. The shared theme enters later,
        # sometimes transformed, and can return as a fragment in the coda.
        theme = 'regional'
        variant = VARIANTS[(phrase+index)%len(VARIANTS)]
        if phrase == 0:
            variant = ['fragment', 'answer', 'original'][index%3]
        if phrase == shared_phrase:
            theme = 'shared'
            variant = ['original', 'rising-sequence', 'inversion'][index%3]
            melody = vary(MOTIF, variant)
        elif phrase == len(phrase_starts)-1 and phrase > shared_phrase:
            theme = 'shared'; variant = 'fragment'
            melody = vary(MOTIF, variant)
        elif phrase%3 == 1:
            theme = 'piece-answer'; variant = 'original'
            melody = answer[:5]
        else:
            melody = vary(REGIONAL_MOTIFS[zone], variant)
        if zone=='outer': spacing=[0,3,6,10,13,16,19]
        elif meter==3: spacing=[0,2,4,5.5,8,10,12]
        else: spacing=[0,2,4.5,6.5,9,11,13]
        if coastal:
            # Longer breaths within the opening/coda, and a gentler reply in the
            # middle. Keep the common motif intact; vary its pace and weight.
            spacing = [0,2.5,5.5,8,11,13,15] if phrase in (0,4) else [0,2.2,4.8,7.4,10.5,13,15]
        phrase_end = min((b+phrase_bars)*bar-1.8,length-9)
        # Stretch the shared theme and displace some entries within the phrase.
        stretch = 1.12 if theme == 'shared' and meter == 4 else 1
        available = (phrase_end-start-1.6)/beat
        positions = [value*stretch for value in spacing[:len(melody)]]
        if positions[-1] > available:
            positions = [value*available/positions[-1] for value in positions]
        phrase_notes.append({'start':round(start,3),'theme':theme,'variation':variant,'notes':melody})
        for j,note in enumerate(melody):
            when = start+positions[j]*beat
            if when>phrase_end-1.5: break
            duration = min(5.5 if zone=='outer' else 4.3,phrase_end-when+1)
            velocity = (.28 if zone=='core' else .25)*arc*rng.uniform(.86,1)
            if coastal:
                velocity *= [1,.86,.77,.84,.70][j%5]
            if j==len(melody)-1: velocity*=.78
            add(note,when,duration,velocity)
        # The low hand speaks once per phrase. Some passages remain solo.
        if zone!='outer' or phrase%2==0:
            if coastal:
                # A single low note supports the first/last phrases; leave the
                # inverted regional reply unaccompanied before the final return.
                if phrase != 3:
                    add(chord[0],start+.9,7,.085*arc)
                if phrase in (1,2):
                    add(chord[1],start+1.6,6,.052*arc)
            else:
                add(chord[0],start-.3,7.5,.12*arc)
                add(chord[1],start+.15,6.8,.075*arc)
        if zone=='core' and phrase%2==1:
            add(chord[1]+12,start+7*beat,5,.08)
        # Occasional low breaths; no continuous pad, percussion or rhythmic clock.
        if zone=='core' and phrase in (2,4):
            add(chord[1],start+1,10,.010,'breath')
        if zone=='solar' and phrase==2 and not coastal:
            add(chord[1]+12,start+1,9,.008,'breath')

    # One small, dark diffuse room, without the previous rhythmic echo network.
    dry = mix.copy()
    wet, decay = arrangement['room'] if arrangement else (.09,.65)
    for channel in range(2):
        t = np.arange(int((5*decay if arrangement else 3.2)*SR))/SR
        ir = rng.normal(0,1,len(t))*np.exp(-t/decay)
        ir[:int(.035*SR)] = 0
        ir = signal.sosfilt(signal.butter(2,1600,fs=SR,output='sos'),ir)
        ir *= wet/np.sqrt(np.sum(ir*ir))
        mix[:,channel] += signal.fftconvolve(dry[:,channel],ir,mode='full')[:len(mix)]
    piano = mix.copy() if stems else None
    shoreline = render_shoreline(len(mix), SR) if coastal else None
    soundscape = SHORE_CUES if coastal else arrangement['cues']
    if arrangement:
        shoreline = render_soundscape(soundscape,len(mix),SR,260908+index*103)
    if shoreline is not None:
        mix += shoreline
    time = np.arange(len(mix))/SR
    mix *= (np.minimum(time/3,1)*np.maximum(np.minimum((length-time)/7,1),0))[:,None]
    mix *= .7/max(.001,float(np.max(np.abs(mix))))
    filename = f'{sid}-tides.mp3' if coastal else f'{sid}-reverie.mp3'
    if stems:
        review = ROOT/'output/music-review'/sid
        review.mkdir(parents=True,exist_ok=True)
        wavfile.write(review/'piano.wav',SR,piano)
        wavfile.write(review/'ambience.wav',SR,shoreline)
    with tempfile.TemporaryDirectory(prefix='nightflight-quiet-') as temp:
        wav = Path(temp)/'mix.wav'
        wavfile.write(wav,SR,mix)
        mastering = 'loudnorm=I=-25:TP=-3:LRA=12'
        if arrangement:
            # Measure first, then apply one constant gain. Large composed rests
            # should not make a dynamic normalizer ride up the room or air bed.
            measured = subprocess.run(['ffmpeg','-hide_banner','-i',str(wav),
                '-af','loudnorm=I=-25:TP=-3:LRA=20:print_format=json','-f','null','-'],
                capture_output=True,text=True,encoding='utf-8',check=True)
            metrics = json.JSONDecoder().raw_decode(measured.stderr[measured.stderr.rfind('{'):])[0]
            gain = min(-25-float(metrics['input_i']), -3.5-float(metrics['input_tp']))
            mastering = f'volume={gain:.4f}dB'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),
            '-af',mastering,'-ar','44100','-c:a','libmp3lame','-b:a','160k',
            '-metadata',f'title={title} / {en}','-metadata','album=十三片夜空 · Regional Variations' if coastal else 'album=十三片夜空 · Quiet Reveries',
            '-metadata','comment=Original arrangement and synthesized shoreline. Modified Salamander Grand Piano samples by Alexander Holm, CC BY 3.0, https://github.com/Tonejs/audio/tree/master/salamander' if coastal else 'comment=Original arrangement and original sound design. Modified Salamander Grand Piano samples by Alexander Holm, CC BY 3.0, https://github.com/Tonejs/audio/tree/master/salamander',
            '-metadata',f'track={index+1}/13',str(OUT/filename)],check=True)
    score_dir = ROOT/'output/quiet-scores'
    score_dir.mkdir(parents=True,exist_ok=True)
    (score_dir/f'{sid}.json').write_text(json.dumps({'region':zone,'regionalMotif':REGIONAL_MOTIFS[zone],
        'phrases':phrase_notes,'events':events, 'soundscape':soundscape},indent=2)+'\n',encoding='utf-8')
    return dict(id=sid,title=title,titleEn=en,zone=zone,bpm=bpm,meter=meter,
        durationSeconds=round(length,2),src=f'/music/{filename}',
        character='柔软琴句 · 潮来潮往' if coastal else arrangement['character'])

if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--track', nargs='+', choices=[score[0] for score in SCORES],
                        help='Render selected tracks and retain the rest of the catalog.')
    parser.add_argument('--stems', action='store_true', help='Export piano/ambience stems for mix review.')
    args = parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    catalog_path = OUT/'catalog.json'
    previous = {entry['id']:entry for entry in json.loads(catalog_path.read_text(encoding='utf-8'))} if args.track else {}
    BANK.update(load_samples())
    manifest=[]
    for i,score in enumerate(SCORES):
        if args.track and score[0] not in args.track:
            manifest.append(previous[score[0]])
            continue
        entry=render(i,score,args.stems)
        manifest.append(entry)
        print(f'{i+1:02}/13 {entry["id"]} {entry["durationSeconds"]}s',flush=True)
    (OUT/'catalog.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
