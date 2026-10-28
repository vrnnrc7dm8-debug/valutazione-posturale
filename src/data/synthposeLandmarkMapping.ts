import type { AnatomicalPlane } from '@/types'

export const SYNTHPOSE_MODEL = 'stanfordmimi/synthpose-vitpose-base-hf' as const
export const SYNTHPOSE_KEYPOINT_NAMES = [
  'Nose', 'L_Eye', 'R_Eye', 'L_Ear', 'R_Ear', 'L_Shoulder', 'R_Shoulder',
  'L_Elbow', 'R_Elbow', 'L_Wrist', 'R_Wrist', 'L_Hip', 'R_Hip', 'L_Knee',
  'R_Knee', 'L_Ankle', 'R_Ankle', 'sternum', 'rshoulder', 'lshoulder',
  'r_lelbow', 'l_lelbow', 'r_melbow', 'l_melbow', 'r_lwrist', 'l_lwrist',
  'r_mwrist', 'l_mwrist', 'r_ASIS', 'l_ASIS', 'r_PSIS', 'l_PSIS', 'r_knee',
  'l_knee', 'r_mknee', 'l_mknee', 'r_ankle', 'l_ankle', 'r_mankle', 'l_mankle',
  'r_5meta', 'l_5meta', 'r_toe', 'l_toe', 'r_big_toe', 'l_big_toe', 'l_calc',
  'r_calc', 'C7', 'L2', 'T11', 'T6',
] as const
export type SynthposeKeypointName = (typeof SYNTHPOSE_KEYPOINT_NAMES)[number]
export type SynthposeMappingType = 'direct' | 'derived' | 'approximate' | 'manual_only'
export interface SynthposeLandmarkMapping {
  plane: AnatomicalPlane
  synthposeKeypoint: SynthposeKeypointName
  clinicalLandmarkId: string
  mappingType: SynthposeMappingType
  minimumConfidence: number
  /** Even a direct marker must be accepted by the operator before reporting. */
  reportEligibleByDefault: false
  notes: string
}
const mapping = (plane: AnatomicalPlane, synthposeKeypoint: SynthposeKeypointName, clinicalLandmarkId: string,
  mappingType: SynthposeMappingType, notes: string): SynthposeLandmarkMapping => ({
  plane, synthposeKeypoint, clinicalLandmarkId, mappingType, minimumConfidence: mappingType === 'direct' ? 0.75 : 0.50,
  reportEligibleByDefault: false, notes,
})

/** No forced equivalence: only targets actually present in the corresponding plane's catalog. */
export const SYNTHPOSE_LANDMARK_MAPPING: SynthposeLandmarkMapping[] = [
  ...(['dx', 'sx'] as const).flatMap(side => {
    const prefix = side === 'dx' ? 'r' : 'l'
    return [
      mapping('frontale_anteriore', `${prefix}_ASIS`, `sias_${side}`, 'direct', 'Marker SIAS: verificare il punto sulla fotografia.'),
      mapping('frontale_posteriore', `${prefix}_PSIS`, `psis_${side}`, 'direct', 'Marker PSIS/SIPS.'),
      mapping('frontale_posteriore', `${prefix}_calc`, `calcagno_${side}`, 'direct', 'Marker calcaneare, verificare la visibilità.'),
      mapping('frontale_anteriore', `${prefix}_big_toe`, `alluce_${side}`, 'direct', 'Marker alluce.'),
      mapping('frontale_anteriore', `${prefix}shoulder`, `acromion_${side}`, 'approximate', 'Shoulder non equivale necessariamente al punto acromiale.'),
      mapping('frontale_posteriore', `${prefix}shoulder`, `acromion_post_${side}`, 'approximate', 'Shoulder non equivale necessariamente al punto acromiale posteriore.'),
      mapping('frontale_anteriore', `${prefix}_lwrist`, `stiloide_radiale_${side}`, 'approximate', 'Marker laterale del polso: non certifica la stiloide radiale.'),
      mapping('frontale_anteriore', `${prefix}_knee`, `rotula_${side}`, 'approximate', 'Marker del ginocchio laterale: non è il centro rotula.'),
      mapping('frontale_anteriore', `${prefix}_ankle`, `malleolo_laterale_${side}`, 'approximate', 'Marker caviglia laterale: verificare il malleolo.'),
      mapping('frontale_anteriore', `${prefix}_mankle`, `malleolo_mediale_${side}`, 'approximate', 'Marker caviglia mediale: verificare il malleolo.'),
    ]
  }),
  mapping('frontale_posteriore', 'C7', 'cervicale_c7', 'direct', 'Marker C7.'),
  mapping('frontale_posteriore', 'L2', 'lombare_l2', 'direct', 'Marker di riferimento L2.'),
  mapping('frontale_posteriore', 'T11', 'toracico_t11', 'direct', 'Marker di riferimento T11.'),
  mapping('frontale_posteriore', 'T6', 'toracico_t6', 'direct', 'Marker di riferimento T6.'),
  mapping('frontale_anteriore', 'sternum', 'linea_sternale', 'approximate', 'Riferimento sternale; non è lo xifoide.'),
  mapping('frontale_anteriore', 'sternum', 'xifoide', 'manual_only', 'Nessuna equivalenza tra sternum e processo xifoideo.'),
  ...(['sagittale_destro', 'sagittale_sinistro'] as const).flatMap(plane => {
    const prefix = plane === 'sagittale_destro' ? 'r' : 'l'
    return [
      mapping(plane, `${prefix}_ASIS`, `sias_${plane}`, 'direct', 'Solo lato osservato; verificare occlusione.'),
      mapping(plane, `${prefix}_PSIS`, `sips_${plane}`, 'direct', 'Solo lato osservato; verificare occlusione.'),
      mapping(plane, `${prefix}_calc`, `calcagno_${plane}`, 'direct', 'Marker calcaneare del lato osservato.'),
      mapping(plane, 'C7', `c7_${plane}`, 'direct', 'Marker C7.'),
      mapping(plane, 'L2', `l2_${plane}`, 'direct', 'Marker L2.'),
      mapping(plane, 'T11', `t11_${plane}`, 'direct', 'Marker T11.'),
      mapping(plane, `${prefix}shoulder`, `acromion_${plane}`, 'approximate', 'Non assumere shoulder = acromion.'),
      mapping(plane, `${prefix}_knee`, `ginocchio_${plane}`, 'approximate', 'Verificare il riferimento anatomico sagittale del ginocchio.'),
      mapping(plane, `${prefix}_ankle`, `malleolo_lat_${plane}`, 'approximate', 'Verificare il malleolo laterale.'),
    ]
  }),
]
