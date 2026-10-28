import { getAlterationLabel } from '@/data/planes'
import type { AlterationTissueAnalysis, AnatomicalPlane } from '@/types'
import { TISSUE_STATE_LABELS } from '@/types'
import { formatAlterationTissueSummary } from '@/utils/tissueAnalysis'

interface TissueAnalysisPreviewProps {
  plane: AnatomicalPlane
  analyses: AlterationTissueAnalysis[]
  /** Tessuti aggregati a livello piano (opzionale). */
  planeTopTissues?: AlterationTissueAnalysis['tissues']
}

export function TissueAnalysisPreview({
  plane,
  analyses,
  planeTopTissues,
}: TissueAnalysisPreviewProps) {
  const withTissues = analyses.filter((a) => a.tissues.length > 0)
  if (withTissues.length === 0 && !planeTopTissues?.length) return null

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
        Analisi tessuti molli
      </p>

      {planeTopTissues && planeTopTissues.length > 0 && (
        <div className="mb-2 rounded border border-emerald-100 bg-white px-2 py-1.5">
          <p className="text-[10px] font-medium text-slate-800">Priorità piano</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {planeTopTissues.slice(0, 5).map((t, index) => (
              <li
                key={`${t.name}-${t.side}-${index}`}
                className="rounded bg-emerald-100/80 px-1.5 py-0.5 text-[10px] text-emerald-900"
              >
                {t.name} {t.side} · {TISSUE_STATE_LABELS[t.functionalState]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {withTissues.length > 0 && (
        <ul className="space-y-1.5">
          {withTissues.map((analysis) => (
            <li
              key={analysis.instanceId}
              className="rounded border border-emerald-100 bg-white px-2 py-1.5 text-[10px] text-slate-700"
            >
              <p className="font-medium text-slate-800">
                {getAlterationLabel(plane, analysis.alterationId)}
              </p>
              <p className="mt-0.5">{formatAlterationTissueSummary(plane, analysis)}</p>
              {analysis.tissues.length > 1 && (
                <ul className="mt-1 space-y-0.5 text-emerald-800">
                  {analysis.tissues.slice(0, 4).map((t, index) => (
                    <li key={`${t.name}-${t.side}-${index}`}>
                      {t.name} {t.side} · {TISSUE_STATE_LABELS[t.functionalState]} (
                      {Math.round(t.confidence * 100)}%)
                      {t.sourceLineNames.length > 0 && (
                        <span className="text-slate-500">
                          {' '}
                          · {t.sourceLineNames[0]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
