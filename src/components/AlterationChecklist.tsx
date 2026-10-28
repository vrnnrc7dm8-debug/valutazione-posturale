import { Plus } from 'lucide-react'
import { getAlterationsForPlane } from '@/data/planes'
import type { AlterationSelection, AnatomicalPlane } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AlterationChecklistProps {
  plane: AnatomicalPlane
  selected: AlterationSelection[]
  onAdd: (alterationId: string) => void
  compact?: boolean
}

export function AlterationChecklist({
  plane,
  selected,
  onAdd,
  compact = false,
}: AlterationChecklistProps) {
  const alterations = getAlterationsForPlane(plane)

  return (
    <div className={compact ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-2'}>
      {alterations.map((alt) => {
        const instances = selected.filter((s) => s.alterationId === alt.id)
        const count = instances.length
        const hasConfirmed = instances.some((s) => s.source === 'confirmed')
        const hasSuggested = instances.some((s) => s.source === 'suggested')

        return (
          <Button
            key={alt.id}
            type="button"
            size="sm"
            variant={count > 0 ? 'default' : 'outline'}
            className={`text-xs h-auto py-1.5 ${hasSuggested ? 'ring-1 ring-amber-400' : ''} ${hasConfirmed ? 'ring-1 ring-emerald-400' : ''}`}
            onClick={() => onAdd(alt.id)}
            title={
              count > 0
                ? `Aggiungi altra istanza (${count} presente${count > 1 ? 'i' : ''})`
                : 'Aggiungi alterazione'
            }
          >
            <Plus className="h-3 w-3 shrink-0" />
            {alt.label}
            {count > 0 && (
              <Badge
                variant="outline"
                className="ml-1 h-4 min-w-4 border-white/40 bg-white/20 px-1 text-[9px] leading-none text-inherit"
              >
                {count}
              </Badge>
            )}
          </Button>
        )
      })}
    </div>
  )
}
