import { describe, expect, it } from 'vitest'
import {
  applyAutoProposals,
  confirmProposalById,
  createEmptyLandmarkCollection,
  getDisplayLandmarks,
} from '@/utils/landmarkCollection'
import { detectLandmarksAutomatic } from '@/utils/landmarkDetection'
import { normalizePlacedLandmark } from '@/utils/landmarkMigration'

describe('landmarkValidation with collection', () => {
  it('detectLandmarksAutomatic writes only to autoProposals', () => {
    const clinical = normalizePlacedLandmark(
      {
        id: 'v1',
        landmarkId: 'vertex',
        position: { x: 0.5, y: 0.06 },
        confidence: 1,
        detectionSource: 'manual',
      },
      'frontale_anteriore',
    )
    const collection = {
      confirmed: [],
      manual: [clinical],
      autoProposals: [],
    }
    const result = detectLandmarksAutomatic('frontale_anteriore', collection, {
      mode: 'semi_automatic',
    })
    expect(result.collection.manual).toHaveLength(1)
    expect(result.collection.autoProposals.length).toBeGreaterThan(0)
    expect(getDisplayLandmarks(result.collection, 'manual')).toHaveLength(1)
  })

  it('confirm moves proposal out of autoProposals bucket', () => {
    let collection = createEmptyLandmarkCollection()
    const result = detectLandmarksAutomatic('frontale_anteriore', collection, {
      mode: 'semi_automatic',
    })
    collection = result.collection
    const first = collection.autoProposals[0]
    expect(first).toBeDefined()
    collection = confirmProposalById(collection, first.id)
    expect(collection.autoProposals.some((p) => p.id === first.id)).toBe(false)
    expect(collection.confirmed.some((p) => p.landmarkId === first.landmarkId)).toBe(true)
  })
})

describe('frontAnteriorLandmarkEngine', () => {
  it('does not overwrite clinical landmarks when proposing', () => {
    const clinical = normalizePlacedLandmark(
      {
        id: 'v1',
        landmarkId: 'vertex',
        position: { x: 0.48, y: 0.05 },
        confidence: 1,
        detectionSource: 'manual',
      },
      'frontale_anteriore',
    )
    const collection = applyAutoProposals(
      { confirmed: [], manual: [clinical], autoProposals: [] },
      [],
    )
    const result = detectLandmarksAutomatic('frontale_anteriore', collection)
    const vtx = result.collection.manual.find((l) => l.landmarkId === 'vertex')
    expect(vtx?.position.x).toBe(0.48)
    expect(result.collection.autoProposals.some((p) => p.landmarkId === 'vertex')).toBe(false)
  })
})
