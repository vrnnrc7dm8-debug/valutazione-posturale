/** Garantisce annotazioni valide (editor con foto vuota / dati legacy). */
import type { ImageViewState, PhotoAnnotations } from '@/types'
import { createDefaultOverlay, createEmptyAnnotations } from '@/types'
import {
  createEmptyLandmarkCollection,
  isStructuredLandmarkCollection,
} from '@/utils/landmarkCollection'

export function normalizePhotoAnnotations(
  raw?: Partial<PhotoAnnotations> | null,
): PhotoAnnotations {
  const base = createEmptyAnnotations()
  if (!raw) return base

  const view = (raw.imageView ?? {}) as Partial<ImageViewState>
  const zoomRaw = Number(view.zoom)

  let landmarks = base.landmarks
  if (isStructuredLandmarkCollection(raw.landmarks)) {
    landmarks = raw.landmarks
  } else if (Array.isArray(raw.landmarks)) {
    landmarks = createEmptyLandmarkCollection()
  }

  return {
    landmarks,
    lines: Array.isArray(raw.lines) ? raw.lines : [],
    angles: Array.isArray(raw.angles) ? raw.angles : [],
    overlay: {
      ...createDefaultOverlay(),
      ...(raw.overlay ?? {}),
    },
    imageView: {
      panX: Number.isFinite(Number(view.panX)) ? Number(view.panX) : 0,
      panY: Number.isFinite(Number(view.panY)) ? Number(view.panY) : 0,
      zoom:
        Number.isFinite(zoomRaw) && zoomRaw > 0
          ? Math.min(5, Math.max(0.25, zoomRaw))
          : 1,
    },
  }
}
