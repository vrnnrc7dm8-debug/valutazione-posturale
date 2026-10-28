import { formatOperatorDirection } from './clinicalOperators'
export { formatOperatorDirection } from './clinicalOperators'
import { formatQuantitativeValue } from '@/data/clinicalThresholds'
import {
  getFemoroTibialeVariantLabel,
  isFemoroTibialeAlteration,
} from '@/data/femoroTibialeDescriptors'
import { getAlterationsForPlane } from '@/data/planes'
import type {
  AlterationSelection,
  AnatomicalPlane,
  ClinicalDirection,
  Descriptor,
  Side,
} from '@/types'
import { SEVERITY_LABELS } from '@/types'

export const CLINICAL_DIRECTION_LABELS: Record<ClinicalDirection, string> = {
  dx: 'Destra',
  sx: 'Sinistra',
  mediale: 'Mediale',
  laterale: 'Laterale',
  varo: 'Varo',
  valgo: 'Valgo',
  anteriore: 'Anteriore',
  posteriore: 'Posteriore',
  antiversione: 'Antiversione',
  retroversione: 'Retroversione',
  anteriorizzazione: 'Anteriorizzazione',
  posteriorizzazione: 'Posteriorizzazione',
  intrarotazione: 'Intrarotazione',
  extrarotazione: 'Extrarotazione',
  rotazione_dx: 'Rotazione DX',
  rotazione_sx: 'Rotazione SX',
}

const FRONTAL_PLANES: AnatomicalPlane[] = ['frontale_anteriore', 'frontale_posteriore']
const SAGITTAL_PLANES: AnatomicalPlane[] = ['sagittale_destro', 'sagittale_sinistro']

/** Override direzioni per alterazioni con semantica clinica specifica. */
const ALTERATION_DIRECTION_OVERRIDES: Record<string, ClinicalDirection[]> = {
  valgismo_varismo_ginocchia: ['valgo', 'varo', 'mediale', 'laterale'],
  asse_calcaneare_anteriore: ['varo', 'valgo', 'mediale', 'laterale'],
  asse_calcaneare_post: ['varo', 'valgo', 'mediale', 'laterale'],
  deviazione_achille: ['varo', 'valgo', 'mediale', 'laterale'],
  anteriorizzazione_capo: ['anteriorizzazione', 'anteriore'],
  anteriorizzazione_capo_sx: ['anteriorizzazione', 'anteriore'],
  forward_head_posture: ['anteriorizzazione', 'anteriore'],
  forward_head_posture_sx: ['anteriorizzazione', 'anteriore'],
  tilt_pelvico_anteriore_sag: ['anteriore', 'antiversione'],
  tilt_pelvico_anteriore_sag_sx: ['anteriore', 'antiversione'],
  tilt_pelvico_posteriore_sag: ['posteriore', 'retroversione'],
  tilt_pelvico_posteriore_sag_sx: ['posteriore', 'retroversione'],
  tilt_pelvico_anteriore: ['anteriore', 'mediale', 'laterale'],
  shift_antero_posterior: ['anteriore', 'posteriore', 'anteriorizzazione', 'posteriorizzazione'],
  shift_antero_posterior_sx: ['anteriore', 'posteriore', 'anteriorizzazione', 'posteriorizzazione'],
  rotazione_femorale: ['intrarotazione', 'extrarotazione', 'rotazione_dx', 'rotazione_sx'],
  rotazione_femorale_stimata: ['intrarotazione', 'extrarotazione', 'rotazione_dx', 'rotazione_sx'],
  asse_femoro_tibiale: ['dx', 'sx', 'anteriore', 'posteriore', 'mediale', 'laterale'],
  rotazione_bacino: ['rotazione_dx', 'rotazione_sx', 'intrarotazione', 'extrarotazione'],
  rotazione_toracica: ['rotazione_dx', 'rotazione_sx', 'intrarotazione', 'extrarotazione'],
}

const DEVIATION_RACHIDE_IDS = [
  'deviazione_rachidea_cervicale',
  'deviazione_rachidea_toracica',
  'deviazione_rachidea_lombare',
  'deviazione_rachidea_lombosacrale',
  'deviazione_sacrale',
] as const

export function getDirectionsForDescriptor(
  plane: AnatomicalPlane,
  descriptor: Descriptor,
): ClinicalDirection[] {
  if (descriptor === 'rotation') return ['rotazione_dx', 'rotazione_sx']
  if (plane === 'trasverso') {
    if (descriptor === 'shift' || descriptor === 'tilt') {
      return ['dx', 'sx']
    }
    return []
  }

  if (FRONTAL_PLANES.includes(plane)) {
    switch (descriptor) {
      case 'tilt':
        return ['dx', 'sx']
      case 'shift':
        return ['dx', 'sx']
      case 'bend':
        return ['dx', 'sx', 'mediale', 'laterale']
      default:
        return []
    }
  }

  if (SAGITTAL_PLANES.includes(plane)) {
    switch (descriptor) {
      case 'tilt':
        return ['anteriore', 'posteriore', 'antiversione', 'retroversione']
      case 'shift':
        return ['anteriore', 'posteriore', 'anteriorizzazione', 'posteriorizzazione']
      case 'bend':
        return ['anteriore', 'posteriore']
      default:
        return []
    }
  }

  return []
}

