import {
  LEGACY_ALTERATION_LABELS,
  resolveAlterationId,
} from '@/data/alterationAliases'
import type { AnatomicalPlane, ClinicalDirection, ClinicalDistrict, Descriptor, MyofascialLineId } from '@/types'

export interface PlaneAlterationDef {
  id: string
  label: string
  suggestedDescriptors: Descriptor[]
  autoHint?: string
  district?: ClinicalDistrict
  parentType?: string
  allowedDirections?: ClinicalDirection[]
}

export interface PlaneClinicalConfig {
  plane: AnatomicalPlane
  label: string
  shortLabel: string
  alterations: PlaneAlterationDef[]
  primaryMyersLines: MyofascialLineId[]
  biomechanicalFocus: string[]
  dominantPatternHints: string[]
}

export const PLANE_CLINICAL_CONFIGS: Record<AnatomicalPlane, PlaneClinicalConfig> = {
  frontale_anteriore: {
    plane: 'frontale_anteriore',
    label: 'Piano frontale anteriore',
    shortLabel: 'Frontale ant.',
    primaryMyersLines: ['lateral_right', 'lateral_left', 'superficial_front', 'spiral_right', 'spiral_left'],
    biomechanicalFocus: [
      'Assi frontali',
      'Dislivelli acromiali e pelvici',
      'Allineamento ginocchia e piedi',
    ],
    dominantPatternHints: [
      'Cerca dislivello SIAS e shift bacino prima di interpretare arti inferiori.',
    ],
    alterations: [
      { id: 'tilt_capo', label: 'Tilt capo', suggestedDescriptors: ['tilt', 'compenso'], district: 'cranio_cervicale' },
      { id: 'inclinazione_bipupillare', label: 'Inclinazione linea bipupillare', suggestedDescriptors: ['tilt', 'rotation'], district: 'cranio_cervicale' },
      { id: 'asimmetria_mandibolare', label: 'Asimmetria mandibolare', suggestedDescriptors: ['tilt', 'shift'], district: 'cranio_cervicale' },
      { id: 'tilt_spalle', label: 'Tilt spalle', suggestedDescriptors: ['tilt', 'compenso'], district: 'cintura_scapolare' },
      { id: 'dislivello_acromiale', label: 'Dislivello acromiale', suggestedDescriptors: ['tilt', 'shift'], district: 'cintura_scapolare' },
      { id: 'inclinazione_clavicole', label: 'Inclinazione clavicole', suggestedDescriptors: ['tilt', 'rotation'], district: 'cintura_scapolare' },
      { id: 'deviazione_sternale', label: 'Deviazione sternale', suggestedDescriptors: ['shift', 'rotation'], district: 'toracica' },
      { id: 'shift_toracico', label: 'Shift toracico', suggestedDescriptors: ['shift', 'compenso'], district: 'toracica' },
      { id: 'dislivello_costale', label: 'Dislivello costale', suggestedDescriptors: ['tilt', 'bend'], district: 'toracica' },
      { id: 'tilt_pelvico_anteriore', label: 'Tilt pelvico anteriore', suggestedDescriptors: ['tilt', 'shift'], district: 'pelvico' },
      { id: 'dislivello_sias', label: 'Dislivello SIAS', suggestedDescriptors: ['tilt', 'shift'], district: 'pelvico' },
      { id: 'shift_bacino', label: 'Shift bacino', suggestedDescriptors: ['shift', 'compenso'], district: 'pelvico' },
      { id: 'valgismo_varismo_ginocchia', label: 'Valgismo/varismo ginocchia', suggestedDescriptors: ['tilt', 'compenso'], district: 'arto_inferiore' },
      { id: 'rotazione_femorale_stimata', label: 'Rotazione femorale stimata', suggestedDescriptors: ['rotation', 'compenso'], district: 'arto_inferiore' },
      { id: 'asse_femoro_tibiale', label: 'Asse femoro-tibiale', suggestedDescriptors: ['tilt', 'rotation'], district: 'arto_inferiore' },
      { id: 'pronazione_supinazione_piede', label: 'Pronazione/supinazione piede', suggestedDescriptors: ['rotation', 'compenso'], district: 'arto_inferiore' },
      { id: 'asse_calcaneare_anteriore', label: 'Asse calcaneare', suggestedDescriptors: ['tilt', 'shift'], district: 'arto_inferiore' },
      { id: 'appoggio_plantare', label: 'Appoggio plantare', suggestedDescriptors: ['shift', 'compenso'], district: 'arto_inferiore' },
      { id: 'triangoli_taglia', label: 'Triangoli della taglia', suggestedDescriptors: ['tilt', 'shift'], district: 'pelvico' },
      { id: 'shift_capo', label: 'Shift capo', suggestedDescriptors: ['shift'], district: 'cranio_cervicale' },
      { id: 'rotazione_capo', label: 'Rotazione capo', suggestedDescriptors: ['rotation'], district: 'cranio_cervicale' },
    ],
  },
  frontale_posteriore: {
    plane: 'frontale_posteriore',
    label: 'Piano frontale posteriore',
    shortLabel: 'Frontale post.',
    primaryMyersLines: ['spiral_right', 'spiral_left', 'lateral_right', 'lateral_left', 'superficial_back', 'functional_back'],
    biomechanicalFocus: [
      'Curva rachidea e scapole',
      'Triangoli della taglia',
      'Calcagno e Achille',
    ],
    dominantPatternHints: [
      'Valuta curva primaria vs compensatoria prima del tilt pelvico.',
    ],
    alterations: [
      {
        id: 'scoliosi_funzionale',
        label: 'Deviazione laterale funzionale del rachide',
        suggestedDescriptors: ['bend', 'rotation', 'compenso'],
        district: 'globale',
        parentType: 'scoliosi_funzionale',
      },
      {
        id: 'deviazione_rachidea_cervicale',
        label: 'Deviazione cervicale',
        suggestedDescriptors: ['shift', 'bend', 'rotation'],
        district: 'cervicale',
        parentType: 'deviazione_rachidea',
      },
      {
        id: 'deviazione_rachidea_toracica',
        label: 'Deviazione rachidea toracica',
        suggestedDescriptors: ['shift', 'bend'],
        district: 'toracica',
        parentType: 'deviazione_rachidea',
      },
      {
        id: 'deviazione_rachidea_lombare',
        label: 'Deviazione rachidea lombare',
        suggestedDescriptors: ['shift', 'bend'],
        district: 'lombare',
        parentType: 'deviazione_rachidea',
      },
      {
        id: 'deviazione_rachidea_lombosacrale',
        label: 'Deviazione rachidea lombo-sacrale',
        suggestedDescriptors: ['shift', 'bend'],
        district: 'lombosacrale',
        parentType: 'deviazione_rachidea',
      },
      {
        id: 'deviazione_sacrale',
        label: 'Deviazione sacrale',
        suggestedDescriptors: ['shift', 'bend'],
        district: 'sacrale',
        parentType: 'deviazione_rachidea',
      },
      {
        id: 'curva_primaria',
        label: 'Curva primaria',
        suggestedDescriptors: ['bend', 'compenso'],
        district: 'toracica',
        parentType: 'curva_primaria',
      },
      {
        id: 'curva_compensatoria',
        label: 'Curva compensatoria',
        suggestedDescriptors: ['bend', 'compenso'],
        district: 'globale',
        parentType: 'curva_compensatoria',
      },
      {
        id: 'rotazione_vertebrale_stimata',
        label: 'Rotazione vertebrale stimata',
        suggestedDescriptors: ['rotation', 'compenso'],
        district: 'toracica',
        parentType: 'rotazione_vertebrale',
      },
      { id: 'tilt_scapolare', label: 'Tilt scapolare', suggestedDescriptors: ['tilt', 'rotation'], district: 'cintura_scapolare' },
      { id: 'winging_scapolare', label: 'Winging scapolare', suggestedDescriptors: ['shift', 'compenso'], district: 'cintura_scapolare' },
      { id: 'asimmetria_scapolare', label: 'Asimmetria scapolare', suggestedDescriptors: ['tilt', 'rotation'], district: 'cintura_scapolare' },
      {
        id: 'dislivello_spalle_post',
        label: 'Dislivello spalle',
        suggestedDescriptors: ['tilt', 'shift'],
        district: 'cintura_scapolare',
      },
      {
        id: 'inclinazione_rachide',
        label: 'Inclinazione rachide',
        suggestedDescriptors: ['bend', 'tilt'],
        district: 'globale',
        parentType: 'inclinazione_rachide',
      },
      { id: 'shift_laterale_post', label: 'Shift laterale', suggestedDescriptors: ['shift', 'compenso'], district: 'globale' },
      { id: 'tilt_bacino_posteriore', label: 'Tilt bacino posteriore', suggestedDescriptors: ['tilt', 'shift'], district: 'pelvico' },
      { id: 'dislivello_psis', label: 'Dislivello PSIS', suggestedDescriptors: ['tilt', 'shift'], district: 'pelvico' },
      { id: 'asimmetria_glutea', label: 'Asimmetria glutea', suggestedDescriptors: ['tilt', 'shift'], district: 'pelvico' },
      { id: 'asse_calcaneare_post', label: 'Asse calcaneare', suggestedDescriptors: ['tilt', 'rotation'], district: 'arto_inferiore' },
      { id: 'appoggio_retropiede', label: 'Appoggio retropiede', suggestedDescriptors: ['shift', 'compenso'], district: 'arto_inferiore' },
      { id: 'deviazione_achille', label: 'Deviazione tendine Achille', suggestedDescriptors: ['tilt', 'rotation'], district: 'arto_inferiore' },
      { id: 'asimmetria_triangolo_taglia', label: 'Asimmetria triangoli della taglia', suggestedDescriptors: ['tilt', 'shift'], district: 'pelvico' },
      { id: 'tilt_capo', label: 'Tilt capo', suggestedDescriptors: ['tilt'], district: 'cranio_cervicale' },
      { id: 'shift_capo', label: 'Shift capo', suggestedDescriptors: ['shift'], district: 'cranio_cervicale' },
      { id: 'rotazione_capo', label: 'Rotazione capo', suggestedDescriptors: ['rotation'], district: 'cranio_cervicale' },
    ],
  },
  sagittale_destro: {
    plane: 'sagittale_destro',
    label: 'Piano sagittale destro',
    shortLabel: 'Sagittale DX',
    primaryMyersLines: ['superficial_front', 'superficial_back', 'deep_front'],
    biomechanicalFocus: [
      'Catena trago-acromion-trocantere-malleolo',
      'Cifosi/lordosi',
      'Shift baricentrico',
    ],
    dominantPatternHints: [
      'Anteriorizzazione capo e shift anteriore spesso coesistono.',
    ],
    alterations: [
      { id: 'anteriorizzazione_capo', label: 'Anteriorizzazione capo', suggestedDescriptors: ['shift', 'compenso'], district: 'cranio_cervicale' },
      { id: 'forward_head_posture', label: 'Forward head posture', suggestedDescriptors: ['shift', 'compenso'], district: 'cranio_cervicale' },
      { id: 'inclinazione_cervicale', label: 'Inclinazione cervicale', suggestedDescriptors: ['tilt', 'bend'], district: 'cervicale' },
      { id: 'ipercifosi_dorsale', label: 'Ipercifosi dorsale', suggestedDescriptors: ['bend', 'fissazione_accorciamento'], district: 'toracica' },
      { id: 'rettilineizzazione_dorsale', label: 'Rettilineizzazione dorsale', suggestedDescriptors: ['bend', 'fissazione_allungamento'], district: 'toracica' },
      { id: 'iperlordosi_lombare', label: 'Iperlordosi lombare', suggestedDescriptors: ['bend', 'fissazione_accorciamento'], district: 'lombare' },
      { id: 'rettilineizzazione_lombare', label: 'Rettilineizzazione lombare', suggestedDescriptors: ['bend', 'fissazione_allungamento'], district: 'lombare' },
      { id: 'tilt_pelvico_anteriore_sag', label: 'Tilt pelvico anteriore', suggestedDescriptors: ['tilt', 'rotation'], district: 'pelvico' },
      { id: 'tilt_pelvico_posteriore_sag', label: 'Tilt pelvico posteriore', suggestedDescriptors: ['tilt', 'rotation'], district: 'pelvico' },
      { id: 'tilt_pelvico_sag', label: 'Tilt pelvico anteriore/posteriore', suggestedDescriptors: ['tilt', 'rotation'], district: 'pelvico' },
      { id: 'shift_bacino_sagittale', label: 'Shift bacino sagittale', suggestedDescriptors: ['shift', 'compenso'], district: 'pelvico' },
      { id: 'shift_antero_posterior', label: 'Shift anteriore/posteriore', suggestedDescriptors: ['shift', 'compenso'], district: 'globale' },
      { id: 'compenso_toraco_lombare', label: 'Compenso toraco-lombare', suggestedDescriptors: ['compenso', 'bend'], district: 'toraco_lombare' },
      { id: 'protrazione_cingolo_scapolare', label: 'Protrazione cingolo scapolare', suggestedDescriptors: ['shift', 'compenso'], district: 'cintura_scapolare' },
      { id: 'allineamento_trago_acromion', label: 'Allineamento trago-acromion', suggestedDescriptors: ['shift', 'compenso'], district: 'cranio_cervicale' },
      { id: 'allineamento_acromion_trocantere', label: 'Allineamento acromion-trocantere', suggestedDescriptors: ['shift'], district: 'globale' },
      { id: 'allineamento_trocantere_malleolo', label: 'Allineamento trocantere-malleolo', suggestedDescriptors: ['shift'], district: 'arto_inferiore' },
      { id: 'recurvatum_ginocchio', label: 'Recurvatum ginocchio', suggestedDescriptors: ['fissazione_allungamento', 'compenso'], district: 'arto_inferiore' },
      { id: 'flessione_ginocchio', label: 'Flessione ginocchio', suggestedDescriptors: ['fissazione_accorciamento', 'compenso'], district: 'arto_inferiore' },
      { id: 'asse_caviglia', label: 'Asse caviglia', suggestedDescriptors: ['tilt', 'shift'], district: 'arto_inferiore' },
      { id: 'appoggio_avampiede_retropiede', label: 'Appoggio avampiede/retropiede', suggestedDescriptors: ['shift', 'compenso'], district: 'arto_inferiore' },
    ],
  },
  sagittale_sinistro: {
    plane: 'sagittale_sinistro',
    label: 'Piano sagittale sinistro',
    shortLabel: 'Sagittale SX',
    primaryMyersLines: ['superficial_front', 'superficial_back', 'deep_front'],
    biomechanicalFocus: [
      'Catena sagittale sinistra',
      'Confronto asimmetrie DX/SX',
    ],
    dominantPatternHints: [
      'Confronta con sagittale destro per asimmetrie di compenso.',
    ],
    alterations: [
      { id: 'anteriorizzazione_capo_sx', label: 'Anteriorizzazione capo', suggestedDescriptors: ['shift', 'compenso'], district: 'cranio_cervicale' },
      { id: 'forward_head_posture_sx', label: 'Forward head posture', suggestedDescriptors: ['shift', 'compenso'], district: 'cranio_cervicale' },
      { id: 'inclinazione_cervicale_sx', label: 'Inclinazione cervicale', suggestedDescriptors: ['tilt', 'bend'], district: 'cervicale' },
      { id: 'ipercifosi_dorsale_sx', label: 'Ipercifosi dorsale', suggestedDescriptors: ['bend', 'fissazione_accorciamento'], district: 'toracica' },
      { id: 'rettilineizzazione_dorsale_sx', label: 'Rettilineizzazione dorsale', suggestedDescriptors: ['bend', 'fissazione_allungamento'], district: 'toracica' },
      { id: 'iperlordosi_lombare_sx', label: 'Iperlordosi lombare', suggestedDescriptors: ['bend', 'fissazione_accorciamento'], district: 'lombare' },
      { id: 'rettilineizzazione_lombare_sx', label: 'Rettilineizzazione lombare', suggestedDescriptors: ['bend', 'fissazione_allungamento'], district: 'lombare' },
      { id: 'tilt_pelvico_anteriore_sag_sx', label: 'Tilt pelvico anteriore', suggestedDescriptors: ['tilt', 'rotation'], district: 'pelvico' },
      { id: 'tilt_pelvico_posteriore_sag_sx', label: 'Tilt pelvico posteriore', suggestedDescriptors: ['tilt', 'rotation'], district: 'pelvico' },
      { id: 'tilt_pelvico_sag_sx', label: 'Tilt pelvico anteriore/posteriore', suggestedDescriptors: ['tilt', 'rotation'], district: 'pelvico' },
      { id: 'shift_bacino_sagittale_sx', label: 'Shift bacino sagittale', suggestedDescriptors: ['shift', 'compenso'], district: 'pelvico' },
      { id: 'shift_antero_posterior_sx', label: 'Shift anteriore/posteriore', suggestedDescriptors: ['shift', 'compenso'], district: 'globale' },
      { id: 'compenso_toraco_lombare_sx', label: 'Compenso toraco-lombare', suggestedDescriptors: ['compenso', 'bend'], district: 'toraco_lombare' },
      { id: 'protrazione_cingolo_scapolare_sx', label: 'Protrazione cingolo scapolare', suggestedDescriptors: ['shift', 'compenso'], district: 'cintura_scapolare' },
      { id: 'allineamento_trago_acromion_sx', label: 'Allineamento trago-acromion', suggestedDescriptors: ['shift', 'compenso'], district: 'cranio_cervicale' },
      { id: 'allineamento_acromion_trocantere_sx', label: 'Allineamento acromion-trocantere', suggestedDescriptors: ['shift'], district: 'globale' },
      { id: 'allineamento_trocantere_malleolo_sx', label: 'Allineamento trocantere-malleolo', suggestedDescriptors: ['shift'], district: 'arto_inferiore' },
      { id: 'recurvatum_ginocchio_sx', label: 'Recurvatum ginocchio', suggestedDescriptors: ['fissazione_allungamento', 'compenso'], district: 'arto_inferiore' },
      { id: 'flessione_ginocchio_sx', label: 'Flessione ginocchio', suggestedDescriptors: ['fissazione_accorciamento', 'compenso'], district: 'arto_inferiore' },
      { id: 'asse_caviglia_sx', label: 'Asse caviglia', suggestedDescriptors: ['tilt', 'shift'], district: 'arto_inferiore' },
      { id: 'appoggio_avampiede_retropiede_sx', label: 'Appoggio avampiede/retropiede', suggestedDescriptors: ['shift', 'compenso'], district: 'arto_inferiore' },
    ],
  },
  trasverso: {
    plane: 'trasverso',
    label: 'Piano trasverso / rotazionale',
    shortLabel: 'Trasverso',
    primaryMyersLines: ['spiral_right', 'spiral_left', 'functional_front', 'functional_back', 'arm_lines'],
    biomechanicalFocus: [
      'Rotazioni capo-torace-bacino',
      'Orientamento scapolare e podalico proiettato',
      'Compensi incrociati',
    ],
    dominantPatternHints: [
      'Disaccoppiamento torace-bacino suggerisce spirale dominante.',
    ],
    alterations: [
      { id: 'posizione_scapulum', label: 'Posizione scapulum', suggestedDescriptors: ['anteposizione', 'retroposizione'], district: 'cintura_scapolare' },
      { id: 'posizione_ileo', label: 'Posizione ileo / emibacino', suggestedDescriptors: ['anteposizione', 'retroposizione'], district: 'pelvico' },
      { id: 'relazione_scapulum_ileo', label: 'Relazione scapulum–ileo (coppia specifica)', suggestedDescriptors: ['dissociazione'], district: 'toraco_lombare' },
      { id: 'relazione_scapolo_pelvica', label: 'Relazione scapolo-pelvica', suggestedDescriptors: ['dissociazione', 'compenso_crociato', 'taglio_stimato'], district: 'toraco_lombare' },
      { id: 'asimmetria_cingolo_scapolare', label: 'Asimmetria cingolo scapolare', suggestedDescriptors: ['dissociazione'], district: 'cintura_scapolare' },
      { id: 'asimmetria_cingolo_pelvico', label: 'Asimmetria cingolo pelvico', suggestedDescriptors: ['dissociazione'], district: 'pelvico' },
      { id: 'relazione_pelvi_calcagni', label: 'Dissociazione cingolo pelvico–linea bicalcaneare', suggestedDescriptors: ['dissociazione'], district: 'pelvico' },
      { id: 'relazione_scapole_calcagni', label: 'Dissociazione cingolo scapolare–linea bicalcaneare', suggestedDescriptors: ['dissociazione'], district: 'cintura_scapolare' },
      { id: 'relazione_cingoli_piedi', label: 'Disassamento cingoli-piedi', suggestedDescriptors: ['dissociazione', 'compenso_crociato'], district: 'globale' },

      { id: 'rotazione_capo', label: 'Rotazione capo', suggestedDescriptors: ['rotation', 'compenso'], district: 'cranio_cervicale' },
      { id: 'torsione_cervicale', label: 'Torsione cervicale', suggestedDescriptors: ['rotation', 'compenso'], district: 'cervicale' },
      { id: 'rotazione_toracica', label: 'Rotazione toracica', suggestedDescriptors: ['rotation', 'compenso'], district: 'toracica' },
      { id: 'torsione_sternale', label: 'Torsione sternale', suggestedDescriptors: ['rotation', 'shift'], district: 'toracica' },
      { id: 'rotazione_bacino', label: 'Rotazione bacino', suggestedDescriptors: ['rotation', 'compenso'], district: 'pelvico' },
      { id: 'torsione_pelvica', label: 'Torsione pelvica', suggestedDescriptors: ['rotation', 'compenso'], district: 'pelvico' },
      { id: 'orientamento_scapolare', label: 'Orientamento scapolare', suggestedDescriptors: ['rotation', 'tilt'], district: 'cintura_scapolare' },
      { id: 'rotazione_femorale', label: 'Rotazione femorale', suggestedDescriptors: ['rotation', 'compenso'], district: 'arto_inferiore' },
      { id: 'orientamento_rotuleo', label: 'Orientamento rotuleo', suggestedDescriptors: ['rotation', 'tilt'], district: 'arto_inferiore' },
      { id: 'convergenza_piedi', label: 'Convergenza/divergenza piedi', suggestedDescriptors: ['convergenza', 'divergenza', 'rotation'], district: 'arto_inferiore' },
      { id: 'asse_podalico', label: 'Asse podalico', suggestedDescriptors: ['rotation', 'tilt'], district: 'arto_inferiore' },
      { id: 'compensi_crociati', label: 'Compensi crociati', suggestedDescriptors: ['compenso', 'rotation'], district: 'globale' },
      { id: 'disaccoppiamento_torace_bacino', label: 'Disaccoppiamento torace-bacino', suggestedDescriptors: ['rotation', 'shift'], district: 'toraco_lombare' },
    ],
  },
}

export function getPlaneConfig(plane: AnatomicalPlane): PlaneClinicalConfig {
  return PLANE_CLINICAL_CONFIGS[plane]
}

export function getAlterationsForPlane(plane: AnatomicalPlane): PlaneAlterationDef[] {
  return PLANE_CLINICAL_CONFIGS[plane].alterations
}

export function getAlterationLabel(plane: AnatomicalPlane, id: string): string {
  const resolved = resolveAlterationId(id)
  const found = PLANE_CLINICAL_CONFIGS[plane].alterations.find((a) => a.id === resolved)
  if (found) return found.label
  return LEGACY_ALTERATION_LABELS[id] ?? id
}
