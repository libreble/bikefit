/**
 * A synthetic IC-6 ride for the demo bike (no hardware). Advances one second at a time and emits
 * the two field sets a real bike streams: LIVE (instantaneous) + AGGREGATED (session totals). Shape
 * of the ride: a 2-min warmup ramp, then repeating 6-min blocks (4 min ≈90% FTP hard / 2 min ≈55%
 * FTP easy), with small per-second jitter so tiles and graphs move like a real ride. Power zones are
 * derived from FTP, so the numbers track whatever FTP the saved profile has (else a 200 W default).
 */

import type { AggFields, LiveFields } from './synthFrames'

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/** 5-zone index (0–4) from % of FTP — roughly the Coggan bands the bike lights by colour. */
function zoneIndex(ftpPct: number): number {
  if (ftpPct < 60) return 0
  if (ftpPct < 76) return 1
  if (ftpPct < 90) return 2
  if (ftpPct < 105) return 3
  return 4
}

const LAP_SECONDS = 360

export class DemoRide {
  private t = 0
  private distanceKm = 0
  private lapDistanceKm = 0
  private calories = 0
  private hr: number
  private sumP = 0
  private nP = 0
  private maxP = 0
  private sumC = 0
  private nC = 0
  private maxC = 0
  private sumH = 0
  private nH = 0
  private maxH = 0
  private maxSpeed = 0
  private readonly zoneSecs = [0, 0, 0, 0, 0]
  private readonly zoneDistKm = [0, 0, 0, 0, 0]
  private readonly zoneKcal = [0, 0, 0, 0, 0]
  private readonly ftpW: number
  private readonly weightKg: number
  private readonly maxHr: number

  constructor(ftpW: number, weightKg: number, maxHr: number) {
    this.ftpW = ftpW
    this.weightKg = weightKg
    this.maxHr = maxHr
    this.hr = clamp(90, 60, maxHr)
  }

  /** Target power (W) at active-second `t`: warmup ramp, then hard/easy interval blocks. */
  private targetPower(t: number): number {
    const F = this.ftpW
    if (t < 120) return 60 + (0.6 * F - 60) * (t / 120)
    const phase = (t - 120) % LAP_SECONDS
    return phase < 240 ? 0.9 * F : 0.55 * F
  }

  /** Advance `dtS` seconds (default 1) and return the LIVE + AGGREGATED field sets for this tick. */
  step(dtS = 1): { live: LiveFields; agg: AggFields } {
    const F = this.ftpW
    this.t += dtS
    const t = this.t

    const power = Math.max(0, Math.round(this.targetPower(t) * (1 + (Math.random() - 0.5) * 0.08)))
    const ratio = F > 0 ? power / F : 0

    const cadence = clamp(
      Math.round(88 + (ratio - 0.7) * 26 + (Math.random() - 0.5) * 4),
      power < 20 ? 0 : 65,
      112,
    )
    const speedKmh = clamp(18 + power / 8 + (Math.random() - 0.5) * 1.5, 0, 70)

    const hrTarget = clamp(95 + ratio * 75, 60, this.maxHr)
    this.hr += (hrTarget - this.hr) * 0.06 * dtS
    const heartRate = Math.round(this.hr)
    const hrPercentOfMax = this.maxHr > 0 ? Math.round((heartRate / this.maxHr) * 100) : 0

    const brakeLevel = clamp(Math.round(ratio * 32), 0, 40)
    const ftpPercent = Math.round(ratio * 100)
    const z = zoneIndex(ftpPercent)

    const dDist = (speedKmh * dtS) / 3600
    const dKcal = (power * dtS) / 1000 // kJ ≈ kcal at ~24% efficiency
    this.distanceKm += dDist
    this.lapDistanceKm += dDist
    this.calories += dKcal
    this.sumP += power
    this.nP++
    this.maxP = Math.max(this.maxP, power)
    this.sumC += cadence
    this.nC++
    this.maxC = Math.max(this.maxC, cadence)
    this.sumH += heartRate
    this.nH++
    this.maxH = Math.max(this.maxH, heartRate)
    this.maxSpeed = Math.max(this.maxSpeed, speedKmh)
    this.zoneSecs[z] = (this.zoneSecs[z] ?? 0) + dtS
    this.zoneDistKm[z] = (this.zoneDistKm[z] ?? 0) + dDist
    this.zoneKcal[z] = (this.zoneKcal[z] ?? 0) + dKcal

    const currentLap = Math.floor((t - 1) / LAP_SECONDS) + 1
    const currentLapTime = ((t - 1) % LAP_SECONDS) + 1
    const currentLapDistance = this.lapDistanceKm
    if (t % LAP_SECONDS === 0) this.lapDistanceKm = 0

    const live: LiveFields = {
      power,
      ftpPercent,
      trainingZone: z + 1,
      heartRate,
      hrPercentOfMax,
      powerToHrRatio: heartRate > 0 ? power / heartRate : 0,
      powerToWeightRatio: this.weightKg > 0 ? power / this.weightKg : 0,
      cadence,
      speedKmh,
      brakeLevel,
      currentLap,
      currentLapTime,
      currentLapDistance,
      totalLaps: currentLap,
      workoutTime: t,
      distanceKm: this.distanceKm,
      calories: Math.round(this.calories),
    }

    const powerAvg = this.nP > 0 ? this.sumP / this.nP : 0
    const hrAvg = this.nH > 0 ? this.sumH / this.nH : 0
    const cadenceAvg = this.nC > 0 ? this.sumC / this.nC : 0
    const speedAvg = t > 0 ? this.distanceKm / (t / 3600) : 0
    const np = powerAvg * 1.06 // stand-in for normalized power (no 30 s rolling 4th-power here)
    const intensityFactor = F > 0 ? np / F : 0
    const trainingStressScore = (t / 3600) * intensityFactor * intensityFactor * 100
    const totalSecs = this.zoneSecs.reduce((a, b) => a + b, 0) || 1

    const agg: AggFields = {
      powerAvg,
      powerMax: this.maxP,
      powerToHrAvg: hrAvg > 0 ? powerAvg / hrAvg : 0,
      powerToWeightAvg: this.weightKg > 0 ? powerAvg / this.weightKg : 0,
      calories: Math.round(this.calories),
      hrAvg,
      hrMax: this.maxH,
      cadenceAvg,
      cadenceMax: this.maxC,
      distance: this.distanceKm,
      speedAvg,
      speedMax: this.maxSpeed,
      intensityFactor,
      trainingStressScore,
      timeInZone: this.zoneSecs.slice(),
      percentInZone: this.zoneSecs.map((s) => Math.round((s / totalSecs) * 100)),
      distanceInZone: this.zoneDistKm.slice(),
      caloriesInZone: this.zoneKcal.map((k) => Math.round(k)),
      ep: np,
    }

    return { live, agg }
  }
}
