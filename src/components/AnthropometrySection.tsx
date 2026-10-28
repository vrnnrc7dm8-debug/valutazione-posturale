import { isAnthropometryAvailable } from '@/storage/clinicalStorage'
import { useState } from 'react'
import type { Patient } from '@/types'
import { ANTHROPOMETRY_LIMITS, bmiClassification, calculateBmi, formatAnthropometric, parseItalianNumber, validMeasurement, type Measurement } from '@/utils/anthropometry'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function MeasurementInput({ field, label, value, onChange }: { field: Measurement; label: string; value: number | null; onChange: (value: number | null) => void }) {
  const [draft, setDraft] = useState({ source: value, raw: value == null ? '' : String(value).replace('.', ',') })
  const raw = Object.is(draft.source, value) ? draft.raw : value == null || !Number.isFinite(value) ? '' : String(value).replace('.', ',')
  const invalid = !validMeasurement(value, field)
  const [min, max] = ANTHROPOMETRY_LIMITS[field]
  return <div className="space-y-2">
    <Label htmlFor={field}>{label}</Label>
    <Input id={field} type="text" inputMode="decimal" autoComplete="off" value={raw} aria-invalid={invalid} aria-describedby={`${field}-hint`} onChange={event => {
      const next = parseItalianNumber(event.target.value)
      setDraft({ source: next, raw: event.target.value })
      onChange(next)
    }} />
    <p id={`${field}-hint`} className={invalid ? 'text-xs text-red-700' : 'text-xs text-slate-500'} role={invalid ? 'alert' : undefined}>{invalid ? `Valore non valido. Inserire un numero tra ${String(min).replace('.', ',')} e ${max}.` : `Da ${String(min).replace('.', ',')} a ${max}; virgola o punto decimale.`}</p>
  </div>
}

export function AnthropometrySection({ patient, onChange }: { patient: Patient; onChange: (patient: Patient) => void }) {
  const data = patient.antropometria ?? { pesoKg: null, altezzaCm: null }
  const bmi = calculateBmi(data.pesoKg, data.altezzaCm)
  return <fieldset className="grid gap-4 rounded-lg border p-4 sm:col-span-2 sm:grid-cols-2">
    <legend className="px-2 font-semibold">Dati antropometrici</legend>
    <p className="text-xs text-slate-600 sm:col-span-2">Misure della valutazione del {patient.dataValutazione || '—'}. Riaprendo una valutazione sono mostrate le misure storiche; per una nuova visita crea una nuova valutazione. Le correzioni qui riguardano questa data.</p>
    {isAnthropometryAvailable() === false && <p role="alert" className="text-sm text-amber-800 sm:col-span-2">Archivio antropometrico non ancora attivato. Prima del salvataggio sul Lexar occorrono il backup verificato e la migrazione dedicata; il backend non modifica automaticamente le tabelle.</p>}
    <MeasurementInput field="pesoKg" label="Peso (kg)" value={data.pesoKg} onChange={pesoKg => onChange({ ...patient, antropometria: { ...data, pesoKg } })} />
    <MeasurementInput field="altezzaCm" label="Altezza (cm)" value={data.altezzaCm} onChange={altezzaCm => onChange({ ...patient, antropometria: { ...data, altezzaCm } })} />
    <div className="space-y-1 sm:col-span-2" aria-live="polite">
      <p>BMI (kg/m²): <output aria-label="BMI">{formatAnthropometric(bmi)}</output></p>
      <p className="text-sm">{patient.eta !== '' && patient.eta >= 18 && patient.eta <= 120 ? 'Classificazione OMS (adulti): ' : 'Interpretazione BMI: '}{bmiClassification(bmi, patient.eta)}</p>
    </div>
  </fieldset>
}
