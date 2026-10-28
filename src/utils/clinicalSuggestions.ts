import {
  CLINICAL_THRESHOLDS,
  degreesQuantitative,
  percentQuantitative,
  type DetectionThreshold,
} from '@/data/clinicalThresholds'
import { getAlterationsForPlane } from '@/data/planes'
import type {
  AnatomicalPlane,
  ClinicalDirection,
  Descriptor,
  PlacedLandmark,
  QuantitativeValue,
  Severity,
  Side,
} from '@/types'
import {
  passesDetectionThreshold,
  severityFromDetectionThreshold,
} from '@/utils/severityFromMeasurement'
import {
  applyFemoroTibialeVariant,
  femoroTibialeVariantFromAlignment,
  femoroTibialeVariantFromRotation,
} from '@/data/femoroTibialeDescriptors'
import { analyzeFrontalLowerLimb } from '@/utils/frontalLowerLimbAnalysis'
import {
  computePosteriorSpineSegmentDeviations,
  findSagittalSpineLandmark,
} from '@/utils/spineSegmentInference'

export interface AlterationSuggestion {
  alterationId: string
  label: string
  reason: string
  severity: Severity
  quantitative?: QuantitativeValue
  direction?: ClinicalDirection
  descriptor?: Descriptor
  side?: Side
}

function pushIfValid(
  out: AlterationSuggestion[],
  plane: AnatomicalPlane,
  alterationId: string,
  reason: string,
  magnitude: number,
  threshold: DetectionThreshold,
  opts?: {
    quantitative?: QuantitativeValue
    direction?: ClinicalDirection
    descriptor?: Descriptor
    side?: Side
  },
) {
  if (!passesDetectionThreshold(magnitude, threshold)) {
    return
  }
  const exists = getAlterationsForPlane(plane).some((a) => a.id === alterationId)
  if (!exists) return
  const label =
    getAlterationsForPlane(plane).find((a) => a.id === alterationId)?.label ??
    alterationId
  if (
    out.some(
      (s) =>
        s.alterationId === alterationId &&
        (opts?.side === undefined || s.side === opts.side),
    )
  ) {
    return
  }
  out.push({
    alterationId,
    label,
    reason,
    severity: severityFromDetectionThreshold(magnitude, threshold),
    quantitative: opts?.quantitative,
    direction: opts?.direction,
    descriptor: opts?.descriptor,
    side: opts?.side,
  })
}

