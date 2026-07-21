/**
 * The /settings route: everything that used to hide behind header buttons + modal popups — language,
 * rider profile, and dashboard customization — gathered into one tab so the top bar stays clean on a
 * phone. Each section persists to localStorage on its own; the `on*Changed` callbacks let the app
 * shell re-read the bits it holds in state (profile → header/HR zones, dashboard → live tiles).
 */
import { ProfilePanel } from '../ui/ProfilePanel'
import { DashboardPanel } from '../ui/DashboardPanel'
import { useT } from '../i18n/i18n'

interface Props {
  onProfileChanged: () => void
  onDashChanged: () => void
}

export function SettingsPage({ onProfileChanged, onDashChanged }: Props) {
  const t = useT()

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">{t('nav.settings')}</h2>
      </div>

      <section className="panel settings-section" aria-labelledby="settings-profile">
        <h3 id="settings-profile" className="settings-heading">
          {t('profile.title')}
        </h3>
        <ProfilePanel onChanged={onProfileChanged} />
      </section>

      <section className="panel settings-section" aria-labelledby="settings-dash">
        <h3 id="settings-dash" className="settings-heading">
          {t('dash.title')}
        </h3>
        <DashboardPanel onChanged={onDashChanged} />
      </section>
    </div>
  )
}
