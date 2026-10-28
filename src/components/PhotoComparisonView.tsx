import { useMemo } from 'react'
import { X } from 'lucide-react'
import { normalizeLandmarkId } from '@/utils/analysisEngine'
import type { PhotoSlot } from '@/types'
import { PLANE_LABELS } from '@/types'
import { distanceNormalized } from '@/utils/geometry'
import { getClinicalLandmarks, countLandmarks } from '@/utils/landmarkCollection'
import { PhotoAnnotationPreview } from '@/components/PhotoAnnotationPreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PhotoComparisonViewProps {
  photo: PhotoSlot
  onClose: () => void
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function PhotoComparisonView({ photo, onClose }: PhotoComparisonViewProps) {
  const baseline = photo.baseline
  const current = photo

  const deltas = useMemo(() => {
    if (!baseline) return []
    const before = getClinicalLandmarks(baseline.annotations.landmarks)
    const after = getClinicalLandmarks(current.annotations.landmarks)
    const rows: {
      type: string
      side?: string
      before?: { x: number; y: number }
      after?: { x: number; y: number }
      shift: number | null
    }[] = []

    for (const b of before) {
      const match = after.find(
        (a) =>
          normalizeLandmarkId(a) === normalizeLandmarkId(b) && a.side === b.side,
      )
      const label = b.label
      rows.push({
        type: label,
        side: b.side,
        before: b.position,
        after: match?.position,
        shift: match
          ? distanceNormalized(b.position, match.position) * 100
          : null,
      })
    }
    for (const a of after) {
      const exists = before.some(
        (b) =>
          normalizeLandmarkId(b) === normalizeLandmarkId(a) && b.side === a.side,
      )
      if (!exists) {
        rows.push({
          type: `${a.label} (solo dopo)`,
          after: a.position,
          shift: null,
        })
      }
    }
    return rows
  }, [baseline, current.annotations.landmarks])

  if (!baseline?.dataUrl || !current.dataUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold text-clinical-900">
              Confronto prima / dopo
            </h2>
            <p className="text-xs text-slate-500">{PLANE_LABELS[photo.plane]}</p>
          </div>
          <Button type="button" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
            Chiudi
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Prima — {baseline.label}</Badge>
              <span className="text-[10px] text-slate-500">
                {formatDate(baseline.capturedAt)}
              </span>
            </div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-slate-900">
              <img
                src={baseline.dataUrl}
                alt="Prima"
                className="h-full w-full object-contain"
              />
              <PhotoAnnotationPreview
                imageUrl={baseline.dataUrl}
                annotations={baseline.annotations}
                className="absolute inset-0"
              />
            </div>
            <p className="text-xs text-slate-500">
              {countLandmarks(baseline.annotations.landmarks)} landmark ·{' '}
              {baseline.annotations.lines.length} linee ·{' '}
              {baseline.annotations.angles.length} angoli
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Badge variant="default">Dopo — attuale</Badge>
              <span className="text-[10px] text-slate-500">Oggi</span>
            </div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-slate-900">
              <img
                src={current.dataUrl}
                alt="Dopo"
                className="h-full w-full object-contain"
              />
              <PhotoAnnotationPreview
                imageUrl={current.dataUrl}
                annotations={current.annotations}
                className="absolute inset-0"
              />
            </div>
            <p className="text-xs text-slate-500">
              {countLandmarks(current.annotations.landmarks)} landmark ·{' '}
              {current.annotations.lines.length} linee ·{' '}
              {current.annotations.angles.length} angoli
            </p>
          </div>
        </div>

        <div className="border-t p-4">
          <h3 className="mb-2 text-sm font-semibold text-clinical-800">
            Spostamento landmark (% immagine)
          </h3>
          {deltas.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nessun landmark comparabile. Usa gli stessi tipi e lati in prima e
              dopo.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-1 pr-2">Landmark</th>
                    <th className="py-1 pr-2">Prima</th>
                    <th className="py-1 pr-2">Dopo</th>
                    <th className="py-1">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {deltas.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 font-medium">{row.type}</td>
                      <td className="py-1.5 pr-2 text-slate-600">
                        {row.before
                          ? `${(row.before.x * 100).toFixed(1)}%, ${(row.before.y * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-slate-600">
                        {row.after
                          ? `${(row.after.x * 100).toFixed(1)}%, ${(row.after.y * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="py-1.5">
                        {row.shift != null ? (
                          <span
                            className={
                              row.shift > 3
                                ? 'font-semibold text-amber-700'
                                : 'text-slate-600'
                            }
                          >
                            {row.shift.toFixed(2)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[10px] text-slate-400">
            Il confronto è indicativo sulla base delle coordinate normalizzate
            in foto. Non sostituisce misure strumentali.
          </p>
        </div>
      </div>
    </div>
  )
}
