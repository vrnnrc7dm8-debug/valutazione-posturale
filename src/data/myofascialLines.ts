import type { Descriptor, MyofascialLineId, Side, TissueState } from '@/types'

/** Metadati clinici per singolo tessuto miofasciale (Step 7). */
export interface MyofascialTissueMeta {
  name: string
  defaultSide?: Side
  defaultStates: TissueState[]
  /** Hint per alterationId o parentType (es. deviazione_rachidea_lombare). */
  alterationHints?: Record<string, TissueState>
  descriptorHints?: Partial<Record<Descriptor, TissueState>>
}

export interface MyofascialLineDefinition {
  id: MyofascialLineId
  name: string
  districts: string[]
  softTissues: string[]
}

export const MYOFASCIAL_LINES: Record<MyofascialLineId, MyofascialLineDefinition> =
  {
    superficial_front: {
      id: 'superficial_front',
      name: 'Linea Superficiale Frontale',
      districts: [
        'piede anteriore',
        'ginocchio',
        'anca',
        'addome',
        'torace anteriore',
        'collo anteriore',
      ],
      softTissues: [
        'tibiale anteriore',
        'quadricipite',
        'retto femorale',
        'retto addominale',
        'fascia sternale',
        'sternocleidomastoideo',
      ],
    },
    superficial_back: {
      id: 'superficial_back',
      name: 'Linea Superficiale Posteriore',
      districts: [
        'piede plantare',
        'gamba posteriore',
        'coscia posteriore',
        'bacino posteriore',
        'colonna dorsale',
        'occipite',
      ],
      softTissues: [
        'fascia plantare',
        'gastrocnemio',
        'soleo',
        'ischiocrurali',
        'legamento sacrotuberoso',
        'erettori spinali',
        'fascia toracolombare',
        'suboccipitali',
      ],
    },
    lateral_right: {
      id: 'lateral_right',
      name: 'Linea Laterale destra',
      districts: [
        'piede laterale DX',
        'ginocchio DX',
        'anca DX',
        'bacino DX',
        'costato DX',
        'collo laterale DX',
      ],
      softTissues: [
        'peronei',
        'bandelletta ileotibiale',
        'tensore fascia lata',
        'medio gluteo',
        'piccolo gluteo',
        'quadrato dei lombi',
        'intercostali',
        'scaleni',
      ],
    },
    lateral_left: {
      id: 'lateral_left',
      name: 'Linea Laterale sinistra',
      districts: [
        'piede laterale SX',
        'ginocchio SX',
        'anca SX',
        'bacino SX',
        'costato SX',
        'collo laterale SX',
      ],
      softTissues: [
        'peronei',
        'bandelletta ileotibiale',
        'tensore fascia lata',
        'medio gluteo',
        'piccolo gluteo',
        'quadrato dei lombi',
        'intercostali',
        'scaleni',
      ],
    },
    spiral_right: {
      id: 'spiral_right',
      name: 'Linea Spirale destra',
      districts: [
        'occipite DX',
        'torace DX',
        'addome obliquo DX',
        'anca DX',
        'gamba anteriore DX',
      ],
      softTissues: [
        'splenio',
        'romboidi',
        'serrato anteriore',
        'obliqui',
        'fascia toracolombare',
        'bicipite femorale',
        'tibiale anteriore',
        'peronei',
      ],
    },
    spiral_left: {
      id: 'spiral_left',
      name: 'Linea Spirale sinistra',
      districts: [
        'occipite SX',
        'torace SX',
        'addome obliquo SX',
        'anca SX',
        'gamba anteriore SX',
      ],
      softTissues: [
        'splenio',
        'romboidi',
        'serrato anteriore',
        'obliqui',
        'fascia toracolombare',
        'bicipite femorale',
        'tibiale anteriore',
        'peronei',
      ],
    },
    deep_front: {
      id: 'deep_front',
      name: 'Linea Profonda Frontale',
      districts: [
        'arco plantare',
        'pavimento pelvico',
        'diaframma',
        'collo profondo',
      ],
      softTissues: [
        'tibiale posteriore',
        'adduttori',
        'pavimento pelvico',
        'ileopsoas',
        'diaframma',
        'trasverso addominale',
        'lungo del collo',
        'muscoli prevertebrali',
      ],
    },
    arm_lines: {
      id: 'arm_lines',
      name: 'Linee del Braccio',
      districts: [
        'spalla',
        'braccio',
        'avambraccio',
        'mano',
      ],
      softTissues: [
        'trapezio',
        'gran dorsale',
        'pettorale maggiore/minore',
        'deltoide',
        'bicipite',
        'tricipite',
        'flessori/estensori avambraccio',
        'fascia palmare',
      ],
    },
    linea_superficiale_frontale_braccio_dx: {
      id: 'linea_superficiale_frontale_braccio_dx',
      name: 'Linea Superficiale Frontale del Braccio DX',
      districts: ['spalla DX', 'braccio anteriore DX', 'avambraccio anteriore DX', 'mano DX'],
      softTissues: [
        'pettorale maggiore',
        'gran dorsale',
        'setto intermuscolare mediale',
        'flessori del polso e delle dita',
      ],
    },
    linea_superficiale_frontale_braccio_sx: {
      id: 'linea_superficiale_frontale_braccio_sx',
      name: 'Linea Superficiale Frontale del Braccio SX',
      districts: ['spalla SX', 'braccio anteriore SX', 'avambraccio anteriore SX', 'mano SX'],
      softTissues: [
        'pettorale maggiore',
        'gran dorsale',
        'setto intermuscolare mediale',
        'flessori del polso e delle dita',
      ],
    },
    linea_profonda_frontale_braccio_dx: {
      id: 'linea_profonda_frontale_braccio_dx',
      name: 'Linea Profonda Frontale del Braccio DX',
      districts: ['spalla DX', 'braccio anteriore DX', 'avambraccio anteriore DX'],
      softTissues: [
        'piccolo pettorale',
        'bicipite brachiale',
        'brachiale',
        'periostio radiale',
        'muscoli tenari',
      ],
    },
    linea_profonda_frontale_braccio_sx: {
      id: 'linea_profonda_frontale_braccio_sx',
      name: 'Linea Profonda Frontale del Braccio SX',
      districts: ['spalla SX', 'braccio anteriore SX', 'avambraccio anteriore SX'],
      softTissues: [
        'piccolo pettorale',
        'bicipite brachiale',
        'brachiale',
        'periostio radiale',
        'muscoli tenari',
      ],
    },
    linea_superficiale_posteriore_braccio_dx: {
      id: 'linea_superficiale_posteriore_braccio_dx',
      name: 'Linea Superficiale Posteriore del Braccio DX',
      districts: ['spalla DX', 'braccio posteriore DX', 'avambraccio posteriore DX'],
      softTissues: [
        'trapezio',
        'deltoide',
        'setto intermuscolare laterale',
        'estensori del polso e delle dita',
      ],
    },
    linea_superficiale_posteriore_braccio_sx: {
      id: 'linea_superficiale_posteriore_braccio_sx',
      name: 'Linea Superficiale Posteriore del Braccio SX',
      districts: ['spalla SX', 'braccio posteriore SX', 'avambraccio posteriore SX'],
      softTissues: [
        'trapezio',
        'deltoide',
        'setto intermuscolare laterale',
        'estensori del polso e delle dita',
      ],
    },
    linea_profonda_posteriore_braccio_dx: {
      id: 'linea_profonda_posteriore_braccio_dx',
      name: 'Linea Profonda Posteriore del Braccio DX',
      districts: ['spalla DX', 'braccio posteriore DX', 'avambraccio posteriore DX'],
      softTissues: [
        'romboidi',
        'elevatore della scapola',
        'cuffia dei rotatori',
        'tricipite brachiale',
        'periostio ulnare',
        'muscoli ipotenari',
      ],
    },
    linea_profonda_posteriore_braccio_sx: {
      id: 'linea_profonda_posteriore_braccio_sx',
      name: 'Linea Profonda Posteriore del Braccio SX',
      districts: ['spalla SX', 'braccio posteriore SX', 'avambraccio posteriore SX'],
      softTissues: [
        'romboidi',
        'elevatore della scapola',
        'cuffia dei rotatori',
        'tricipite brachiale',
        'periostio ulnare',
        'muscoli ipotenari',
      ],
    },
    functional_front: {
      id: 'functional_front',
      name: 'Linea Funzionale Frontale',
      districts: [
        'catena cinetica anteriore',
        'piede–anca–trunk anteriore',
      ],
      softTissues: [
        'quadricipite',
        'retto addominale',
        'pettorali',
        'sternocleidomastoideo',
        'tibiale anteriore',
      ],
    },
    functional_back: {
      id: 'functional_back',
      name: 'Linea Funzionale Posteriore',
      districts: [
        'catena cinetica posteriore',
        'piede–anca–trunk posteriore',
      ],
      softTissues: [
        'ischiocrurali',
        'glutei',
        'erettori spinali',
        'trapezio',
        'gastrocnemio',
      ],
    },
  }

