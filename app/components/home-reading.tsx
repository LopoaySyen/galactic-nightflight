import { Fragment } from 'react';
import type { HomeLanguage } from '@/lib/landing/home-content';

// Author the few long clauses explicitly; punctuation supplies the other breaks.
// Keep the original wording and punctuation intact for copying and screen readers.
const clauseBreaks: Record<string, readonly string[]> = {
  '看看几千年后的星空。': ['看看', '几千年后的星空。'],
  '这是从你所在位置重新计算的星空。': ['这是从你所在位置', '重新计算的星空。'],
  '恒星运动与观察者轨道采用近似模型，': ['恒星运动与观察者轨道', '采用近似模型，'],
  '近红外模式把人眼看不见的波段映射成可见颜色；': ['近红外模式把人眼看不见的波段', '映射成可见颜色；'],
  '也可以输入名称或已有星表编号搜索。': ['也可以输入名称', '或已有星表编号搜索。'],
  '照片中的每个星点不一定有单独记录。': ['照片中的每个星点', '不一定有单独记录。'],
  '之后也可以从底部工具栏重新打开「新手教程」。': ['之后也可以从底部工具栏', '重新打开「新手教程」。'],
  '源码、运行说明和数据来源都在 GitHub。': ['源码、运行说明和数据来源', '都在 GitHub。'],
  '地表和大气用于模拟异地观星的环境，': ['地表和大气用于', '模拟异地观星的环境，'],
  '左侧按钮可以看向银河中心、外围或盘面上下。': ['左侧按钮可以看向', '银河中心、外围或盘面上下。'],
  '恒星的方向和亮度会随之重新计算。': ['恒星的方向和亮度', '会随之重新计算。'],
  'Fast-forward a few thousand years.': ['Fast-forward ', 'a few thousand years.'],
  'What does night look like here?': ['What does night ', 'look like here?'],
};

export function HomeReading({ children, language }: { children: string; language: HomeLanguage }) {
  const clauses = language === 'zh'
    ? children.split(/(?<=[，。！？；：])|(?<=——)/u)
    : children.match(/[^,.!?;:]+(?:[,.!?;:]|$)\s*/g) ?? [children];
  const phrases = clauses.filter(Boolean).flatMap(clause => clauseBreaks[clause] ?? [clause]);
  return <>{phrases.map((phrase, index) => <Fragment key={index}>
    <span className="nf-reading-phrase">{phrase.trimEnd()}</span>{phrase.slice(phrase.trimEnd().length)}
    {index < phrases.length - 1 && <wbr/>}
  </Fragment>)}</>;
}
