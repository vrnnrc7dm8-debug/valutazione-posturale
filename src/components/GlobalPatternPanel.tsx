import { PATTERN_REGION_LABELS } from '@/utils/patternRecognition'
import type { PatternRecognitionResult } from '@/types/patternRecognition'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'

export function GlobalPatternPanel({ result, debug = false }: { result: PatternRecognitionResult; debug?: boolean }) {
  const globals=result.globalPatterns.filter(p=>p.reportEligible)
  return <section aria-label="Riconoscimento posturale regionale e globale" className="space-y-2 rounded border p-3 text-sm">
    <h3 className="font-semibold">Pattern posturali regionali e globali</h3>
    <p className="text-xs">Ipotesi fotografiche descrittive. Non sono diagnosi strutturali né indicano causalità ascendente/discendente. Myers utilizza solo riscontri confermati clinicamente.</p>
    <details><summary>PATTERN REGIONALI ({result.regionalPatterns.length})</summary>
      {result.regionalPatterns.map(r=><div key={r.id} className="my-2"><p>{PATTERN_REGION_LABELS[r.region]} · {r.severity} · {r.directions.join('; ')}{r.bilateralOrganization ? ` · Confronto DX/SX: ${r.bilateralOrganization}` : ''} · {r.confirmed?'reperti confermati':'ipotesi geometrica da verificare'}</p><p className="text-xs">Piani: {r.supportedPlanes.join(', ')}</p></div>)}
    </details>
    <div><h4 className="font-semibold">PATTERN GLOBALI ({globals.length})</h4>
      {!globals.length&&<p>Nessuna configurazione globale sufficientemente documentata.</p>}
      {globals.map(g=><article key={g.id} className="my-3 rounded border p-2">
        <p className="font-medium">{g.name} — {g.direction}</p>
        <p>{g.severity} · Indice funzionale stimato: {g.functionalIntensity}% (euristico, non anatomico)</p>
        <p className="text-xs">{g.confirmed?'Fonti confermate clinicamente':'Ipotesi fotografica da verificare; non alimenta automaticamente Myers'} · Riscontri indipendenti: {g.independentEvidenceCount} · Regioni: {g.regionsInvolved.map(r=>PATTERN_REGION_LABELS[r]).join(', ')} · Piani: {g.supportedPlanes.join(', ')}</p>
        <details><summary>Perché questo pattern?</summary>{g.explanation.map((text,i)=><p key={i} className="text-xs">{text}</p>)}<p className="text-xs">sourceObservationIds: {g.sourceObservationIds.join('; ')}</p><p className="text-xs">sourceMeasurementIds: {g.sourceMeasurementIds.join('; ')}</p><p className="text-xs">sourcePatternIds: {g.sourcePatternIds.join('; ')}</p></details>
        {g.myersCompatibility.length>0&&<p className="text-xs">Famiglie Myers da valutare dopo conferma: {g.myersCompatibility.map(id=>MYOFASCIAL_LINES[id].name).join(', ')}</p>}
        {g.consequences.map(text=><p key={text} className="text-xs">{text}</p>)}
      </article>)}
    </div>
    {debug&&<details><summary>Debug — potenziali pattern non risolti</summary>{result.unresolvedPotentialPatterns.map((u,i)=><p key={i} className="text-xs">{u.signatureId}: {u.reason} {u.missingEvidence.join(', ')}</p>)}</details>}
  </section>
}
