/** Header language switcher: one small flag button per locale, the active one lit and the rest
 * dimmed. Tapping a flag switches every label live and persists the choice (localStorage). Compact
 * by design so it tucks into the top-right of the title bar on a bike-mounted phone. */
import { useI18n, useT } from '../i18n/i18n'
import { LOCALES } from '../i18n/messages'

export function LanguageSwitcher() {
  const t = useT()
  const locale = useI18n((s) => s.locale)
  const setLocale = useI18n((s) => s.setLocale)

  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {LOCALES.map(({ code, label, flag }) => {
        const active = code === locale
        return (
          <button
            key={code}
            type="button"
            className={`lang-flag${active ? ' lang-flag--active' : ''}`}
            onClick={() => setLocale(code)}
            aria-label={label}
            aria-pressed={active}
            title={label}
          >
            <span aria-hidden="true">{flag}</span>
          </button>
        )
      })}
    </div>
  )
}
