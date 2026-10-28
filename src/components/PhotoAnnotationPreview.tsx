import { useEffect, useRef, useState } from 'react'
import {
  getLandmarkDefinition,
  LANDMARK_CATEGORY_COLORS,
} from '@/data/anatomicalLandmarks'
import { normalizeLandmarkId } from '@/utils/analysisEngine'
import { FrameOverlaySvg } from '@/components/FrameOverlaySvg'
import { ImageAnnotationsSvg } from '@/components/ImageAnnotationsSvg'
import type { PhotoAnnotations, PlacedLandmark } from '@/types'
import { createDefaultImageView } from '@/types'
import {
  computeImageDisplayMetrics,
  computeTransformedImageRect,
} from '@/utils/geometry'
import { getAllLandmarks, countLandmarks, getClinicalLandmarks } from '@/utils/landmarkCollection'

interface PhotoAnnotationPreviewProps {
  imageUrl: string
  annotations: PhotoAnnotations
  className?: string
  /** Nella card upload usa vista centrata (ignora pan/zoom dell’editor). */
  useCenteredView?: boolean
}

export function PhotoAnnotationPreview({
  imageUrl,
  annotations,
  className,
  useCenteredView = false,
}: PhotoAnnotationPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const view = useCenteredView
    ? createDefaultImageView()
    : (annotations.imageView ?? createDefaultImageView())
  const { overlay } = annotations

  const baseMetrics =
    containerSize.w > 0 && imageSize.w > 0
      ? computeImageDisplayMetrics(
          containerSize.w,
          containerSize.h,
          imageSize.w,
          imageSize.h,
        )
      : null

  const imageRect = baseMetrics
    ? computeTransformedImageRect(baseMetrics, view)
    : null

  const previewLandmarks = getClinicalLandmarks(annotations.landmarks)

  const hasContent =
    countLandmarks(annotations.landmarks) > 0 ||
    annotations.lines.length > 0 ||
    annotations.angles.length > 0 ||
    overlay.showGrid ||
    overlay.showGravityLine ||
    overlay.showHorizontalRef

  if (!hasContent) return null

  const getLm = (id: string): PlacedLandmark | undefined =>
    getAllLandmarks(annotations.landmarks).find((l) => l.id === id)

  return (
    <div ref={containerRef} className={className}>
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-contain opacity-0"
        onLoad={(e) =>
          setImageSize({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }
      />
      {containerSize.w > 0 && (
        <FrameOverlaySvg
          containerWidth={containerSize.w}
          containerHeight={containerSize.h}
          overlay={overlay}
        />
      )}
      {imageRect && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: imageRect.left,
            top: imageRect.top,
            width: imageRect.width,
            height: imageRect.height,
          }}
        >
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-contain opacity-0"
          />
          <ImageAnnotationsSvg annotations={annotations} getLandmark={getLm} />
          {previewLandmarks.map((lm) => {
            const color =
              LANDMARK_CATEGORY_COLORS[lm.category] ??
              getLandmarkDefinition(normalizeLandmarkId(lm)).color
            return (
              <div
                key={lm.id}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
                style={{
                  left: `${lm.position.x * 100}%`,
                  top: `${lm.position.y * 100}%`,
                  backgroundColor: color,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
