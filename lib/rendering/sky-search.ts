import type {PointSourceSample} from './contracts.ts';
import {starName,starAliases} from './star-identities.ts';
import {deepSkyTargets} from './sky-object-catalog.ts';
export interface SkySearchEntry {id:string;kind:'star'|'deep-sky';title:string;subtitle:string;titleEn?:string;subtitleEn?:string;terms:string[];priority:number}
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('en').replace(/[\s\-_·]+/g,'');

/** Index only catalogue-backed objects, never procedural stars or pixels inside photos. */
export function buildSkySearchIndex(stars:readonly PointSourceSample[]):SkySearchEntry[]{
  const seen=new Set<string>();
  const entries:SkySearchEntry[]=[];
  for(const source of stars){
    const data=source.observedData;
    if(source.role!=='observed-bright-star'||!data||seen.has(source.id))continue;
    seen.add(source.id);
    const hip=data.catalogueIdentifier,hd=data.henryDraperIdentifier;
    const localSample=data.catalog==='gaia-dr3'?source.id.replace('gaia-dr3-bright-',''):undefined;
    const title=source.displayName?starName(source.displayName,'zh',source.id):hip?`依巴谷 ${hip}`:hd?`亨利·德雷珀 ${hd}`:`盖亚样本 ${localSample}`;
    const terms=[title,...starAliases(source.id,source.displayName)];
    if(hip)terms.push(`HIP ${hip}`,`依巴谷 ${hip}`,hip);
    if(hd)terms.push(`HD ${hd}`,`亨利德雷珀 ${hd}`,hd);
    // Gaia source IDs are absent in this bundle; do not pretend local row numbers are official IDs.
    if(localSample)terms.push(`盖亚样本 ${localSample}`,`Gaia sample ${localSample}`);
    entries.push({id:source.id,kind:'star',title,titleEn:source.displayName??(hip?`HIP ${hip}`:hd?`HD ${hd}`:`Gaia sample ${localSample}`),
      subtitleEn:hip?`HIP ${hip}`:hd?`HD ${hd}`:'Local sample identifier',
      subtitle:[source.displayName&&source.displayName!==title?source.displayName:'实测恒星',hip?`依巴谷 ${hip}`:hd?`亨利·德雷珀 ${hd}`:'本地样本序号'].filter(Boolean).join(' · '),
      terms:[...new Set(terms.filter(Boolean).map(normalize))],priority:source.displayName?data.referenceApparentMagnitude:100+data.referenceApparentMagnitude});
  }
  for(const target of deepSkyTargets)entries.push({id:target.id,kind:'deep-sky',title:target.name,subtitle:target.kind,
    terms:[...new Set([target.name,...target.aliases].map(normalize))],priority:20});
  return entries;
}
export function searchSkyObjects(index:readonly SkySearchEntry[],query:string,limit=12):SkySearchEntry[]{
  const needle=normalize(query);
  const matches:Array<{entry:SkySearchEntry;rank:number}>=[];
  for(const entry of index){
    const rank=!needle?0:entry.terms.some(term=>term===needle)?0:entry.terms.some(term=>term.startsWith(needle))?1:entry.terms.some(term=>term.includes(needle))?2:Infinity;
    if(!Number.isFinite(rank))continue;
    matches.push({entry,rank});
  }
  return matches.sort((a,b)=>a.rank-b.rank||a.entry.priority-b.entry.priority||a.entry.title.localeCompare(b.entry.title,'zh-CN')).slice(0,limit).map(item=>item.entry);
}
