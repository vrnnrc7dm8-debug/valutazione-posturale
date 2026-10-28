import { describe, expect, it } from 'vitest'
import {
  angleBetweenPoints,
  clinicalHorizontalTilt,
  computeAbsoluteTilt,
  computeLimbRotationOffset,
  computeRelativeTilt,
  horizontalTilt,
  midpoint,
  pixelsToCm,
} from '@/utils/landmarkGeometry'
import {
  computeBodySpanNormalized,
  resolveCalibration,
} from '@/utils/calibration'
import { inferMyofascialAlterations } from '@/utils/myofascialInference'
import type { PlacedLandmark } from '@/types'

describe('landmarkGeometry', () => {
  it('clinicalHorizontalTilt is symmetric for segment direction', () => {
    const forward = clinicalHorizontalTilt({ x: 0.4, y: 0.2 }, { x: 0.6, y: 0.25 })
    const reverse = clinicalHorizontalTilt({ x: 0.6, y: 0.25 }, { x: 0.4, y: 0.2 })
    expect(forward.degrees).toBeCloseTo(reverse.degrees, 1)
  })

  it('clinicalHorizontalTilt returns ~0 for horizontal segment', () => {
    const result = clinicalHorizontalTilt({ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.3 })
    expect(result.degrees).toBeLessThan(0.5)
  })

  it('computeAbsoluteTilt detects inclined shoulders', () => {
    const result = computeAbsoluteTilt({ x: 0.4, y: 0.2 }, { x: 0.6, y: 0.25 })
    expect(result.degrees).toBeGreaterThan(2)
    expect(result.severity).not.toBe('normal')
  })

  it('horizontalTilt matches segment tilt for acute angles', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 1, y: 1 }
    expect(horizontalTilt(a, b).degrees).toBeCloseTo(45, 0)
  })

  it('computeRelativeTilt compares two segments', () => {
    const shoulder = { from: { x: 0.35, y: 0.22 }, to: { x: 0.65, y: 0.24 } }
    const pelvis = { from: { x: 0.44, y: 0.48 }, to: { x: 0.56, y: 0.48 } }
    expect(computeRelativeTilt(shoulder, pelvis).degrees).toBeGreaterThan(0)
  })

  it('computeLimbRotationOffset detects knee offset', () => {
    const result = computeLimbRotationOffset(
      { x: 0.44, y: 0.35 },
      { x: 0.48, y: 0.55 },
      { x: 0.44, y: 0.85 },
    )
    expect(result.degrees).toBeGreaterThan(0)
    expect(result.direction).toBe('lateral')
  })

  it('pixelsToCm uses body span when landmarks provided', () => {
    const landmarks: PlacedLandmark[] = [
      {
        id: '1',
        landmarkId: 'vertex',
        label: 'v',
        shortLabel: 'v',
        position: { x: 0.5, y: 0.06 },
        plane: 'frontale_anteriore',
        side: 'linea_mediana',
        category: 'head',
        confidence: 1,
      },
      {
        id: '2',
        landmarkId: 'malleolo_laterale_dx',
        label: 'm',
        shortLabel: 'm',
        position: { x: 0.44, y: 0.88 },
        plane: 'frontale_anteriore',
        side: 'destro',
        category: 'foot',
        confidence: 1,
      },
    ]
    const cal = resolveCalibration(
      { mode: 'subject_height', subjectHeightCm: 170, status: 'unavailable' },
      landmarks,
      170,
    )
    const converted = pixelsToCm(0.1, cal, 170)
    expect(converted.unit).toBe('cm')
    expect(converted.value).toBeGreaterThan(10)
    expect(converted.value).toBeLessThan(25)
  })

  it('angleBetweenPoints at right angle', () => {
    expect(
      angleBetweenPoints({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }),
    ).toBeCloseTo(90, 0)
  })

  it('midpoint averages coordinates', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('calibration', () => {
  it('computeBodySpanNormalized from vertex to malleolo', () => {
    const span = computeBodySpanNormalized([
      {
        id: '1',
        landmarkId: 'vertex',
        label: 'v',
        shortLabel: 'v',
        position: { x: 0.5, y: 0.06 },
        plane: 'frontale_anteriore',
        side: 'linea_mediana',
        category: 'head',
        confidence: 1,
      },
      {
        id: '2',
        landmarkId: 'malleolo_laterale_dx',
        label: 'm',
        shortLabel: 'm',
        position: { x: 0.44, y: 0.88 },
        plane: 'frontale_anteriore',
        side: 'destro',
        category: 'foot',
        confidence: 1,
      },
    ])
    expect(span).toBeCloseTo(0.82, 1)
  })
})

describe('myofascialInference frontale anteriore', () => {
  const baseLandmarks = (): PlacedLandmark[] => [
    {
      id: '1',
      landmarkId: 'acromion_dx',
      label: 'Acr D',
      shortLabel: 'AD',
      position: { x: 0.38, y: 0.2 },
      plane: 'frontale_anteriore',
      side: 'destro',
      category: 'shoulder_girdle',
      confidence: 0.9,
    },
    {
      id: '2',
      landmarkId: 'acromion_sx',
      label: 'Acr S',
      shortLabel: 'AS',
      position: { x: 0.62, y: 0.26 },
      plane: 'frontale_anteriore',
      side: 'sinistro',
      category: 'shoulder_girdle',
      confidence: 0.9,
    },
    {
      id: '3',
      landmarkId: 'sias_dx',
      label: 'SIAS D',
      shortLabel: 'SD',
      position: { x: 0.44, y: 0.48 },
      plane: 'frontale_anteriore',
      side: 'destro',
      category: 'pelvis',
      confidence: 0.9,
    },
    {
      id: '4',
      landmarkId: 'sias_sx',
      label: 'SIAS S',
      shortLabel: 'SS',
      position: { x: 0.56, y: 0.48 },
      plane: 'frontale_anteriore',
      side: 'sinistro',
      category: 'pelvis',
      confidence: 0.9,
    },
  ]

  it('generates absolute acromion tilt in degrees', () => {
    const findings = inferMyofascialAlterations(
      baseLandmarks(),
      'frontale_anteriore',
    )
    const tilt = findings.find((f) => f.id.includes('tilt_acromion'))
    expect(tilt).toBeDefined()
    expect(tilt?.unit).toBe('deg')
    expect(tilt?.referenceMode).toBe('absolute')
  })

  it('separates absolute and relative findings', () => {
    const findings = inferMyofascialAlterations(
      baseLandmarks(),
      'frontale_anteriore',
    )
    expect(findings.some((f) => f.referenceMode === 'absolute')).toBe(true)
    expect(findings.some((f) => f.referenceMode === 'relative')).toBe(true)
  })

  it('shows shift as preliminary % when scale is not calibrated', () => {
    const findings = inferMyofascialAlterations(
      [
        ...baseLandmarks(),
        {
          id: '5',
          landmarkId: 'vertex',
          label: 'Vtx',
          shortLabel: 'V',
          position: { x: 0.52, y: 0.08 },
          plane: 'frontale_anteriore',
          side: 'linea_mediana',
          category: 'head',
          confidence: 0.9,
        },
      ],
      'frontale_anteriore',
    )
    const shifts = findings.filter((f) => f.operator === 'shift')
    if (shifts.length > 0) {
      expect(shifts.every((f) => f.unit === 'px' && f.reportEligible === false)).toBe(true)
      expect(
        shifts.every((f) =>
          f.preliminaryReasons?.some((r) => r.includes('calibrat')),
        ),
      ).toBe(true)
    }
  })

  it('includes shift in cm when height is set', () => {
    const findings = inferMyofascialAlterations(
      [
        ...baseLandmarks(),
        {
          id: '5',
          landmarkId: 'vertex',
          label: 'Vtx',
          shortLabel: 'V',
          position: { x: 0.52, y: 0.08 },
          plane: 'frontale_anteriore',
          side: 'linea_mediana',
          category: 'head',
          confidence: 0.9,
        },
        {
          id: '6',
          landmarkId: 'malleolo_laterale_dx',
          label: 'MlD',
          shortLabel: 'MD',
          position: { x: 0.43, y: 0.88 },
          plane: 'frontale_anteriore',
          side: 'destro',
          category: 'foot',
          confidence: 0.9,
        },
        {
          id: '7',
          landmarkId: 'malleolo_laterale_sx',
          label: 'MlS',
          shortLabel: 'MS',
          position: { x: 0.57, y: 0.88 },
          plane: 'frontale_anteriore',
          side: 'sinistro',
          category: 'foot',
          confidence: 0.9,
        },
      ],
      'frontale_anteriore',
      undefined,
      { subjectHeightCm: 175 },
    )
    const shifts = findings.filter((f) => f.operator === 'shift')
    expect(shifts.length).toBeGreaterThan(0)
    expect(shifts.every((f) => f.unit === 'cm')).toBe(true)
  })
})
