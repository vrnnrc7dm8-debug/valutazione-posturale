import { useMemo } from 'react'
import { AlertTriangle, Layers } from 'lucide-react'
import type { StructuredPosturalFinding } from '@/types/landmarks'
import { CLINICAL_AXIS_LABELS } from '@/types/landmarks'
import { Badge } from '@/components/ui/badge'
import {
  formatCategoryLabel,
  formatDirectionLabel,
  formatOperatorLabel,
  formatQuantitativeValue,
  formatReferenceLabel,
  groupFindingsByObservationType,
} from '@/utils/posturalFormatting'

const SEVERITY_VARIANT: Record<
  StructuredPosturalFinding['severity'],
  'default' | 'outline' | 'lieve' | 'moderato' | 'severo'
> = {
  normal: 'outline',
  lieve: 'lieve',
  moderata: 'moderato',
  marcata: 'severo',
}

function UpperLimbFindingCard({
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

interface UpperLimbClinicalSectionProps {
  findings: StructuredPosturalFinding[]
}

export function UpperLimbClinicalSection({ findings }: UpperLimbClinicalSectionProps) {
  const byType = useMemo(() => groupFindingsByObservationType(findings), [findings])
  if (findings.length === 0) return null

  const subsections: Array<{
    key: keyof ReturnType<typeof groupFindingsByObservationType>
    title: string
    description: string
  }> = [
    {
      key: 'osservazione_diretta',
      title: 'Osservazione diretta',
      description:
        'Posizione polso/mano, assi braccio e avambraccio, deviazioni misurabili senza inferenza rotazionale.',
    },
    {
      key: 'stima_biomeccanica',
      title: 'Stima biomeccanica',
      description:
        'Tendenza intra/extrarotazione solo con acromion, gomito, stiloide e dorso mano — stima da foto frontale.',
    },
    {
      key: 'inferenza_miofasciale',
      title: 'Inferenza miofasciale',
      description: 'Possibile coinvolgimento linee del braccio Myers e muscoli correlati.',
    },
  ]

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
      <div className="mb-3 flex items-start gap-2">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
        <div>
          <h4 className="text-xs font-bold tracking-wide text-violet-900">
            Arti superiori e linee del braccio
          </h4>
          <p className="text-[10px] text-slate-600">
            Orientamento biomeccanico dx/sx, polso/mano e linee miofasciali del braccio
          </p>
        </div>
        <Badge variant="outline" className="ml-auto shrink-0 text-violet-800">
          {findings.length}
        </Badge>
      </div>
      <div className="space-y-3">
        {subsections.map(({ key, title, description }) =>
          byType[key].length > 0 ? (
            <div key={key}>
              <p className="mb-1.5 text-[10px] font-semibold text-violet-900">{title}</p>
              <p className="mb-2 text-[9px] text-slate-500">{description}</p>
              <div className="space-y-2">
                {byType[key].map((f) => (
                  <UpperLimbFindingCard
                    key={f.id}
                    finding={f}
                    variant={f.reportEligible === false ? 'preliminare' : 'refertabile'}
                  />
                ))}
              </div>
            </div>
          ) : null,
        )}
      </div>
    </section>
  )
}
