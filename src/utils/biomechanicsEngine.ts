import { analyzeTransverse } from './transverseAnalysis'
import {
  CLINICAL_THRESHOLDS,
  degreesQuantitative,
  normalizedToPercentValue,
  percentQuantitative,
} from '@/data/clinicalThresholds'
import type { AnatomicalPlane, ClinicalDirection, Side, PlacedLandmark, Point2D, QuantitativeUnit } from '@/types'
import { getPlaneConfig } from '@/data/planes'
import { deviationFromVerticalDegrees, segmentTiltDegrees } from '@/utils/angleCalculations'
import {
  computePosteriorSpineSegmentDeviations,
  computeSagittalSpineSegmentMetrics,
} from '@/utils/spineSegmentInference'
import {
  autoSeverityFromDegrees,
  severityFromNormalizedMagnitude,
} from '@/utils/severityFromMeasurement'
import {
  analyzeFrontalLowerLimb,
  frontalLowerLimbAxes,
  frontalLowerLimbToAutoMeasurements,
} from '@/utils/frontalLowerLimbAnalysis'
import { midpoint, verticalDifference, type LevelDifference } from '@/utils/vectorAnalysis'

export interface BiomechanicalAxis {
  id: string
  label: string
  from: Point2D
  to: Point2D
  color: string
  plane: AnatomicalPlane
}

export interface AutoMeasurement {
  clinicalSuggestion?: { phenomenon: string; district: import('@/types').ClinicalDistrict; descriptor: import('@/types').Descriptor; direction?: ClinicalDirection }
  side?: Side
  direction?: ClinicalDirection
  observationNote?: string
  id: string
  label: string
  value: string
  severity: 'normale' | 'lieve' | 'moderato' | 'severo'
  plane: AnatomicalPlane
  suggestion?: string
  numericValue?: number
  unit?: QuantitativeUnit
}

function findLm(
  landmarks: PlacedLandmark[],
  ...ids: string[]
): PlacedLandmark | undefined {
  for (const id of ids) {
    const lm = landmarks.find((l) => l.landmarkId === id || (l as { type?: string }).type === id)
    if (lm) return lm
  }
  return undefined
}

function pos(lm: PlacedLandmark): Point2D {
  return lm.position
}

