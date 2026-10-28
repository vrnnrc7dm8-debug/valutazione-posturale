import type { AnnotationOverlaySettings } from '@/types'

interface FrameOverlaySvgProps {
  containerWidth: number
  containerHeight: number
  overlay: AnnotationOverlaySettings
}

/** Griglia e linee di riferimento fisse rispetto al riquadro di analisi. */
export function FrameOverlaySvg({
  containerWidth,
  containerHeight,
  overlay,
}: FrameOverlaySvgProps) {
  if (containerWidth <= 0 || containerHeight <= 0) return null

  const gridLines: {
    x1: number
    y1: number
    x2: number
    y2: number
    major?: boolean
  }[] = []

  if (overlay.showGrid) {
    const n = overlay.gridDivisions
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const major = i === Math.floor(n / 2)
      const x = t * containerWidth
      const y = t * containerHeight
      gridLines.push({
        x1: x,
        y1: 0,
        x2: x,
        y2: containerHeight,
        major,
      })
      gridLines.push({
        x1: 0,
        y1: y,
        x2: containerWidth,
        y2: y,
        major,
      })
    }
  }

  const gravX = overlay.gravityLineX * containerWidth
  const horizY = overlay.horizontalRefY * containerHeight

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      width={containerWidth}
      height={containerHeight}
    >
      {overlay.showGrid &&
        gridLines.map((g, i) => (
          <line
            key={i}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            stroke={
              g.major ? 'rgba(148,163,184,0.55)' : 'rgba(148,163,184,0.28)'
            }
            strokeWidth={g.major ? 1 : 0.5}
          />
        ))}

      {overlay.showGravityLine && (
        <line
          x1={gravX}
          y1={0}
          x2={gravX}
          y2={containerHeight}
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="8 4"
          opacity={0.9}
        />
      )}

      {overlay.showHorizontalRef && (
        <line
          x1={0}
          y1={horizY}
          x2={containerWidth}
          y2={horizY}
          stroke="#06b6d4"
          strokeWidth={2}
          strokeDasharray="8 4"
          opacity={0.9}
        />
      )}
    </svg>
  )
}
