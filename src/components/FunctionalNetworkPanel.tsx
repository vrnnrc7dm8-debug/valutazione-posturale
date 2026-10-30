import type { FunctionalModel, FunctionalProvenance } from '@/types/functional'
import { formatOperatorDirection } from '@/data/clinicalOperators'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import { COMPARISON_LABELS, FUNCTIONAL_SEGMENT_LABELS, FUNCTIONAL_STATE_LABELS, functionalPercent, functionalProvenanceLines } from '@/utils/functionalFormat'

function Evidence({ value }: { value: FunctionalProvenance }) {
  return <details className="ml-2 text-xs"><summary>Evidenze e provenienza</summary>{functionalProvenanceLines(value).map((line, i) => <p key={i} className="break-words">{line}</p>)}</details>
}
export function FunctionalNetworkPanel({ model }: { model: FunctionalModel }) {
  return <section aria-label="Rete funzionale e pattern globali" className="space-y-3 rounded border p-3 text-sm">
    <h3 className="font-semibold">Organizzazione funzionale e pattern globali</h3>
    <p className="text-xs">{model.methodology}</p>
    <details><summary>MISURE — dati geometrici e snapshot registrati ({model.measurements.length})</summary>
      {model.measurements.map(m => <p key={m.id} className="text-xs">{m.label}: {m.available && m.value !== undefined ? `${m.value} ${m.unit ?? ''}` : 'non calcolabile'} · {m.origin === 'computed_geometry' ? 'geometria corrente' : 'snapshot registrato'} · {m.id}</p>)}
    </details>
    <details><summary>PATTERN LOCALI — reperti confermati ({model.localPatterns.length})</summary>
      {model.localPatterns.map(p => <div key={p.id} className="my-2"><p>{p.family} — {p.descriptor ? formatOperatorDirection(p.descriptor, p.direction) : 'operatore non registrato'} · {FUNCTIONAL_SEGMENT_LABELS[p.segment]} · {p.side ?? 'lato non specificato'} · {functionalPercent(p.index)}</p><p className="text-xs">Supporto multiplanare: {p.planes.length}/3 piani</p><Evidence value={p} /></div>)}
      <h4 className="font-semibold">Confronto omolaterale e controlaterale</h4>
      {model.comparisons.map(c => <div key={c.id} className="my-2"><p>{c.family}: {COMPARISON_LABELS[c.relation]}{c.normalSide ? ` · lato ${c.normalSide} nei limiti geometrici registrati` : ''}</p>{c.consequences.map(text => <p key={text} className="text-xs">{text}</p>)}<Evidence value={c} /></div>)}
    </details>
    <details><summary>PATTERN GLOBALI — rete di tensegrità, ipotesi ({model.globalPatterns.length})</summary>
      {!model.globalPatterns.length && <p>Nessun pattern globale sufficientemente supportato. Nessuna propagazione automatica.</p>}
      {model.globalPatterns.map(g => <div key={g.id} className="my-2"><p className="font-medium">{g.kind === 'global_tensegrity' ? 'Pattern globale di tensegrità' : g.kind === 'torsional' ? 'Pattern torsionale / crociato' : 'Continuità regionale supportata'}</p><p>Direzione: {g.direction ?? 'non determinabile'} · {functionalPercent(g.index)} · Coerenza multiplanare: {g.planes.length}/3</p><p>Componenti: {g.lineIds.map(id => MYOFASCIAL_LINES[id].name).join(', ') || 'da verificare'}</p>{g.consequences.map(text => <p key={text} className="text-xs">{text}</p>)}<Evidence value={g} /></div>)}
    </details>
    <details><summary>MYERS — binari e distribuzione segmentaria ({model.lines.length})</summary>
      {model.lines.map(l => <div key={l.lineId} className="my-2"><p className="font-medium">{MYOFASCIAL_LINES[l.lineId].name}</p><p>Indice globale: {functionalPercent(l.globalIndex)} · Direzione: {l.direction ?? 'non determinabile'} · Copertura: {l.coverage}% dei segmenti/lati</p>{l.segments.map(s => <p key={`${s.segment}:${s.side}`} className="text-xs">{FUNCTIONAL_SEGMENT_LABELS[s.segment]} · {s.side === 'undetermined' ? 'lato non determinabile' : s.side} · {functionalPercent(s.index)} · {s.state === 'mixed' ? 'stati misti' : FUNCTIONAL_STATE_LABELS[s.state]}</p>)}<Evidence value={l} /></div>)}
    </details>
    <details><summary>TESSUTI — stati funzionali presunti e incidenze ({model.tissues.length})</summary>
      {model.tissues.map(t => <div key={t.id} className="my-3"><p className="font-medium">{t.name} · {t.side} · {FUNCTIONAL_SEGMENT_LABELS[t.segment]}</p><p>Stato funzionale presunto: {FUNCTIONAL_STATE_LABELS[t.state]}</p><p>Indice locale: {functionalPercent(t.localIndex)}</p><p>Incidenza sul segmento: {functionalPercent(t.segmentIncidence)} · sulla linea globale: {functionalPercent(t.globalIncidence)}</p><p>Linee: {t.lineIds.map(id => MYOFASCIAL_LINES[id].name).join(', ')}</p><p>Relazione degli indici controlaterali: {COMPARISON_LABELS[t.contralateral]}</p>{t.antagonistTissueIds.length > 0 && <p>Relazioni antagoniste supportate: {t.antagonistTissueIds.map(id => model.tissues.find(other => other.id === id)?.name ?? id).join(', ')}</p>}{t.uncertainty.map(text => <p key={text} className="text-xs">{text}</p>)}<Evidence value={t} /></div>)}
    </details>
    <details><summary>CONSEGUENZE PRESUMIBILI E DISCORDANZE</summary>
      {model.conflicts.map((c, i) => <div key={i}><p>{c.message}</p><Evidence value={c} /></div>)}
      {[...new Set([...model.localPatterns.flatMap(l => l.consequences), ...model.globalPatterns.flatMap(g => g.consequences)])].map(text => <p key={text}>{text}</p>)}
    </details>
  </section>
}