export function buildBiomechanicalAxes(
  plane: AnatomicalPlane,
  landmarks: PlacedLandmark[],
): BiomechanicalAxis[] {
  if (plane === 'trasverso') return analyzeTransverse(landmarks).axes
  const axes: BiomechanicalAxis[] = []
  const add = (id: string, label: string, from: Point2D, to: Point2D, color: string) => {
    axes.push({ id, label, from, to, color, plane })
  }

  if (plane === 'frontale_anteriore') {
    const acrD = findLm(landmarks, 'acromion_dx')
    const acrS = findLm(landmarks, 'acromion_sx')
    const siasD = findLm(landmarks, 'sias_dx')
    const siasS = findLm(landmarks, 'sias_sx')
    const rotD = findLm(landmarks, 'rotula_dx')
    const rotS = findLm(landmarks, 'rotula_sx')
    const malD = findLm(landmarks, 'malleolo_mediale_dx', 'malleolo_laterale_dx')
    const malS = findLm(landmarks, 'malleolo_mediale_sx', 'malleolo_laterale_sx')
    if (acrD && acrS) add('biacromiale', 'Linea biacromiale', pos(acrD), pos(acrS), '#0ea5e9')
    if (siasD && siasS) add('bisiliaca', 'Linea bisiliaca', pos(siasD), pos(siasS), '#06b6d4')
    if (rotD && rotS) add('birotulea', 'Linea birotulea', pos(rotD), pos(rotS), '#8b5cf6')
    if (malD && malS) add('bimallolare', 'Linea bimallolare', pos(malD), pos(malS), '#f59e0b')
    const man = findLm(landmarks, 'manubrio')
    const omb = findLm(landmarks, 'ombelico')
    if (man && omb) add('sternale', 'Asse sternale', pos(man), pos(omb), '#ef4444')

    for (const axis of frontalLowerLimbAxes(analyzeFrontalLowerLimb(landmarks))) {
      add(axis.id, axis.label, axis.from, axis.to, axis.color)
    }
  }

  if (plane === 'frontale_posteriore') {
    const acrD = findLm(landmarks, 'acromion_post_dx')
    const acrS = findLm(landmarks, 'acromion_post_sx')
    const psisD = findLm(landmarks, 'psis_dx')
    const psisS = findLm(landmarks, 'psis_sx')
    const calcD = findLm(landmarks, 'calcagno_dx')
    const calcS = findLm(landmarks, 'calcagno_sx')
    if (acrD && acrS) add('biacromiale_post', 'Linea biacromiale', pos(acrD), pos(acrS), '#0ea5e9')
    if (psisD && psisS) add('bipsis', 'Linea bipsis', pos(psisD), pos(psisS), '#06b6d4')
    if (calcD && calcS) add('bicalcaneare', 'Linea bicalcaneare', pos(calcD), pos(calcS), '#f59e0b')
    const c7 = findLm(landmarks, 'cervicale_c7')
    const sac = findLm(landmarks, 'apice_sacrale', 'sacro_medio')
    if (c7 && sac) add('asse_rachide', 'Occipite-C7-sacro', pos(c7), pos(sac), '#ef4444')
  }

  if (plane === 'sagittale_destro' || plane === 'sagittale_sinistro') {
    const tr = findLm(landmarks, `trago_${plane}`)
    const acr = findLm(landmarks, `acromion_${plane}`)
    const trc = findLm(landmarks, `trocantere_${plane}`)
    const mal = findLm(landmarks, `malleolo_lat_${plane}`)
    if (tr && acr) add(`pl_${plane}_1`, 'Trago-acromion', pos(tr), pos(acr), '#0ea5e9')
    if (acr && trc) add(`pl_${plane}_2`, 'Acromion-trocantere', pos(acr), pos(trc), '#06b6d4')
    if (trc && mal) add(`pl_${plane}_3`, 'Trocantere-malleolo', pos(trc), pos(mal), '#f59e0b')
  }

  return axes
}