export const ALL_LINE_IDS = Object.keys(
  MYOFASCIAL_LINES,
) as MyofascialLineId[]

/**
 * Catalogo tessuti con hint per alterazione/descrittore.
 * Chiave normalizzata: lowercase trim.
 */
export const TISSUE_CATALOG: Record<string, MyofascialTissueMeta> = {
  ileopsoas: {
    name: 'ileopsoas',
    defaultStates: ['accorciamento', 'fissazione'],
    alterationHints: {
      tilt_pelvico_anteriore: 'accorciamento',
      tilt_pelvico_anteriore_sag: 'accorciamento',
      tilt_pelvico_anteriore_sag_sx: 'accorciamento',
      anteriorizzazione_capo: 'accorciamento',
      forward_head_posture: 'accorciamento',
    },
    descriptorHints: { tilt: 'accorciamento', shift: 'accorciamento' },
  },
  'retto femorale': {
    name: 'recto femorale',
    defaultStates: ['accorciamento', 'compenso'],
    alterationHints: {
      tilt_pelvico_anteriore_sag: 'accorciamento',
      iperlordosi_lombare: 'accorciamento',
    },
  },
  'retto addominale': {
    name: 'retto addominale',
    defaultStates: ['accorciamento', 'compenso'],
    alterationHints: {
      tilt_pelvico_anteriore: 'accorciamento',
      tilt_pelvico_anteriore_sag: 'accorciamento',
      anteriorizzazione_capo: 'accorciamento',
    },
  },
  ischiocrurali: {
    name: 'ischiocrurali',
    defaultStates: ['allungamento', 'compenso'],
    alterationHints: {
      tilt_pelvico_anteriore_sag: 'allungamento',
      iperlordosi_lombare: 'allungamento',
    },
    descriptorHints: { tilt: 'allungamento' },
  },
  erettori: {
    name: 'erettori spinali',
    defaultStates: ['accorciamento', 'fissazione'],
    alterationHints: {
      deviazione_rachidea_lombare: 'accorciamento',
      deviazione_rachidea_toracica: 'accorciamento',
      iperlordosi_lombare: 'accorciamento',
      ipercifosi_dorsale: 'accorciamento',
    },
    descriptorHints: { bend: 'accorciamento' },
  },
  'erettori spinali': {
    name: 'erettori spinali',
    defaultStates: ['accorciamento', 'fissazione'],
    alterationHints: {
      deviazione_rachidea_lombare: 'accorciamento',
      deviazione_rachidea_toracica: 'accorciamento',
      iperlordosi_lombare: 'accorciamento',
      ipercifosi_dorsale: 'accorciamento',
    },
    descriptorHints: { bend: 'accorciamento' },
  },
  obliqui: {
    name: 'obliqui',
    defaultStates: ['accorciamento', 'compenso'],
    alterationHints: {
      deviazione_rachidea_toracica: 'accorciamento',
      deviazione_rachidea_lombare: 'accorciamento',
      rotazione_toracica: 'accorciamento',
      scoliosi_funzionale: 'accorciamento',
    },
    descriptorHints: { rotation: 'accorciamento' },
  },
  'quadrato dei lombi': {
    name: 'quadrato dei lombi',
    defaultStates: ['accorciamento', 'fissazione'],
    alterationHints: {
      deviazione_rachidea_lombare: 'accorciamento',
      dislivello_sias: 'accorciamento',
      tilt_pelvico_anteriore: 'accorciamento',
    },
  },
  sternocleidomastoideo: {
    name: 'sternocleidomastoideo',
    defaultStates: ['accorciamento', 'compenso'],
    alterationHints: {
      anteriorizzazione_capo: 'accorciamento',
      forward_head_posture: 'accorciamento',
    },
  },
  suboccipitali: {
    name: 'suboccipitali',
    defaultStates: ['accorciamento', 'fissazione'],
    alterationHints: {
      anteriorizzazione_capo: 'accorciamento',
      forward_head_posture: 'accorciamento',
    },
  },
  'tensore fascia lata': {
    name: 'tensore fascia lata',
    defaultStates: ['accorciamento', 'compenso'],
    alterationHints: {
      dislivello_sias: 'accorciamento',
      tilt_pelvico_anteriore: 'accorciamento',
    },
  },
  'medio gluteo': {
    name: 'medio gluteo',
    defaultStates: ['allungamento', 'compenso'],
    alterationHints: {
      dislivello_sias: 'allungamento',
      shift_bacino: 'compenso',
    },
  },
  trapezio: {
    name: 'trapezio',
    defaultStates: ['accorciamento', 'compenso'],
    alterationHints: {
      tilt_scapolare: 'accorciamento',
      asimmetria_scapolare: 'accorciamento',
      winging_scapolare: 'allungamento',
    },
  },
  romboidi: {
    name: 'romboidi',
    defaultStates: ['allungamento', 'compenso'],
    alterationHints: {
      winging_scapolare: 'allungamento',
      tilt_scapolare: 'allungamento',
    },
  },
  scaleni: {
    name: 'scaleni',
    defaultStates: ['accorciamento', 'compenso'],
    alterationHints: {
      deviazione_rachidea_cervicale: 'accorciamento',
      anteriorizzazione_capo: 'accorciamento',
    },
  },
  gastrocnemio: {
    name: 'gastrocnemio',
    defaultStates: ['accorciamento', 'compenso'],
    descriptorHints: { compenso: 'compenso' },
  },
}

