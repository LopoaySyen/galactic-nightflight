import english from './observation-en.json' with { type: 'json' };

export type ObservationLanguage = 'zh' | 'en';
const messages: Record<string, string> = english;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.entries(messages).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
  const ids: string[] = [];
  const pieces = key.split(/(\{\d+\})/g).map(piece => {
    if (/^\{\d+\}$/.test(piece)) { ids.push(piece); return '(.*?)'; }
    return escape(piece);
  });
  return { pattern: new RegExp(`^${pieces.join('')}$`, 'u'), ids, value };
});

/** Translate presentation text only; catalogue identifiers and simulation state stay intact. */
export function translateObservation(text: string, language: ObservationLanguage, depth = 0): string {
  if (language === 'zh' || !text || depth > 3) return text;
  if (Object.hasOwn(messages, text)) return messages[text];
  const key = text.trim();
  if (Object.hasOwn(messages, key)) return text.slice(0, text.indexOf(key)) + messages[key] + text.slice(text.indexOf(key) + key.length);
  for (const template of templates) {
    const match = key.match(template.pattern);
    if (!match) continue;
    return template.value.replace(/\{\d+\}/g, id => translateObservation(match[template.ids.indexOf(id) + 1] ?? '', language, depth + 1));
  }
  if (text.includes(' · ')) return text.split(' · ').map(part => translateObservation(part, language, depth + 1)).join(' · ');
  return text;
}
