import { formatPattern, formatTissueState, observationSummaries } from '@/utils/clinicalPipeline'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import { ReportPhotograph, type ReportImageSize } from '@/components/ReportPhotograph'
import { anthropometryReportLines } from '@/utils/anthropometry'
import { AlertTriangle } from 'lucide-react'
import type { Assessment, ClinicalFinding } from '@/types'
import { SEVERITY_LABELS, TISSUE_STATE_LABELS } from '@/types'
import { MyofascialResultCard } from '@/components/MyofascialResultCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface ClinicalReportProps {
  assessment: Assessment
  generating?: boolean
  error?: string
  photoSizes?: Record<string, ReportImageSize>
  stale?: boolean
}

const PRIORITY_VARIANT = {
  bassa: 'lieve' as const,
  media: 'moderato' as const,
  alta: 'severo' as const,
}

function StructuredFindingCard({ finding }: { finding: ClinicalFinding }) {
  return (
    <li className="rounded-lg border border-clinical-200 bg-white px-3 py-2 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-medium text-clinical-900">{finding.alterationLabel}</span>
        <Badge variant={finding.severity}>{SEVERITY_LABELS[finding.severity]}</Badge>
      </div>
      <p className="leading-relaxed text-slate-700">{finding.narrative}</p>
      {finding.topMyersLine && (
        <p className="mt-1.5 text-xs text-violet-800">
          Myers: {finding.topMyersLine.lineName} ({finding.topMyersLine.side}) ·{' '}
          {TISSUE_STATE_LABELS[finding.topMyersLine.functionalState]}
        </p>
      )}
      {finding.topTissues.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {finding.topTissues.slice(0, 3).map((t, index) => (
            <Badge key={`${t.name}-${t.side}-${index}`} variant="outline" className="text-[10px]">
              {t.name} {t.side} · {TISSUE_STATE_LABELS[t.functionalState]}
            </Badge>
          ))}
        </div>
      )}
    </li>
  )
}

