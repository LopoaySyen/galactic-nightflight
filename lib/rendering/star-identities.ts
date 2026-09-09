import names from '../../public/data/chinese-star-names.json' with { type: 'json' };
import nearbyNames from '../../public/data/nearby-stars.json' with { type: 'json' };
import {solarNames} from './solar-star.ts';

type StellarNames = { zh: string; en: string; aliases: string[] };
const identities = names as Record<string, StellarNames>;
const nearbyIdentities = new Map<string, StellarNames>(nearbyNames.map(record => [record.id, record]));
export const commonStarNames: Record<string,string> = {
  'Rigil Kentaurus':'南门二 A', Toliman:'南门二 B', Procyon:'南河三', Polaris:'勾陈一',
  Sirius:'天狼星', Canopus:'老人星', Arcturus:'大角星', Vega:'织女星', Capella:'五车二',
  Rigel:'参宿七', Betelgeuse:'参宿四', Altair:'牛郎星', Aldebaran:'毕宿五', Antares:'心宿二',
  Spica:'角宿一', Pollux:'北河三', Fomalhaut:'北落师门', Deneb:'天津四', Regulus:'轩辕十四',
};

export function starIdentity(id?: string): StellarNames | undefined {
  if(id==='sun')return solarNames;
  return id ? nearbyIdentities.get(id) ?? (id.startsWith('hip-') ? identities[id.slice(4)] : undefined) : undefined;
}
export function starName(name?: string, language: 'zh'|'en' = 'zh', id?: string): string {
  const identity = starIdentity(id);
  if (language === 'en') return name ?? identity?.en ?? 'Observed star';
  return (name && commonStarNames[name]) || identity?.zh || name || '实测恒星';
}
export function starAliases(id: string, name?: string): string[] {
  return [...new Set([...(starIdentity(id)?.aliases ?? []), name, name && commonStarNames[name]].filter((value): value is string => !!value))];
}

export const polarisDescription = {
  zh: '勾陈一，也称北极星，是小熊座 α 星。从地球看，它位于北天极附近，常用来辨认北方。它属于三合星系统，主星是一颗造父变星。',
  en: 'Polaris, Alpha Ursae Minoris, lies close to Earth’s north celestial pole and helps observers find north. It is a triple system whose primary is a Cepheid variable.',
  sources: [
    { label: 'NASA · Polaris', url: 'https://science.nasa.gov/solar-system/what-is-the-north-star-and-how-do-you-find-it/' },
    { label: 'Harvard & Smithsonian · Polaris', url: 'https://www.cfa.harvard.edu/news/polaris-north-star' },
  ],
};
