import { AlterationInferencePreview } from '@/components/AlterationInferencePreview'
import { TissueAnalysisPreview } from '@/components/TissueAnalysisPreview'
import { formatAlterationInstanceSummary } from '@/data/directionalDescriptors'
import { getPlaneConfig } from '@/data/planes'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import type { AnatomicalPlane, PlaneAssessment, PlacedLandmark } from '@/types'
import {
  computeAutoMeasurements,
  type AutoMeasurement,
} from '@/utils/biomechanicsEngine'
import { isFrontalLowerLimbAutoMeasurementId } from '@/utils/frontalLowerLimbAnalysis'
import { analyzeMyofascialLinesForPlane, inferMyersForPlane } from '@/utils/myersEngine'
import { analyzeTissuesForPlane } from '@/utils/tissueAnalysis'
import { scorePlaneAssessment } from '@/utils/postureScoring'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PlaneClinicalPanelProps {
  plane: AnatomicalPlane
  assessment: PlaneAssessment
  landmarks: PlacedLandmark[]
}

export function PlaneClinicalPanel({
  plane,
  assessment,
  landmarks,
}: PlaneClinicalPanelProps) {
  const config = getPlaneConfig(plane)
  const normalized = landmarks.map((l) => ({
    ...l,
    landmarkId: l.landmarkId ?? (l as { type?: string }).type ?? '',
  }))
  const autoMs: AutoMeasurement[] = computeAutoMeasurements(plane, normalized).filter(
    (measurement) =>
      plane !== 'frontale_anteriore' ||
      !isFrontalLowerLimbAutoMeasurementId(measurement.id),
  )
  const score = scorePlaneAssessment(assessment, autoMs)
  const myers = analyzeMyofascialLinesForPlane(plane, assessment.alterations)
  const myersByAlteration = inferMyersForPlane(plane, assessment.alterations)
  const tissueAnalyses = analyzeTissuesForPlane(
    plane,
    assessment.alterations,
    myersByAlteration,
  )
  const planeTopTissues = tissueAnalyses
    .flatMap((a) => a.tissues)
    .sort((a, b) => b.score - a.score)

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

        {myers.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-clinical-800">
              Linee Myers ipotizzate (piano)
            </p>
            <div className="flex flex-wrap gap-1">
              {myers.slice(0, 4).map((m) => (
                <Badge key={m.lineId} variant={m.severity}>
                  {MYOFASCIAL_LINES[m.lineId].name.split(' ').slice(-2).join(' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {assessment.alterations.length > 0 && (
          <AlterationInferencePreview plane={plane} inferences={myersByAlteration} />
        )}

        {assessment.alterations.length > 0 && (
          <TissueAnalysisPreview
            plane={plane}
            analyses={tissueAnalyses}
            planeTopTissues={planeTopTissues}
          />
        )}

        {assessment.alterations.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-clinical-800">
              Alterazioni selezionate
            </p>
            <ul className="space-y-0.5 text-xs text-slate-600">
              {assessment.alterations.map((a) => (
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