export function ClinicalReport({ assessment, generating = false, error = '', stale = false, photoSizes }: ClinicalReportProps) {
  const { report } = assessment

  if (!report) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          {generating ? <p role="status">Elaborazione del report clinico in corso…</p> : error ? <p role="alert" className="text-red-700">{error}</p> : <>Genera il report per visualizzare l&apos;output clinico per piano.</>}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6" aria-busy={generating}>
      {generating && <p role="status">Elaborazione del report clinico in corso…</p>}
      {error && <p role="alert" className="rounded border border-red-300 p-3 text-red-700">{error}</p>}
      {stale && <p role="status" className="rounded border border-amber-300 p-3 text-amber-900">La valutazione è stata modificata dopo il report. I risultati qui sotto appartengono alla generazione precedente: premi Rigenera report per aggiornarli ed esportarli.</p>}
      {report.generatedAt && <p className="text-xs text-slate-500">Report generato: {report.generatedAt}</p>}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="flex gap-3 pt-6">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">{report.disclaimer}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Scheda ipotesi funzionale posturale e miofasciale</CardTitle>
              <CardDescription>
                {assessment.patient.nome} {assessment.patient.cognome} — organizzata
                per piano anatomico
              </CardDescription>
            </div>
            <Badge variant={PRIORITY_VARIANT[report.therapeuticPriority]}>
              {report.priorityEvaluable === false ? 'Priorità non valutabile: dati insufficienti' : `Priorità globale ${report.therapeuticPriority}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <section aria-label="Dati essenziali paziente" className="rounded-lg border p-4 text-sm">
            <p>Codice clinico: {assessment.patient.codiceClinico || assessment.patient.id}</p>
            <p>Data valutazione: {assessment.patient.dataValutazione || '—'} · Età: {assessment.patient.eta === '' ? '—' : assessment.patient.eta} · Sesso: {assessment.patient.sesso || '—'}</p>
            {assessment.patient.noteCliniche && <p>Note cliniche: {assessment.patient.noteCliniche}</p>}
            {assessment.patient.operatore && <p>Operatore: {assessment.patient.operatore}</p>}
          </section>
          {anthropometryReportLines(assessment).length > 0 && <section aria-label="Dati antropometrici" className="rounded-lg border p-4 text-sm">
            {anthropometryReportLines(assessment).map(line => <p key={line}>{line}</p>)}
          </section>}
          <h3 className="font-semibold">{report.clinicalPipeline ? 'A. Misure oggettive per piano' : 'Analisi per piano'}</h3>
          {report.sections.map((section) => (
            <section key={section.plane} aria-label={`Report piano ${section.planeLabel}`} className="rounded-xl border border-slate-200 p-4">

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-clinical-900">
                  {section.planeLabel}
                </h3>
                <Badge variant={PRIORITY_VARIANT[section.therapeuticPriority]}>
                  {section.priorityEvaluable === false ? 'Priorità non valutabile' : `Priorità ${section.therapeuticPriority}`}
                </Badge>
              </div>
              {(() => {
                const photo = (report.photographs ?? (stale ? [] : assessment.photos)).find(p => p.plane === section.plane && p.dataUrl)
                return photo ? <ReportPhotograph photo={photo} size={photoSizes?.[photo.plane]} /> : null
              })()}
              {section.dataAvailability && <div className="mb-3 text-sm text-slate-600">
                <p>{section.dataAvailability.note}</p>
                <p>Landmark validati disponibili: {section.dataAvailability.clinicalLandmarks}. Esclusi o non utilizzabili: {section.dataAvailability.excludedLandmarks}.</p>
              </div>}
              {(section.recordedMeasurements?.length ?? 0) > 0 && <div className="mb-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Misure registrate nella valutazione</p>
                <ul className="text-sm">{section.recordedMeasurements?.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>}
              {!report.clinicalPipeline && <p className="mb-3 text-sm text-slate-600">
                <span className="font-medium">Pattern dominante:</span>{' '}
                {section.dominantPattern}
              </p>}

              {!report.clinicalPipeline && section.observedAlterations.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                    Alterazioni registrate
                  </p>
                  <ul className="space-y-1 text-sm">
                    {section.observedAlterations.map((a, i) => (
                      <li key={i} className="rounded bg-slate-50 px-2 py-1">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {section.structuredFindings && section.structuredFindings.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                    Ipotesi interpretative integrate (Myers e tessuti)
                  </p>
                  <ul className="space-y-2">
                    {section.structuredFindings.map((f) => (
                      <StructuredFindingCard key={f.instanceId} finding={f} />
                    ))}
                  </ul>
                </div>
              )}

              {section.autoMeasurements.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                    Misure e indici derivati da landmark validati
                  </p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {section.autoMeasurements.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!report.clinicalPipeline && section.myersLines.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                    Linee Myers (ipotesi)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {section.myersLines.map((m, i) => (
                      <div
                        key={i}
                        className="rounded border border-clinical-200 bg-clinical-50 px-2 py-1 text-xs"
                      >
                        <span className="font-medium">{m.name}</span> —{' '}
                        {SEVERITY_LABELS[m.severity]}
                        <p className="text-slate-500">{m.tissues.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!report.clinicalPipeline && section.compensationNotes.length > 0 && (
                <p className="text-xs italic text-slate-500">
                  {section.compensationNotes.join(' ')}
                </p>
              )}
            </section>
          ))}

          {report.quantitativePosturalFindings &&
            report.quantitativePosturalFindings.length > 0 && (
              <section className="space-y-2">
                <p className="font-medium text-clinical-800">
                  {report.clinicalPipeline ? 'Misure quantitative aggiuntive' : 'Reperti derivati: misure, indici e ipotesi'}
                </p>
                <ul className="space-y-2">
                  {report.quantitativePosturalFindings.filter(f => !report.clinicalPipeline || f.observationType !== 'inferenza_miofasciale').map((f) => (
                    <li
                      key={f.id}
                      className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-clinical-900">{f.segment}</p>
                      <p className="text-xs text-slate-600">
                        {f.observationType === 'inferenza_miofasciale' ? 'Ipotesi miofasciale' : f.observationType === 'osservazione_diretta' ? 'Osservazione geometrica' : 'Indice biomeccanico derivato'} · {f.operator} {f.referenceMode} · {f.value.toFixed(1)}
                        {f.unit === 'deg' ? '°' : f.unit} · {f.severity}
                      </p>
                      {!report.clinicalPipeline && <p className="mt-1 text-xs text-slate-700">{f.interpretation}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}


          {report.clinicalPipeline && <>
            <section><h3 className="font-semibold">B. Osservazioni posturali</h3>
              {observationSummaries(report.clinicalPipeline.observations).map(text => <p key={text}>{text}</p>)}
            </section>
            <section><h3 className="font-semibold">C. Pattern consolidati</h3>
              {report.clinicalPipeline.patterns.map(p => <p key={p.id}>{formatPattern(p)} · {p.observationIds.length} osservazioni</p>)}
            </section>
            <section><h3 className="font-semibold">D. Ipotesi miofasciali</h3>
              {report.alteredMeridians.map(m => <p key={m.lineId}>{MYOFASCIAL_LINES[m.lineId].name} · {m.prevalentSide}</p>)}
            </section>
            <section><h3 className="font-semibold">E. Tessuti correlati</h3>
              {report.clinicalPipeline.tissues.map(t => <div key={`${t.tissueId}:${t.side}`} className="my-2 text-sm"><p>{formatTissueState(t)}</p><p className="text-xs">Linee: {t.sourceLineIds.map(id => MYOFASCIAL_LINES[id].name).join(', ')}</p><p className="text-xs">Evidenze: {t.evidence.map(id => { const p = report.clinicalPipeline!.patterns.find(p => p.id === id); return p ? formatPattern(p) : id }).join('; ')}</p></div>)}
            </section>
          </>}

          <Separator />

          {!report.clinicalPipeline && <> <section>
            <h3 className="mb-3 text-sm font-semibold text-clinical-800">
              Meridiani miofasciali globali (Myers)
            </h3>
            {report.alteredMeridians.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun meridiano con score significativo.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {report.alteredMeridians.map((r) => (
                  <MyofascialResultCard key={r.lineId} result={r} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-clinical-800">
              Ipotesi di coinvolgimento dei tessuti molli
            </h3>
            <div className="flex flex-wrap gap-1">
              {(report.rankedTissueFindings ?? []).slice(0, 12).map((t, index) => (
                <Badge key={`${t.name}-${t.side}-${index}`} variant="default">
                  {t.name} {t.side} · {t.functionalState}
                </Badge>
              ))}
              {!report.rankedTissueFindings?.length &&
                report.topSoftTissues.map((t) => (
                  <Badge key={t} variant="default">
                    {t}
                  </Badge>
                ))}
            </div>
          </section>

          <section className="space-y-2 rounded-lg bg-clinical-50 p-4 text-sm">
            <p className="font-medium text-clinical-800">Compensi globali</p>
            <p>{report.primaryCompensationHypothesis}</p>
            <ul className="list-inside list-disc text-slate-700">
              {report.secondaryCompensationHypotheses.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>

          </>}
          {report.aiReady && (
            <p className="text-xs text-slate-400">
              AI: landmark detection{' '}
              {report.aiReady.landmarkDetectionReady ? 'pronto' : '—'} · pattern{' '}
              {report.aiReady.patternClassificationReady ? 'attivo' : 'in preparazione'}
            </p>
          )}

          <p className="text-xs text-slate-500">{report.integrationNotes}</p>
        </CardContent>
      </Card>
    </div>
  )
}
