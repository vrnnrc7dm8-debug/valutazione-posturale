import { getAlterationLabel } from '@/data/planes'
import type { AlterationMyersInference, AnatomicalPlane } from '@/types'
import { formatAlterationMyersSummary } from '@/utils/myersEngine'

interface AlterationInferencePreviewProps {
  plane: AnatomicalPlane
  inferences: AlterationMyersInference[]
}

export function AlterationInferencePreview({
  plane,
  inferences,
}: AlterationInferencePreviewProps) {
  const withLines = inferences.filter((inf) => inf.lines.length > 0)
  if (withLines.length === 0) return null

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
        Myers per alterazione
      </p>
      <ul className="space-y-1.5">
        {withLines.map((inf) => {
          const topLine = inf.lines[0]
          const topTissue = topLine.tissues[0]
          return (
            <li
              key={inf.instanceId}
              className="rounded border border-violet-100 bg-white px-2 py-1.5 text-[10px] text-slate-700"
            >
              <p className="font-medium text-slate-800">
                {getAlterationLabel(plane, inf.alterationId)}
              </p>
              <p className="mt-0.5">{formatAlterationMyersSummary(plane, inf)}</p>
              {topTissue && (
                <p className="mt-0.5 text-violet-800">
                  {topLine.lineName.split(' ').slice(-2).join(' ')} · {topTissue.name}{' '}
                  {topTissue.side} · {topTissue.functionalState} (
                  {Math.round(topTissue.confidence * 100)}%)
                </p>
              )}
              {inf.lines.length > 1 && (
                <p className="mt-0.5 text-slate-500">
                  +{inf.lines.length - 1} altra/e linea/e correlate
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
