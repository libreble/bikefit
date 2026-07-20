/**
 * i18n runtime. A tiny, dependency-free translator over the {@link messages} catalog — no library,
 * in keeping with the app's hand-rolled ethos (see DECISIONS.md). The current locale lives in a
 * Zustand store so two callers can share it:
 *
 *  - React components use {@link useT}, which subscribes to the locale and re-renders on change.
 *  - Plain modules (thrown errors in the BLE/session layers) call the module-level {@link t}, which
 *    reads the locale at call-time — correct because those strings are produced at throw-time.
 *
 * Locale is picked once from localStorage → the browser's languages → 'en', and persisted on change.
 */
import { useCallback } from 'react'
import { create } from 'zustand'
import { messages, type Locale, type MessageKey, type MessageVars } from './messages'

const KEY = 'bikefit.locale.v1'
const SUPPORTED: Locale[] = ['en', 'nl']

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED as string[]).includes(v)
}

/** localStorage choice, else the first browser language we support, else English. */
function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (isLocale(saved)) return saved
  } catch {
    // localStorage can throw in private mode — fall through to language detection.
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const base = lang.slice(0, 2).toLowerCase()
    if (isLocale(base)) return base
  }
  return 'en'
}

/** Substitute `{name}` placeholders; unknown keys and missing locales fall back to `en` then the key. */
export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const table = messages[locale] ?? messages.en
  let s = table[key] ?? messages.en[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      s = s.replaceAll(`{${name}}`, String(value))
    }
  }
  return s
}

interface I18nState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useI18n = create<I18nState>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(KEY, locale)
    } catch {
      // Ignore persistence failures (private mode); the in-memory choice still applies.
    }
    document.documentElement.lang = locale
    set({ locale })
  },
}))

// Reflect the initial choice onto <html lang> so the very first paint is correct.
document.documentElement.lang = useI18n.getState().locale

/** A translate function bound to the given locale — what {@link useT} hands components. */
export type TFunc = (key: MessageKey, vars?: MessageVars) => string

/**
 * Non-reactive translate for non-React modules (e.g. thrown error messages). Reads the current
 * locale each call. Don't use this for rendered component text — it won't re-render on a language
 * switch; use {@link useT} there instead.
 */
export function t(key: MessageKey, vars?: MessageVars): string {
  return translate(useI18n.getState().locale, key, vars)
}

/** Reactive translator hook: components re-render when the locale changes. */
export function useT(): TFunc {
  const locale = useI18n((s) => s.locale)
  return useCallback((key, vars) => translate(locale, key, vars), [locale])
}