export function getAllowedDirections(
  plane: AnatomicalPlane,
  alterationId: string,
  descriptor: Descriptor,
): ClinicalDirection[] {
  if (descriptor === 'compenso') return []
  if (descriptor === 'rotation') return ['rotazione_dx', 'rotazione_sx']
  if (FRONTAL_PLANES.includes(plane) && (descriptor === 'shift' || descriptor === 'tilt')) return ['dx', 'sx']
  const def = getAlterationsForPlane(plane).find((a) => a.id === alterationId)
  if (def?.allowedDirections?.length) {
    return def.allowedDirections
  }
  if (ALTERATION_DIRECTION_OVERRIDES[alterationId]) {
    return ALTERATION_DIRECTION_OVERRIDES[alterationId]
  }
  if (
    DEVIATION_RACHIDE_IDS.includes(
      alterationId as (typeof DEVIATION_RACHIDE_IDS)[number],
    )
  ) {
    if (descriptor === 'shift' || descriptor === 'bend') {
      return ['dx', 'sx', 'mediale', 'laterale']
    }
  }
  return getDirectionsForDescriptor(plane, descriptor)
}

export function directionImpliesSide(direction?: ClinicalDirection): Side | undefined {
  if (!direction) return undefined
  if (direction === 'dx' || direction === 'rotazione_dx') return 'destro'
  if (direction === 'sx' || direction === 'rotazione_sx') return 'sinistro'
  return undefined
}

export function sanitizeDirectionForAlteration(
  plane: AnatomicalPlane,
  alterationId: string,
  descriptor: Descriptor,
  direction?: ClinicalDirection,
): ClinicalDirection | undefined {
  if (!direction) return undefined
  const allowed = getAllowedDirections(plane, alterationId, descriptor)
  return allowed.includes(direction) ? direction : undefined
}

export function buildAlterationUpdatePatch(
  plane: AnatomicalPlane,
  alterationId: string,
  current: AlterationSelection,
  patch: Partial<AlterationSelection>,
): Partial<AlterationSelection> {
  const nextDescriptor = patch.descriptor ?? current.descriptor
  let nextDirection = 'direction' in patch ? patch.direction : current.direction

  if (patch.descriptor && patch.descriptor !== current.descriptor) {
    nextDirection = sanitizeDirectionForAlteration(
      plane,
      alterationId,
      nextDescriptor,
      current.direction,
    )
  }

  if ('direction' in patch) {
    nextDirection = sanitizeDirectionForAlteration(
      plane,
      alterationId,
      nextDescriptor,
      patch.direction,
    )
  }

  const nextPatch: Partial<AlterationSelection> = {
    ...patch,
    direction: nextDirection,
  }

  // Body side and motion direction are independent (e.g. right arm rotating left).

  return nextPatch
}

export function formatDirectionLabel(direction?: ClinicalDirection): string | undefined {
  if (!direction) return undefined
  return CLINICAL_DIRECTION_LABELS[direction]
}


export function formatAlterationInstanceSummary(sel: AlterationSelection): string {
  const parts: string[] = []
  const q = formatQuantitativeValue(sel.quantitative)
  if (q) parts.push(q)
  const sideShort: Record<Side, string> = {
    destro: 'DX',
    sinistro: 'SX',
    bilaterale: 'bilat.',
  }
  if (isFemoroTibialeAlteration(sel.alterationId) && sel.descriptor === 'tilt') {
    parts.push(getFemoroTibialeVariantLabel(sel))
    if (sel.side) {
      parts.push(sideShort[sel.side])
    }
    if (
      sel.direction &&
      !['valgo', 'varo', 'intrarotazione', 'extrarotazione'].includes(sel.direction)
    ) {
      parts.push(CLINICAL_DIRECTION_LABELS[sel.direction])
    }
  } else {
    parts.push(formatOperatorDirection(sel.descriptor, sel.direction))
    if (sel.side && !sel.direction) parts.push(`lato ${sideShort[sel.side]}`)
  }
  parts.push(SEVERITY_LABELS[sel.severity])
  return parts.join(' · ')
}

export function effectiveSideForMyers(sel: AlterationSelection): Side | undefined {
  return sel.side ?? directionImpliesSide(sel.direction)
}
