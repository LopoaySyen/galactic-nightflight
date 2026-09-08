"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translateObservation, type ObservationLanguage } from '@/lib/i18n/observation';

type LanguageContext = { language: ObservationLanguage; locale: string; t: (text: string) => string; toggleLanguage: () => void };
const Context = createContext<LanguageContext>({ language: 'zh', locale: 'zh-CN', t: text => text, toggleLanguage: () => {} });

export function ObservationLanguageProvider({ initialLanguage, children }: { initialLanguage: ObservationLanguage; children: ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage);
  const t = useCallback((text: string) => translateObservation(text, language), [language]);
  const toggleLanguage = useCallback(() => {
    const next = language === 'zh' ? 'en' : 'zh';
    setLanguage(next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(window.history.state, '', url);
  }, [language]);
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.title = language === 'en' ? 'Observatory · Galactic Nightflight' : '观星平台 · 银河夜航';
    return () => { document.documentElement.lang = previous; };
  }, [language]);
  useEffect(() => {
    const followHistory = () => setLanguage(new URL(window.location.href).searchParams.get('lang') === 'en' ? 'en' : 'zh');
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, []);
  const value = useMemo(() => ({ language, locale: language === 'en' ? 'en-US' : 'zh-CN', t, toggleLanguage }), [language, t, toggleLanguage]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useObservationLanguage = () => useContext(Context);
