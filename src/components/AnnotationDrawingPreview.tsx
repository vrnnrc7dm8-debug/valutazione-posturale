import type { PlacedLandmark, Point2D } from '@/types'
import { angleAtVertex, describeAngleArc } from '@/utils/geometry'
import {
  formatLineMeasurementLabel,
  type LineMeasurementReference,
} from '@/utils/lineMeasurements'

interface AnnotationDrawingPreviewProps {
  pendingLineStartId: string | null
  pendingAngleIds: string[]
  previewEnd: Point2D | null
  lineReference: LineMeasurementReference
  getLandmark: (id: string) => PlacedLandmark | undefined
}

const LINE_STROKE = '#38bdf8'
const ANGLE_STROKE = '#fbbf24'
const STROKE_WIDTH = 2
const STROKE_OPACITY = 0.9

export function AnnotationDrawingPreview({
  pendingLineStartId,
  pendingAngleIds,
  previewEnd,
  lineReference,
  getLandmark,
}: AnnotationDrawingPreviewProps) {
  const lineStart = pendingLineStartId
    ? getLandmark(pendingLineStartId)
    : undefined

  const angleVertex =
    pendingAngleIds.length >= 1
      ? getLandmark(pendingAngleIds[0])
      : undefined
  const angleArmA =
    pendingAngleIds.length >= 2
      ? getLandmark(pendingAngleIds[1])
      : undefined

  const showLinePreview =
    lineStart && previewEnd && pendingLineStartId && !pendingAngleIds.length

  const showAngleRayA = angleVertex && angleArmA
  const showAngleRayPreview =
    angleVertex && angleArmA && previewEnd && pendingAngleIds.length === 2

  let previewAngleDeg: number | null = null
  if (showAngleRayPreview && angleVertex && angleArmA) {
    previewAngleDeg = angleAtVertex(
      angleArmA.position,
      angleVertex.position,
      previewEnd,
    )
  }

  if (!showLinePreview && !showAngleRayA && !angleVertex) {
    return null
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      {showLinePreview && (
        <g opacity={STROKE_OPACITY}>
          <line
            x1={lineStart.position.x}
            y1={lineStart.position.y}
            x2={previewEnd.x}
            y2={previewEnd.y}
            stroke={LINE_STROKE}
            strokeWidth={STROKE_WIDTH}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="6 4"
          />
          <circle
            cx={lineStart.position.x}
            cy={lineStart.position.y}
            r={0.008}
            fill={LINE_STROKE}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={previewEnd.x}
            cy={previewEnd.y}
            r={0.007}
            fill="none"
            stroke={LINE_STROKE}
            strokeWidth={STROKE_WIDTH}
            vectorEffect="non-scaling-stroke"
          />
          <g
            transform={`translate(${(lineStart.position.x + previewEnd.x) / 2}, ${(lineStart.position.y + previewEnd.y) / 2}) scale(0.001)`}
          >
            <text
              x={0}
              y={-10}
              fill={LINE_STROKE}
              fontSize={13}
              fontWeight={600}
              textAnchor="middle"
              transform="scale(1000)"
            >
              {formatLineMeasurementLabel(
                lineStart.position,
                previewEnd,
                lineReference,
              )}
            </text>
          </g>
        </g>
      )}

      {angleVertex && pendingAngleIds.length >= 1 && (
        <g opacity={STROKE_OPACITY}>
          <circle
            cx={angleVertex.position.x}
            cy={angleVertex.position.y}
            r={0.009}
            fill={ANGLE_STROKE}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}

      {showAngleRayA && angleVertex && angleArmA && (
        <line
          x1={angleVertex.position.x}
          y1={angleVertex.position.y}
          x2={angleArmA.position.x}
          y2={angleArmA.position.y}
          stroke={ANGLE_STROKE}
          strokeWidth={STROKE_WIDTH}
          vectorEffect="non-scaling-stroke"
          opacity={STROKE_OPACITY}
        />
      )}

      {showAngleRayPreview && angleVertex && angleArmA && previewEnd && (
        <g opacity={STROKE_OPACITY}>
          <line
            x1={angleVertex.position.x}
            y1={angleVertex.position.y}
            x2={previewEnd.x}
            y2={previewEnd.y}
            stroke={ANGLE_STROKE}
            strokeWidth={STROKE_WIDTH}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="6 4"
          />
          {previewAngleDeg !== null && (
            <g transform={`scale(${1 / 1000})`}>
              <path
                d={describeAngleArc(
                  {
                    x: angleArmA.position.x * 1000,
                    y: angleArmA.position.y * 1000,
                  },
                  {
                    x: angleVertex.position.x * 1000,
                    y: angleVertex.position.y * 1000,
                  },
                  { x: previewEnd.x * 1000, y: previewEnd.y * 1000 },
                  28,
                )}
                fill="none"
                stroke={ANGLE_STROKE}
                strokeWidth={STROKE_WIDTH}
              />
              <text
                x={angleVertex.position.x * 1000 + 32}
                y={angleVertex.position.y * 1000 - 8}
                fill={ANGLE_STROKE}
                fontSize={13}
                fontWeight={600}
              >
                {previewAngleDeg.toFixed(1)}°
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  )
}
