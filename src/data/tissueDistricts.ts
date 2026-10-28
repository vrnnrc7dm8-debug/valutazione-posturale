import type { AlterationSelection, ClinicalDistrict, PosturalPattern, SpinalRegion } from '@/types'

export type EvidenceRegion = SpinalRegion | ClinicalDistrict | 'coscia' | 'gamba' | 'piede'
export type TissueProximity = 'local' | 'adjacent' | 'remote'

/** Tissue anatomy metadata only: line membership and operator vectors remain in the existing database. */
const TISSUE_REGIONS: Record<string, EvidenceRegion[]> = {
  suboccipitali: ['cervicale'], splenio: ['cervicale'], scaleni: ['cervicale'],
  sternocleidomastoideo: ['cervicale'], 'lungo del collo': ['cervicale'], 'muscoli prevertebrali': ['cervicale'],
  romboidi: ['cervico_dorsale', 'toracica'], trapezio: ['cervico_dorsale', 'cintura_scapolare'],
  'erettori spinali': ['cervico_dorsale', 'toracica', 'toraco_lombare', 'lombare', 'lombosacrale'],
  lunghissimo: ['cervico_dorsale', 'toracica', 'lombare'], ileocostale: ['toracica', 'lombare'],
  intercostali: ['toracica'], 'serrato anteriore': ['toracica', 'cintura_scapolare'],
  'dentato anteriore': ['toracica', 'cintura_scapolare'], 'fascia sternale': ['toracica'],
  obliqui: ['toraco_lombare'], 'obliquo esterno': ['toraco_lombare'], 'obliquo interno': ['toraco_lombare'],
  'retto addominale': ['toraco_lombare'], diaframma: ['toraco_lombare'],
  'trasverso addominale': ['lombare', 'pelvico'], 'fascia toracolombare': ['toraco_lombare', 'lombare', 'lombosacrale'],
  'quadrato dei lombi': ['lombare', 'lombosacrale'], 'legamento sacrotuberoso': ['lombosacrale', 'sacrale', 'pelvico'],
  'pavimento pelvico': ['sacrale', 'pelvico'], ileopsoas: ['lombare', 'pelvico'],
  'medio gluteo': ['pelvico'], 'piccolo gluteo': ['pelvico'], 'grande gluteo': ['pelvico'],
  'tensore fascia lata': ['pelvico', 'coscia'], 'bandelletta ileotibiale': ['coscia'],
  ischiocrurali: ['coscia'], 'bicipite femorale': ['coscia'], semitendinoso: ['coscia'], semimembranoso: ['coscia'],
  quadricipite: ['coscia'], 'retto femorale': ['coscia'], adduttori: ['coscia'],
  gastrocnemio: ['gamba'], soleo: ['gamba'], 'tibiale anteriore': ['gamba'],
  'tibiale posteriore': ['gamba', 'piede'], peronei: ['gamba', 'piede'], 'fascia plantare': ['piede'],
  deltoide: ['cintura_scapolare'], 'gran dorsale': ['toracica', 'cintura_scapolare'],
  'pettorale maggiore/minore': ['toracica', 'cintura_scapolare'], 'pettorale maggiore': ['toracica', 'cintura_scapolare'],
  'piccolo pettorale': ['toracica', 'cintura_scapolare'], bicipite: ['arto_superiore'], tricipite: ['arto_superiore'],
  'bicipite brachiale': ['arto_superiore'], brachiale: ['arto_superiore'],
  'flessori/estensori avambraccio': ['arto_superiore'], 'fascia palmare': ['arto_superiore'],
}
const SPINE: EvidenceRegion[] = ['cervicale', 'cervico_dorsale', 'toracica', 'toraco_lombare', 'lombare', 'lombosacrale', 'sacrale']
export function isSpinalPhenomenon(id: string): boolean {
  return /deviazione_rachidea|deviazione_sacrale|scoliosi|curva_primaria/.test(id)
}
export function primaryRegion(value: Pick<PosturalPattern, 'phenomenon' | 'district' | 'anatomicalDetails'>): EvidenceRegion {
  const region = value.anatomicalDetails?.region
  if (region) return region
  if (/plantare|retropiede|avampiede|calcaneare/.test(value.phenomenon)) return 'piede'
  if (/achille/.test(value.phenomenon)) return 'gamba'
  if (/femoro_tibiale|ginocchio|femorale/.test(value.phenomenon)) return 'coscia'
  return value.district === 'cranio_cervicale' ? 'cervicale' : value.district ?? 'globale'
}
export function alterationRegion(a: AlterationSelection): EvidenceRegion {
  const region = a.anatomicalDetails?.region
  if (region) return region
  const suffix = a.alterationId.replace(/^deviazione_rachidea_/, '')
  if (SPINE.includes(suffix as EvidenceRegion)) return suffix as EvidenceRegion
  if (a.alterationId === 'deviazione_sacrale') return 'sacrale'
  return primaryRegion({ phenomenon: a.alterationId, district: a.district ?? 'globale' })
}
export function tissueProximity(tissue: string, region: EvidenceRegion): TissueProximity {
  const regions = TISSUE_REGIONS[tissue.toLowerCase()] ?? []
  if (regions.includes(region) || (region === 'arto_inferiore' && regions.some(r => ['pelvico', 'coscia', 'gamba', 'piede'].includes(r)))) return 'local'
  const index = SPINE.indexOf(region)
  if (index >= 0 && regions.some(r => SPINE.includes(r) && Math.abs(SPINE.indexOf(r) - index) === 1)) return 'adjacent'
  if ((region === 'cervicale' && regions.includes('cintura_scapolare')) || (region === 'lombosacrale' && regions.includes('pelvico'))) return 'adjacent'
  return 'remote'
}
