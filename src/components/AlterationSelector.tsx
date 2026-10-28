import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { formatQuantitativeValue } from '@/data/clinicalThresholds'
import {
  applyFemoroTibialeVariant,
  FEMORO_TIBIALE_VARIANT_OPTIONS,
  isFemoroTibialeAlteration,
  resolveFemoroTibialeVariantId,
} from '@/data/femoroTibialeDescriptors'
import {
  formatAlterationInstanceSummary,
  getAllowedDirections,
  CLINICAL_DIRECTION_LABELS,
} from '@/data/directionalDescriptors'
import { getAlterationsForPlane } from '@/data/planes'
import type {
  AlterationSelection,
  AnatomicalPlane,
  ClinicalDirection,
  Descriptor,
  Severity,
  Side,
} from '@/types'
import { DESCRIPTOR_LABELS } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const FALLBACK_DESCRIPTORS: Descriptor[] = [
  'tilt',
  'bend',
  'shift',
  'rotation',
  'compenso',
  'fissazione_accorciamento',
  'fissazione_allungamento',
]

function instanceSummary(
  sel: AlterationSelection,
  index: number,
  total: number,
): string {
  const parts: string[] = []
  if (total > 1) {
    parts.push(`#${index + 1}`)
  }
  const q = formatQuantitativeValue(sel.quantitative)
  if (q) parts.push(q)
  parts.push(formatAlterationInstanceSummary(sel))
  return parts.join(' · ')
}

interface AlterationSelectorProps {
  plane: AnatomicalPlane
  selected: AlterationSelection[]
  onUpdate: (instanceId: string, patch: Partial<AlterationSelection>) => void
  onRemove: (instanceId: string) => void
}

