import type {Metadata} from 'next';
import {PlanetariumScene} from '@/app/components/planetarium-scene';
export const metadata:Metadata={title:'观星平台 · 银河夜航',description:'进入银河夜航，移动观察位置、调整时间与感光方式，在三维银河中看星空。'};
export default function ObservePage(){return <PlanetariumScene/>;}
