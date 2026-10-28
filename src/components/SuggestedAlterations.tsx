import { Check, Sparkles } from 'lucide-react'
import { formatQuantitativeValue } from '@/data/clinicalThresholds'
import {
  CLINICAL_DIRECTION_LABELS,
  formatDirectionLabel,
} from '@/data/directionalDescriptors'
import {
  getFemoroTibialeVariantLabel,
  isFemoroTibialeAlteration,
} from '@/data/femoroTibialeDescriptors'
import type { AlterationSuggestion } from '@/utils/clinicalSuggestions'
import type { AlterationSelection, Side } from '@/types'
import { SEVERITY_LABELS } from '@/types'
import { Button } from '@/components/ui/button'

interface SuggestedAlterationsProps {
  suggestions: AlterationSuggestion[]
  selected: AlterationSelection[]
  onConfirm: (suggestion: AlterationSuggestion) => void
  onDismiss: (alterationId: string, side?: Side) => void
}

function suggestionKey(s: AlterationSuggestion): string {
  return `${s.alterationId}:${s.side ?? 'none'}:${s.descriptor ?? ''}:${s.direction ?? ''}`
}

function sideLabel(side?: Side): string | undefined {
  if (!side) return undefined
  return side === 'destro' ? 'Destro' : side === 'sinistro' ? 'Sinistro' : 'Bilaterale'
}

export function SuggestedAlterations({
  suggestions,
  selected,
  onConfirm,
  onDismiss,
}: SuggestedAlterationsProps) {
  const pending = suggestions.filter(
    (s) =>
      !selected.some(
        (a) =>
          a.suggestionKey === `${s.alterationId}:${s.side ?? 'none'}` || (a.alterationId === s.alterationId &&
          (a.source === 'confirmed' || a.source === 'manual' || a.status === 'excluded' || a.status === 'modified') &&
          (s.side === undefined || a.side === s.side)),
      ),
  )

  if (pending.length === 0) return null

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-2">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
        <Sparkles className="h-3 w-3" />
        Suggerimenti automatici
      </p>
      <p className="text-[10px] text-amber-800">
        Ipotesi da landmark — non diagnosi. Conferma o ignora.
      </p>
      <ul className="space-y-2">
        {pending.map((s) => {
          const q = formatQuantitativeValue(s.quantitative)
          const variantLabel =
            isFemoroTibialeAlteration(s.alterationId) && s.descriptor
              ? getFemoroTibialeVariantLabel({
                  descriptor: s.descriptor,
                  direction: s.direction,
                })
              : undefined
          const directionLabel =
            variantLabel && s.direction
              ? undefined
              : s.direction
                ? formatDirectionLabel(s.direction) ??
                  CLINICAL_DIRECTION_LABELS[s.direction]
                : undefined
          const lato = sideLabel(s.side)
          return (
            <li
              key={suggestionKey(s)}
              className="rounded border border-amber-100 bg-white p-2 text-xs"
            >
              <p className="font-medium text-slate-800">{s.label}</p>
              <p className="mt-0.5 text-[10px] text-slate-600">{s.reason}</p>
              <p className="mt-1 text-[10px] text-amber-900">
                Severità stimata: {SEVERITY_LABELS[s.severity]}
                {q ? ` · ${q}` : ''}
                {variantLabel ? ` · ${variantLabel}` : ''}
                {lato ? ` · ${lato}` : ''}
                {directionLabel ? ` · ${directionLabel}` : ''}
              </p>
              <div className="mt-2 flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-6 text-[10px]"
                  onClick={() => onConfirm(s)}
                >
                  <Check className="h-3 w-3" />
                  Conferma
                </Button>
                {(
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => onDismiss(s.alterationId, s.side)}
                  >
                    Escludi
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
