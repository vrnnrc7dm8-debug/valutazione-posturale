import type { ClinicalDirection, Descriptor, Side } from '@/types'

export const TRANSVERSE_REFERENCES = {
  scapulum_ileo: 'Scapulum ↔ ileo',
  scapolare_pelvico: 'Cingolo scapolare ↔ cingolo pelvico',
  pelvico_bicalcaneare: 'Cingolo pelvico ↔ linea bicalcaneare',
  scapolare_bicalcaneare: 'Cingolo scapolare ↔ linea bicalcaneare',
  scapulum_controlaterale: 'Scapulum ↔ scapulum controlaterale',
  ileo_controlaterale: 'Ileo ↔ ileo controlaterale',
  pelvico_asse_piede: 'Cingolo pelvico ↔ asse completo piede',
  scapolare_asse_piede: 'Cingolo scapolare ↔ asse completo piede',
  non_specificato: 'Riferimento da specificare',
} as const
export const TRANSVERSE_ORIENTATIONS = {
  dx_anteposto: 'Lato DX anteposto', sx_anteposto: 'Lato SX anteposto',
  dx_retroposto: 'Lato DX retroposto', sx_retroposto: 'Lato SX retroposto',
  indeterminabile: 'Orientamento non determinabile',
} as const
export interface TransverseRelation {
  relationType: 'dissociazione' | 'parallelismo' | 'compenso_crociato' | 'shear'
  reference: keyof typeof TRANSVERSE_REFERENCES
  orientation?: keyof typeof TRANSVERSE_ORIENTATIONS
  referenceSide?: 'dx' | 'sx'
  orientationSource?: 'geometric_suggestion' | 'manual'
  legacyDirection?: ClinicalDirection
}
export function isTransverseRelation(descriptor?: Descriptor): boolean {
  return ['dissociazione', 'compenso_crociato', 'taglio_stimato'].includes(descriptor ?? '')
}
export function defaultTransverseRelation(phenomenon: string, descriptor?: Descriptor, sourceIds: string[] = []): TransverseRelation {
  const source = sourceIds.join(' ')
  return {
    relationType: descriptor === 'compenso_crociato' ? 'compenso_crociato' : descriptor === 'taglio_stimato' ? 'shear' : 'dissociazione',
    reference: phenomenon === 'relazione_scapulum_ileo' ? 'scapulum_ileo' : phenomenon === 'asimmetria_cingolo_scapolare' ? 'scapulum_controlaterale'
      : phenomenon === 'asimmetria_cingolo_pelvico' ? 'ileo_controlaterale'
      : phenomenon === 'relazione_pelvi_calcagni' ? 'pelvico_bicalcaneare'
      : phenomenon === 'relazione_scapole_calcagni' ? 'scapolare_bicalcaneare'
      : ['relazione_scapolo_pelvica', 'disaccoppiamento_torace_bacino'].includes(phenomenon) ? 'scapolare_pelvico'
      : phenomenon === 'relazione_cingoli_piedi' && /scapolare_piede/.test(source) ? 'scapolare_asse_piede'
      : phenomenon === 'relazione_cingoli_piedi' && /pelvico_piede/.test(source) ? 'pelvico_asse_piede' : 'non_specificato',
    orientation: 'indeterminabile',
  }
}
/** Lazy, lossless live-data migration. Never guesses AP orientation from historical DX/SX. */
export function normalizeTransverseRelation<T extends { descriptor?: Descriptor; direction?: ClinicalDirection; transverseRelation?: TransverseRelation }>(value: T, plane: string, phenomenon: string, sourceIds: string[] = []): T {
  if (plane !== 'trasverso' || !isTransverseRelation(value.descriptor)) return value
  const transverseRelation = { ...defaultTransverseRelation(phenomenon, value.descriptor, sourceIds), ...value.transverseRelation }
  if (value.direction) transverseRelation.legacyDirection ??= value.direction
  return { ...value, direction: undefined, transverseRelation }
}
/** Canonical lateral orientation for Myers only; never written back as relation.direction. */
export function transverseRelationSide(relation?: TransverseRelation): Side | undefined {
  if (!relation || relation.reference === 'non_specificato' || relation.relationType === 'parallelismo') return undefined
  if (relation.orientation === 'dx_anteposto' || relation.orientation === 'sx_retroposto') return 'destro'
  if (relation.orientation === 'sx_anteposto' || relation.orientation === 'dx_retroposto') return 'sinistro'
  return undefined
}
export function formatTransverseRelation(relation: TransverseRelation, quantitative?: { value: number; unit: string }): string {
  const type = { dissociazione: 'Dissociazione', parallelismo: 'Parallelismo', compenso_crociato: 'Compenso crociato', shear: 'Taglio biomeccanico stimato (indice proiettivo)' }[relation.relationType]
  const reference = TRANSVERSE_REFERENCES[relation.reference]
  const side = relation.orientation?.startsWith('dx_') ? 'DX' : 'SX'
  const movement = relation.orientation?.endsWith('anteposto') ? 'anteposto' : 'retroposto'
  const subject = relation.reference.startsWith('pelvico') || relation.reference === 'ileo_controlaterale' ? 'Ileo' : 'Scapulum'
  const target = relation.reference === 'scapulum_ileo' ? `all’ileo ${relation.referenceSide?.toUpperCase() ?? side}`
    : relation.reference.endsWith('bicalcaneare') ? 'alla linea bicalcaneare'
    : relation.reference.endsWith('controlaterale') ? `al ${side === 'DX' ? 'SX' : 'DX'}`
    : relation.reference.endsWith('asse_piede') ? 'all’asse completo del piede'
    : 'al cingolo pelvico'
  const orientation = relation.orientation && relation.orientation !== 'indeterminabile' ? `${subject} ${side} ${movement} rispetto ${target}` : 'Orientamento non determinabile'
  const measure = quantitative ? `${quantitative.unit === 'gradi' ? 'Angolo relativo' : 'Indice relativo'}: ${quantitative.value.toFixed(1)}${quantitative.unit === 'gradi' ? '°' : '%'}` : undefined
  const title = relation.relationType === 'dissociazione' && relation.reference === 'scapulum_controlaterale' ? 'Asimmetria scapolare trasversa'
    : relation.relationType === 'dissociazione' && relation.reference === 'ileo_controlaterale' ? 'Asimmetria pelvica trasversa'
    : `${type} ${relation.reference === 'scapolare_pelvico' ? 'scapolo-pelvica' : reference.replace(' ↔ ', '–')}`
  return [title, measure, orientation, relation.orientationSource === 'geometric_suggestion' ? 'orientamento di origine geometrica' : undefined,
    relation.legacyDirection ? `Direzione legacy ${relation.legacyDirection.toUpperCase()} conservata: significato da verificare` : undefined].filter(Boolean).join(' · ')
}
