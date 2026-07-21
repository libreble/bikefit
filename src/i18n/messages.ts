/**
 * The translation catalog. `en` is the source of truth: its keys define the {@link MessageKey}
 * union and every other locale is typed `Record<MessageKey, string>`, so adding a key to `en`
 * makes TypeScript require it in `nl` (and any future locale) — no key can silently go missing.
 *
 * Placeholders use `{name}` and are filled by {@link translate}. Unit *symbols* (W, kg, bpm, rpm,
 * km/h, kcal, km, %) are deliberately NOT in here: they're international and stay as literals in the
 * views; only words and the age abbreviation ("yr"/"jr") are translated.
 */

export type Locale = 'en' | 'nl'

/** Locales in menu order, with the label (each in its own language) and flag for the switcher. */
export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
]

const en = {
  // Generic actions / states, reused across views.
  'common.save': 'Save',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.loading': 'Loading…',
  'common.saved': 'Saved',

  // App shell + nav.
  'app.title': 'Bikefit — ICG IC-6',
  'nav.label': 'Sections',
  'nav.live': 'Live',
  'nav.history': 'History',
  'nav.settings': 'Settings',
  'lang.label': 'Language',

  // Connection bar.
  'conn.connect': 'Connect',
  'conn.disconnect': 'Disconnect',
  'conn.cancel': 'Cancel',
  'conn.demo': 'Demo',
  'conn.demoTitle': 'Simulate a ride without a bike (for testing the UI)',
  'conn.noDevice': 'No device',
  'conn.status.idle': 'Idle',
  'conn.status.requesting': 'Requesting…',
  'conn.status.connecting': 'Connecting…',
  'conn.status.connected': 'Connected',
  'conn.status.reconnecting': 'Reconnecting…',
  'conn.status.disconnected': 'Disconnected',
  'conn.status.error': 'Error',

  // Metric names (dashboard tiles, graphs, summary).
  'metric.power': 'Power',
  'metric.cadence': 'Cadence',
  'metric.hr': 'Heart rate',
  'metric.speed': 'Speed',
  'metric.resistance': 'Resistance',
  'metric.distance': 'Distance',
  'metric.calories': 'Calories',
  'metric.elapsed': 'Elapsed',

  // Live tiles.
  'tiles.label': 'Live metrics',
  'tiles.avg': 'avg',
  'tiles.aboveAvg': 'above average',
  'tiles.belowAvg': 'below average',
  'tiles.atAvg': 'at average',

  // Graphs / sparklines.
  'graphs.label': 'Trends',
  'spark.trend': '{name} trend',

  // Export (current + past session).
  'export.currentTitle': 'Current session',
  'export.json': 'Export JSON',
  'export.tcx': 'Export TCX',
  'export.jsonShort': 'JSON',
  'export.tcxShort': 'TCX',

  // Live page — recent-rides preview.
  'live.recentTitle': 'Recent rides',
  'live.viewAll': 'View all →',
  'live.noRides': 'No rides yet.',

  // History page.
  'history.title': 'Session history',
  'history.addDemo': 'Add demo session',
  'history.adding': 'Adding…',
  'history.importJson': 'Import JSON',
  'history.refresh': 'Refresh',
  'history.refreshing': 'Refreshing…',
  'history.empty': 'No sessions yet. Ride the bike, or add a demo session.',

  // Session detail page.
  'session.title': 'Session',
  'session.back': '← History',

  // Session list rows.
  'list.open': 'Open session from {time}',
  'list.powerAvg': '{value} W avg',
  'list.distance': '{value} km',

  // Session summary stat labels.
  'stat.duration': 'Duration',
  'stat.avgPower': 'Avg power',
  'stat.maxPower': 'Max power',
  'stat.avgHr': 'Avg HR',
  'stat.maxHr': 'Max HR',
  'stat.avgCadence': 'Avg cadence',
  'stat.distance': 'Distance',
  'stat.energy': 'Energy',
  'stat.if': 'IF',
  'stat.tss': 'TSS',

  // Dashboard-customize dialog.
  'dash.title': 'Customize dashboard',
  'dash.note':
    'The first shown metric is the hero (big) tile. Reorder with the arrows; uncheck a metric to hide it.',
  'dash.hero': 'hero',
  'dash.moveUp': 'Move {name} up',
  'dash.moveDown': 'Move {name} down',
  'dash.reset': 'Reset to default',

  // Rider-profile dialog + form.
  'profile.title': 'Rider profile',
  'profile.note':
    "Optional, stored only on this device. When set it's sent to the bike so it can show your FTP zones (Coach-By-Color) and W/kg. Leave blank to keep the bike's own defaults.",
  'profile.ftp': 'FTP',
  'profile.weight': 'Weight',
  'profile.maxHr': 'Max HR',
  'profile.age': 'Age',
  'profile.name': 'Name',
  'profile.unitYr': 'yr',
  'profile.phFtp': 'e.g. 220',
  'profile.phWeight': 'e.g. 75',
  'profile.phMaxHr': 'e.g. 185',
  'profile.phAge': 'optional',
  'profile.phName': 'shown on the bike (initials only)',
  'profile.colorMode': 'Enable Coach-By-Color on the bike (front zone light)',
  'profile.deleted': 'Profile deleted.',
  'profile.delete': 'Delete profile',
  'profile.maxHrHint': 'Estimated from age (220 − age) — enter your own to override.',

  // Heart-rate zones (live HR-tile badge + post-ride time-in-zone breakdown).
  'hrzone.title': 'Time in HR zones',
  'hrzone.maxHr': 'HRmax {hr}',
  'hrzone.badgeAria': 'Heart-rate zone {z}',
  'hrzone.z1': 'Recovery',
  'hrzone.z2': 'Endurance',
  'hrzone.z3': 'Aerobic',
  'hrzone.z4': 'Threshold',
  'hrzone.z5': 'Maximum',

  // Coach-By-Color power zones — the bike's front-light colours, mirrored on the power tile.
  'cbczone.badgeAria': 'Coach-By-Color zone: {name}',
  'cbczone.white': 'White',
  'cbczone.blue': 'Blue',
  'cbczone.green': 'Green',
  'cbczone.yellow': 'Yellow',
  'cbczone.red': 'Red',

  // User-facing error messages (thrown deep, shown in the alert strip).
  'error.notJson': 'Not valid JSON.',
  'error.notSessionFile': 'Not a Bikefit session file.',
  'error.unsupportedVersion': 'Unsupported session file (version {version}; expected 2).',
  'error.noTrainerService': 'No supported trainer service found. Present: {present}.',
  'error.noSessionToExport': 'no session to export',
  'error.sessionNotFound': 'session {id} not found',
} as const

