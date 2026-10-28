import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getPlaneConfig } from '@/data/planes'
import type { AnatomicalPlane, PlaneAssessment, StructuredLandmarkCollection } from '@/types'
import { getAllLandmarks, getClinicalLandmarks } from '@/utils/landmarkCollection'
import { AlterationChecklist } from '@/components/AlterationChecklist'
import { AlterationSelector } from '@/components/AlterationSelector'
import { SuggestedAlterations } from '@/components/SuggestedAlterations'
import { PlaneClinicalPanel } from '@/components/PlaneClinicalPanel'
import { MyofascialAssessmentPanel } from '@/components/MyofascialAssessmentPanel'
import { UpperLimbClinicalSection } from '@/components/UpperLimbClinicalSection'
import { usePlaneAlterations } from '@/hooks/usePlaneAlterations'
import { computeAlterationSuggestions } from '@/utils/clinicalSuggestions'
import { resolveCalibration } from '@/utils/calibration'
import { inferMyofascialAlterations } from '@/utils/myofascialInference'
import { isUpperLimbFinding } from '@/utils/frontalUpperLimbAnalysis'
import type { PhotoCalibration } from '@/types'

interface AnnotationClinicalPanelProps {
  plane: AnatomicalPlane
  assessment: PlaneAssessment
  landmarkCollection: StructuredLandmarkCollection
  onAssessmentChange: (next: PlaneAssessment) => void
  calibration?: PhotoCalibration
  subjectHeightCm?: number
  gravityLineX?: number
}

export function AnnotationClinicalPanel({
  plane,
  assessment,
  landmarkCollection,
  onAssessmentChange,
  calibration,
  subjectHeightCm,
  gravityLineX,
}: AnnotationClinicalPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const config = getPlaneConfig(plane)
  const clinicalLandmarks = useMemo(
    () => getClinicalLandmarks(landmarkCollection),
    [landmarkCollection],
  )
  const {
    addAlteration,
    updateAlteration,
    confirmSuggestion,
    removeAlteration,
    removeSuggestedAlteration,
  } = usePlaneAlterations(plane, assessment, onAssessmentChange)

  const suggestions = useMemo(
    () => computeAlterationSuggestions(plane, clinicalLandmarks),
    [plane, clinicalLandmarks],
  )

  const inferenceLandmarks = useMemo(
    () => getAllLandmarks(landmarkCollection),
    [landmarkCollection],
  )
  const resolvedCalibration = useMemo(
    () => resolveCalibration(calibration, clinicalLandmarks, subjectHeightCm),
    [calibration, clinicalLandmarks, subjectHeightCm],
  )
  const upperLimbFindings = useMemo(() => {
    if (plane !== 'frontale_anteriore') return []
    return inferMyofascialAlterations(inferenceLandmarks, plane, undefined, {
      calibration: resolvedCalibration,
      subjectHeightCm,
      gravityLineX,
      collection: landmarkCollection,
    }).filter(isUpperLimbFinding)
  }, [
    plane,
    inferenceLandmarks,
    resolvedCalibration,
    subjectHeightCm,
    gravityLineX,
    landmarkCollection,
  ])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 bg-clinical-50 px-3 py-2">
        <h3 className="text-sm font-semibold text-clinical-900">
          Analisi clinica
        </h3>
        <p className="text-[10px] text-slate-500">
          {config.label} — alterazioni, Myers, tessuti · sincronizzato con scheda Analisi
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <PlaneClinicalPanel
          plane={plane}
          assessment={assessment}
          landmarks={clinicalLandmarks}
        />

        {upperLimbFindings.length > 0 && (
          <UpperLimbClinicalSection findings={upperLimbFindings} />
        )}

        <SuggestedAlterations
          suggestions={suggestions}
          selected={assessment.alterations}
          onConfirm={(s) =>
            confirmSuggestion(s.alterationId, {
              severity: s.severity,
              quantitative: s.quantitative,
              direction: s.direction,
              descriptor: s.descriptor,
              side: s.side,
            })
          }
          onDismiss={removeSuggestedAlteration}
        />

        <div>
          <p className="mb-1.5 text-xs font-medium text-clinical-800">
            Checklist alterazioni
          </p>
          <AlterationChecklist
            plane={plane}
            selected={assessment.alterations}
            onAdd={addAlteration}
            compact
          />
        </div>

        <AlterationSelector
          plane={plane}
          selected={assessment.alterations}
          onUpdate={updateAlteration}
          onRemove={removeAlteration}
        />

        {suggestions.length > 0 && (
          <p className="text-[10px] italic text-slate-500">
            {config.dominantPatternHints[0]}
          </p>
        )}

        {clinicalLandmarks.length === 0 && (
          <p className="rounded border border-dashed border-slate-300 p-2 text-[10px] text-slate-500">
            Posiziona landmark per attivare misure automatiche e suggerimenti
            (es. SIAS–SIPS, trago–C7).
          </p>
        )}

        <div className="border-t border-slate-200 pt-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <span>Landmark quantitativi (avanzato)</span>
            {advancedOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>
          {advancedOpen && (
            <div className="mt-2">
              <MyofascialAssessmentPanel
                plane={plane}
                landmarkCollection={landmarkCollection}
                calibration={calibration}
                subjectHeightCm={subjectHeightCm}
                gravityLineX={gravityLineX}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
