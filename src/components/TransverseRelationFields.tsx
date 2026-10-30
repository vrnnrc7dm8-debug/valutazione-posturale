import { TRANSVERSE_REFERENCES, TRANSVERSE_ORIENTATIONS, defaultTransverseRelation, type TransverseRelation } from '@/data/transverseRelations'
import type { Descriptor } from '@/types'

export function TransverseRelationFields({ value, phenomenon, descriptor, onChange }: { value?: TransverseRelation; phenomenon: string; descriptor?: Descriptor; onChange: (value: TransverseRelation) => void }) {
  const relation = value ?? defaultTransverseRelation(phenomenon, descriptor)
  return <fieldset className="space-y-1 rounded border p-2" aria-label="Relazione e orientamento anatomico">
    <label className="block">Relazione<select className="block w-full border" value={relation.relationType} onChange={e => onChange({ ...relation, relationType: e.target.value as TransverseRelation['relationType'] })}>
      <option value="dissociazione">Dissociazione</option><option value="parallelismo">Parallelismo</option><option value="compenso_crociato">Compenso crociato</option><option value="shear">Taglio biomeccanico stimato</option>
    </select></label>
    <label className="block">Orientamento anatomico<select className="block w-full border" value={relation.orientation ?? 'indeterminabile'} onChange={e => onChange({ ...relation, orientation: e.target.value as TransverseRelation['orientation'], orientationSource: 'manual' })}>
      {Object.entries(TRANSVERSE_ORIENTATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label className="block">Riferimento<select className="block w-full border" value={relation.reference} onChange={e => onChange({ ...relation, reference: e.target.value as TransverseRelation['reference'], orientation: 'indeterminabile', orientationSource: 'manual' })}>
      {Object.entries(TRANSVERSE_REFERENCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    {relation.reference === 'scapulum_ileo' && <label className="block">Lato ileo di riferimento<select className="block w-full border" value={relation.referenceSide ?? ''} onChange={e => onChange({ ...relation, referenceSide: e.target.value as 'dx' | 'sx' || undefined, orientation: 'indeterminabile', orientationSource: 'manual' })}><option value="">Stesso lato del soggetto</option><option value="dx">Ileo DX</option><option value="sx">Ileo SX</option></select></label>}
    {relation.orientationSource === 'geometric_suggestion' && <p>Orientamento geometrico suggerito: verificare prima di confermare.</p>}
    {relation.legacyDirection && <p>Direzione legacy {relation.legacyDirection.toUpperCase()} conservata; specificare il significato anatomico.</p>}
  </fieldset>
}