export function computeAutoMeasurements(
  plane: AnatomicalPlane,
  landmarks: PlacedLandmark[],
): AutoMeasurement[] {
  if (plane === 'trasverso') return analyzeTransverse(landmarks).measurements
  const results: AutoMeasurement[] = []
  const config = getPlaneConfig(plane)

  if (plane === 'frontale_anteriore') {
    const acrD = findLm(landmarks, 'acromion_dx')
    const acrS = findLm(landmarks, 'acromion_sx')
    if (acrD && acrS) {
      const diff = verticalDifference('Dislivello acromiale', pos(acrD), pos(acrS))
      const q = percentQuantitative(diff.magnitude)
      results.push({
        id: 'dislivello_acromiale_auto',
        side: acrD.position.y === acrS.position.y ? undefined : acrD.position.y < acrS.position.y ? 'destro' : 'sinistro',
        direction: acrD.position.y === acrS.position.y ? undefined : acrD.position.y < acrS.position.y ? 'dx' : 'sx',
        observationNote: acrD.position.y === acrS.position.y ? 'Punti allo stesso livello' : acrD.position.y < acrS.position.y ? 'Destro più alto del sinistro' : 'Sinistro più alto del destro',
        label: 'Dislivello acromiale',
        value: `${q.value}% immagine`,
        severity: severityFromNormalizedMagnitude(diff.magnitude),
        plane,
        numericValue: q.value,
        unit: q.unit,
        suggestion:
          diff.magnitude > CLINICAL_THRESHOLDS.suggestion_hint.dislivello_sias
            ? 'Valutare tilt spalle e linea laterale Myers'
            : undefined,
      })
    }
    const siasD = findLm(landmarks, 'sias_dx')
    const siasS = findLm(landmarks, 'sias_sx')
    if (siasD && siasS) {
      const diff = verticalDifference('Dislivello SIAS', pos(siasD), pos(siasS))
      const q = percentQuantitative(diff.magnitude)
      results.push({
        id: 'dislivello_sias_auto',
        side: siasD.position.y === siasS.position.y ? undefined : siasD.position.y < siasS.position.y ? 'destro' : 'sinistro',
        direction: siasD.position.y === siasS.position.y ? undefined : siasD.position.y < siasS.position.y ? 'dx' : 'sx',
        observationNote: siasD.position.y === siasS.position.y ? 'Punti allo stesso livello' : siasD.position.y < siasS.position.y ? 'Destro più alto del sinistro' : 'Sinistro più alto del destro',
        label: 'Dislivello SIAS / tilt pelvico',
        value: `${q.value}%`,
        severity: severityFromNormalizedMagnitude(diff.magnitude),
        plane,
        numericValue: q.value,
        unit: q.unit,
      })
    }
    const puD = findLm(landmarks, 'bipupillare_dx')
    const puS = findLm(landmarks, 'bipupillare_sx')
    if (puD && puS) {
      const tilt = segmentTiltDegrees(pos(puD), pos(puS))
      const q = { value: Math.round(tilt * 10) / 10, unit: 'gradi' as const }
      results.push({
        id: 'bipupillare_tilt',
        side: puD.position.y === puS.position.y ? undefined : puD.position.y < puS.position.y ? 'destro' : 'sinistro',
        direction: puD.position.y === puS.position.y ? undefined : puD.position.y < puS.position.y ? 'dx' : 'sx',
        observationNote: puD.position.y === puS.position.y ? 'Punti allo stesso livello' : puD.position.y < puS.position.y ? 'Destro più alto del sinistro' : 'Sinistro più alto del destro',
        label: 'Inclinazione linea bipupillare',
        value: `${q.value}°`,
        severity: autoSeverityFromDegrees(tilt, CLINICAL_THRESHOLDS.bipupillare_gradi),
        plane,
        numericValue: q.value,
        unit: q.unit,
      })
    }

    results.push(...frontalLowerLimbToAutoMeasurements(analyzeFrontalLowerLimb(landmarks)))
  }

  if (plane === 'frontale_posteriore') {
    const psisD = findLm(landmarks, 'psis_dx')
    const psisS = findLm(landmarks, 'psis_sx')
    if (psisD && psisS) {
      const diff = verticalDifference('Dislivello PSIS', pos(psisD), pos(psisS))
      const q = percentQuantitative(diff.magnitude)
      results.push({
        id: 'dislivello_psis_auto',
        label: 'Dislivello PSIS',
        value: `${q.value}%`,
        severity: severityFromNormalizedMagnitude(diff.magnitude),
        plane,
        numericValue: q.value,
        unit: q.unit,
      })
    }
    const infD = findLm(landmarks, 'angolo_scapola_inf_dx')
    const infS = findLm(landmarks, 'angolo_scapola_inf_sx')
    const supD = findLm(landmarks, 'angolo_scapola_sup_dx')
    const supS = findLm(landmarks, 'angolo_scapola_sup_sx')
    if (infD && infS && supD && supS) {
      const midD = midpoint(pos(infD), pos(supD))
      const midS = midpoint(pos(infS), pos(supS))
      const diff = verticalDifference('Asimmetria scapolare', midD, midS)
      const q = percentQuantitative(diff.magnitude)
      results.push({
        id: 'asimmetria_scapolare_auto',
        label: 'Asimmetria scapolare',
        value: `${q.value}%`,
        severity: severityFromNormalizedMagnitude(diff.magnitude),
        plane,
        numericValue: q.value,
        unit: q.unit,
      })
    }

    for (const seg of computePosteriorSpineSegmentDeviations(landmarks)) {
      results.push({
        id: `spine_post_${seg.segment}`,
        label: seg.label,
        value: `${seg.quantitative.value}% verso ${seg.direction}`,
        severity: seg.severity,
        plane,
        numericValue: seg.quantitative.value,
        unit: seg.quantitative.unit,
        suggestion: seg.reason,
      })
    }
  }

  if (plane === 'sagittale_destro' || plane === 'sagittale_sinistro') {
    const tr = findLm(landmarks, `trago_${plane}`)
    const acr = findLm(landmarks, `acromion_${plane}`)
    const mal = findLm(landmarks, `malleolo_lat_${plane}`)
    if (tr && acr && mal) {
      const plumb = deviationFromVerticalDegrees(pos(tr), pos(mal))
      const q = degreesQuantitative(plumb)
      results.push({
        id: `plumb_${plane}`,
        label: 'Deviazione catena laterale',
        value: `${q.value}° da verticale`,
        severity: autoSeverityFromDegrees(plumb, CLINICAL_THRESHOLDS.plumb_line_gradi),
        plane,
        numericValue: q.value,
        unit: q.unit,
      })
    }
    const sias = findLm(landmarks, `sias_${plane}`)
    const sips = findLm(landmarks, `sips_${plane}`)
    if (sias && sips) {
      const deltaY = sias.position.y - sips.position.y
      const pct = normalizedToPercentValue(Math.abs(deltaY))
      if (deltaY > CLINICAL_THRESHOLDS.sias_sips_anterior.detection) {
        const q = percentQuantitative(deltaY)
        results.push({
          id: `sias_sips_${plane}`,
          label: 'SIAS vs SIPS',
          value: `SIAS inferiore di ${pct}% immagine`,
          severity: severityFromNormalizedMagnitude(
            deltaY,
            CLINICAL_THRESHOLDS.sias_sips_anterior,
          ),
          plane,
          numericValue: q.value,
          unit: q.unit,
          suggestion:
            'Possibile tilt pelvico anteriore (suggerimento clinico, non diagnosi)',
        })
      } else if (deltaY < -CLINICAL_THRESHOLDS.sias_sips_posterior.detection) {
        const q = percentQuantitative(deltaY)
        results.push({
          id: `sias_sips_${plane}`,
          label: 'SIAS vs SIPS',
          value: `SIAS superiore di ${pct}%`,
          severity: severityFromNormalizedMagnitude(
            Math.abs(deltaY),
            CLINICAL_THRESHOLDS.sias_sips_posterior,
          ),
          plane,
          numericValue: q.value,
          unit: q.unit,
          suggestion:
            'Possibile tilt pelvico posteriore/retroversione (suggerimento)',
        })
      } else {
        results.push({
          id: `sias_sips_${plane}`,
          label: 'SIAS vs SIPS',
          value: 'Allineamento verticale simile',
          severity: 'normale',
          plane,
        })
      }
    }

    const trg = findLm(landmarks, `trago_${plane}`)
    const xif = findLm(landmarks, `xifoide_${plane}`)
    if (trg && xif) {
      const fwd = pos(trg).x - pos(xif).x
      if (fwd > CLINICAL_THRESHOLDS.forward_head_trago_xifoide.detection) {
        const q = percentQuantitative(fwd)
        results.push({
          id: `fhp_${plane}`,
          label: 'Forward head / anteriorizzazione stimata',
          value: `Shift anteriore ${q.value}%`,
          severity: severityFromNormalizedMagnitude(
            fwd,
            CLINICAL_THRESHOLDS.forward_head_trago_xifoide,
          ),
          plane,
          numericValue: q.value,
          unit: q.unit,
          suggestion: 'Correlare con Linea Superficiale Posteriore e Profonda Frontale',
        })
      }
    }

    for (const metric of computeSagittalSpineSegmentMetrics(plane, landmarks).slice(0, 4)) {
      results.push({
        id: `spine_sag_${metric.segmentLabel.replace(/[^a-z0-9]/gi, '_')}`,
        label: `Catena rachide ${metric.segmentLabel}`,
        value: metric.reason,
        severity: metric.severity,
        plane,
        numericValue: metric.quantitative.value,
        unit: metric.quantitative.unit,
      })
    }
  }

  if (results.length === 0 && landmarks.length > 0) {
    results.push({
      id: 'need_more_lm',
      label: 'Landmark insufficienti',
      value: `Aggiungere landmark chiave per ${config.shortLabel}`,
      severity: 'normale',
      plane,
      suggestion: config.dominantPatternHints[0],
    })
  }

  return results
}

export type { LevelDifference }
