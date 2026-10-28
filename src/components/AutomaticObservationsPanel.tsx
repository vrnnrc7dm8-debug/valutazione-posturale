import { useState } from 'react'
import type { ClinicalObservation, ClinicalDirection, ClinicalDistrict, Severity, Side } from '@/types'

interface Props {
  observations: ClinicalObservation[]
  onDecision: (observation: ClinicalObservation) => void
}
export function AutomaticObservationsPanel({ observations, onDecision }: Props) {
  const [editing, setEditing] = useState<string[]>([])
  if (!observations.length) return null
  return <section aria-label="Osservazioni automatiche da confermare" className="space-y-2 rounded border border-amber-200 bg-amber-50 p-2">
    <h4 className="text-xs font-semibold">Osservazioni automatiche da confermare</h4>
    {observations.map(o => {
      const patch = (changes: Partial<ClinicalObservation>) => onDecision({ ...o, ...changes, status: o.status === 'suggested' ? 'suggested' : 'modified' })
      return <div key={o.id} className="rounded border bg-white p-2 text-xs">
        <p className="font-medium">{o.phenomenon.replaceAll('_', ' ')} · {o.side} · {o.direction} · {o.severity}</p>
        <p>{o.notes}</p>
        <p className="text-[10px]">{o.status === 'suggested' ? 'OSSERVAZIONE AUTOMATICA SUGGERITA' : o.status === 'excluded' ? 'Esclusa' : o.status === 'modified' ? 'Modificata e confermata' : 'Confermata'}</p>
        <div className="my-1 flex gap-2">
          {o.status === 'suggested' && <button type="button" className="underline" onClick={() => onDecision({ ...o, status: 'confirmed' })}>Conferma</button>}
          {o.status !== 'excluded' && <button type="button" className="underline" onClick={() => setEditing(ids => ids.includes(o.id) ? ids.filter(id => id !== o.id) : [...ids, o.id])}>Modifica</button>}
          <button type="button" className="underline" onClick={() => onDecision({ ...o, status: o.status === 'excluded' ? 'suggested' : 'excluded' })}>{o.status === 'excluded' ? 'Ripristina proposta' : 'Escludi'}</button>
        </div>
        {editing.includes(o.id) && o.status !== 'excluded' && <div className="grid gap-1 sm:grid-cols-2">
          <label>Distretto<select className="block w-full border" value={o.district} onChange={e => patch({ district: e.target.value as ClinicalDistrict })}>{['cranio_cervicale', 'cervicale', 'cervico_dorsale', 'toracica', 'toraco_lombare', 'lombare', 'lombosacrale', 'sacrale', 'pelvico', 'cintura_scapolare', 'arto_superiore', 'arto_inferiore', 'globale'].map(d => <option key={d}>{d}</option>)}</select></label>
          <label>Lato<select className="block w-full border" value={o.side ?? ''} onChange={e => patch({ side: e.target.value as Side || undefined })}><option value="">Indeterminato</option>{['destro', 'sinistro', 'bilaterale'].map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Direzione<select className="block w-full border" value={o.direction ?? ''} onChange={e => patch({ direction: e.target.value as ClinicalDirection || undefined })}><option value="">Indeterminata</option>{['dx', 'sx', 'valgo', 'varo', 'intrarotazione', 'extrarotazione', 'mediale', 'laterale'].map(d => <option key={d}>{d}</option>)}</select></label>
          <label>Severità<select className="block w-full border" value={o.severity ?? 'lieve'} onChange={e => patch({ severity: e.target.value as Severity })}>{['lieve', 'moderato', 'severo'].map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Note<textarea className="block w-full border" value={o.notes ?? ''} onChange={e => patch({ notes: e.target.value })} /></label>
        </div>}
      </div>
    })}
  </section>
}
