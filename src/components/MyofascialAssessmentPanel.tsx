import { useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  Gauge,
  Layers,
  Ruler,
  ShieldCheck,
} from 'lucide-react'
import type { AnatomicalPlane, PhotoCalibration, StructuredLandmarkCollection } from '@/types'
import { getAllLandmarks, getClinicalLandmarks } from '@/utils/landmarkCollection'
import type { StructuredPosturalFinding } from '@/types/landmarks'
import { CLINICAL_AXIS_LABELS } from '@/types/landmarks'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { resolveCalibration } from '@/utils/calibration'
import {
  groupFindingsByClinicalAxis,
  inferMyofascialAlterations,
} from '@/utils/myofascialInference'
import {
  formatCategoryLabel,
  formatDirectionLabel,
  formatOperatorLabel,
  formatQuantitativeValue,
  formatReferenceLabel,
  groupFindingsByReportEligibility,
} from '@/utils/posturalFormatting'
import { UpperLimbClinicalSection } from '@/components/UpperLimbClinicalSection'
import { isUpperLimbFinding } from '@/utils/frontalUpperLimbAnalysis'

interface MyofascialAssessmentPanelProps {
  plane: AnatomicalPlane
  landmarkCollection: StructuredLandmarkCollection
  calibration?: PhotoCalibration
  subjectHeightCm?: number
  gravityLineX?: number
}

const SEVERITY_VARIANT: Record<
  StructuredPosturalFinding['severity'],
  'default' | 'outline' | 'lieve' | 'moderato' | 'severo'
> = {
  normal: 'outline',
  lieve: 'lieve',
  moderata: 'moderato',
  marcata: 'severo',
}

function FindingCard({
  finding,
  variant,
}: {
  finding: StructuredPosturalFinding
  variant: 'refertabile' | 'preliminare'
}) {
  const category = formatCategoryLabel(finding.clinicalCategory)
  const axisLabel = finding.clinicalAxis
    ? CLINICAL_AXIS_LABELS[finding.clinicalAxis]
    : null
  const isPreliminary = variant === 'preliminare'

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        isPreliminary
          ? 'border-amber-200 bg-amber-50/60'
          : 'border-emerald-200 bg-emerald-50/30'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-base font-semibold tabular-nums text-clinical-900">
          {formatQuantitativeValue(finding)}
        </span>
        <Badge variant={SEVERITY_VARIANT[finding.severity]}>
          {finding.severity}
        </Badge>
        <Badge variant="outline">{formatOperatorLabel(finding.operator)}</Badge>
        {category && <Badge variant="outline">{category}</Badge>}
        {axisLabel && (
          <Badge variant="outline" className="text-[10px]">
            {axisLabel}
          </Badge>
        )}
        <span className="text-xs text-slate-500">
          conf. {Math.round(finding.confidence * 100)}%
        </span>
      </div>
      <p className="font-medium text-clinical-900">{finding.segment}</p>
      <p className="mt-1 text-xs text-slate-600">
        {formatReferenceLabel(finding)} · {formatDirectionLabel(finding.direction)}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-400">
        Landmark: {finding.landmarksUsed.join(', ')}
      </p>
      {finding.preliminaryReasons && finding.preliminaryReasons.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[10px] text-amber-900">
          {finding.preliminaryReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      {finding.relatedMyofascialLines.length > 0 && (
        <p className="mt-2 text-xs text-clinical-700">
          <Layers className="mr-1 inline h-3 w-3" />
          {finding.relatedMyofascialLines.slice(0, 2).join(' · ')}
        </p>
      )}
      {finding.relatedMuscles.length > 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          {finding.relatedMuscles.slice(0, 4).join(', ')}
        </p>
      )}
      {finding.warnings && finding.warnings.length > 0 && !finding.preliminaryReasons && (
        <p className="mt-1 text-[10px] text-amber-800">{finding.warnings[0]}</p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-slate-700">
        {finding.interpretation}
      </p>
    </div>
  )
}

function ClinicalSection({
  title,
  description,
  icon: Icon,
  findings,
  variant,
  emptyMessage,
}: {
  title: string
  description: string
  icon: typeof ShieldCheck
  findings: StructuredPosturalFinding[]
  variant: 'refertabile' | 'preliminare'
  emptyMessage?: string
}) {
  return (
    <section
      className={`rounded-lg border p-3 ${
        variant === 'refertabile'
          ? 'border-emerald-200 bg-white'
          : 'border-amber-200 bg-amber-50/40'
      }`}
    >
      <div className="mb-3 flex items-start gap-2">
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            variant === 'refertabile' ? 'text-emerald-600' : 'text-amber-600'
          }`}
        />
        <div>
          <h4
            className={`text-xs font-bold tracking-wide ${
              variant === 'refertabile' ? 'text-emerald-800' : 'text-amber-900'
            }`}
          >
            {title}
          </h4>
          <p className="text-[10px] text-slate-600">{description}</p>
        </div>
        <Badge
          variant="outline"
          className={`ml-auto shrink-0 ${
            variant === 'refertabile' ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {findings.length}
        </Badge>
      </div>
      {findings.length === 0 ? (
        <p className="text-[10px] text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {findings.map((f) => (
            <FindingCard key={f.id} finding={f} variant={variant} />
          ))}
        </div>
      )}
    </section>
  )
}

