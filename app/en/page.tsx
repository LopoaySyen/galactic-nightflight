import type {Metadata} from 'next';
import {NightHome} from '@/app/components/night-home';
export const metadata:Metadata={title:'Galactic Nightflight · One galaxy. Countless skies.',description:'Imagine standing on a world elsewhere in the Milky Way. Choose a position, time and atmosphere, and explore the sky from there.',alternates:{languages:{'zh-CN':'/','en':'/en'}},openGraph:{title:'Galactic Nightflight',locale:'en_US'}};
export default function EnglishHome(){return <NightHome language="en"/>;}
