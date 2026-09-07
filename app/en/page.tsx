import type {Metadata} from 'next';
import {NightHome} from '@/app/components/night-home';
export const metadata:Metadata={title:'Galactic Nightflight · Explore the stars',description:'Explore a changing three-dimensional sky with observed star catalogues, galactic models, time controls and deep-sky imagery.',alternates:{languages:{'zh-CN':'/','en':'/en'}},openGraph:{title:'Galactic Nightflight',locale:'en_US'}};
export default function EnglishHome(){return <NightHome language="en"/>;}
