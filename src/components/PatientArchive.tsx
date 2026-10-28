import { useCallback, useEffect, useRef, useState } from 'react'
import type { Assessment, Patient } from '@/types'
import { getPatient, listAssessments, listRevisions, managePatient, loadAssessmentFromStorage, patientDirectory, type EvaluationSummary, type RevisionSummary, type PatientDirectory } from '@/storage/clinicalStorage'
import { createEmptyAssessment } from '@/utils/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function PatientArchive({ onOpen, revision = 0, activeCode }: { onOpen: (load: () => Promise<Assessment>) => Promise<void>; revision?: number; activeCode?: string }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [archived, setArchived] = useState(false)
  const [directory, setDirectory] = useState<PatientDirectory>({ patients: [], total: 0, offset: 0, limit: 25 })
  const [selected, setSelected] = useState<Patient | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([])
  const [revisions, setRevisions] = useState<{id: number; entries: RevisionSummary[]} | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [management, setManagement] = useState(false)
  const [backup, setBackup] = useState<{backupId?: string; verified?: boolean; evaluations?: number; files?: number} | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    const id = ++requestId.current
    setBusy(true); setError('')
    try { const result = await patientDirectory(search, offset, archived); if (id === requestId.current) setDirectory(result) }
    catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : 'Archivio non disponibile.') }
    finally { if (id === requestId.current) setBusy(false) }
  }, [search, offset, archived])
  const invalidate = useCallback(() => { requestId.current++ }, [])
  useEffect(() => { const timer = setTimeout(() => { void refresh() }, 0); return () => { clearTimeout(timer); invalidate() } }, [refresh, revision, invalidate])
  async function run(work: () => Promise<void>) {
    setBusy(true); setError('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'Operazione non riuscita.') }
    finally { setBusy(false) }
  }
  async function changeStatus(action: 'archive' | 'restore') {
    if (!selected || !confirm(action === 'archive' ? 'Archiviare questo paziente senza cancellare dati?' : 'Ripristinare il paziente nell’elenco attivo?')) return
    await managePatient(selected.id, action); setSelected(null); setManagement(false); await refresh()
  }
  return <section className="space-y-4 rounded-lg border bg-white p-4" aria-label="Archivio pazienti" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Archivio pazienti</h2><Button variant="outline" disabled={busy} onClick={() => void refresh()}>Aggiorna archivio</Button></div>
    <div className="flex gap-2"><Button variant={!archived ? 'default' : 'outline'} onClick={() => { setArchived(false); setOffset(0); setSelected(null) }}>Pazienti attivi</Button><Button variant={archived ? 'default' : 'outline'} onClick={() => { setArchived(true); setOffset(0); setSelected(null) }}>Pazienti archiviati</Button></div>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setOffset(0); setSearch(query); setSelected(null); if (query === search && offset === 0) void refresh() }}>
      <Input aria-label="Cerca paziente" placeholder="Nome, cognome o codice clinico" value={query} onChange={e => setQuery(e.target.value)} /><Button disabled={busy} type="submit">Cerca / Elenca</Button>
    </form>
    {error && <p role="alert" className="text-red-700">{error} <button className="underline" onClick={() => void refresh()}>Riprova archivio</button></p>}
    <p className="text-sm">{directory.total} pazienti · {busy ? 'Caricamento…' : directory.total ? `Risultati ${offset+1}–${Math.min(offset+directory.limit, directory.total)}` : 'Nessun paziente trovato.'}</p>
    <div className="grid gap-4 lg:grid-cols-2"><ul className="max-h-[65vh] space-y-2 overflow-auto" aria-label="Elenco pazienti">{directory.patients.map(p => <li key={p.id}><button disabled={busy} aria-pressed={selected?.id === p.id} className="w-full rounded border p-3 text-left aria-pressed:bg-clinical-50" onClick={() => void run(async () => { setSelected(p); setEvaluations([]); setRevisions(null); setManagement(false); setBackup(null); setEvaluations(await listAssessments(p.id)) })}>
      <span className="font-semibold">{p.cognome} {p.nome}</span><span className="block text-xs">{p.codiceClinico || p.id}{activeCode === p.id ? ' · Paziente aperto' : ''}</span><span className="block text-sm">{p.evaluationCount ?? 0} valutazioni · Ultima: {p.lastEvaluationDate || '—'}</span><span className="block text-xs">Contenuti delle valutazioni: {p.photoCount ?? 0} foto · {p.landmarkCount ?? 0} landmark · {p.alterationCount ?? 0} alterazioni · {p.hasReport ? 'con report' : 'senza report'}</span>
    </button>{Boolean(p.homonymCount) && <p className="text-xs text-amber-800">Omonimo: confronta codice clinico e contenuti prima di gestire il paziente.</p>}</li>)}</ul>
    {selected && <div className="space-y-3 rounded border p-3" aria-label="Scheda paziente in archivio"><h3 className="font-semibold">{selected.cognome} {selected.nome}</h3><p className="text-xs">Codice clinico: {selected.id}</p>
      <Button disabled={busy} variant="outline" onClick={() => { setManagement(v => !v); setBackup(null); setConfirmation('') }}>Gestisci paziente</Button>
      {management && <div className="space-y-3 rounded border border-amber-200 p-3" aria-label="Gestione paziente">
        <Button disabled={busy || activeCode === selected.id} onClick={() => void run(() => changeStatus(archived ? 'restore' : 'archive'))}>{archived ? 'Ripristina' : 'Archivia'}</Button>
        {activeCode === selected.id && <p className="text-sm">Per gestire questo paziente chiudi prima la valutazione aperta.</p>}
        <p className="text-sm">Elimina definitivamente rimuove il paziente dall’indice SQLite soltanto dopo backup verificato e controllo delle dipendenze. File originali e backup restano conservati sul Lexar.</p>
        <Button disabled={busy || activeCode === selected.id} variant="outline" onClick={() => void run(async () => { setBackup(await managePatient(selected.id, 'prepare-delete')) })}>Prepara backup e verifica eliminazione</Button>
        {backup?.verified && <><p>Backup verificato: {backup.evaluations} valutazioni, {backup.files} file. Scrivi ELIMINA {selected.id} per confermare.</p><Input aria-label="Conferma eliminazione" value={confirmation} onChange={e => setConfirmation(e.target.value)} /><Button disabled={busy || confirmation !== `ELIMINA ${selected.id}`} onClick={() => void run(async () => { await managePatient(selected.id, 'delete', { backupId: backup.backupId, confirmation }); setSelected(null); await refresh() })}>Elimina definitivamente</Button></>}
      </div>}
      {!archived && <Button disabled={busy} variant="outline" onClick={() => void run(async () => { await onOpen(async () => ({ ...createEmptyAssessment(), patient: { ...await getPatient(selected.id), dataValutazione: new Date().toISOString().slice(0, 10) } })) })}>Nuova valutazione per questo paziente</Button>}
      <h4 className="font-semibold">Storico valutazioni ({evaluations.length})</h4><ul className="space-y-3">{evaluations.map(v => <li key={v.id} className="rounded border p-2"><button disabled={busy} className="text-left underline" onClick={() => void run(() => onOpen(() => loadAssessmentFromStorage(selected.id, v.id)))}>Apri valutazione {v.id} · {v.date}</button><p className="text-xs">{v.photoCount ?? '—'} foto · {v.landmarkCount ?? '—'} landmark · {v.alterationCount ?? '—'} alterazioni · Report {v.hasReport ? 'presente' : 'assente'}{v.unavailable ? ' · Documento non disponibile' : ''}</p><button className="text-xs underline" disabled={busy} onClick={() => void run(async () => { setRevisions({ id: v.id, entries: await listRevisions(selected.id, v.id) }) })}>Revisioni conservate della valutazione {v.id}</button></li>)}</ul>
      {revisions && <div aria-label="Revisioni conservate" className="max-h-64 space-y-2 overflow-auto"><p>Le revisioni precedenti si aprono in sola lettura; non sostituiscono la valutazione corrente.</p>{revisions.entries.map(v => <button key={v.revision} disabled={busy} className="block text-left text-xs underline" onClick={() => void run(() => onOpen(() => loadAssessmentFromStorage(selected.id, revisions.id, v.revision)))}>{v.current ? 'Attuale' : 'Revisione'} {v.updatedAt || v.revision} · {v.photoCount} foto · {v.landmarkCount} landmark · {v.alterationCount} alterazioni · {v.hasReport ? 'con report' : 'senza report'}</button>)}</div>}
    </div>}</div>
    <div className="flex gap-2"><Button variant="outline" disabled={busy || offset===0} onClick={() => setOffset(Math.max(0,offset-directory.limit))}>Precedenti</Button><Button variant="outline" disabled={busy || offset+directory.limit>=directory.total} onClick={() => setOffset(offset+directory.limit)}>Successivi</Button></div>
  </section>
}
