import { AutomaticObservationsPanel } from './AutomaticObservationsPanel'
import { isReportEligibleLandmark } from '@/utils/landmarkValidation'
import { AlterationSelector } from './AlterationSelector'
import { runClinicalPipeline, formatPattern, formatTissueState, patternSelection, applyClinicalEdit, formatMyersEvidence, formatTissueSupport } from '@/utils/clinicalPipeline'
import { formatAlterationInstanceSummary } from '@/data/directionalDescriptors'
import { getPlaneConfig } from '@/data/planes'
import type { AnatomicalPlane, PlaneAssessment, PlacedLandmark } from '@/types'
import {
  computeAutoMeasurements,
  type AutoMeasurement,
} from '@/utils/biomechanicsEngine'
import { scorePlaneAssessment } from '@/utils/postureScoring'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PlaneClinicalPanelProps {
  plane: AnatomicalPlane
  assessment: PlaneAssessment
  landmarks: PlacedLandmark[]
  onAssessmentChange?: (next: PlaneAssessment) => void
}

export function PlaneClinicalPanel({
  plane,
  assessment,
  landmarks,
  onAssessmentChange,
}: PlaneClinicalPanelProps) {
  const config = getPlaneConfig(plane)
  const normalized = landmarks.filter(isReportEligibleLandmark).map((l) => ({
    ...l,
    landmarkId: l.landmarkId ?? (l as { type?: string }).type ?? '',
  }))
  const autoMs: AutoMeasurement[] = computeAutoMeasurements(plane, normalized)
  const pipeline = runClinicalPipeline([assessment], autoMs)
  const consolidated = pipeline.consolidatedPlanes[0]
  const score = scorePlaneAssessment(consolidated, plane === 'frontale_anteriore' ? [] : autoMs)

  return (
    <Card className="border-clinical-200 bg-clinical-50/30">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{config.label}</CardTitle>
            <CardDescription>
              Valutazioni e parametri dedicati a questo piano
            </CardDescription>
          </div>
          <Badge
            variant={
              score.priority === 'alta'
                ? 'severo'
                : score.priority === 'media'
                  ? 'moderato'
                  : 'lieve'
            }
          >
            Priorità {score.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold text-clinical-800">
            Focus biomeccanico
          </p>
          <ul className="list-inside list-disc text-xs text-slate-600">
            {config.biomechanicalFocus.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>

        {autoMs.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-clinical-800">
              Misurazioni automatiche ({landmarks.length} landmark)
            </p>
            <ul className="space-y-1">
              {autoMs.map((m) => (
                <li
                  key={m.id}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  <span className="font-medium">{m.label}:</span> {m.value}
                  {m.severity !== 'normale' && (
                    <span className="ml-1 text-amber-700">
                      ({m.severity})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {onAssessmentChange && <AutomaticObservationsPanel
          observations={pipeline.observations.filter(o => o.source === 'automatic_measurement')}
          onDecision={observation => onAssessmentChange({ ...assessment,
            observations: [...(assessment.observations ?? []).filter(o => o.id !== observation.id), observation],
          })} />}
        {pipeline.inferences.some(i => i.lines.length) && <div>
          <p className="text-xs font-semibold">Linee Myers ipotizzate e origine</p>
          <ul>{formatMyersEvidence(pipeline.patterns, pipeline.inferences).map((text, i) => <li key={i} className="my-1 text-xs">{text}</li>)}</ul>
        </div>}

        <div>
          <p className="font-semibold">Pattern consolidati</p>
          {pipeline.patterns.map(p => <p key={p.id}>{formatPattern(p)} · {p.observationIds.length} osservazioni</p>)}
          {onAssessmentChange && <AlterationSelector plane={plane} selected={pipeline.patterns.map(patternSelection)}
            onUpdate={(id, patch) => {
              const ids = new Set(pipeline.patterns.find(p => p.id === id)?.observationIds)
              onAssessmentChange({ ...assessment, alterations: assessment.alterations.map(a => ids.has(a.instanceId) ? applyClinicalEdit(a, patch) : a), observations: assessment.observations?.map(o => ids.has(o.id) ? { ...o, descriptor: patch.descriptor ?? o.descriptor, side: 'side' in patch ? patch.side : o.side, direction: 'direction' in patch ? patch.direction : o.direction, district: patch.district ?? o.district, severity: patch.severity ?? o.severity, notes: patch.note ?? o.notes, status: patch.status ?? 'modified' } : o) })
            }}
            onRemove={id => {
              const ids = new Set(pipeline.patterns.find(p => p.id === id)?.observationIds)
              onAssessmentChange({ ...assessment, alterations: assessment.alterations.filter(a => !ids.has(a.instanceId)), observations: assessment.observations?.filter(o => !ids.has(o.id)) })
            }} />}
          <p className="mt-2 font-semibold">Tessuti correlati (ipotesi)</p>
          {pipeline.tissues.map(t => <div key={`${t.tissueId}:${t.side}`} className="my-2 text-xs"><p>{formatTissueState(t)}</p>{formatTissueSupport(t, pipeline.patterns).map((text, i) => <p key={i}>{text}</p>)}</div>)}
        </div>

        {assessment.alterations.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-clinical-800">
              Alterazioni selezionate
            </p>
            <ul className="space-y-0.5 text-xs text-slate-600">
              {assessment.alterations.filter(a => a.status !== 'excluded').map((a) => (
                <li key={a.instanceId}>
                  {config.alterations.find((x) => x.id === a.alterationId)?.label}
                  {' — '}
                  {formatAlterationInstanceSummary(a)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] italic text-slate-500">
          {config.dominantPatternHints[0]}
        </p>
      </CardContent>
    </Card>
  )
}
