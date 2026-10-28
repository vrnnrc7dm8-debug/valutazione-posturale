import { Activity } from 'lucide-react'
import { getPlaneConfig } from '@/data/planes'
import type {
  AnatomicalPlane,
  PlaneAssessment,
} from '@/types'
import { PLANE_LABELS } from '@/types'
import { AlterationChecklist } from '@/components/AlterationChecklist'
import { AlterationSelector } from '@/components/AlterationSelector'
import { PlaneClinicalPanel } from '@/components/PlaneClinicalPanel'
import { usePlaneAlterations } from '@/hooks/usePlaneAlterations'
import { computeAutoMeasurements } from '@/utils/biomechanicsEngine'
import { getAllLandmarks } from '@/utils/landmarkCollection'
import { isFrontalLowerLimbAutoMeasurementId } from '@/utils/frontalLowerLimbAnalysis'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PosturalPlaneAssessmentProps {
  planeAssessments: PlaneAssessment[]
  photos: { plane: AnatomicalPlane; annotations: import('@/types').PhotoAnnotations }[]
  onChange: (assessments: PlaneAssessment[]) => void
}

const TAB_PLANES: AnatomicalPlane[] = [
  'frontale_anteriore',
  'frontale_posteriore',
  'sagittale_destro',
  'sagittale_sinistro',
  'trasverso',
]

function PlaneAlterationEditor({
  plane,
  assessment,
  onAssessmentChange,
}: {
  plane: AnatomicalPlane
  assessment: PlaneAssessment
  onAssessmentChange: (next: PlaneAssessment) => void
}) {
  const { addAlteration, updateAlteration, removeAlteration } = usePlaneAlterations(
    plane,
    assessment,
    onAssessmentChange,
  )

  return (
    <div className="space-y-3">
      <AlterationChecklist
        plane={plane}
        selected={assessment.alterations}
        onAdd={addAlteration}
      />
      <AlterationSelector
        plane={plane}
        selected={assessment.alterations}
        onUpdate={updateAlteration}
        onRemove={removeAlteration}
      />
    </div>
  )
}

export function PosturalPlaneAssessment({
  planeAssessments,
  photos,
  onChange,
}: PosturalPlaneAssessmentProps) {
  const getAssessment = (plane: AnatomicalPlane) =>
    planeAssessments.find((p) => p.plane === plane)!

  const updateAssessment = (next: PlaneAssessment) => {
    onChange(
      planeAssessments.map((p) => (p.plane === next.plane ? next : p)),
    )
  }

  const totalAlterations = planeAssessments.reduce(
    (n, p) => n + p.alterations.length,
    0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-clinical-600" />
          Dashboard analisi clinica
        </CardTitle>
        <CardDescription>
          Riepilogo funzionale delle valutazioni. Le alterazioni si selezionano
          principalmente in <strong>Fotografie → Annota</strong> osservando il
          paziente; qui puoi rivedere, integrare e preparare il report.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-lg border border-clinical-200 bg-clinical-50/50 px-3 py-2 text-xs text-clinical-800">
          <strong>{totalAlterations}</strong> alterazioni confermate su{' '}
          {planeAssessments.filter((p) => p.alterations.length > 0).length}{' '}
          piani. Modifiche in Annota si riflettono qui in tempo reale.
        </div>

        <Tabs defaultValue="frontale_anteriore">
          <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
            {TAB_PLANES.map((plane) => {
              const count = getAssessment(plane).alterations.length
              const short = getPlaneConfig(plane).shortLabel
              return (
                <TabsTrigger key={plane} value={plane} className="gap-1 text-xs">
                  {short}
                  {count > 0 && (
                    <span className="rounded-full bg-clinical-600 px-1.5 text-[10px] text-white">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {TAB_PLANES.map((plane) => {
            const assessment = getAssessment(plane)
            const landmarks = getAllLandmarks(
              photos.find((p) => p.plane === plane)?.annotations.landmarks ?? {
                confirmed: [],
                manual: [],
                autoProposals: [],
              },
            )
            const autoMs = computeAutoMeasurements(plane, landmarks).filter(
              (measurement) =>
                plane !== 'frontale_anteriore' ||
                !isFrontalLowerLimbAutoMeasurementId(measurement.id),
            )

            return (
              <TabsContent key={plane} value={plane} className="space-y-4">
                <PlaneClinicalPanel
                  plane={plane}
                  assessment={assessment}
                  landmarks={landmarks}
                  onAssessmentChange={updateAssessment}
                />

                {autoMs.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold text-clinical-800">
                      Riepilogo biomeccanico automatico
                    </p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {autoMs.map((m) => (
                        <li key={m.id}>
                          {m.label}: {m.value}
                          {m.suggestion && (
                            <span className="block text-[10px] text-amber-700">
                              {m.suggestion}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium text-clinical-800">
                    {PLANE_LABELS[plane]} — integrazione alterazioni
                  </p>
                  <PlaneAlterationEditor
                    plane={plane}
                    assessment={assessment}
                    onAssessmentChange={updateAssessment}
                  />
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      </CardContent>
    </Card>
  )
}
