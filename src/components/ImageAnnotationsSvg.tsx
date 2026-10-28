import type { PhotoAnnotations, PlacedLandmark, Point2D } from '@/types'
import { angleAtVertex, describeAngleArc } from '@/utils/geometry'
import {
  formatLineMeasurementLabel,
  resolveLineReference,
} from '@/utils/lineMeasurements'

interface ImageAnnotationsSvgProps {
  annotations: PhotoAnnotations
  getLandmark: (id: string) => PlacedLandmark | undefined
}

const LINE_STROKE = '#0ea5e9'
const ANGLE_STROKE = '#f59e0b'
const STROKE_WIDTH = 2
const STROKE_OPACITY = 0.85
const SCALE = 1000

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function toScaled(p: Point2D): { x: number; y: number } {
  return { x: p.x * SCALE, y: p.y * SCALE }
}

/** Linee e angoli in coordinate normalizzate immagine (0–1), sopra foto e griglia. */
export function ImageAnnotationsSvg({
  annotations,
  getLandmark,
}: ImageAnnotationsSvgProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      {annotations.lines.map((line) => {
        const a = getLandmark(line.landmarkAId)
        const b = getLandmark(line.landmarkBId)
        if (!a || !b) return null
        const reference = resolveLineReference(line.reference)
        const pa = toScaled(a.position)
        const pb = toScaled(b.position)
        const pm = toScaled(midpoint(a.position, b.position))
        const label = formatLineMeasurementLabel(a.position, b.position, reference)
        return (
          <g key={line.id} opacity={STROKE_OPACITY} transform={`scale(${1 / SCALE})`}>
            <line
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={LINE_STROKE}
              strokeWidth={STROKE_WIDTH}
            />
            <circle cx={pa.x} cy={pa.y} r={5} fill={LINE_STROKE} />
            <circle cx={pb.x} cy={pb.y} r={5} fill={LINE_STROKE} />
            <text
              x={pm.x}
              y={pm.y - 10}
              fill={LINE_STROKE}
              fontSize={13}
              fontWeight={600}
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        )
      })}

      {annotations.angles.map((ang) => {
        const a = getLandmark(ang.landmarkAId)
        const v = getLandmark(ang.vertexLandmarkId)
        const c = getLandmark(ang.landmarkCId)
        if (!a || !v || !c) return null
        const deg = angleAtVertex(a.position, v.position, c.position)
        const pa = toScaled(a.position)
        const pv = toScaled(v.position)
        const pc = toScaled(c.position)
        return (
          <g key={ang.id} opacity={STROKE_OPACITY} transform={`scale(${1 / SCALE})`}>
            <line
              x1={pv.x}
              y1={pv.y}
              x2={pa.x}
              y2={pa.y}
              stroke={ANGLE_STROKE}
              strokeWidth={STROKE_WIDTH}
            />
            <line
              x1={pv.x}
              y1={pv.y}
              x2={pc.x}
              y2={pc.y}
              stroke={ANGLE_STROKE}
              strokeWidth={STROKE_WIDTH}
            />
            <path
              d={describeAngleArc(pa, pv, pc, 28)}
              fill="none"
              stroke={ANGLE_STROKE}
              strokeWidth={STROKE_WIDTH}
            />
            <circle cx={pv.x} cy={pv.y} r={6} fill={ANGLE_STROKE} />
            <text
              x={pv.x + 32}
              y={pv.y - 8}
              fill={ANGLE_STROKE}
              fontSize={13}
              fontWeight={600}
            >
              {deg.toFixed(1)}°
            </text>
          </g>
        )
      })}
    </svg>
  )
}
