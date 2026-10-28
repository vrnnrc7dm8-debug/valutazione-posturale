import { describe, expect, it } from 'vitest'
import type { PlacedLandmark } from '@/types'
import { resolveCalibration } from '@/utils/calibration'
import {
  inferFrontAnteriorUpperLimbFromLandmarks,
  isUpperLimbFinding,
} from '@/utils/frontalUpperLimbAnalysis'
import {
  filterReportEligibleFindings,
  inferMyofascialAlterations,
} from '@/utils/myofascialInference'
import { normalizePlacedLandmark } from '@/utils/landmarkMigration'

function confirmedLm(
  landmarkId: string,
  position: { x: number; y: number },
  overrides: Partial<PlacedLandmark> = {},
): PlacedLandmark {
  return normalizePlacedLandmark(
    {
      id: landmarkId,
      landmarkId,
      label: landmarkId,
      shortLabel: landmarkId,
      position,
      confidence: 1,
      validationState: 'manuale_confermato',
      ...overrides,
    },
    'frontale_anteriore',
  )
}

function upperLimbChainDx(overrides: {
  gomito?: { x: number; y: number }
  stiloide?: { x: number; y: number }
  dorso?: { x: number; y: number }
  validationState?: PlacedLandmark['validationState']
} = {}): PlacedLandmark[] {
  const validationState = overrides.validationState ?? 'manuale_confermato'
  return [
    confirmedLm('acromion_dx', { x: 0.38, y: 0.22 }, { validationState }),
    confirmedLm('linea_sternale', { x: 0.5, y: 0.35 }),
    confirmedLm(
      'gomito_dx',
      overrides.gomito ?? { x: 0.4, y: 0.38 },
      { validationState },
    ),
    confirmedLm(
      'stiloide_radiale_dx',
      overrides.stiloide ?? { x: 0.34, y: 0.52 },
      { validationState },
    ),
    confirmedLm(
      'dorso_mano_dx',
      overrides.dorso ?? { x: 0.33, y: 0.56 },
      { validationState },
    ),
  ]
}

describe('frontalUpperLimbAnalysis', () => {
  it('calcola asse braccio e avambraccio con landmark confermati', () => {
    const landmarks = upperLimbChainDx({
      gomito: { x: 0.42, y: 0.38 },
      stiloide: { x: 0.4, y: 0.52 },
      dorso: { x: 0.39, y: 0.56 },
    })
    const calibration = resolveCalibration(undefined, landmarks, 175)
    const findings = inferFrontAnteriorUpperLimbFromLandmarks(
      'frontale_anteriore',
      landmarks,
      calibration,
      undefined,
    )

    expect(findings.some((f) => f.id === 'fa_ul_tilt_arm_dx')).toBe(true)
    expect(findings.some((f) => f.id === 'fa_ul_tilt_forearm_dx')).toBe(true)
    expect(findings.every(isUpperLimbFinding)).toBe(true)
  })

  it('non inferisce rotazione con solo stiloide (gomito assente)', () => {
    const landmarks = [
      confirmedLm('acromion_dx', { x: 0.38, y: 0.22 }),
      confirmedLm('linea_sternale', { x: 0.5, y: 0.35 }),
      confirmedLm('stiloide_radiale_dx', { x: 0.34, y: 0.52 }),
    ]
    const calibration = resolveCalibration(undefined, landmarks, 175)
    const findings = inferFrontAnteriorUpperLimbFromLandmarks(
      'frontale_anteriore',
      landmarks,
      calibration,
      undefined,
    )

    expect(findings.some((f) => f.id === 'fa_ul_rotation_dx')).toBe(false)
    expect(findings.some((f) => f.id === 'fa_ul_myofascial_dx')).toBe(false)
    expect(findings.some((f) => f.id === 'fa_ul_prelim_styloid_only_dx')).toBe(true)
    const prelim = findings.find((f) => f.id === 'fa_ul_prelim_styloid_only_dx')
    expect(prelim?.reportEligible).toBe(false)
    expect(prelim?.observationType).toBe('osservazione_diretta')
  })

  it('calcola tendenza intrarotazione solo con catena completa acromion–gomito–stiloide–dorso', () => {
    const landmarks = upperLimbChainDx({
      gomito: { x: 0.4, y: 0.38 },
      stiloide: { x: 0.36, y: 0.52 },
      dorso: { x: 0.35, y: 0.56 },
    })
    const calibration = resolveCalibration(undefined, landmarks, 175)
    const findings = inferFrontAnteriorUpperLimbFromLandmarks(
      'frontale_anteriore',
      landmarks,
      calibration,
      undefined,
    )

    const rotation = findings.find((f) => f.id === 'fa_ul_rotation_dx')
    expect(rotation).toBeDefined()
    expect(rotation?.observationType).toBe('stima_biomeccanica')
    expect(rotation?.landmarksUsed).toEqual([
      'acromion_dx',
      'gomito_dx',
      'stiloide_radiale_dx',
      'dorso_mano_dx',
    ])
    expect(rotation?.warnings?.some((w) => w.includes('foto frontale'))).toBe(true)

    const myofascial = findings.find((f) => f.id === 'fa_ul_myofascial_dx')
    expect(myofascial?.observationType).toBe('inferenza_miofasciale')
    expect(myofascial?.relatedMyofascialLines.length).toBeGreaterThan(0)
  })

  it('landmark non confermati restano preliminari', () => {
    const landmarks = upperLimbChainDx({
      validationState: 'automatico_stimato',
    }).map((lm) => ({
      ...lm,
      confidence: 0.45,
      needsConfirmation: true,
    }))
    const calibration = resolveCalibration(undefined, landmarks, 175)
    const findings = inferMyofascialAlterations(landmarks, 'frontale_anteriore', undefined, {
      calibration,
      subjectHeightCm: 175,
    })
    const upper = findings.filter(isUpperLimbFinding)
    expect(upper.length).toBeGreaterThan(0)
    expect(filterReportEligibleFindings(upper).length).toBe(0)
    expect(upper.some((f) => f.reportEligible === false)).toBe(true)
  })

  it('orientamento mano richiede stiloide e dorso mano', () => {
    const landmarks = [
      confirmedLm('acromion_dx', { x: 0.38, y: 0.22 }),
      confirmedLm('gomito_dx', { x: 0.4, y: 0.38 }),
      confirmedLm('stiloide_radiale_dx', { x: 0.36, y: 0.52 }),
    ]
    const calibration = resolveCalibration(undefined, landmarks, 175)
    const findings = inferFrontAnteriorUpperLimbFromLandmarks(
      'frontale_anteriore',
      landmarks,
      calibration,
      undefined,
    )

    expect(findings.some((f) => f.id === 'fa_ul_align_hand_dx')).toBe(false)
    expect(findings.some((f) => f.id === 'fa_ul_rotation_dx')).toBe(false)
  })
})
