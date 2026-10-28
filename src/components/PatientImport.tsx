import { useRef, useState } from 'react'
import type { Assessment } from '@/types'
import type { PatientImportResult } from '@/types/patientExport'
import { previewPatientImport, type ImportPreview } from '@/storage/clinicalStorage'
import { parsePatientExportFolder, parsePatientExportZip } from '@/utils/patientImport'
import { countLandmarks } from '@/utils/landmarkCollection'
import { Button } from '@/components/ui/button'

export function PatientImport({ disabled, onImport }: { disabled?: boolean; onImport: (assessment: Assessment, preview: ImportPreview) => Promise<void> }) {
  const zip = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const [allowHomonym, setAllowHomonym] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ result: PatientImportResult; preview: ImportPreview } | null>(null)
  async function prepare(load: () => Promise<PatientImportResult>) {
    setBusy(true); setError(''); setPending(null); setAllowHomonym(false)
    try { const result = await load(); const preview = await previewPatientImport(result.assessment.patient); setPending({ result, preview }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Importazione non leggibile.') }
    finally { setBusy(false) }
  }
  async function confirmImport() {
    if (!pending) return
    setBusy(true); setError('')
    try { await onImport({ ...pending.result.assessment, allowHomonym }, pending.preview); setPending(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Importazione non riuscita. Nessuna sovrascrittura eseguita.') }
    finally { setBusy(false) }
  }
  const a = pending?.result.assessment
  return <>
    <Button variant="secondary" size="sm" disabled={disabled || busy} onClick={() => zip.current?.click()}>Importa paziente (ZIP)</Button>
    <Button variant="secondary" size="sm" disabled={disabled || busy} onClick={() => folder.current?.click()}>Importa cartella paziente</Button>
    <input ref={zip} aria-label="File ZIP paziente" type="file" accept=".zip,application/zip" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void prepare(() => parsePatientExportZip(file)) }} />
    <input ref={input => { folder.current = input; input?.setAttribute('webkitdirectory', '') }} aria-label="Cartella paziente" type="file" multiple hidden onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) void prepare(() => parsePatientExportFolder(files)) }} />
    {busy && !pending && <p role="status" className="text-sm">Lettura importazione e verifica archivio…</p>}
    {error && !pending && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {pending && a && <div role="dialog" aria-modal="true" aria-label="Anteprima importazione" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded-xl bg-white p-6">
        <h2 className="text-lg font-bold">Anteprima importazione</h2>
        <p>{a.patient.cognome} {a.patient.nome} · {a.patient.codiceClinico || a.patient.id}</p><p>Data valutazione: {a.patient.dataValutazione || 'non disponibile'}</p>
        <p>{a.photos.filter(p => p.dataUrl).length} fotografie · {a.photos.reduce((n, p) => n + countLandmarks(p.annotations.landmarks), 0)} landmark · {a.planeAssessments.reduce((n, p) => n + p.alterations.length, 0)} alterazioni</p>
        <p>Report: {a.report ? 'presente nel pacchetto' : 'assente; potrai generarlo dai dati importati'}. Calibrazioni: {a.photos.filter(p => p.calibration).length}. Antropometria: {a.patient.antropometria ? 'presente' : 'non disponibile'}.</p>
        <p>{a.importedFiles?.length ?? 0} documenti originali saranno conservati come allegati sul Lexar. L’originale selezionato non sarà modificato.</p>
        {pending.preview.exists ? <div className="rounded border border-amber-300 p-3 text-sm"><p>Paziente già presente: {pending.preview.patient?.cognome} {pending.preview.patient?.nome}.</p><p>Verrà aggiunta una nuova valutazione allo stesso codice clinico. L’anagrafica esistente e le valutazioni precedenti non saranno sovrascritte. Le misure importate saranno conservate nella nuova valutazione; il profilo corrente resta invariato.</p>{pending.preview.evaluations.some(v => v.date === a.patient.dataValutazione) && <p className="font-semibold">Esiste già una valutazione in questa data: confermando creerai una copia distinta nello storico.</p>}</div> : <p>Sarà creato un nuovo paziente con il codice clinico importato.</p>}
        {(pending.preview.candidates?.length ?? 0) > 0 && <div className="rounded border border-amber-300 p-3"><p>Omonimi presenti: confronta i codici e lo storico prima di confermare.</p><ul>{pending.preview.candidates!.map(p => <li key={p.id}>{p.cognome} {p.nome} · {p.id} · {p.evaluationCount ?? 0} valutazioni · {p.photoCount ?? 0} foto · {p.landmarkCount ?? 0} landmark · {p.hasReport ? 'con report' : 'senza report'}</li>)}</ul>{!pending.preview.exists && <label><input type="checkbox" checked={allowHomonym} onChange={e => setAllowHomonym(e.target.checked)} /> Confermo che è un paziente distinto dagli omonimi elencati</label>}</div>}
        {error && <p role="alert" className="text-red-700">{error} Annulla e ripeti l’anteprima se l’archivio è cambiato.</p>}
        <div className="flex gap-3"><Button disabled={busy || (!pending.preview.exists && Boolean(pending.preview.candidates?.length) && !allowHomonym)} onClick={() => void confirmImport()}>{busy ? 'Importazione…' : 'Conferma importazione'}</Button><Button disabled={busy} variant="outline" onClick={() => { setPending(null); setError('') }}>Annulla importazione</Button></div>
      </div>
    </div>}
  </>
}