function normalizeTissueKey(name: string): string {
  return name.trim().toLowerCase()
}

export function getTissueCatalogEntry(name: string): MyofascialTissueMeta | undefined {
  return TISSUE_CATALOG[normalizeTissueKey(name)]
}

export function resolveTissueFunctionalState(
  tissueName: string,
  lineScore: number,
  descriptor?: Descriptor,
  resolvedAlterationId?: string,
  fallback?: TissueState,
): TissueState {
  const entry = getTissueCatalogEntry(tissueName)
  if (entry?.alterationHints && resolvedAlterationId) {
    const direct = entry.alterationHints[resolvedAlterationId]
    if (direct) return direct
  }
  if (entry?.descriptorHints && descriptor) {
    const fromDescriptor = entry.descriptorHints[descriptor]
    if (fromDescriptor) return fromDescriptor
  }
  if (fallback) return fallback
  if (entry?.defaultStates[0]) return entry.defaultStates[0]
  return inferTissueState(lineScore, descriptor)
}

export function inferTissueState(
  score: number,
  dominantDescriptor?: string,
): TissueState {
  if (dominantDescriptor?.includes('accorciamento')) return 'accorciamento'
  if (dominantDescriptor?.includes('allungamento')) return 'allungamento'
  if (dominantDescriptor === 'compenso') return 'compenso'
  if (score >= 8) return 'fissazione'
  if (score >= 4) return 'accorciamento'
  return 'compenso'
}

