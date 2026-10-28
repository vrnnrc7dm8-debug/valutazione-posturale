import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PlacedLandmark } from '@/types'
import { cn } from '@/lib/utils'

interface CollapsibleLandmarkPanelProps {
  landmarks: PlacedLandmark[]
  onRemove: (id: string) => void
  defaultOpen?: boolean
}

export function CollapsibleLandmarkPanel({
  landmarks,
  onRemove,
  defaultOpen = true,
}: CollapsibleLandmarkPanelProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-slate-200">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-clinical-800 hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Landmark ({landmarks.length})</span>
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all',
          open ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <ul className="max-h-40 space-y-1 overflow-y-auto px-3 pb-3">
          {landmarks.length === 0 ? (
            <li className="text-[10px] text-slate-500">Nessun landmark</li>
          ) : (
            landmarks.map((lm) => (
              <li
                key={lm.id}
                className="flex justify-between rounded bg-slate-50 px-2 py-1 text-[10px]"
              >
                <span className="truncate">{lm.label}</span>
                <button
                  type="button"
                  className="shrink-0 text-red-500"
                  onClick={() => onRemove(lm.id)}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
