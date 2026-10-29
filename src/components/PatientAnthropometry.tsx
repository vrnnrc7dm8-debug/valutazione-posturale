import { useState } from 'react'
import type { Patient } from '@/types'
import { updatePatientAnthropometry } from '@/storage/clinicalStorage'
import { parseItalianNumber } from '@/utils/anthropometry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function PatientAnthropometry({ patient, archived, active, disabled, onSaved, onBusyChange, onEditingChange }: { patient: Patient; archived: boolean; active: boolean; disabled: boolean; onSaved: (patient: Patient) => Promise<void>; onBusyChange: (busy: boolean) => void; onEditingChange: (editing: boolean) => void }) {
  const [draft, setDraft] = useState<{ peso: string; altezza: string; data: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function save() {
    if (!draft || archived || busy) return
    setBusy(true); onBusyChange(true); setError(''); setMessage('')
    try {
      const saved = await updatePatientAnthropometry(patient.id, { pesoKg: parseItalianNumber(draft.peso), altezzaCm: parseItalianNumber(draft.altezza), dataMisurazione: draft.data })
      setDraft(null); onEditingChange(false); setMessage('Antropometria aggiornata.')
      await onSaved(saved)
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.') }
    finally { setBusy(false); onBusyChange(false) }
  }
  return <section className="space-y-3 border-t pt-3" aria-label="Antropometria corrente">
    <h4 className="font-semibold">ANTROPOMETRIA CORRENTE</h4>
    <dl><dt>Peso corrente</dt><dd>{patient.antropometria?.pesoKg != null ? `${patient.antropometria.pesoKg} kg` : '—'}</dd><dt>Altezza corrente</dt><dd>{patient.antropometria?.altezzaCm != null ? `${patient.antropometria.altezzaCm} cm` : '—'}</dd><dt>Data ultima misurazione antropometrica</dt><dd>{patient.antropometria?.dataMisurazione || '—'}</dd></dl>
    {draft ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save() }}>
      <label className="block">Peso (kg)<Input type="number" min="0.3" max="500" step="any" disabled={busy || disabled} value={draft.peso} onChange={e => setDraft({ ...draft, peso: e.target.value })} /></label>
      <label className="block">Altezza (cm)<Input type="number" min="20" max="260" step="any" disabled={busy || disabled} value={draft.altezza} onChange={e => setDraft({ ...draft, altezza: e.target.value })} /></label>
      <label className="block">Data misurazione<Input type="date" required disabled={busy || disabled} value={draft.data} onChange={e => setDraft({ ...draft, data: e.target.value })} /></label>
      <div className="flex gap-2"><Button type="submit" disabled={busy || disabled}>Salva antropometria</Button><Button type="button" variant="outline" disabled={busy || disabled} onClick={() => { setDraft(null); onEditingChange(false); setError('') }}>Annulla</Button></div>
    </form> : !archived && <Button variant="outline" disabled={disabled} onClick={() => {
      onEditingChange(true)
      const today = new Date(); const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      setDraft({ peso: String(patient.antropometria?.pesoKg ?? ''), altezza: String(patient.antropometria?.altezzaCm ?? ''), data: patient.antropometria?.dataMisurazione || localDate }); setMessage(''); setError('')
    }}>Modifica antropometria</Button>}
    {archived && <p>Paziente archiviato — ripristinalo per modificare l'antropometria.</p>}
    {message && <div role="status"><p>{message}</p>{active && <p>Il profilo corrente è aggiornato. La valutazione già aperta conserva il proprio snapshot.</p>}</div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>
}
