import { describe, expect, it } from 'vitest'
import type { PlacedLandmark } from '@/types'
import {
  applyAutoProposals,
  clearAutoProposalsOnModeChange,
  confirmProposalById,
  createEmptyLandmarkCollection,
  getClinicalLandmarks,
  getDisplayLandmarks,
  migrateFlatLandmarksToCollection,
  resetLandmarkCollection,
} from '@/utils/landmarkCollection'
import { confirmEstimatedLandmark, withValidationState } from '@/utils/landmarkValidation'
import { normalizePlacedLandmark } from '@/utils/landmarkMigration'

function proposal(id: string): PlacedLandmark {
  return withValidationState(
    normalizePlacedLandmark(
      {
        id,
        landmarkId: id,
        position: { x: 0.5, y: 0.3 },
        confidence: 0.45,
        detectionSource: 'automatic',
        needsConfirmation: true,
      },
      'frontale_anteriore',
    ),
  )
}

describe('landmarkCollection', () => {
  it('separates clinical landmarks from auto proposals', () => {
    const flat = [
      proposal('p1'),
      confirmEstimatedLandmark(
        normalizePlacedLandmark(
          {
            id: 'c1',
            landmarkId: 'vertex',
            position: { x: 0.5, y: 0.06 },
            confidence: 1,
          },
          'frontale_anteriore',
        ),
      ),
    ]
    const collection = migrateFlatLandmarksToCollection(flat)
    expect(collection.autoProposals).toHaveLength(1)
    expect(getClinicalLandmarks(collection)).toHaveLength(1)
  })

  it('manual mode hides auto proposals', () => {
    const collection = applyAutoProposals(createEmptyLandmarkCollection(), [proposal('p1')])
    expect(getDisplayLandmarks(collection, 'manual')).toHaveLength(0)
    expect(getDisplayLandmarks(collection, 'semi_automatic')).toHaveLength(1)
  })

  it('mode change clears unconfirmed proposals', () => {
    const collection = applyAutoProposals(createEmptyLandmarkCollection(), [proposal('p1')])
    const cleared = clearAutoProposalsOnModeChange(collection)
    expect(cleared.autoProposals).toHaveLength(0)
  })

  it('confirm moves proposal to confirmed bucket', () => {
    const p = proposal('p1')
    const collection = applyAutoProposals(createEmptyLandmarkCollection(), [p])
    const next = confirmProposalById(collection, p.id)
    expect(next.autoProposals).toHaveLength(0)
    expect(next.confirmed).toHaveLength(1)
  })

  it('reset supports proposals only or all', () => {
    const p = proposal('p1')
    const confirmed = confirmEstimatedLandmark(p)
    const collection = {
      confirmed: [confirmed],
      manual: [],
      autoProposals: [proposal('p2')],
    }
    expect(resetLandmarkCollection(collection, 'proposals_only').autoProposals).toHaveLength(0)
    expect(getClinicalLandmarks(resetLandmarkCollection(collection, 'proposals_only'))).toHaveLength(1)
    expect(resetLandmarkCollection(collection, 'all').confirmed).toHaveLength(0)
  })
})
