/**
 * Render a SessionFile as a Garmin TCX document — the pragmatic standard for indoor power rides.
 * TCX is XML that Strava, intervals.icu, TrainingPeaks and Golden Cheetah all import, and (unlike
 * GPX) carries power/HR/cadence natively: cadence + HR are first-class Trackpoint fields, power and
 * speed go in the Garmin ActivityExtension (ns3) TPX. No GPS — this is a trainer, so no positions.
 */

import type { SessionFile, SessionSample } from '../types'

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function trackpoint(startWall: number, s: SessionSample): string {
  const parts = [`<Time>${iso(startWall + s.t)}</Time>`]
  if (s.distanceKm !== undefined) {
    parts.push(`<DistanceMeters>${(s.distanceKm * 1000).toFixed(1)}</DistanceMeters>`)
  }
  if (s.cadenceRpm !== undefined) {
    const cad = Math.min(254, Math.max(0, Math.round(s.cadenceRpm)))
    parts.push(`<Cadence>${cad}</Cadence>`)
  }
  if (s.bpm !== undefined && s.bpm > 0) {
    parts.push(`<HeartRateBpm><Value>${Math.round(s.bpm)}</Value></HeartRateBpm>`)
  }
  const ext: string[] = []
  if (s.speedKmh !== undefined) ext.push(`<ns3:Speed>${(s.speedKmh / 3.6).toFixed(2)}</ns3:Speed>`)
  if (s.powerW !== undefined) ext.push(`<ns3:Watts>${Math.round(s.powerW)}</ns3:Watts>`)
  if (ext.length > 0) parts.push(`<Extensions><ns3:TPX>${ext.join('')}</ns3:TPX></Extensions>`)
  return `<Trackpoint>${parts.join('')}</Trackpoint>`
}

export function buildTcx(file: SessionFile): string {
  const { session, summary, samples } = file
  const startWall = session.startedAtWall
  const startIso = iso(startWall)

  let maxSpeedKmh = 0
  for (const s of samples) if (s.speedKmh !== undefined && s.speedKmh > maxSpeedKmh) maxSpeedKmh = s.speedKmh

  const lap: string[] = [`<TotalTimeSeconds>${summary.durationS}</TotalTimeSeconds>`]
  if (summary.distanceKm !== undefined) {
    lap.push(`<DistanceMeters>${(summary.distanceKm * 1000).toFixed(1)}</DistanceMeters>`)
  }
  if (maxSpeedKmh > 0) lap.push(`<MaximumSpeed>${(maxSpeedKmh / 3.6).toFixed(2)}</MaximumSpeed>`)
  if (summary.energyKcal !== undefined) lap.push(`<Calories>${Math.round(summary.energyKcal)}</Calories>`)
  if (summary.avgBpm !== undefined) {
    lap.push(`<AverageHeartRateBpm><Value>${summary.avgBpm}</Value></AverageHeartRateBpm>`)
  }
  if (summary.maxBpm !== undefined) {
    lap.push(`<MaximumHeartRateBpm><Value>${summary.maxBpm}</Value></MaximumHeartRateBpm>`)
  }
  lap.push('<Intensity>Active</Intensity>')
  if (summary.avgCadenceRpm !== undefined) {
    lap.push(`<Cadence>${Math.min(254, summary.avgCadenceRpm)}</Cadence>`)
  }
  lap.push('<TriggerMethod>Manual</TriggerMethod>')
  lap.push(`<Track>${samples.map((s) => trackpoint(startWall, s)).join('')}</Track>`)

  const lx: string[] = []
  if (summary.avgPowerW !== undefined) lx.push(`<ns3:AvgWatts>${summary.avgPowerW}</ns3:AvgWatts>`)
  if (summary.maxPowerW !== undefined) lx.push(`<ns3:MaxWatts>${summary.maxPowerW}</ns3:MaxWatts>`)
  if (lx.length > 0) lap.push(`<Extensions><ns3:LX>${lx.join('')}</ns3:LX></Extensions>`)

  const device = xmlEscape(session.device?.name ?? 'ICG IC-6')

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<TrainingCenterDatabase' +
    ' xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"' +
    ' xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"' +
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
    ' xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2' +
    ' http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">\n' +
    '  <Activities>\n' +
    '    <Activity Sport="Biking">\n' +
    `      <Id>${startIso}</Id>\n` +
    `      <Lap StartTime="${startIso}">${lap.join('')}</Lap>\n` +
    `      <Creator xsi:type="Device_t"><Name>${device}</Name></Creator>\n` +
    '    </Activity>\n' +
    '  </Activities>\n' +
    '  <Author xsi:type="Application_t"><Name>Bikefit</Name></Author>\n' +
    '</TrainingCenterDatabase>\n'
  )
}
