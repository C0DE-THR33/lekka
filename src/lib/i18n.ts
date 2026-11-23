import { useSyncExternalStore } from 'react'
import en from '../i18n/en.json'
import kn from '../i18n/kn.json'

export type Lang = 'en' | 'kn'
export type Key = keyof typeof en
type Vars = Record<string, string | number>

const DICTS: Record<Lang, Partial<Record<Key, string>>> = { en, kn }

/** Looks up `key` (falling back to English) and fills {placeholders}. */
export function translate(lang: Lang, key: Key, vars: Vars = {}): string {
  const text = DICTS[lang][key] ?? en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

function storedLang(): Lang {
  try {
    return localStorage.getItem('lang') === 'kn' ? 'kn' : 'en'
  } catch {
    return 'en'
  }
}

let current: Lang = storedLang()
const listeners = new Set<() => void>()
if (typeof document !== 'undefined') {
  document.documentElement.lang = current
  // Follow a language change made in another tab or frame (the demo view shows both apps at once).
  addEventListener('storage', e => {
    if (e.key !== 'lang') return
    current = storedLang()
    document.documentElement.lang = current
    listeners.forEach(f => f())
  })
}

export function setLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem('lang', lang)
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
  document.documentElement.lang = lang
  listeners.forEach(f => f())
}

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => { listeners.delete(f) }
}

export const useLang = () => useSyncExternalStore(subscribe, () => current)

/** Returns t(key, vars) for the current language; re-renders when it changes. */
export function useT() {
  const lang = useLang()
  return (key: Key, vars?: Vars) => translate(lang, key, vars)
}

export type T = ReturnType<typeof useT>
