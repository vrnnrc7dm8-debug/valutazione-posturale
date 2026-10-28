import { useCallback, useMemo, useState } from 'react'
import {
  Crosshair,
  Eraser,
  Ruler,
  Trash2,
} from 'lucide-react'
import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import type { AnatomicalPlane, PhotoCalibration, StructuredLandmarkCollection } from '@/types'
import { createDefaultCalibration } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  calibrationFromMarkerDistance,
  computeBodySpanNormalized,
  resolveCalibration,
} from '@/utils/calibration'
import {
  clearAutoProposals,
  confirmProposalById,
  countAutoProposals,
  getAllLandmarks,
  getClinicalLandmarks,
  getDisplayLandmarks,
  resetLandmarkCollection,
  type LandmarkEditorDisplayMode,
} from '@/utils/landmarkCollection'
import {
  getEffectiveConfidence,
  resolveValidationState,
  VALIDATION_STATE_LABELS,
} from '@/utils/landmarkValidation'

export type LandmarkEditorMode = LandmarkEditorDisplayMode

interface LandmarkEditorProps {
  plane: AnatomicalPlane
  collection: StructuredLandmarkCollection
  mode: LandmarkEditorMode
  onModeChange: (mode: LandmarkEditorMode) => void
  onCollectionChange: (collection: StructuredLandmarkCollection) => void
  calibration?: PhotoCalibration
  subjectHeightCm?: number
  onCalibrationChange: (calibration: PhotoCalibration) => void
  onSubjectHeightChange?: (heightCm: number | undefined) => void
}

function correctionDelta(lm: import('@/types').PlacedLandmark): string | null {
  if (!lm.autoPosition) return null
  const dx = (lm.position.x - lm.autoPosition.x) * 100
  const dy = (lm.position.y - lm.autoPosition.y) * 100
  if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return null
  return `Δ auto ${dx >= 0 ? '+' : ''}${dx.toFixed(1)}% x, ${dy >= 0 ? '+' : ''}${dy.toFixed(1)}% y`
}

const MODE_LABELS: Record<LandmarkEditorMode, string> = {
  manual: 'Manuale assistita',
  semi_automatic: 'Manuale assistita',
  automatic: 'Manuale assistita',
}

function LandmarkResetDialog({
  open,
  onClose,
  onProposalsOnly,
  onAll,
}: {
  open: boolean
  onClose: () => void
  onProposalsOnly: () => void
  onAll: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <h4 className="text-sm font-semibold text-clinical-900">Reset landmark del piano</h4>
        <p className="mt-2 text-xs text-slate-600">
          Vuoi eliminare solo le proposte automatiche o anche i landmark confermati?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-start text-xs"
            onClick={() => {
              onProposalsOnly()
              onClose()
            }}
          >
            Solo proposte automatiche
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="justify-start text-xs"
            onClick={() => {
              onAll()
              onClose()
            }}
          >
            Proposte + landmark confermati/manuali
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={onClose}>
            Annulla
          </Button>
        </div>
      </div>
    </div>
  )
}

