import type {Metadata} from 'next';
import {NightHome} from './components/night-home';
export const metadata:Metadata={alternates:{languages:{'zh-CN':'/','en':'/en'}}};
export default function Home(){return <NightHome language="zh"/>;}