/** Every translatable string key — derived from `en`, so it can never drift from the catalog. */
export type MessageKey = keyof typeof en

/** Values interpolated into a `{name}` placeholder. */
export type MessageVars = Record<string, string | number>

const nl: Record<MessageKey, string> = {
  'common.save': 'Opslaan',
  'common.close': 'Sluiten',
  'common.delete': 'Verwijderen',
  'common.loading': 'Laden…',
  'common.saved': 'Opgeslagen',

  'app.title': 'Bikefit — ICG IC-6',
  'nav.label': 'Secties',
  'nav.live': 'Live',
  'nav.history': 'Geschiedenis',
  'nav.settings': 'Instellingen',
  'lang.label': 'Taal',

  'conn.connect': 'Verbinden',
  'conn.disconnect': 'Verbreken',
  'conn.cancel': 'Annuleren',
  'conn.demo': 'Demo',
  'conn.demoTitle': 'Simuleer een rit zonder fiets (om de interface te testen)',
  'conn.noDevice': 'Geen apparaat',
  'conn.status.idle': 'Inactief',
  'conn.status.requesting': 'Aanvragen…',
  'conn.status.connecting': 'Verbinden…',
  'conn.status.connected': 'Verbonden',
  'conn.status.reconnecting': 'Opnieuw verbinden…',
  'conn.status.disconnected': 'Verbroken',
  'conn.status.error': 'Fout',

  'metric.power': 'Vermogen',
  'metric.cadence': 'Cadans',
  'metric.hr': 'Hartslag',
  'metric.speed': 'Snelheid',
  'metric.resistance': 'Weerstand',
  'metric.distance': 'Afstand',
  'metric.calories': 'Calorieën',
  'metric.elapsed': 'Verstreken',

  'tiles.label': 'Live-waarden',
  'tiles.avg': 'gem',
  'tiles.aboveAvg': 'boven gemiddelde',
  'tiles.belowAvg': 'onder gemiddelde',
  'tiles.atAvg': 'op gemiddelde',

  'graphs.label': 'Trends',
  'spark.trend': '{name}-trend',

  'export.currentTitle': 'Huidige sessie',
  'export.json': 'Exporteer JSON',
  'export.tcx': 'Exporteer TCX',
  'export.jsonShort': 'JSON',
  'export.tcxShort': 'TCX',

  'live.recentTitle': 'Recente ritten',
  'live.viewAll': 'Alle bekijken →',
  'live.noRides': 'Nog geen ritten.',

  'history.title': 'Sessiegeschiedenis',
  'history.addDemo': 'Demo-sessie toevoegen',
  'history.adding': 'Toevoegen…',
  'history.importJson': 'Importeer JSON',
  'history.refresh': 'Vernieuwen',
  'history.refreshing': 'Vernieuwen…',
  'history.empty': 'Nog geen sessies. Fiets een rit of voeg een demo-sessie toe.',

  'session.title': 'Sessie',
  'session.back': '← Geschiedenis',

  'list.open': 'Open sessie van {time}',
  'list.powerAvg': '{value} W gem',
  'list.distance': '{value} km',

  'stat.duration': 'Duur',
  'stat.avgPower': 'Gem. vermogen',
  'stat.maxPower': 'Max. vermogen',
  'stat.avgHr': 'Gem. hartslag',
  'stat.maxHr': 'Max. hartslag',
  'stat.avgCadence': 'Gem. cadans',
  'stat.distance': 'Afstand',
  'stat.energy': 'Energie',
  'stat.if': 'IF',
  'stat.tss': 'TSS',

  'dash.title': 'Dashboard aanpassen',
  'dash.note':
    'De eerste zichtbare waarde is de grote tegel. Herschik met de pijlen; vink een waarde uit om te verbergen.',
  'dash.hero': 'groot',
  'dash.moveUp': '{name} omhoog verplaatsen',
  'dash.moveDown': '{name} omlaag verplaatsen',
  'dash.reset': 'Standaard herstellen',

  'profile.title': 'Fietsersprofiel',
  'profile.note':
    'Optioneel, alleen op dit apparaat opgeslagen. Indien ingesteld wordt het naar de fiets gestuurd zodat die je FTP-zones (Coach-By-Color) en W/kg kan tonen. Laat leeg om de standaardwaarden van de fiets te behouden.',
  'profile.ftp': 'FTP',
  'profile.weight': 'Gewicht',
  'profile.maxHr': 'Max. hartslag',
  'profile.age': 'Leeftijd',
  'profile.name': 'Naam',
  'profile.unitYr': 'jr',
  'profile.phFtp': 'bijv. 220',
  'profile.phWeight': 'bijv. 75',
  'profile.phMaxHr': 'bijv. 185',
  'profile.phAge': 'optioneel',
  'profile.phName': 'getoond op de fiets (alleen initialen)',
  'profile.colorMode': 'Coach-By-Color op de fiets inschakelen (zonelampje voor)',
  'profile.deleted': 'Profiel verwijderd.',
  'profile.delete': 'Profiel verwijderen',
  'profile.maxHrHint': 'Geschat op basis van leeftijd (220 − leeftijd) — vul je eigen waarde in.',

  'hrzone.title': 'Tijd in hartslagzones',
  'hrzone.maxHr': 'HRmax {hr}',
  'hrzone.badgeAria': 'Hartslagzone {z}',
  'hrzone.z1': 'Herstel',
  'hrzone.z2': 'Duur',
  'hrzone.z3': 'Aeroob',
  'hrzone.z4': 'Drempel',
  'hrzone.z5': 'Maximaal',

  'cbczone.badgeAria': 'Coach-By-Color-zone: {name}',
  'cbczone.white': 'Wit',
  'cbczone.blue': 'Blauw',
  'cbczone.green': 'Groen',
  'cbczone.yellow': 'Geel',
  'cbczone.red': 'Rood',

  'error.notJson': 'Geen geldige JSON.',
  'error.notSessionFile': 'Geen Bikefit-sessiebestand.',
  'error.unsupportedVersion': 'Niet-ondersteund sessiebestand (versie {version}; verwacht 2).',
  'error.noTrainerService': 'Geen ondersteunde trainerservice gevonden. Aanwezig: {present}.',
  'error.noSessionToExport': 'geen sessie om te exporteren',
  'error.sessionNotFound': 'sessie {id} niet gevonden',
}

export const messages: Record<Locale, Record<MessageKey, string>> = { en, nl }
