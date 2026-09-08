import type { Vector3 } from '../physics/vector.ts';
import { equatorialDirectionToGalactic } from './observed-star-catalog.ts';
import { CENTRAL_BLACK_HOLE_MASS } from '../physics/galactic-gravity.ts';

export interface CompactObject {
  id: string; name: string; nameEn: string; aliases: string[];
  positionParsec: Vector3; massSolar: number; description: string; descriptionEn: string;
  sourceUrl: string; imagePath?: string; imageCredit?: string;
}
function equatorialPosition(ra: number, dec: number, distance: number): Vector3 {
  const d = equatorialDirectionToGalactic(ra, dec);
  return { x: -8277 + d.x * distance, y: d.y * distance, z: d.z * distance };
}
export const compactObjects: readonly CompactObject[] = [
  { id: 'sgr-a-star', name: '人马座 A*', nameEn: 'Sagittarius A*',
    aliases: ['Sgr A*','SgrA','银河中心黑洞','人马座A','Sagittarius A Star'],
    positionParsec: { x: 0, y: 0, z: 0 }, massSolar: CENTRAL_BLACK_HOLE_MASS,
    description: '银河中心的超大质量黑洞。黑洞本身不发光；周围炽热物质与弯曲的光线揭示了它的存在。',
    descriptionEn: 'The supermassive black hole at the Galactic centre. Hot surrounding matter and bent light reveal an otherwise dark object.',
    sourceUrl: 'https://www.eso.org/public/images/eso2208-eht-mwa/',
    imagePath: '/deep-sky/sgr-a-eht.jpg', imageCredit: 'EHT Collaboration · 1.3 mm radio observation' },
  { id: 'cygnus-x1', name: '天鹅座 X-1', nameEn: 'Cygnus X-1',
    aliases: ['Cyg X-1','Cygnus X1','天鹅座X1','HD 226868'],
    positionParsec: equatorialPosition(299.590315,35.201606,2220), massSolar: 21.2,
    description: '有大质量伴星的黑洞双星。采用射电视差给出的约 2.22 千秒差距距离和约 21.2 个太阳质量。',
    descriptionEn: 'A black-hole binary with a massive companion; the adopted distance is about 2.22 kpc and mass about 21.2 Suns.',
    sourceUrl: 'https://doi.org/10.1126/science.abb3363' },
  { id: 'm87-star', name: 'M87* 黑洞', nameEn: 'M87*',
    aliases: ['M87 Star','M87黑洞','室女座A黑洞'],
    positionParsec: equatorialPosition(187.705917,12.391122,16_800_000), massSolar: 6.5e9,
    description: 'M87 星系中心的超大质量黑洞，也是事件视界望远镜首个成像的黑洞。',
    descriptionEn: 'The supermassive black hole in M87, the first black hole imaged by the Event Horizon Telescope.',
    sourceUrl: 'https://www.eso.org/public/images/eso1907a/',
    imagePath: '/deep-sky/m87-eht.jpg', imageCredit: 'EHT Collaboration · 1.3 mm radio observation' },
];
export const compactObjectsById = new Map(compactObjects.map(object => [object.id, object]));
/** Galactic diffuse light is smooth over sub-parsec close-up moves, but a black
 * hole's angular geometry is not. Keep the live camera origin in that case. */
export function compactViewObserver(observer:Vector3,background:Vector3|undefined) {
  if(!background)return observer;
  const shift=Math.hypot(observer.x-background.x,observer.y-background.y,observer.z-background.z);
  const near=compactObjects.some(object=>Math.hypot(object.positionParsec.x-observer.x,object.positionParsec.y-observer.y,object.positionParsec.z-observer.z)<1);
  return near&&shift<1?observer:background;
}
