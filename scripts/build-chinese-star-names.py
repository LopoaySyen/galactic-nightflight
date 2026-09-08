"""Join Stellarium's Chinese sky culture to the bundled Hipparcos IDs.
Only names are enriched: never invent a distance for an unlocated star.
Source data retain the upstream CC BY-SA terms; see the generated source note.
"""
from pathlib import Path
import ast
import csv
import json
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/master/chinese/'
WORK = ROOT/'work/star-names'

def roman(text):
    values = {'I':1,'V':5,'X':10,'L':50,'C':100}
    return sum(-values[c] if i+1<len(text) and values[c]<values[text[i+1]] else values[c] for i,c in enumerate(text))

def chinese_number(value):
    digits='零一二三四五六七八九'
    if value<10:return digits[value]
    if value<100:return (digits[value//10] if value>=20 else '')+'十'+(digits[value%10] if value%10 else '')
    raise ValueError('Unexpected star number')

def translations(text):
    result={}
    for block in re.split(r'\n\s*\n',text):
        values={'msgid':'','msgstr':''};key=None
        for line in block.splitlines():
            if line.startswith(('msgid ', 'msgstr ')):
                key,raw=line.split(' ',1);values[key]=ast.literal_eval(raw)
            elif line.startswith('"') and key:values[key]+=ast.literal_eval(line)
        if values['msgid'] and values['msgstr']:result[values['msgid']]=values['msgstr']
    return result

def build():
    WORK.mkdir(parents=True,exist_ok=True)
    for remote,local in [('index.json','chinese.json'),('po/zh_CN.po','zh_CN.po'),('description.md','description.md')]:
        path=WORK/local
        if not path.exists():urllib.request.urlretrieve(BASE+remote,path)
    culture=json.loads((WORK/'chinese.json').read_text(encoding='utf8'))
    terms=translations((WORK/'zh_CN.po').read_text(encoding='utf8'))
    for constellation in culture['constellations']:
        name=constellation['common_name']
        if name.get('native'):terms[name['english']]=name['native']
    def translate(name):
        if name in terms:return terms[name]
        match=re.fullmatch(r'(.+?) (?:Added )?([IVXLC]+)',name)
        if match and match[1] in terms:
            return terms[match[1]]+('增' if ' Added ' in name else '')+chinese_number(roman(match[2]))
        return None
    rows=list(csv.reader((ROOT/'public/data/yale-bright-stars.csv').read_text(encoding='utf8').splitlines()))[1:]
    usable={row[6]:row for row in rows if row[7] and 0<float(row[7])<=10000 and row[6]}
    output={}; missing=[]
    for key,names in culture['common_names'].items():
        if not key.startswith('HIP ') or key[4:] not in usable:continue
        english=[name['english'] for name in names]
        translated=[name.get('native') or translate(name['english']) for name in names]
        native=[name for name in translated if name and re.search('[\u3400-\u9fff]',name)]
        if not native:missing.append([key,english]);continue
        output[key[4:]]={'zh':native[0],'en':usable[key[4:]][8] or english[0],
            'aliases':list(dict.fromkeys(native+english))}
    output['11767']['aliases']+=['勾陳一','小熊座α','小熊座阿尔法','α UMi','Alpha Ursae Minoris','North Star']
    # Common names remain searchable beside historical asterism numbering.
    output['11767']['zh']='勾陈一'
    dest=ROOT/'public/data/chinese-star-names.json'
    dest.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    source={'dataset':'Chinese stellar names joined by Hipparcos identifier','records':len(output),
        'source':BASE+'index.json','translation':BASE+'po/zh_CN.po','sourceDescription':BASE+'description.md',
        'attribution':'Karrie Berglund; Sun Shuwei; Stellarium contributors and Chinese translators',
        'license':'CC BY-SA, as specified in the Chinese sky culture description; this derived name table retains those terms.',
        'changes':'Retained names for existing stars with usable distances; combined native names, translated asterisms and source Roman numerals; added common Polaris aliases.',
        'retrieved':'2026-09-08','unmatchedNames':len(missing),
        'scope':'Names and cross-identifications only. Physical measurements remain those of the existing Yale/Hipparcos catalogue.'}
    (ROOT/'public/data/chinese-star-names-source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'records':len(output),'untranslatedExamples':missing[:12],'polaris':output['11767']},ensure_ascii=False))

if __name__=='__main__':build()