export function computeAlterationSuggestions(
  plane: AnatomicalPlane,
  landmarks: PlacedLandmark[],
): AlterationSuggestion[] {
  const suggestions: AlterationSuggestion[] = []

  if (plane === 'frontale_posteriore') {
    for (const seg of computePosteriorSpineSegmentDeviations(landmarks)) {
      pushIfValid(
        suggestions,
        plane,
        seg.alterationId,
        seg.reason,
        seg.magnitude,
        CLINICAL_THRESHOLDS.deviazione_spinous_posterior,
        {
          quantitative: seg.quantitative,
          direction: seg.direction,
          descriptor: seg.descriptor,
        },
      )
    }
    return suggestions
  }

  if (plane === 'frontale_anteriore') {
    const analysis = analyzeFrontalLowerLimb(landmarks)

    for (const side of ['destro', 'sinistro'] as const) {
      const limb = analysis[side]
      if (!limb.evaluable) continue

      const alignmentVariant = femoroTibialeVariantFromAlignment(limb.alignment)
      if (alignmentVariant && limb.alignment !== 'neutro') {
        const variantPatch = applyFemoroTibialeVariant(alignmentVariant)
        pushIfValid(
          suggestions,
          plane,
          'asse_femoro_tibiale',
          `Asse femoro-tibiale ${side}: ${limb.femoroTibialAngleDegrees?.toFixed(1)}° · ${limb.alignment}.`,
          Math.abs(limb.alignmentDeviation ?? 0),
          CLINICAL_THRESHOLDS.ginocchio_valgismo_varismo,
          {
            quantitative: degreesQuantitative(limb.femoroTibialAngleDegrees ?? 0),
            direction: variantPatch.direction,
            descriptor: variantPatch.descriptor,
            side,
          },
        )
      }

      const rotationVariant = femoroTibialeVariantFromRotation(limb.rotation)
      if (rotationVariant) {
        const variantPatch = applyFemoroTibialeVariant(rotationVariant)
        pushIfValid(
          suggestions,
          plane,
          'asse_femoro_tibiale',
          `Rotazione arto inferiore ${side}: ${limb.rotation}.`,
          Math.abs(limb.rotationDeviation ?? 0),
          CLINICAL_THRESHOLDS.rotazione_arto_frontale,
          {
            quantitative: percentQuantitative(Math.abs(limb.rotationDeviation ?? 0)),
            direction: variantPatch.direction,
            descriptor: variantPatch.descriptor,
            side,
          },
        )
      }
    }
    return suggestions
  }

  if (plane !== 'sagittale_destro' && plane !== 'sagittale_sinistro') {
    return suggestions
  }

  const p = plane
  const tr = findLm(landmarks, `trago_${p}`)
  const c7 = findSagittalSpineLandmark(p, landmarks, 'c7')
  const t10 = findSagittalSpineLandmark(p, landmarks, 't10')
  const t12 = findSagittalSpineLandmark(p, landmarks, 't12')
  const l2 = findSagittalSpineLandmark(p, landmarks, 'l2')
  const l3 = findSagittalSpineLandmark(p, landmarks, 'l3')
  const l4 = findSagittalSpineLandmark(p, landmarks, 'l4')
  const l5 = findSagittalSpineLandmark(p, landmarks, 'l5')
  const s1 = findSagittalSpineLandmark(p, landmarks, 's1')
  const s2 = findSagittalSpineLandmark(p, landmarks, 's2')
  const acr = findLm(landmarks, `acromion_${p}`)
  const trc = findLm(landmarks, `trocantere_${p}`)
  const sias = findLm(landmarks, `sias_${p}`)
  const sips = findLm(landmarks, `sips_${p}`)

  if (tr && c7) {
    const shift = c7.position.x - tr.position.x
    const q = percentQuantitative(shift)
    pushIfValid(
      suggestions,
      plane,
      p === 'sagittale_destro' ? 'anteriorizzazione_capo' : 'anteriorizzazione_capo_sx',
      `Trago anteriorizzato rispetto a C7 (${q.value}% immagine).`,
      shift,
      CLINICAL_THRESHOLDS.shift_anteriore_normalizzato,
      { quantitative: q, direction: 'anteriorizzazione', descriptor: 'shift' },
    )
    pushIfValid(
      suggestions,
      plane,
      p === 'sagittale_destro' ? 'forward_head_posture' : 'forward_head_posture_sx',
      `Trago anteriorizzato rispetto a C7 (${q.value}% immagine).`,
      shift,
      CLINICAL_THRESHOLDS.shift_anteriore_normalizzato,
      { quantitative: q, direction: 'anteriorizzazione', descriptor: 'shift' },
    )
  }

  if (c7 && t10) {
    const shift = c7.position.x - t10.position.x
    const q = percentQuantitative(shift)
    pushIfValid(
      suggestions,
      plane,
      p === 'sagittale_destro' ? 'inclinazione_cervicale' : 'inclinazione_cervicale_sx',
      `C7 anteriorizzato rispetto a T10 (${q.value}% immagine).`,
      shift,
      CLINICAL_THRESHOLDS.c7_t10_shift,
      { quantitative: q, direction: 'anteriore', descriptor: 'bend' },
    )
  }

  if (acr && trc) {
    const shift = trc.position.x - acr.position.x
    const q = percentQuantitative(shift)
    pushIfValid(
      suggestions,
      plane,
      p === 'sagittale_destro'
        ? 'protrazione_cingolo_scapolare'
        : 'protrazione_cingolo_scapolare_sx',
      `Acromion anteriorizzato rispetto al trocantere (${q.value}% immagine).`,
      shift,
      CLINICAL_THRESHOLDS.shift_anteriore_acromion_trocantere,
      { quantitative: q, direction: 'anteriore', descriptor: 'shift' },
    )
    pushIfValid(
      suggestions,
      plane,
      p === 'sagittale_destro'
        ? 'allineamento_acromion_trocantere'
        : 'allineamento_acromion_trocantere_sx',
      `Disallineamento acromion–trocantere (${q.value}% immagine).`,
      shift,
      CLINICAL_THRESHOLDS.shift_anteriore_acromion_trocantere,
      { quantitative: q, direction: 'anteriore', descriptor: 'shift' },
    )
  }

  if (sias && sips) {
    const deltaY = sias.position.y - sips.position.y
    if (deltaY > 0) {
      const q = percentQuantitative(deltaY)
      pushIfValid(
        suggestions,
        plane,
        p === 'sagittale_destro'
          ? 'tilt_pelvico_anteriore_sag'
          : 'tilt_pelvico_anteriore_sag_sx',
        `SIAS più bassa di SIPS (${q.value}% immagine).`,
        deltaY,
        CLINICAL_THRESHOLDS.sias_sips_anterior,
        { quantitative: q, direction: 'anteriore', descriptor: 'tilt' },
      )
    } else {
      const q = percentQuantitative(Math.abs(deltaY))
      pushIfValid(
        suggestions,
        plane,
        p === 'sagittale_destro'
          ? 'tilt_pelvico_posteriore_sag'
          : 'tilt_pelvico_posteriore_sag_sx',
        `SIAS più alta di SIPS (${q.value}% immagine).`,
        Math.abs(deltaY),
        CLINICAL_THRESHOLDS.sias_sips_posterior,
        { quantitative: q, direction: 'posteriore', descriptor: 'tilt' },
      )
    }
  }

  const dorsalUpper = t10 ?? t12
  const dorsalLower = l3 ?? l2 ?? l5
  if (dorsalUpper && dorsalLower) {
    const shift = dorsalUpper.position.x - dorsalLower.position.x
    const q = percentQuantitative(shift)
    pushIfValid(
      suggestions,
      plane,
      p === 'sagittale_destro' ? 'ipercifosi_dorsale' : 'ipercifosi_dorsale_sx',
      `${dorsalUpper.shortLabel} posteriorizzato rispetto a ${dorsalLower.shortLabel} (${q.value}% immagine).`,
      shift,
      CLINICAL_THRESHOLDS.cifosi_t10_l5,
      { quantitative: q, direction: 'posteriore', descriptor: 'bend' },
    )
    pushIfValid(
      suggestions,
      plane,
      p === 'sagittale_destro'
        ? 'compenso_toraco_lombare'
        : 'compenso_toraco_lombare_sx',
      `Disaccordo sagittale ${dorsalUpper.shortLabel}–${dorsalLower.shortLabel} (${q.value}% immagine).`,
      shift,
      CLINICAL_THRESHOLDS.cifosi_t10_l5,
      { quantitative: q, descriptor: 'compenso' },
    )
  }

  const lordosisUpper = t12 ?? t10
  const lordosisLower = s2 ?? s1 ?? l5
  if (
    lordosisUpper &&
    lordosisLower &&
    Math.abs(lordosisUpper.position.x - lordosisLower.position.x) < 0.015
  ) {
    const lumbar = l4 ?? l3 ?? l2 ?? l5
    if (lumbar && lordosisUpper.position.x - lumbar.position.x > 0) {
      const shift = lordosisUpper.position.x - lumbar.position.x
      const q = percentQuantitative(shift)
      pushIfValid(
        suggestions,
        plane,
        p === 'sagittale_destro' ? 'iperlordosi_lombare' : 'iperlordosi_lombare_sx',
        `Curva lombare accentuata tra ${lordosisUpper.shortLabel} e ${lumbar.shortLabel} (${q.value}% immagine).`,
        shift,
        CLINICAL_THRESHOLDS.lordosi_l5_t10,
        { quantitative: q, direction: 'anteriore', descriptor: 'bend' },
      )
    }
  }

  const flatL5 = l5 ?? l4
  if (flatL5 && s1 && Math.abs(flatL5.position.y - s1.position.y) < 0.02) {
    const shift = flatL5.position.x - s1.position.x
    if (shift > 0) {
      const q = percentQuantitative(shift)
      pushIfValid(
        suggestions,
        plane,
        p === 'sagittale_destro'
          ? 'rettilineizzazione_lombare'
          : 'rettilineizzazione_lombare_sx',
        `Profilo lombo-sacrale poco curvato ${flatL5.shortLabel}–S1 (${q.value}% immagine).`,
        shift,
        CLINICAL_THRESHOLDS.rettilineizzazione_lombare,
        { quantitative: q, direction: 'posteriore', descriptor: 'bend' },
      )
    }
  }

  if (sias && s1) {
    const shift = Math.abs(sias.position.x - s1.position.x)
    const q = percentQuantitative(shift)
    pushIfValid(
      suggestions,
      plane,
      p === 'sagittale_destro' ? 'shift_bacino_sagittale' : 'shift_bacino_sagittale_sx',
      `SIAS disallineata rispetto a S1 (${q.value}% immagine).`,
      shift,
      CLINICAL_THRESHOLDS.shift_bacino_sagittale,
      {
        quantitative: q,
        direction: sias.position.x > s1.position.x ? 'anteriore' : 'posteriore',
        descriptor: 'shift',
      },
    )
  }

  return suggestions
}

function findLm(
  landmarks: PlacedLandmark[],
  ...ids: string[]
): PlacedLandmark | undefined {
  for (const id of ids) {
    const hit = landmarks.find(
      (l) => l.landmarkId === id || (l as { type?: string }).type === id,
    )
    if (hit) return hit
  }
  return undefined
}
