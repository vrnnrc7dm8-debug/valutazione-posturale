import type { PlacedLandmark } from '@/types'
import { cn } from '@/lib/utils'
import {
  getEffectiveConfidence,
  resolveValidationState,
  VALIDATION_STATE_LABELS,
  type LandmarkValidationState,
} from '@/utils/landmarkValidation'

const STATE_STYLES: Record<
  LandmarkValidationState,
  { badge: string; dot: string }
> = {
  automatico_stimato: {
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    dot: 'bg-amber-500',
  },
  manuale_corretto: {
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-600',
  },
  manuale_confermato: {
    badge: 'bg-sky-100 text-sky-900 border-sky-300',
    dot: 'bg-sky-600',
  },
}

const STATE_SHORT: Record<LandmarkValidationState, string> = {
  automatico_stimato: 'Stimato',
  manuale_corretto: 'Corretto',
  manuale_confermato: 'Confermato',
}

interface LandmarkVisualIndicatorProps {
  landmark: PlacedLandmark
  /** Mostra badge esteso (hover/selezione). */
  expanded?: boolean
  className?: string
}

export function LandmarkVisualIndicator({
  landmark,
  expanded = false,
  className,
}: LandmarkVisualIndicatorProps) {
  const state = resolveValidationState(landmark)
  const conf = Math.round(getEffectiveConfidence(landmark) * 100)
  const styles = STATE_STYLES[state]

  if (!expanded) {
    return (
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-0 z-[36] -translate-x-1/2 -translate-y-full pb-0.5',
          className,
        )}
      >
        <div
          className={cn(
            'flex items-center gap-0.5 rounded-full border px-1 py-px text-[7px] font-semibold leading-none shadow-sm whitespace-nowrap',
            styles.badge,
          )}
          title={`${VALIDATION_STATE_LABELS[state]} · confidence ${conf}%`}
        >
          <span className={cn('h-1 w-1 shrink-0 rounded-full', styles.dot)} />
          <span>{STATE_SHORT[state]}</span>
          <span className="opacity-80">{conf}%</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-1/2 top-full z-[36] mt-1 -translate-x-1/2',
        className,
      )}
    >
      <div
        className={cn(
          'rounded border px-1.5 py-0.5 text-center text-[8px] leading-tight shadow-sm',
          styles.badge,
        )}
      >
        <p className="font-semibold">{VALIDATION_STATE_LABELS[state]}</p>
        <p className="opacity-90">conf. {conf}%</p>
      </div>
    </div>
  )
}

export { STATE_SHORT, STATE_STYLES }