/** Piano di osservazione nel database clinico linee/vettori. */
export type ClinicalObservationPlane =
  | 'front_anterior'
  | 'front_posterior'
  | 'sagittal'
  | 'transverse'

export type FunctionalMovementOperator = 'tilt' | 'shift' | 'bend' | 'rotation'

export interface FunctionalVectorProfile {
  plane: ClinicalObservationPlane
  tilt: string[]
  shift: string[]
  bend: string[]
  rotation: string[]
}

/** Profilo clinico esteso: linee dx/sx, muscoli, vettori, riferimenti anatomici. */
export interface MyofascialLineClinicalProfile {
  id: MyofascialLineId
  name: string
  side: 'dx' | 'sx' | 'bilateral'
  districts: string[]
  muscles: string[]
  primaryReferences: string[]
  secondaryReferences: string[]
  vectors: FunctionalVectorProfile[]
}

const frontAnteriorVectors = (
  tilt: string[],
  shift: string[] = [],
  bend: string[] = [],
  rotation: string[] = [],
): FunctionalVectorProfile => ({
  plane: 'front_anterior',
  tilt,
  shift,
  bend,
  rotation,
})

const frontPosteriorVectors = (
  tilt: string[],
  shift: string[] = [],
  bend: string[] = [],
  rotation: string[] = [],
): FunctionalVectorProfile => ({
  plane: 'front_posterior',
  tilt,
  shift,
  bend,
  rotation,
})