function ClinicalAxisSection({
  findings,
}: {
  findings: StructuredPosturalFinding[]
}) {
  const byAxis = useMemo(() => groupFindingsByClinicalAxis(findings), [findings])
  const axes = Object.keys(byAxis) as Array<keyof typeof CLINICAL_AXIS_LABELS>
  if (axes.length === 0) return null

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold text-clinical-800">Assi clinici (panoramica)</p>
      {axes.map((axis) => (
        <div key={axis} className="text-[10px] text-slate-600">
          <span className="font-medium">{CLINICAL_AXIS_LABELS[axis]}:</span>{' '}
          {byAxis[axis]?.map((f) => f.segment).join(' · ')}
        </div>
      ))}
    </div>
  )
}

export function MyofascialAssessmentPanel({
  plane,
  landmarkCollection,
  calibration,
  subjectHeightCm,
  gravityLineX,
}: MyofascialAssessmentPanelProps) {
  const clinicalLandmarks = useMemo(
    () => getClinicalLandmarks(landmarkCollection),
    [landmarkCollection],
  )
  const inferenceLandmarks = useMemo(
    () => getAllLandmarks(landmarkCollection),
    [landmarkCollection],
  )

  const resolvedCalibration = useMemo(
    () => resolveCalibration(calibration, clinicalLandmarks, subjectHeightCm),
    [calibration, clinicalLandmarks, subjectHeightCm],
  )

  const findings = useMemo(
    () =>
      inferMyofascialAlterations(inferenceLandmarks, plane, undefined, {
        calibration: resolvedCalibration,
        subjectHeightCm,
        gravityLineX,
        collection: landmarkCollection,
      }),
    [
      inferenceLandmarks,
      plane,
      resolvedCalibration,
      subjectHeightCm,
      gravityLineX,
      landmarkCollection,
    ],
  )

  const { definitive, preliminary } = useMemo(
    () => groupFindingsByReportEligibility(findings),
    [findings],
  )

  const upperLimbFindings = useMemo(
    () => findings.filter(isUpperLimbFinding),
    [findings],
  )
  const coreDefinitive = useMemo(
    () => definitive.filter((f) => !isUpperLimbFinding(f)),
    [definitive],
  )
  const corePreliminary = useMemo(
    () => preliminary.filter((f) => !isUpperLimbFinding(f)),
    [preliminary],
  )

  const estimatedCount = landmarkCollection.autoProposals.length

  return (
    <Card className="border-clinical-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-clinical-600" />
          Valutazione quantitativa — frontale anteriore
        </CardTitle>
        <CardDescription className="text-xs">
          Aggiornamento immediato ad ogni proposta, correzione o conferma landmark
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-[10px]">
          <Badge variant="outline" className="gap-1">
            <Gauge className="h-3 w-3" />
            {findings.length} misura/e
          </Badge>
          <Badge variant="outline" className="gap-1 text-emerald-800">
            <ShieldCheck className="h-3 w-3" />
            {definitive.length} refertabile/i
          </Badge>
          {preliminary.length > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-800">
              <AlertTriangle className="h-3 w-3" />
              {preliminary.length} preliminare/i
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            <Ruler className="h-3 w-3" />
            {resolvedCalibration.label}
          </Badge>
          {estimatedCount > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-800">
              {estimatedCount} LM stimati
            </Badge>
          )}
        </div>

        {findings.length === 0 ? (
          <p className="text-xs text-slate-500">
            Proponi o posiziona landmark (semiautomatico consigliato), correggi se
            necessario e conferma per popolare la sezione REFERTABILE.
          </p>
        ) : (
          <div className="max-h-[32rem] space-y-3 overflow-y-auto">
            {upperLimbFindings.length > 0 && (
              <UpperLimbClinicalSection findings={upperLimbFindings} />
            )}
            <ClinicalSection
              title="REFERTABILE"
              description="Solo dati con landmark confermati o corretti e confidence ≥ soglia clinica. Inclusi nel referto definitivo."
              icon={ShieldCheck}
              findings={coreDefinitive}
              variant="refertabile"
              emptyMessage="Nessuna misura refertabile: conferma i landmark proposti o correggili manualmente."
            />
            <ClinicalSection
              title="PRELIMINARE"
              description="Landmark automatici non confermati, confidence insufficiente o shift senza scala calibrata. Esclusi dal referto definitivo."
              icon={AlertTriangle}
              findings={corePreliminary}
              variant="preliminare"
              emptyMessage="Nessuna stima preliminare pendente."
            />
            <ClinicalAxisSection findings={coreDefinitive} />
          </div>
        )}

        {!resolvedCalibration.shiftAvailable && findings.some((f) => f.operator === 'shift') && (
          <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900">
            Shift in cm richiedono calibrazione scala (altezza soggetto nel pannello
            Landmark). Fino ad allora compaiono in PRELIMINARE come % immagine.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
