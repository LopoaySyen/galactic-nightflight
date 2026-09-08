"use client";
import { useObservationLanguage } from './observation-language';

import {useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import {searchSkyObjects,type SkySearchEntry} from '@/lib/rendering/sky-search';
export function SkySearch({index,loading,failed,onSelect,onClose}:{index:readonly SkySearchEntry[];loading:boolean;failed:boolean;onSelect:(entry:SkySearchEntry)=>void;onClose:()=>void}){
  const { t } = useObservationLanguage();
  const [query,setQuery]=useState(''),[active,setActive]=useState(0);
  const deferredQuery=useDeferredValue(query);
  const results=useMemo(()=>searchSkyObjects(index,deferredQuery),[index,deferredQuery]);
  const current=Math.min(active,Math.max(0,results.length-1)),pending=query!==deferredQuery;
  const listRef=useRef<HTMLUListElement>(null),inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{inputRef.current?.focus();},[]);
  useEffect(()=>{listRef.current?.children[current]?.scrollIntoView({block:'nearest'});},[current]);
  return <section className="sky-search" role="search" aria-label={t("搜索恒星与深空天体")}>
    <div className="sky-search-heading"><div><span>{t("从名字，抵达星空")}</span><h2>{t("寻找天体")}</h2></div><button type="button" onClick={onClose} aria-label={t("关闭天体搜索")}>×</button></div>
    <label htmlFor="sky-search-input">{t("中文名、英文名或星表编号")}</label>
    <input ref={inputRef} id="sky-search-input" type="search" autoComplete="off" spellCheck={false} placeholder={t("天狼星、Sirius、依巴谷 32349…")}
      role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="sky-search-results" aria-activedescendant={results.length?`sky-result-${current}`:undefined}
      value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}} onKeyDown={event=>{
        if(event.nativeEvent.isComposing)return;
        if(event.key==='ArrowDown'&&results.length){event.preventDefault();setActive(Math.min(current+1,results.length-1));}
        if(event.key==='ArrowUp'&&results.length){event.preventDefault();setActive(Math.max(0,current-1));}
        if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();if(!pending&&results[current])onSelect(results[current]);}
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
      }}/>
    <p className="sky-search-status" role="status">{pending?t('正在匹配…'):loading?t('星表载入中，已载入的天体可以先搜。'):failed?t('部分星表未能载入；当前搜索已载入的数据。'):query.trim()?t('选择结果即可暂停时间、定位并查看资料。'):t('常用天体')}</p>
    <ul id="sky-search-results" ref={listRef} role="listbox" aria-label={t("匹配的天体")} aria-busy={pending}>
      {results.map((entry,i)=><li key={`${entry.kind}-${entry.id}`} role="presentation"><button id={`sky-result-${i}`} type="button" role="option" tabIndex={-1} aria-selected={i===current}
        onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>onSelect(entry)}>
        <span className="sky-result-kind">{entry.kind==='star'?t('恒星'):t(entry.subtitle)}</span><span className="sky-result-name"><strong>{t(entry.title)}</strong><small>{t(entry.subtitle)}</small></span><span className="sky-result-action">{t("定位")}</span>
      </button></li>)}
    </ul>
    {!results.length&&!pending&&<p className="sky-search-empty">{t("没有找到这个天体。试试完整名称或星表编号；本网站目前只搜索已载入的目录。")}</p>}
    <details className="sky-search-help"><summary>{t("支持哪些编号？")}</summary><p>{t("依巴谷星表编号可以写成“依巴谷 32349”或“HIP 32349”；亨利·德雷珀星表编号可以写成“HD 48915”。这些字母是星表的简称，后面的数字用于识别恒星，不表示亮度或距离。")}</p><p>{t("盖亚数据没有保存官方恒星编号，只能用本地的“盖亚样本 123”等写法查找。也支持星云、星团与星系的名称及梅西耶目录写法，例如猎户座大星云的 M42。")}</p></details>
  </section>;
}