export function AlterationSelector({
  plane,
  selected,
  onUpdate,
  onRemove,
}: AlterationSelectorProps) {
  const [editing, setEditing] = useState<string[]>([])
  if (selected.length === 0) return null
  const catalog = getAlterationsForPlane(plane)

  const grouped = selected.reduce<Map<string, AlterationSelection[]>>((acc, sel) => {
    const list = acc.get(sel.alterationId) ?? []
    list.push(sel)
    acc.set(sel.alterationId, list)
    return acc
  }, new Map())

  return (
    <div className="space-y-2">
      {selected.map((sel) => {
        const def = catalog.find((a) => a.id === sel.alterationId)
        const siblings = grouped.get(sel.alterationId) ?? [sel]
        const indexInGroup = siblings.findIndex((s) => s.instanceId === sel.instanceId)
        const descriptors =
          def?.suggestedDescriptors?.length ? def.suggestedDescriptors : FALLBACK_DESCRIPTORS
        const allowedDirections = getAllowedDirections(
          plane,
          sel.alterationId,
          sel.descriptor,
        )
        const femoroVariantId = isFemoroTibialeAlteration(sel.alterationId)
          ? resolveFemoroTibialeVariantId(sel)
          : null

        return (
          <div
            key={sel.instanceId}
            className="rounded-lg border border-slate-200 bg-white p-2"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-medium">{def?.label}</span>
                <p className="text-[10px] text-slate-500">
                  {instanceSummary(sel, indexInGroup, siblings.length)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {sel.source === 'suggested' && (
                  <Badge variant="outline" className="text-[9px]">
                    suggerita
                  </Badge>
                )}
                {sel.source === 'confirmed' && (
                  <Badge variant="default" className="text-[9px]">
                    confermata
                  </Badge>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(ids => ids.includes(sel.instanceId) ? ids.filter(id => id !== sel.instanceId) : [...ids, sel.instanceId])}>Modifica</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onUpdate(sel.instanceId, { status: sel.status === 'excluded' ? 'modified' : 'excluded' })}>{sel.status === 'excluded' ? 'Ripristina' : 'Escludi'}</Button>
                <span className="text-xs">{sel.status === 'excluded' ? 'Esclusa' : sel.status === 'modified' ? 'Modificata' : ''}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-slate-500 hover:text-red-600"
                  onClick={() => onRemove(sel.instanceId)}
                  title="Elimina istanza"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {editing.includes(sel.instanceId) && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label className="text-[10px]">Descrittore</Label>
                {femoroVariantId ? (
                  <Select
                    value={femoroVariantId}
                    onValueChange={(variantId) =>
                      onUpdate(
                        sel.instanceId,
                        applyFemoroTibialeVariant(
                          variantId as (typeof FEMORO_TIBIALE_VARIANT_OPTIONS)[number]['id'],
                          sel,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEMORO_TIBIALE_VARIANT_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={sel.descriptor}
                    onValueChange={(v) =>
                      onUpdate(sel.instanceId, { descriptor: v as Descriptor })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {descriptors.map((d) => (
                        <SelectItem key={d} value={d}>
                          {DESCRIPTOR_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {allowedDirections.length > 0 && (
                <div>
                  <Label className="text-[10px]">Direzione</Label>
                  <Select
                    value={
                      femoroVariantId &&
                      ['valgo', 'varo', 'intrarotazione', 'extrarotazione'].includes(
                        sel.direction ?? '',
                      )
                        ? 'none'
                        : (sel.direction ?? 'none')
                    }
                    onValueChange={(v) =>
                      onUpdate(sel.instanceId, {
                        direction:
                          v === 'none' ? undefined : (v as ClinicalDirection),
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {allowedDirections.map((d) => (
                        <SelectItem key={d} value={d}>
                          {CLINICAL_DIRECTION_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-[10px]">Severità</Label>
                <Select
                  value={sel.severity}
                  onValueChange={(v) =>
                    onUpdate(sel.instanceId, { severity: v as Severity })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lieve">Lieve</SelectItem>
                    <SelectItem value="moderato">Moderato</SelectItem>
                    <SelectItem value="severo">Severo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Lato</Label>
                <Select
                  value={sel.side ?? 'none'}
                  onValueChange={(v) =>
                    onUpdate(sel.instanceId, {
                      side: v === 'none' ? undefined : (v as Side),
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="destro">Destro</SelectItem>
                    <SelectItem value="sinistro">Sinistro</SelectItem>
                    <SelectItem value="bilaterale">Bilaterale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="text-xs">Distretto
                <select className="block w-full border p-1" value={sel.district ?? def?.district ?? 'globale'} onChange={e => onUpdate(sel.instanceId, { district: e.target.value as AlterationSelection['district'] })}>
                  {['cranio_cervicale', 'cervicale', 'cervico_dorsale', 'toracica', 'toraco_lombare', 'lombare', 'lombosacrale', 'sacrale', 'pelvico', 'cintura_scapolare', 'arto_superiore', 'arto_inferiore', 'globale'].map(d => <option key={d} value={d}>{d.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              {/deviazione_rachidea|scoliosi/.test(sel.alterationId) && <>
                <label className="text-xs">Regione
                  <select className="block w-full border p-1" value={sel.anatomicalDetails?.region ?? sel.alterationId.match(/deviazione_rachidea_(.+)/)?.[1] ?? 'indeterminata'} onChange={e => onUpdate(sel.instanceId, { anatomicalDetails: { ...sel.anatomicalDetails, region: e.target.value as NonNullable<AlterationSelection['anatomicalDetails']>['region'] } })}>
                    {['indeterminata', 'cervicale', 'cervico_dorsale', 'toracica', 'toraco_lombare', 'lombare', 'lombosacrale', 'globale'].map(r => <option key={r} value={r}>{r.replaceAll('_', '-')}</option>)}
                  </select>
                </label>
                <label className="text-xs">Convessità
                  <select className="block w-full border p-1" value={sel.anatomicalDetails?.convexity ?? 'indeterminata'} onChange={e => onUpdate(sel.instanceId, { anatomicalDetails: { ...sel.anatomicalDetails, convexity: e.target.value as 'dx' | 'sx' | 'indeterminata' } })}>
                    <option value="indeterminata">Indeterminata</option><option value="dx">Destra</option><option value="sx">Sinistra</option>
                  </select>
                </label>
                {(['level', 'apex', 'startLevel', 'endLevel'] as const).map((field, i) => <label key={field} className="text-xs">{['Livello', 'Apice', 'Livello iniziale', 'Livello finale'][i]}
                  <input className="block w-full border p-1" value={sel.anatomicalDetails?.[field] ?? ''} onChange={e => onUpdate(sel.instanceId, { anatomicalDetails: { ...sel.anatomicalDetails, [field]: e.target.value } })} />
                </label>)}
              </>}
              <label className="text-xs">Gruppo clinico comune (facoltativo)
                <input className="block w-full border p-1" value={sel.patternId ?? ''} onChange={e => onUpdate(sel.instanceId, { patternId: e.target.value || undefined })} />
              </label>
              <label className="text-xs">Note
                <textarea className="block w-full border p-1" value={sel.note ?? ''} onChange={e => onUpdate(sel.instanceId, { note: e.target.value })} />
              </label>
            </div>}
          </div>
        )
      })}
    </div>
  )
}
