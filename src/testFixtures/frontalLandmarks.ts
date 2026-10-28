import { normalizePlacedLandmark } from '@/utils/landmarkMigration'
import type { PlacedLandmark } from '@/types'

/** 21 synthetic, confirmed landmarks; no patient coordinates. */
export function frontal21Landmarks(abnormal = true): PlacedLandmark[] {
  const points: Array<[string, number, number]> = [
    ['vertex', .5, .05], ['glabella', .5, .1], ['bipupillare_dx', .45, .12], ['bipupillare_sx', .55, .12],
    ['trago_dx', .4, .14], ['trago_sx', .6, .14],
    ['acromion_dx', .3, .25], ['acromion_sx', .7, abnormal ? .271 : .25],
    ['linea_sternale', .5, .3], ['sias_dx', .4, .5], ['sias_sx', .6, abnormal ? .528 : .5],
    ['rotula_dx', abnormal ? .44 : .4, .7], ['rotula_sx', abnormal ? .56 : .6, .7],
    ['malleolo_mediale_dx', .41, .9], ['malleolo_laterale_dx', .39, .9],
    ['malleolo_mediale_sx', .59, .9], ['malleolo_laterale_sx', .61, .9],
    ['alluce_dx', abnormal ? .46 : .4, .95], ['alluce_sx', abnormal ? .54 : .6, .95],
    ['stiloide_radiale_dx', .25, .6], ['stiloide_radiale_sx', .75, .6],
  ]
  return points.map(([landmarkId, x, y]) => normalizePlacedLandmark({ id: landmarkId, landmarkId, position: { x, y }, confidence: 1, detectionSource: 'manual', validationState: 'manuale_confermato' }, 'frontale_anteriore'))
}