const sagittalVectors = (
  tilt: string[],
  shift: string[] = [],
  bend: string[] = [],
  rotation: string[] = [],
): FunctionalVectorProfile => ({
  plane: 'sagittal',
  tilt,
  shift,
  bend,
  rotation,
})

const transverseVectors = (
  tilt: string[],
  shift: string[] = [],
  bend: string[] = [],
  rotation: string[] = [],
): FunctionalVectorProfile => ({
  plane: 'transverse',
  tilt,
  shift,
  bend,
  rotation,
})

/**
 * Database clinico linee miofasciali — muscoli, vettori funzionali, riferimenti.
 * Derivato dalla struttura "Linee muscoli e vettori" (Myers Anatomy Trains).
 */
export const MYOFASCIAL_CLINICAL_DATABASE: MyofascialLineClinicalProfile[] = [
  {
    id: 'superficial_front',
    name: 'Linea Superficiale Frontale',
    side: 'bilateral',
    districts: MYOFASCIAL_LINES.superficial_front.districts,
    muscles: [
      'sternocleidomastoideo',
      'retto femorale',
      'tibiale anteriore',
      'estensore lungo delle dita',
      'quadricipite',
      'retto addominale',
      'fascia sternale',
    ],
    primaryReferences: ['vertex', 'manubrio', 'sias', 'rotula', 'malleolo', 'alluce'],
    secondaryReferences: ['glabella', 'xifoide', 'ombelico', 'trocantere'],
    vectors: [
      frontAnteriorVectors(
        ['tilt capo', 'tilt tronco'],
        ['anteriorizzazione testa', 'shift sterno', 'shift bacino'],
        ['flessione tronco'],
      ),
      sagittalVectors(
        ['tilt pelvico anteriore'],
        ['anteriorizzazione testa', 'shift acromion-trocantere'],
        ['ipercifosi/iperlordosi compensatoria'],
      ),
    ],
  },
  {
    id: 'superficial_back',
    name: 'Linea Superficiale Posteriore',
    side: 'bilateral',
    districts: MYOFASCIAL_LINES.superficial_back.districts,
    muscles: [
      'gastrocnemio',
      'soleo',
      'bicipite femorale',
      'semitendinoso',
      'semimembranoso',
      'erettori spinali',
      'lunghissimo',
      'ileocostale',
      'fascia toracolombare',
      'suboccipitali',
      'fascia plantare',
    ],
    primaryReferences: ['occipite', 'c7', 'psis', 'calcagno', 'achille'],
    secondaryReferences: ['processi spinosi', 'apice_sacrale', 'fossa_poplitea'],
    vectors: [
      frontPosteriorVectors(
        ['tilt scapolare', 'deviazione rachide'],
        ['shift bacino posteriore'],
        ['scoliosi funzionale', 'cifosi'],
      ),
      sagittalVectors(
        ['tilt pelvico posteriore'],
        ['posteriorizzazione testa'],
        ['ipercifosi dorsale', 'iperlordosi lombare'],
      ),
    ],
  },
  {
    id: 'lateral_right',
    name: 'Linea Laterale destra',
    side: 'dx',
    districts: MYOFASCIAL_LINES.lateral_right.districts,
    muscles: [
      'tensore fascia lata',
      'peronei',
      'bandelletta ileotibiale',
      'medio gluteo',
      'piccolo gluteo',
      'quadrato dei lombi',
      'intercostali',
      'scaleni',
    ],
    primaryReferences: ['acromion_dx', 'sias_dx', 'rotula_dx', 'malleolo_laterale_dx'],
    secondaryReferences: ['cresta_iliaca_dx', 'trocantere_dx', 'arco_costale_dx'],
    vectors: [
      frontAnteriorVectors(
        ['tilt spalle dx', 'tilt bacino dx', 'tilt testa dx'],
        ['shift bacino dx', 'shift ginocchio dx'],
        ['bend laterale dx'],
      ),
      frontPosteriorVectors(
        ['asimmetria scapolare dx'],
        ['shift pelvico dx'],
      ),
      transverseVectors([], [], [], ['rotazione cingolo scapolare dx']),
    ],
  },
  {
    id: 'lateral_left',
    name: 'Linea Laterale sinistra',
    side: 'sx',
    districts: MYOFASCIAL_LINES.lateral_left.districts,
    muscles: [
      'tensore fascia lata',
      'peronei',
      'bandelletta ileotibiale',
      'medio gluteo',
      'piccolo gluteo',
      'quadrato dei lombi',
      'intercostali',
      'scaleni',
    ],
    primaryReferences: ['acromion_sx', 'sias_sx', 'rotula_sx', 'malleolo_laterale_sx'],
    secondaryReferences: ['cresta_iliaca_sx', 'trocantere_sx', 'arco_costale_sx'],
    vectors: [
      frontAnteriorVectors(
        ['tilt spalle sx', 'tilt bacino sx', 'tilt testa sx'],
        ['shift bacino sx', 'shift ginocchio sx'],
        ['bend laterale sx'],
      ),
      frontPosteriorVectors(
        ['asimmetria scapolare sx'],
        ['shift pelvico sx'],
      ),
      transverseVectors([], [], [], ['rotazione cingolo scapolare sx']),
    ],
  },
  {
    id: 'spiral_right',
    name: 'Linea Spirale destra',
    side: 'dx',
    districts: MYOFASCIAL_LINES.spiral_right.districts,
    muscles: [
      'sternocleidomastoideo',
      'obliquo esterno',
      'obliquo interno',
      'dentato anteriore',
      'serrato anteriore',
      'bicipite femorale',
      'tibiale anteriore',
      'peronei',
      'splenio',
      'romboidi',
    ],
    primaryReferences: ['acromion_dx', 'sias_dx', 'vertex', 'angolo_scapola_inf_dx'],
    secondaryReferences: ['manubrio', 'ombelico', 'rotula_dx'],
    vectors: [
      frontAnteriorVectors(
        ['tilt obliquo dx'],
        ['shift rotazionale tronco dx'],
        ['bend + rotazione'],
        ['rotazione cingolo scapolare dx'],
      ),
      frontPosteriorVectors(
        ['deviazione rachide con rotazione dx'],
        [],
        ['scoliosi funzionale'],
        ['rotazione toracica dx'],
      ),
      transverseVectors([], [], [], ['torsione sternale dx', 'compensi crociati dx']),
    ],
  },
  {
    id: 'spiral_left',
    name: 'Linea Spirale sinistra',
    side: 'sx',
    districts: MYOFASCIAL_LINES.spiral_left.districts,
    muscles: [
      'sternocleidomastoideo',
      'obliquo esterno',
      'obliquo interno',
      'dentato anteriore',
      'serrato anteriore',
      'bicipite femorale',
      'tibiale anteriore',
      'peronei',
      'splenio',
      'romboidi',
    ],
    primaryReferences: ['acromion_sx', 'sias_sx', 'vertex', 'angolo_scapola_inf_sx'],
    secondaryReferences: ['manubrio', 'ombelico', 'rotula_sx'],
    vectors: [
      frontAnteriorVectors(
        ['tilt obliquo sx'],
        ['shift rotazionale tronco sx'],
        ['bend + rotazione'],
        ['rotazione cingolo scapolare sx'],
      ),
      frontPosteriorVectors(
        ['deviazione rachide con rotazione sx'],
        [],
        ['scoliosi funzionale'],
        ['rotazione toracica sx'],
      ),
      transverseVectors([], [], [], ['torsione sternale sx', 'compensi crociati sx']),
    ],
  },
  {
    id: 'deep_front',
    name: 'Linea Profonda Frontale',
    side: 'bilateral',
    districts: MYOFASCIAL_LINES.deep_front.districts,
    muscles: [
      'ileopsoas',
      'tibiale posteriore',
      'adduttori',
      'pavimento pelvico',
      'diaframma',
      'trasverso addominale',
      'lungo del collo',
    ],
    primaryReferences: ['sias', 'sips', 'manubrio', 'xifoide'],
    secondaryReferences: ['ombelico', 'sinfisi_pubica'],
    vectors: [
      frontAnteriorVectors(['tilt pelvico'], ['shift bacino anteriore']),
      sagittalVectors(['antiversione bacino'], ['anteriorizzazione testa']),
    ],
  },
  {
    id: 'arm_lines',
    name: 'Linee del Braccio',
    side: 'bilateral',
    districts: MYOFASCIAL_LINES.arm_lines.districts,
    muscles: [
      'trapezio',
      'deltoide',
      'pettorale maggiore',
      'pettorale minore',
      'bicipite',
      'tricipite',
      'gran dorsale',
    ],
    primaryReferences: ['acromion_dx', 'acromion_sx', 'clavicola_dx', 'clavicola_sx'],
    secondaryReferences: ['sterno_clavicolare_dx', 'sterno_clavicolare_sx'],
    vectors: [
      frontAnteriorVectors(['tilt spalle'], ['shift cingolo scapolare']),
      frontPosteriorVectors(['winging scapolare', 'tilt scapolare']),
    ],
  },
  {
    id: 'linea_superficiale_frontale_braccio_dx',
    name: 'Linea Superficiale Frontale del Braccio DX',
    side: 'dx',
    districts: MYOFASCIAL_LINES.linea_superficiale_frontale_braccio_dx.districts,
    muscles: MYOFASCIAL_LINES.linea_superficiale_frontale_braccio_dx.softTissues,
    primaryReferences: ['acromion_dx', 'gomito_dx', 'stiloide_radiale_dx', 'dorso_mano_dx'],
    secondaryReferences: ['clavicola_dx'],
    vectors: [
      frontAnteriorVectors([], ['shift arto superiore'], [], ['intrarotazione arto superiore']),
    ],
  },
  {
    id: 'linea_superficiale_frontale_braccio_sx',
    name: 'Linea Superficiale Frontale del Braccio SX',
    side: 'sx',
    districts: MYOFASCIAL_LINES.linea_superficiale_frontale_braccio_sx.districts,
    muscles: MYOFASCIAL_LINES.linea_superficiale_frontale_braccio_sx.softTissues,
    primaryReferences: ['acromion_sx', 'gomito_sx', 'stiloide_radiale_sx', 'dorso_mano_sx'],
    secondaryReferences: ['clavicola_sx'],
    vectors: [
      frontAnteriorVectors([], ['shift arto superiore'], [], ['intrarotazione arto superiore']),
    ],
  },
  {
    id: 'linea_profonda_frontale_braccio_dx',
    name: 'Linea Profonda Frontale del Braccio DX',
    side: 'dx',
    districts: MYOFASCIAL_LINES.linea_profonda_frontale_braccio_dx.districts,
    muscles: MYOFASCIAL_LINES.linea_profonda_frontale_braccio_dx.softTissues,
    primaryReferences: ['acromion_dx', 'gomito_dx', 'stiloide_radiale_dx'],
    secondaryReferences: ['dorso_mano_dx'],
    vectors: [
      frontAnteriorVectors([], ['shift arto superiore'], [], ['intrarotazione arto superiore']),
    ],
  },
  {
    id: 'linea_profonda_frontale_braccio_sx',
    name: 'Linea Profonda Frontale del Braccio SX',
    side: 'sx',
    districts: MYOFASCIAL_LINES.linea_profonda_frontale_braccio_sx.districts,
    muscles: MYOFASCIAL_LINES.linea_profonda_frontale_braccio_sx.softTissues,
    primaryReferences: ['acromion_sx', 'gomito_sx', 'stiloide_radiale_sx'],
    secondaryReferences: ['dorso_mano_sx'],
    vectors: [
      frontAnteriorVectors([], ['shift arto superiore'], [], ['intrarotazione arto superiore']),
    ],
  },
  {
    id: 'linea_superficiale_posteriore_braccio_dx',
    name: 'Linea Superficiale Posteriore del Braccio DX',
    side: 'dx',
    districts: MYOFASCIAL_LINES.linea_superficiale_posteriore_braccio_dx.districts,
    muscles: MYOFASCIAL_LINES.linea_superficiale_posteriore_braccio_dx.softTissues,
    primaryReferences: ['acromion_dx', 'gomito_dx', 'stiloide_radiale_dx'],
    secondaryReferences: ['dorso_mano_dx'],
    vectors: [
      frontAnteriorVectors([], ['shift arto superiore'], [], ['extrarotazione arto superiore']),
    ],
  },
  {
    id: 'linea_superficiale_posteriore_braccio_sx',
    name: 'Linea Superficiale Posteriore del Braccio SX',
    side: 'sx',
    districts: MYOFASCIAL_LINES.linea_superficiale_posteriore_braccio_sx.districts,
    muscles: MYOFASCIAL_LINES.linea_superficiale_posteriore_braccio_sx.softTissues,
    primaryReferences: ['acromion_sx', 'gomito_sx', 'stiloide_radiale_sx'],
    secondaryReferences: ['dorso_mano_sx'],
    vectors: [
      frontAnteriorVectors([], ['shift arto superiore'], [], ['extrarotazione arto superiore']),
    ],
  },
  {
    id: 'linea_profonda_posteriore_braccio_dx',
    name: 'Linea Profonda Posteriore del Braccio DX',
    side: 'dx',
    districts: MYOFASCIAL_LINES.linea_profonda_posteriore_braccio_dx.districts,
    muscles: MYOFASCIAL_LINES.linea_profonda_posteriore_braccio_dx.softTissues,
    primaryReferences: ['acromion_dx', 'gomito_dx', 'stiloide_radiale_dx'],
    secondaryReferences: ['dorso_mano_dx'],
    vectors: [
      frontAnteriorVectors([], ['shift arto superiore'], [], ['extrarotazione arto superiore']),
    ],
  },
  {
    id: 'linea_profonda_posteriore_braccio_sx',
    name: 'Linea Profonda Posteriore del Braccio SX',
    side: 'sx',
    districts: MYOFASCIAL_LINES.linea_profonda_posteriore_braccio_sx.districts,
    muscles: MYOFASCIAL_LINES.linea_profonda_posteriore_braccio_sx.softTissues,
    primaryReferences: ['acromion_sx', 'gomito_sx', 'stiloide_radiale_sx'],
    secondaryReferences: ['dorso_mano_sx'],
    vectors: [
      frontAnteriorVectors([], ['shift arto superiore'], [], ['extrarotazione arto superiore']),
    ],
  },
  {
    id: 'functional_front',
    name: 'Linea Funzionale Frontale',
    side: 'bilateral',
    districts: MYOFASCIAL_LINES.functional_front.districts,
    muscles: MYOFASCIAL_LINES.functional_front.softTissues,
    primaryReferences: ['vertex', 'sias', 'rotula', 'malleolo'],
    secondaryReferences: ['manubrio', 'trocantere'],
    vectors: [
      frontAnteriorVectors(['catena anteriore accorciata'], ['shift cinetico anteriore']),
      sagittalVectors([], ['anteriorizzazione segmenti']),
    ],
  },
  {
    id: 'functional_back',
    name: 'Linea Funzionale Posteriore',
    side: 'bilateral',
    districts: MYOFASCIAL_LINES.functional_back.districts,
    muscles: MYOFASCIAL_LINES.functional_back.softTissues,
    primaryReferences: ['c7', 'psis', 'calcagno'],
    secondaryReferences: ['occipite', 'apice_sacrale'],
    vectors: [
      frontPosteriorVectors(['catena posteriore'], ['compenso dorsale']),
      sagittalVectors(['retroversione bacino'], ['posteriorizzazione']),
    ],
  },
]

export function getClinicalProfilesForObservationPlane(
  observationPlane: ClinicalObservationPlane,
): MyofascialLineClinicalProfile[] {
  return MYOFASCIAL_CLINICAL_DATABASE.filter((profile) =>
    profile.vectors.some((v) => v.plane === observationPlane),
  )
}

export function getClinicalProfileByLineId(
  lineId: MyofascialLineId,
): MyofascialLineClinicalProfile | undefined {
  return MYOFASCIAL_CLINICAL_DATABASE.find((p) => p.id === lineId)
}

export function resolveLinesForOperator(
  observationPlane: ClinicalObservationPlane,
  operator: FunctionalMovementOperator,
  side?: 'dx' | 'sx',
): MyofascialLineClinicalProfile[] {
  return MYOFASCIAL_CLINICAL_DATABASE.filter((profile) => {
    if (side && profile.side !== 'bilateral' && profile.side !== side) {
      return false
    }
    return profile.vectors.some(
      (v) => v.plane === observationPlane && v[operator].length > 0,
    )
  })
}
