/** Header language picker. A native <select> (accessible + gives the OS wheel picker on a
 * bike-mounted phone) dressed up as a pill: a globe glyph on the left, a custom chevron on the
 * right, the browser's default arrow removed. The choice persists (localStorage) and switches every
 * label live. */
import { useI18n, useT } from '../i18n/i18n'
import { LOCALES, type Locale } from '../i18n/messages'

export function LanguageSwitcher() {
  const t = useT()
  const locale = useI18n((s) => s.locale)
  const setLocale = useI18n((s) => s.setLocale)

  return (
    <div className="lang-picker">
      {/* Globe — decorative; the <select> carries the accessible name. */}
      <svg
        className="lang-picker__globe"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9S14.5 18.6 12 21C9.5 18.6 8.2 15.4 8.2 12S9.5 5.4 12 3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
      <select
        className="lang-picker__select"
        aria-label={t('lang.label')}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {LOCALES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      <svg
        className="lang-picker__caret"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <path
          d="M6 9l6 6 6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
