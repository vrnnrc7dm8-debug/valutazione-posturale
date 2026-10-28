import type { AnatomicalPlane, ClinicalDirection, Descriptor } from '@/types'
import { getAlterationsForPlane } from './planes'

/** Compatibility default only for observations saved before the operator field existed. */
export function observationDescriptor(phenomenon: string, plane: AnatomicalPlane, descriptor?: Descriptor): Descriptor {
  if (descriptor) return descriptor
  if (phenomenon === 'deviazione_rachidea') return 'bend'
  if (phenomenon === 'inclinazione_linea_bipupillare') return 'tilt'
  if (phenomenon === 'rotazione_arto_inferiore') return 'rotation'
  if (phenomenon === 'anteriorizzazione_capo') return 'shift'
  return getAlterationsForPlane(plane).find(a => a.id === phenomenon || a.id === `${phenomenon}_sx`)?.suggestedDescriptors[0] ?? 'shift'
}

/** Patient-anatomical direction, independent of the screen coordinates. */
export function formatOperatorDirection(descriptor: Descriptor, direction?: ClinicalDirection): string {
  const label: Record<Descriptor, string> = {
    shift: 'Shift', tilt: 'Tilt', rotation: 'Rotazione', bend: 'Bend', compenso: 'Compenso',
    fissazione_accorciamento: 'Fissazione in accorciamento', fissazione_allungamento: 'Fissazione in allungamento',
  }
  if (descriptor === 'compenso' || !direction) return label[descriptor]
  if (direction === 'rotazione_dx' || direction === 'rotazione_sx') return `${label[descriptor]} ${direction === 'rotazione_dx' ? 'DX' : 'SX'}`
  if (direction === 'dx' || direction === 'sx') return `${label[descriptor]} ${direction.toUpperCase()}`
  return `${label[descriptor]} ${direction.replaceAll('_', ' ')}`
}
