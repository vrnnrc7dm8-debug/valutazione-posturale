import { useState } from 'react'
import type { Patient } from '@/types'
import { updatePatient } from '@/storage/clinicalStorage'
import { Button } from '@/components/ui/button'
import { PatientAnthropometry } from '@/components/PatientAnthropometry'
import { Input } from '@/components/ui/input'

export function PatientProfile({ patient, archived, active, onSaved, onBusyChange }: { patient: Patient; archived: boolean; active: boolean; onSaved: (patient: Patient) => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const [draft, setDraft] = useState<Patient | null>(null)
  const [anthropometryEditing, setAnthropometryEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function save() {
    if (!draft || archived) return
    setBusy(true); onBusyChange(true); setError('')
    try {
      const saved = await updatePatient({ ...draft, id: patient.id })
      setDraft(null)
      setMessage('Dati paziente aggiornati')
      await onSaved(saved)
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.') }
    finally { setBusy(false); onBusyChange(false) }
  }
  return <section aria-label="Scheda paziente" className="space-y-3">
    <h3 className="font-semibold">SCHEDA PAZIENTE</h3>
    <label className="block">Codice clinico<Input value={patient.id} readOnly /></label>
    <h4 className="font-semibold">ANAGRAFICA</h4>
    {draft ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save() }}>
      <label className="block">Nome<Input required value={draft.nome} disabled={busy} onChange={e => setDraft({ ...draft, nome: e.target.value })} /></label>
      <label className="block">Cognome<Input required value={draft.cognome} disabled={busy} onChange={e => setDraft({ ...draft, cognome: e.target.value })} /></label>
      <label className="block">Sesso<select className="block rounded border p-2" value={draft.sesso} disabled={busy} onChange={e => setDraft({ ...draft, sesso: e.target.value as Patient['sesso'] })}><option value="">Non specificato</option><option value="M">Maschile</option><option value="F">Femminile</option><option value="altro">Altro</option></select></label>
      <label className="block">Note cliniche/anagrafiche<textarea className="block w-full rounded border p-2" value={draft.noteCliniche} disabled={busy} onChange={e => setDraft({ ...draft, noteCliniche: e.target.value })} /></label>
      <div className="flex gap-2"><Button type="submit" disabled={busy}>Salva modifiche</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setDraft(null); setError('') }}>Annulla</Button></div>
    </form> : <><dl className="space-y-1"><dt>Nome</dt><dd>{patient.nome || '—'}</dd><dt>Cognome</dt><dd>{patient.cognome || '—'}</dd><dt>Sesso</dt><dd>{({ M: 'Maschile', F: 'Femminile', altro: 'Altro' } as Record<string, string>)[patient.sesso] || 'Non specificato'}</dd><dt>Note cliniche/anagrafiche</dt><dd className="whitespace-pre-wrap">{patient.noteCliniche || '—'}</dd></dl>
      {!archived && <Button variant="outline" disabled={busy || anthropometryEditing} onClick={() => { setDraft({ ...patient }); setMessage(''); setError('') }}>Modifica dati paziente</Button>}</>}
    <PatientAnthropometry onEditingChange={setAnthropometryEditing} patient={patient} archived={archived} active={active} disabled={busy || draft !== null} onSaved={onSaved} onBusyChange={value => { setBusy(value); onBusyChange(value) }} />
    <dl><dt>Numero valutazioni</dt><dd>{patient.evaluationCount ?? 0}</dd><dt>Data ultima valutazione</dt><dd>{patient.lastEvaluationDate || '—'}</dd></dl>
    {archived && <p>Paziente archiviato — ripristinalo per modificare i dati.</p>}
    {Boolean(patient.homonymCount) && <p className="text-amber-800">Esiste un altro paziente con lo stesso nome e cognome. I codici clinici restano distinti.</p>}
    {message && <div role="status"><p>{message}</p>{active && <p>Anagrafica corrente aggiornata. La valutazione già aperta conserva i dati con cui è stata salvata.</p>}</div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>
}
