import type { Metadata } from 'next';
import { PlanetariumScene } from '@/app/components/planetarium-scene';

type ObservePageProps = { searchParams: Promise<{ lang?: string }> };
export async function generateMetadata({ searchParams }: ObservePageProps): Promise<Metadata> {
  const en = (await searchParams).lang === 'en';
  return {
    title: en ? 'Observatory · Galactic Nightflight' : '观星平台 · 银河夜航',
    description: en ? 'Explore the sky from different places in the Milky Way. Move your viewpoint, follow time and adjust the atmosphere.' : '进入银河夜航，移动观察位置、调整时间与感光方式，在三维银河中看星空。',
  };
}
export default async function ObservePage({ searchParams }: ObservePageProps) {
  return <PlanetariumScene initialLanguage={(await searchParams).lang === 'en' ? 'en' : 'zh'} />;
}
