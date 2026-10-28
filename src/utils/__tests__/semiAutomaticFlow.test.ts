import { describe, expect, it } from 'vitest'
import type { Assessment, PlacedLandmark } from '@/types'
import {
  applyAutoProposals,
  confirmAllProposals,
  createEmptyLandmarkCollection,
  getClinicalLandmarks,
} from '@/utils/landmarkCollection'
import {
  inferMyofascialAlterations,
  filterReportEligibleFindings,
} from '@/utils/myofascialInference'
import {
  buildQuantitativeReportSections,
  enrichClinicalReportWithQuantitativeFindings,
} from '@/utils/reportGenerator'
import type { ClinicalReportData } from '@/types'
import { normalizePlacedLandmark } from '@/utils/landmarkMigration'

function baseLm(overrides: Partial<PlacedLandmark>): PlacedLandmark {
  return normalizePlacedLandmark(
    {
      id: '1',
      landmarkId: 'vertex',
      label: 'Vertex',
      shortLabel: 'Vtx',
      position: { x: 0.5, y: 0.06 },
      confidence: 1,
      ...overrides,
    },
    'frontale_anteriore',
  )
}

function symmetricCollection(kind: 'proposals' | 'confirmed'): ReturnType<typeof createEmptyLandmarkCollection> {
  const ids = [
    'vertex',
    'acromion_dx',
    'acromion_sx',
    'sias_dx',
    'sias_sx',
    'trago_dx',
    'trago_sx',
    'linea_sternale',
    'ombelico',
    'arco_costale_dx',
    'arco_costale_sx',
    'rotula_dx',
    'rotula_sx',
    'malleolo_laterale_dx',
    'malleolo_laterale_sx',
    'manubrio',
  ]

  let collection = createEmptyLandmarkCollection()
  const placed = ids.map((id, i) =>
    baseLm({
      id: String(i),
      landmarkId: id,
      position:
        id.includes('_dx')
          ? { x: 0.4, y: 0.3 }
          : id.includes('_sx')
            ? { x: 0.6, y: 0.3 }
            : { x: 0.5, y: 0.3 },
      ...(kind === 'proposals'
        ? {
            validationState: 'automatico_stimato' as const,
            detectionSource: 'automatic' as const,
            needsConfirmation: true,
            confidence: 0.45,
          }
        : {}),
    }),
  )

  if (kind === 'proposals') {
    collection = applyAutoProposals(collection, placed)
  } else {
    collection = confirmAllProposals(applyAutoProposals(collection, placed))
  }

  return collection
}

describe('semi-automatic UX flow', () => {
  it('after manual confirm, findings move from preliminary to refertabile', () => {
    let collection = symmetricCollection('proposals')
    const acrSx = collection.autoProposals.find((l) => l.landmarkId === 'acromion_sx')
    if (acrSx) acrSx.position.y = 0.36

    const before = inferMyofascialAlterations(
      [...getClinicalLandmarks(collection), ...collection.autoProposals],
      'frontale_anteriore',
      undefined,
      { subjectHeightCm: 175, gravityLineX: 0.5, collection },
    )
    expect(filterReportEligibleFindings(before).length).toBe(0)

    collection = confirmAllProposals(collection)
    const after = inferMyofascialAlterations(getClinicalLandmarks(collection), 'frontale_anteriore', undefined, {
      subjectHeightCm: 175,
      gravityLineX: 0.5,
      collection,
    })
    expect(filterReportEligibleFindings(after).length).toBeGreaterThan(0)
  })

  it('reportGenerator includes only reportEligible findings', () => {
    const collection = symmetricCollection('proposals')
    const acrSx = collection.autoProposals.find((l) => l.landmarkId === 'acromion_sx')
    if (acrSx) acrSx.position.y = 0.36

    const assessment = {
      photos: [
        {
          plane: 'frontale_anteriore' as const,
          annotations: { landmarks: collection },
        },
      ],
      defaultSubjectHeightCm: 175,
    } as unknown as Assessment

    expect(buildQuantitativeReportSections(assessment).flatMap((s) => s.findings).length).toBe(0)

    const confirmed = symmetricCollection('confirmed')
    const acrSxConfirmed = [...confirmed.confirmed, ...confirmed.manual].find(
      (l) => l.landmarkId === 'acromion_sx',
    )
    if (acrSxConfirmed) acrSxConfirmed.position.y = 0.36
    const confirmedAssessment = {
      ...assessment,
      photos: [{ ...assessment.photos[0], annotations: { landmarks: confirmed } }],
    } as Assessment

    expect(
      buildQuantitativeReportSections(confirmedAssessment).flatMap((s) => s.findings).length,
    ).toBeGreaterThan(0)

    const report = enrichClinicalReportWithQuantitativeFindings(
      { sections: [], integrationNotes: '' } as unknown as ClinicalReportData,
      confirmedAssessment,
    )
    expect(report.quantitativePosturalFindings?.every((f) => f.reportEligible !== false)).toBe(true)
  })
})