export function LandmarkEditor({
  plane,
  collection,
  mode,
  onModeChange: _onModeChange,
  onCollectionChange,
  calibration,
  subjectHeightCm,
  onCalibrationChange,
  onSubjectHeightChange,
}: LandmarkEditorProps) {
  const [resetOpen, setResetOpen] = useState(false)
  const [markerA, setMarkerA] = useState(calibration?.markerLandmarkA ?? '')
  const [markerB, setMarkerB] = useState(calibration?.markerLandmarkB ?? '')
  const [markerCm, setMarkerCm] = useState(
    calibration?.markerDistanceCm?.toString() ?? '',
  )

  const clinicalLandmarks = useMemo(() => getClinicalLandmarks(collection), [collection])
  const displayList = useMemo(
    () => getDisplayLandmarks(collection, mode),
    [collection, mode],
  )
  const pending = countAutoProposals(collection)
  const resolvedCal = useMemo(
    () => resolveCalibration(calibration, clinicalLandmarks, subjectHeightCm),
    [calibration, clinicalLandmarks, subjectHeightCm],
  )
  const bodySpan = useMemo(
    () => computeBodySpanNormalized(clinicalLandmarks),
    [clinicalLandmarks],
  )
  const catalog = useMemo(() => getLandmarksForPlane(plane), [plane])

  const confirmOne = useCallback(
    (id: string) => {
      onCollectionChange(confirmProposalById(collection, id))
    },
    [collection, onCollectionChange],
  )

  const updateHeight = (value: string) => {
    const parsed = value === '' ? undefined : Number(value)
    onSubjectHeightChange?.(parsed)
    onCalibrationChange(
      resolveCalibration(
        {
          ...(calibration ?? createDefaultCalibration()),
          mode: 'subject_height',
          subjectHeightCm: parsed,
        },
        clinicalLandmarks,
        parsed,
      ),
    )
  }

  const applyMarkerCalibration = () => {
    const distance = Number(markerCm)
    if (!markerA || !markerB || !distance || distance <= 0) return
    const next =
      calibrationFromMarkerDistance(clinicalLandmarks, markerA, markerB, distance) ??
      createDefaultCalibration()
    onCalibrationChange({
      ...next,
      markerLandmarkA: markerA,
      markerLandmarkB: markerB,
      markerDistanceCm: distance,
    })
  }

  return (
    <>
      <div className="shrink-0 space-y-3 border-b border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-clinical-900">
            <Crosshair className="h-3.5 w-3.5" />
            Landmark — {MODE_LABELS.manual}
          </h3>
        </div>

        <p className="text-[10px] text-slate-600">
          Posiziona e trascina i landmark sulla foto. Solo i punti manuali e confermati entrano
          nel referto clinico. Le proposte euristiche, se presenti, non generano referto
          definitivo.
        </p>

        {pending > 0 && (
          <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
            {pending} proposta/e euristica/he non confermata/e — esclusa/e dal referto.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={pending === 0}
            onClick={() => onCollectionChange(clearAutoProposals(collection))}
          >
            <Eraser className="h-3 w-3" />
            Cancella tutte le proposte euristiche
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px] text-red-800"
            onClick={() => setResetOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
            Reset landmark del piano
          </Button>
        </div>

        <div className="rounded border border-slate-200 bg-white p-2 space-y-2">
          <Label className="flex items-center gap-1 text-[10px] font-medium">
            <Ruler className="h-3 w-3" />
            Calibrazione scala
          </Label>
          <div>
            <Label htmlFor="subject-height" className="text-[9px] text-slate-500">
              Altezza soggetto (cm)
            </Label>
            <Input
              id="subject-height"
              type="number"
              min={0}
              step={1}
              className="mt-0.5 h-7 text-xs"
              placeholder="es. 175"
              value={subjectHeightCm ?? calibration?.subjectHeightCm ?? ''}
              onChange={(e) => updateHeight(e.target.value)}
            />
          </div>
          <div className="border-t border-slate-100 pt-2">
            <p className="mb-1 text-[9px] font-medium text-slate-600">Marker noto</p>
            <div className="grid grid-cols-2 gap-1">
              <Select value={markerA} onValueChange={setMarkerA}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue placeholder="Landmark A" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.shortLabel} — {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={markerB} onValueChange={setMarkerB}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue placeholder="Landmark B" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.shortLabel} — {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-1 flex gap-1">
              <Input
                type="number"
                min={0}
                step={0.1}
                className="h-7 flex-1 text-xs"
                placeholder="Distanza cm"
                value={markerCm}
                onChange={(e) => setMarkerCm(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={applyMarkerCalibration}
              >
                Applica
              </Button>
            </div>
          </div>
          <div className="text-[9px] text-slate-500 space-y-0.5">
            <p>Stato: {resolvedCal.label}</p>
            <p>
              Clinici: {clinicalLandmarks.length} · Proposte: {pending} · Totale:{' '}
              {getAllLandmarks(collection).length}
            </p>
            {bodySpan !== undefined && (
              <p>Span corporeo: {(bodySpan * 100).toFixed(0)}% immagine</p>
            )}
          </div>
        </div>

        {displayList.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1 text-[9px] text-slate-500">
              <span className="rounded bg-amber-100 px-1 text-amber-900">Proposta</span>
              <span className="rounded bg-emerald-100 px-1 text-emerald-900">Corretto</span>
              <span className="rounded bg-sky-100 px-1 text-sky-900">Clinico</span>
            </div>
            <ul className="max-h-36 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2">
              {displayList.map((lm) => {
                const delta = correctionDelta(lm)
                const state = resolveValidationState(lm)
                const conf = getEffectiveConfidence(lm)
                const isProposal = collection.autoProposals.some((p) => p.id === lm.id)
                return (
                  <li
                    key={lm.id}
                    className="flex items-start justify-between gap-2 rounded bg-slate-50 px-2 py-1 text-[10px]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-clinical-900">{lm.label}</p>
                      <p className="text-slate-500">
                        {isProposal ? 'Proposta euristica' : VALIDATION_STATE_LABELS[state]} ·
                        conf. {Math.round(conf * 100)}%
                      </p>
                      {delta && <p className="text-emerald-700">{delta}</p>}
                    </div>
                    {isProposal && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 shrink-0 px-1.5 text-[9px]"
                        onClick={() => confirmOne(lm.id)}
                      >
                        OK
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <LandmarkResetDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onProposalsOnly={() =>
          onCollectionChange(resetLandmarkCollection(collection, 'proposals_only'))
        }
        onAll={() => onCollectionChange(resetLandmarkCollection(collection, 'all'))}
      />
    </>
  )
}

/** Colore fill landmark: categoria anatomica; proposte euristiche in ambra. */
export function landmarkSourceColor(
  _lm: import('@/types').PlacedLandmark,
  categoryColor: string,
  isProposal = false,
): string {
  if (isProposal) return '#f59e0b'
  return categoryColor
}

export function landmarkSourceRingClass(
  _lm: import('@/types').PlacedLandmark,
  isProposal = false,
): string {
  if (isProposal) return 'ring-2 ring-dashed ring-amber-400'
  return ''
}

export { MODE_LABELS as LANDMARK_MODE_LABELS }
