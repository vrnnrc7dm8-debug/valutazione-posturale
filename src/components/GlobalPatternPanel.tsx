import { GLOBAL_SUPPORT_LABELS } from '@/utils/clinicalCorroboration'
import { PATTERN_REGION_LABELS } from '@/utils/patternRecognition'
import type { PatternRecognitionResult } from '@/types/patternRecognition'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'

export function GlobalPatternPanel({ result, debug = false }: { result: PatternRecognitionResult; debug?: boolean }) {
  const globals=result.globalPatterns.filter(p=>p.reportEligible)
  return <section aria-label="Riconoscimento posturale regionale e globale" className="space-y-2 rounded border p-3 text-sm">
    <h3 className="font-semibold">Pattern posturali regionali e globali</h3>
    <p className="text-xs">Ipotesi fotografiche descrittive. Non sono diagnosi strutturali né indicano causalità ascendente/discendente. Myers utilizza solo riscontri confermati clinicamente.</p>
    <details><summary>PATTERN REGIONALI ({result.regionalPatterns.length})</summary>
      {result.regionalPatterns.map(r=><div key={r.id} className="my-2"><p>{r.name ?? PATTERN_REGION_LABELS[r.region]} · {r.severity} · {r.confirmed?'reperti confermati':'ipotesi geometrica da verificare'}</p><p>{r.interpretation}</p><details><summary>Perché questo pattern?</summary>{r.components?.map((text,i)=><p key={i}>{text}</p>)}</details><p className="text-xs">Piani: {r.supportedPlanes.join(', ')}</p></div>)}
    </details>
    <div><h4 className="font-semibold">PATTERN GLOBALI ({globals.length})</h4>
      {!globals.length&&<p>Nessuna configurazione globale sufficientemente documentata.</p>}
      {globals.map(g=><article key={g.id} className="my-3 rounded border p-2">
        <p className="font-medium">{g.name} — {g.direction}{g.prevalentSide ? ` · Bilaterale, prevalenza ${g.prevalentSide==='sinistro'?'SX':'DX'}` : ''}</p>
        <p>{g.severity} · Indice funzionale stimato: {g.functionalIntensity}% (euristico, non anatomico)</p>
        <p className="text-xs">{g.corroboration?.eligible?'Pattern corroborato clinicamente dalle fonti disponibili':g.confirmed?'Fonti confermate clinicamente':'Ipotesi fotografica non ancora sufficientemente corroborata'} · Riscontri indipendenti: {g.independentEvidenceCount} · Regioni: {g.regionsInvolved.map(r=>PATTERN_REGION_LABELS[r]).join(', ')} · Piani: {g.supportedPlanes.join(', ')}</p>
        <details><summary>Perché questo pattern?</summary>{g.supportScore!==undefined&&<p>Supporto stimato: {Math.round(g.supportScore*100)}% · {g.supportTypes?.map(t=>GLOBAL_SUPPORT_LABELS[t]).join('; ')}</p>}{g.explanation.map((text,i)=><p key={i} className="text-xs">{text}</p>)}{debug && <details><summary>Dettagli tecnici</summary><p className="text-xs">sourceObservationIds: {g.sourceObservationIds.join('; ')}</p><p className="text-xs">sourceMeasurementIds: {g.sourceMeasurementIds.join('; ')}</p><p className="text-xs">sourcePatternIds: {g.sourcePatternIds.join('; ')}</p></details>}</details>
        {g.myersCompatibility.length>0&&<p className="text-xs">Compatibilità Myers del pattern: {g.myersCompatibility.map(id=>MYOFASCIAL_LINES[id].name).join(', ')}</p>}
        {g.consequences.map(text=><p key={text} className="text-xs">{text}</p>)}
      </article>)}
    </div>
    {debug&&<details><summary>Debug — potenziali pattern non risolti</summary>{result.unresolvedPotentialPatterns.map((u,i)=><p key={i} className="text-xs">{u.signatureId}: {u.reason} {u.missingEvidence.join(', ')}</p>)}</details>}
  </section>
}
