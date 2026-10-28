import type { Assessment, AnthropometrySnapshot, Patient } from '@/types'

export const ANTHROPOMETRY_LIMITS = { pesoKg: [0.3, 500], altezzaCm: [20, 260] } as const
export type Measurement = keyof typeof ANTHROPOMETRY_LIMITS

export function parseItalianNumber(raw: string): number | null {
  const value = raw.trim()
  if (!value) return null
  if (!/^\d+(?:[.,]\d+)?$/.test(value)) return NaN
  return Number(value.replace(',', '.'))
}
export function validMeasurement(value: number | null | undefined, field: Measurement): boolean {
  if (value == null) return true
  const [min, max] = ANTHROPOMETRY_LIMITS[field]
  return Number.isFinite(value) && value >= min && value <= max
}
export function calculateBmi(weight: number | null | undefined, height: number | null | undefined): number | null {
  if (weight == null || height == null || !validMeasurement(weight, 'pesoKg') || !validMeasurement(height, 'altezzaCm')) return null
  return weight / ((height / 100) ** 2)
}
export function bmiClassification(bmi: number | null, age: number | '' | null | undefined): string {
  if (age !== '' && age != null && Number.isFinite(age) && age >= 0 && age < 18) return 'Minorenne: necessari riferimenti per età e sesso.'
  if (age === '' || age == null || !Number.isInteger(age) || age < 18 || age > 120) return 'Età non disponibile: classificazione adulti non applicata.'
  if (bmi == null || !Number.isFinite(bmi)) return '—'
  if (bmi < 18.5) return 'Sottopeso'
  if (bmi < 25) return 'Normopeso'
  if (bmi < 30) return 'Sovrappeso'
  return 'Obesità'
}
export function formatAnthropometric(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
export function snapshotFromPatient(patient: Patient): AnthropometrySnapshot {
  return {
    pesoKg: patient.antropometria?.pesoKg ?? null,
    altezzaCm: patient.antropometria?.altezzaCm ?? null,
    dataMisurazione: patient.dataValutazione,
    etaAnni: patient.eta !== '' && Number.isInteger(patient.eta) && patient.eta >= 0 && patient.eta <= 120 ? patient.eta : null,
    sesso: patient.sesso,
  }
}
export function anthropometricReport(assessment: Assessment) {
  const snapshot = snapshotFromPatient(assessment.patient)
  return { ...snapshot, bmi: calculateBmi(snapshot.pesoKg, snapshot.altezzaCm) }
}
export function anthropometryReportLines(assessment: Assessment): string[] {
  const data = assessment.report?.antropometria ?? anthropometricReport(assessment)
  if (data.pesoKg == null && data.altezzaCm == null) return []
  return [
    `Dati antropometrici del ${data.dataMisurazione || '—'}`,
    `Peso: ${formatAnthropometric(data.pesoKg)} kg`,
    `Altezza: ${formatAnthropometric(data.altezzaCm)} cm`,
    `BMI: ${formatAnthropometric(data.bmi)} kg/m²`,
    `Classificazione BMI: ${bmiClassification(data.bmi, data.etaAnni)}`,
  ]
}
