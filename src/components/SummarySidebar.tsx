import { isReportStale } from '@/utils/reportGeneration'
import { Activity, Layers, User } from 'lucide-react'
import type { Assessment } from '@/types'
import { PLANE_LABELS, SEVERITY_LABELS } from '@/types'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createEmptyLandmarkCollection, countLandmarks } from '@/utils/landmarkCollection'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface SummarySidebarProps {
  assessment: Assessment
}

export function SummarySidebar({ assessment }: SummarySidebarProps) {
  const { patient, planeAssessments, myofascialResults, report } = assessment
  const totalAlterations = planeAssessments.reduce(
    (n, p) => n + p.alterations.length,
    0,
  )
  const photosCount = assessment.photos.filter((p) => p.dataUrl).length
  const landmarksCount = assessment.photos.reduce(
    (n, p) => n + countLandmarks(p.annotations?.landmarks ?? createEmptyLandmarkCollection()),
    0,
  )
  const planesWithData = planeAssessments.filter((p) => p.alterations.length > 0)

  return (
    <Card className="sticky top-4 h-fit max-h-[calc(100vh-2rem)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-clinical-600" />
          Riepilogo automatico
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-8rem)] px-6 pb-6">
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm">
              <User className="mt-0.5 h-4 w-4 text-clinical-500" />
              <div>
                <p className="font-medium">
                  {patient.nome || patient.cognome
                    ? `${patient.nome} ${patient.cognome}`.trim()
                    : 'Paziente non inserito'}
                </p>
                <p className="text-xs text-slate-500">
                  {patient.dataValutazione || '—'} · {patient.operatore || 'Operatore —'}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-clinical-50 p-2">
                <p className="text-lg font-bold text-clinical-700">{photosCount}</p>
                <p className="text-slate-500">Foto</p>
              </div>
              <div className="rounded-md bg-clinical-50 p-2">
                <p className="text-lg font-bold text-clinical-700">
                  {landmarksCount}
                </p>
                <p className="text-slate-500">Landmark</p>
              </div>
              <div className="rounded-md bg-clinical-50 p-2">
                <p className="text-lg font-bold text-clinical-700">
                  {totalAlterations}
                </p>
                <p className="text-slate-500">Alterazioni</p>
              </div>
            </div>

            {planesWithData.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-clinical-700">
                  <Layers className="h-3 w-3" />
                  Piani attivi
                </p>
                <ul className="space-y-1 text-xs text-slate-600">
                  {planesWithData.map((p) => (
                    <li key={p.plane}>
                      {PLANE_LABELS[p.plane]} ({p.alterations.length})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {myofascialResults.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-clinical-700">
                  Top meridiani (ipotesi)
                </p>
                <ul className="space-y-2">
                  {myofascialResults.slice(0, 5).map((r) => (
                    <li
                      key={r.lineId}
                      className="flex items-center justify-between gap-1 text-xs"
                    >
                      <span className="truncate">
                        {MYOFASCIAL_LINES[r.lineId].name}
                      </span>
                      <Badge variant={r.severity} className="shrink-0">
                        {SEVERITY_LABELS[r.severity]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report && (
              <div className="rounded-md border border-clinical-200 bg-clinical-50 p-3 text-xs">
                <p className="font-semibold text-clinical-800">{isReportStale(assessment) ? 'Report da rigenerare' : 'Report generato'}</p>
                <p className="mt-1 text-slate-600">
                  Priorità:{' '}
                  <span className="font-medium capitalize">
                    {report.priorityEvaluable === false ? 'Non valutabile' : report.therapeuticPriority}
                  </span>
                </p>
              </div>
            )}

            {!report && totalAlterations > 0 && (
              <p className="text-xs text-slate-500 italic">
                Premi &quot;Genera report&quot; per calcolare meridiani e scheda
                clinica.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
