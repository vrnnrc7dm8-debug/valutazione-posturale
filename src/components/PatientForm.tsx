import { AnthropometrySection } from '@/components/AnthropometrySection'
import type { Patient } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PatientFormProps {
  patient: Patient
  onChange: (patient: Patient) => void
}

export function PatientForm({ patient, onChange }: PatientFormProps) {
  const update = <K extends keyof Patient>(key: K, value: Patient[K]) => {
    onChange({ ...patient, [key]: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard paziente</CardTitle>
        <CardDescription>
          Dati anagrafici e contesto della valutazione posturale statica
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="codice-clinico">Codice clinico univoco</Label>
          <Input id="codice-clinico" value={patient.codiceClinico || patient.id} readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            value={patient.nome}
            onChange={(e) => update('nome', e.target.value)}
            placeholder="Nome"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cognome">Cognome</Label>
          <Input
            id="cognome"
            value={patient.cognome}
            onChange={(e) => update('cognome', e.target.value)}
            placeholder="Cognome"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eta">Età</Label>
          <Input
            id="eta"
            type="number"
            min={0}
            max={120}
            value={patient.eta}
            onChange={(e) =>
              update('eta', e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Sesso</Label>
          <Select
            value={patient.sesso || undefined}
            onValueChange={(v) => update('sesso', v as Patient['sesso'])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Maschio</SelectItem>
              <SelectItem value="F">Femmina</SelectItem>
              <SelectItem value="altro">Altro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="data">Data valutazione</Label>
          <Input
            id="data"
            type="date"
            value={patient.dataValutazione}
            onChange={(e) => update('dataValutazione', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operatore">Operatore</Label>
          <Input
            id="operatore"
            value={patient.operatore}
            onChange={(e) => update('operatore', e.target.value)}
            placeholder="Nome operatore"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">Note cliniche</Label>
          <Textarea
            id="note"
            value={patient.noteCliniche}
            onChange={(e) => update('noteCliniche', e.target.value)}
            placeholder="Anamnesi, contesto, obiettivi della valutazione..."
            rows={4}
          />
        </div>
        <AnthropometrySection patient={patient} onChange={onChange} />
      </CardContent>
    </Card>
  )
}
