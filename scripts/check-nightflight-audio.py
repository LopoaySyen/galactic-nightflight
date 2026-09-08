"""Decode every delivered recording and measure loudness/peaks for playback QA."""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root/'public/music/catalog.json').read_text(encoding='utf-8'))
results = []
for track in catalog:
    filename = root / 'public' / track['src'].lstrip('/')
    scan = subprocess.run(['ffmpeg','-hide_banner','-i',str(filename),'-af',
        'loudnorm=I=-25:TP=-3:LRA=12:print_format=json','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
    metrics, _ = json.JSONDecoder().raw_decode(scan.stderr[scan.stderr.rfind('{'):])
    loudness, peak = float(metrics['input_i']), float(metrics['input_tp'])
    assert -27 <= loudness <= -23, (track['id'], loudness)
    assert peak < -2.8, (track['id'], peak)
    results.append(dict(id=track['id'],integratedLUFS=loudness,truePeakDBTP=peak,bytes=filename.stat().st_size))
output = root/'output/audio-quality.json'
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(tracks=len(results),minutes=round(sum(t['durationSeconds'] for t in catalog)/60,2),
    megabytes=round(sum(r['bytes'] for r in results)/1e6,2),
    loudnessRange=[min(r['integratedLUFS'] for r in results),max(r['integratedLUFS'] for r in results)],
    maximumTruePeak=max(r['truePeakDBTP'] for r in results)),indent=2))
