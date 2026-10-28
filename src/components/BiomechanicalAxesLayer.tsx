import type { BiomechanicalAxis } from '@/utils/biomechanicsEngine'

interface BiomechanicalAxesLayerProps {
  axes: BiomechanicalAxis[]
}

/** Assi biomeccanici nel layer immagine (coordinate normalizzate 0–1). */
export function BiomechanicalAxesLayer({ axes }: BiomechanicalAxesLayerProps) {
  if (axes.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      {axes.map((axis) => (
        <line
          key={axis.id}
          x1={axis.from.x}
          y1={axis.from.y}
          x2={axis.to.x}
          y2={axis.to.y}
          stroke={axis.color}
          strokeWidth={0.003}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="0.012 0.008"
          opacity={0.85}
        />
      ))}
    </svg>
  )
}
