import { SYNTHPOSE_KEYPOINT_NAMES, SYNTHPOSE_MODEL } from '@/data/synthposeLandmarkMapping'
import type { AnatomicalPlane } from '@/types'
import type { SynthposeResult } from '@/utils/synthposeAdapter'

/** Synthetic marker grid: never derived from a patient's photograph. */
export function synthposeFixture(plane: AnatomicalPlane = 'frontale_anteriore'): SynthposeResult {
  return {
    model: SYNTHPOSE_MODEL, modelVersion: 'synthetic-test', device: 'cpu', plane,
    imageWidth: 400, imageHeight: 800, thresholds: { minimum: 0.5, high: 0.75 },
    keypoints: SYNTHPOSE_KEYPOINT_NAMES.map((name, index) => ({
      index, name, xPx: 100 + index, yPx: 200 + index, xNormalized: (100 + index) / 400,
      yNormalized: (200 + index) / 800, confidence: 0.9,
    })),
  }
}
