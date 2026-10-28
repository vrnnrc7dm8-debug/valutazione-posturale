import type { AlterationSelection, ClinicalDirection, Descriptor } from '@/types'

export type FemoroTibialeVariantId =
  | 'asse_femoro_tibiale'
  | 'valgismo_ginocchio'
  | 'varismo_ginocchio'
  | 'intrarotazione_arto_inferiore'
  | 'extrarotazione_arto_inferiore'

export interface FemoroTibialeVariantOption {
  id: FemoroTibialeVariantId
  label: string
  descriptor: Descriptor
  direction?: ClinicalDirection
}

export const FEMORO_TIBIALE_VARIANT_OPTIONS: FemoroTibialeVariantOption[] = [
  {
    id: 'asse_femoro_tibiale',
    label: 'Asse femoro-tibiale',
    descriptor: 'tilt',
  },
  {
    id: 'valgismo_ginocchio',
    label: 'Valgismo ginocchio',
    descriptor: 'tilt',
    direction: 'valgo',
  },
  {
    id: 'varismo_ginocchio',
    label: 'Varismo ginocchio',
    descriptor: 'tilt',
    direction: 'varo',
  },
  {
    id: 'intrarotazione_arto_inferiore',
    label: 'Intrarotazione arto inferiore',
    descriptor: 'rotation',
    direction: 'intrarotazione',
  },
  {
    id: 'extrarotazione_arto_inferiore',
    label: 'Extrarotazione arto inferiore',
    descriptor: 'rotation',
    direction: 'extrarotazione',
  },
]

const VARIANT_DIRECTIONS = new Set<ClinicalDirection>([
  'valgo',
  'varo',
  'intrarotazione',
  'extrarotazione',
])

export function isFemoroTibialeAlteration(alterationId: string): boolean {
  return alterationId === 'asse_femoro_tibiale'
}

export function resolveFemoroTibialeVariantId(
  selection: Pick<AlterationSelection, 'descriptor' | 'direction'>,
): FemoroTibialeVariantId {
  if (selection.descriptor === 'rotation' && selection.direction === 'intrarotazione') {
    return 'intrarotazione_arto_inferiore'
  }
  if (selection.descriptor === 'rotation' && selection.direction === 'extrarotazione') {
    return 'extrarotazione_arto_inferiore'
  }
  if (selection.descriptor === 'tilt' && selection.direction === 'valgo') {
    return 'valgismo_ginocchio'
  }
  if (selection.descriptor === 'tilt' && selection.direction === 'varo') {
    return 'varismo_ginocchio'
  }
  return 'asse_femoro_tibiale'
}

export function applyFemoroTibialeVariant(
  variantId: FemoroTibialeVariantId,
  current?: Pick<AlterationSelection, 'direction'>,
): Pick<AlterationSelection, 'descriptor' | 'direction'> {
  const option = FEMORO_TIBIALE_VARIANT_OPTIONS.find((entry) => entry.id === variantId)
  if (!option) {
    return { descriptor: 'tilt', direction: clearFemoroVariantDirection(current?.direction) }
  }

  if (variantId === 'asse_femoro_tibiale') {
    return {
      descriptor: option.descriptor,
      direction: clearFemoroVariantDirection(current?.direction),
    }
  }

  return {
    descriptor: option.descriptor,
    direction: option.direction,
  }
}

function clearFemoroVariantDirection(
  direction?: ClinicalDirection,
): ClinicalDirection | undefined {
  if (!direction || VARIANT_DIRECTIONS.has(direction)) {
    return undefined
  }
  return direction
}

export function getFemoroTibialeVariantLabel(
  selection: Pick<AlterationSelection, 'descriptor' | 'direction'>,
): string {
  const variantId = resolveFemoroTibialeVariantId(selection)
  return (
    FEMORO_TIBIALE_VARIANT_OPTIONS.find((entry) => entry.id === variantId)?.label ??
    'Asse femoro-tibiale'
  )
}

export function femoroTibialeVariantFromAlignment(
  alignment: 'neutro' | 'valgismo' | 'varismo' | 'non valutabile',
): FemoroTibialeVariantId | undefined {
  if (alignment === 'valgismo') return 'valgismo_ginocchio'
  if (alignment === 'varismo') return 'varismo_ginocchio'
  if (alignment === 'neutro') return 'asse_femoro_tibiale'
  return undefined
}

export function femoroTibialeVariantFromRotation(
  rotation: 'intrarotazione' | 'extrarotazione' | 'neutra' | 'non valutabile',
): FemoroTibialeVariantId | undefined {
  if (rotation === 'intrarotazione') return 'intrarotazione_arto_inferiore'
  if (rotation === 'extrarotazione') return 'extrarotazione_arto_inferiore'
  return undefined
}
