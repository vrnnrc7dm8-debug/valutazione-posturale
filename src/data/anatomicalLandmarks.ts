import type { AnatomicalPlane } from '@/types'

export type LandmarkCategory =
  | 'head'
  | 'shoulder_girdle'
  | 'thorax'
  | 'pelvis'
  | 'upper_limb'
  | 'lower_limb'
  | 'spine'
  | 'foot'
  | 'midline'

export type LandmarkSide =
  | 'destro'
  | 'sinistro'
  | 'bilaterale'
  | 'linea_mediana'

export interface LandmarkCatalogEntry {
  id: string
  label: string
  shortLabel: string
  plane: AnatomicalPlane
  side: LandmarkSide
  category: LandmarkCategory
  /** Per future AI detection confidence default */
  defaultConfidence: number
}

export const LANDMARK_CATEGORY_COLORS: Record<LandmarkCategory, string> = {
  head: '#8b5cf6',
  shoulder_girdle: '#2563eb',
  thorax: '#16a34a',
  pelvis: '#ea580c',
  upper_limb: '#9333ea',
  lower_limb: '#dc2626',
  spine: '#7c3aed',
  foot: '#0891b2',
  midline: '#db2777',
}

function lm(
  id: string,
  label: string,
  shortLabel: string,
  plane: AnatomicalPlane,
  side: LandmarkSide,
  category: LandmarkCategory,
): LandmarkCatalogEntry {
  return {
    id,
    label,
    shortLabel,
    plane,
    side,
    category,
    defaultConfidence: 1,
  }
}

const FRONTALE_ANTERIORE: LandmarkCatalogEntry[] = [
  lm('vertex', 'Vertex', 'Vtx', 'frontale_anteriore', 'linea_mediana', 'head'),
  lm('glabella', 'Glabella', 'Glb', 'frontale_anteriore', 'linea_mediana', 'head'),
  lm('bipupillare_sx', 'Pupilla sinistra', 'PuS', 'frontale_anteriore', 'sinistro', 'head'),
  lm('bipupillare_dx', 'Pupilla destra', 'PuD', 'frontale_anteriore', 'destro', 'head'),
  lm('trago_sx', 'Trago sinistro', 'TrS', 'frontale_anteriore', 'sinistro', 'head'),
  lm('trago_dx', 'Trago destro', 'TrD', 'frontale_anteriore', 'destro', 'head'),
  lm('commissura_labiale_sx', 'Commissura labiale SX', 'CLS', 'frontale_anteriore', 'sinistro', 'head'),
  lm('commissura_labiale_dx', 'Commissura labiale DX', 'CLD', 'frontale_anteriore', 'destro', 'head'),
  lm('mento', 'Mento', 'Men', 'frontale_anteriore', 'linea_mediana', 'head'),
  lm('acromion_dx', 'Acromion destro', 'AcrD', 'frontale_anteriore', 'destro', 'shoulder_girdle'),
  lm('acromion_sx', 'Acromion sinistro', 'AcrS', 'frontale_anteriore', 'sinistro', 'shoulder_girdle'),
  lm('clavicola_dx', 'Clavicola destra', 'ClD', 'frontale_anteriore', 'destro', 'shoulder_girdle'),
  lm('clavicola_sx', 'Clavicola sinistra', 'ClS', 'frontale_anteriore', 'sinistro', 'shoulder_girdle'),
  lm('sterno_clavicolare_dx', 'Art. sterno-clavicolare DX', 'SCD', 'frontale_anteriore', 'destro', 'shoulder_girdle'),
  lm('sterno_clavicolare_sx', 'Art. sterno-clavicolare SX', 'SCS', 'frontale_anteriore', 'sinistro', 'shoulder_girdle'),
  lm('gomito_dx', 'Gomito destro', 'Gom dx', 'frontale_anteriore', 'destro', 'upper_limb'),
  lm('gomito_sx', 'Gomito sinistro', 'Gom sx', 'frontale_anteriore', 'sinistro', 'upper_limb'),
  lm('stiloide_radiale_dx', 'Stiloide radiale destro', 'Stil dx', 'frontale_anteriore', 'destro', 'upper_limb'),
  lm('stiloide_radiale_sx', 'Stiloide radiale sinistro', 'Stil sx', 'frontale_anteriore', 'sinistro', 'upper_limb'),
  lm('dorso_mano_dx', 'Dorso mano destro', 'Mano dx', 'frontale_anteriore', 'destro', 'upper_limb'),
  lm('dorso_mano_sx', 'Dorso mano sinistro', 'Mano sx', 'frontale_anteriore', 'sinistro', 'upper_limb'),
  lm('manubrio', 'Manubrio sternale', 'Man', 'frontale_anteriore', 'linea_mediana', 'thorax'),
  lm('xifoide', 'Processo xifoideo', 'Xif', 'frontale_anteriore', 'linea_mediana', 'thorax'),
  lm('linea_sternale', 'Linea mediana sternale', 'Ste', 'frontale_anteriore', 'linea_mediana', 'thorax'),
  lm('ombelico', 'Ombelico', 'Omb', 'frontale_anteriore', 'linea_mediana', 'thorax'),
  lm('arco_costale_dx', 'Arcata costale DX', 'CoD', 'frontale_anteriore', 'destro', 'thorax'),
  lm('arco_costale_sx', 'Arcata costale SX', 'CoS', 'frontale_anteriore', 'sinistro', 'thorax'),
  lm('sias_dx', 'SIAS destro', 'SID', 'frontale_anteriore', 'destro', 'pelvis'),
  lm('sias_sx', 'SIAS sinistro', 'SIS', 'frontale_anteriore', 'sinistro', 'pelvis'),
  lm('cresta_iliaca_dx', 'Cresta iliaca DX', 'CID', 'frontale_anteriore', 'destro', 'pelvis'),
  lm('cresta_iliaca_sx', 'Cresta iliaca SX', 'CIS', 'frontale_anteriore', 'sinistro', 'pelvis'),
  lm('sinfisi_pubica', 'Sinfisi pubica', 'SP', 'frontale_anteriore', 'linea_mediana', 'pelvis'),
  lm('trocantere_dx', 'Grande trocantere DX', 'TrD', 'frontale_anteriore', 'destro', 'lower_limb'),
  lm('trocantere_sx', 'Grande trocantere SX', 'TrS', 'frontale_anteriore', 'sinistro', 'lower_limb'),
  lm('rotula_dx', 'Centro rotula DX', 'RoD', 'frontale_anteriore', 'destro', 'lower_limb'),
  lm('rotula_sx', 'Centro rotula SX', 'RoS', 'frontale_anteriore', 'sinistro', 'lower_limb'),
  lm('tuberosita_tibiale_dx', 'Tuberosità tibiale DX', 'TbD', 'frontale_anteriore', 'destro', 'lower_limb'),
  lm('tuberosita_tibiale_sx', 'Tuberosità tibiale SX', 'TbS', 'frontale_anteriore', 'sinistro', 'lower_limb'),
  lm('malleolo_mediale_dx', 'Malleolo mediale DX', 'MmD', 'frontale_anteriore', 'destro', 'foot'),
  lm('malleolo_laterale_dx', 'Malleolo laterale DX', 'MlD', 'frontale_anteriore', 'destro', 'foot'),
  lm('malleolo_mediale_sx', 'Malleolo mediale SX', 'MmS', 'frontale_anteriore', 'sinistro', 'foot'),
  lm('malleolo_laterale_sx', 'Malleolo laterale SX', 'MlS', 'frontale_anteriore', 'sinistro', 'foot'),
  lm('secondo_dito_dx', 'Secondo dito DX', '2dD', 'frontale_anteriore', 'destro', 'foot'),
  lm('secondo_dito_sx', 'Secondo dito SX', '2dS', 'frontale_anteriore', 'sinistro', 'foot'),
  lm('alluce_dx', 'Alluce DX', 'AlD', 'frontale_anteriore', 'destro', 'foot'),
  lm('alluce_sx', 'Alluce SX', 'AlS', 'frontale_anteriore', 'sinistro', 'foot'),
  lm('arco_plantare_dx', 'Arco plantare mediale DX', 'ApD', 'frontale_anteriore', 'destro', 'foot'),
  lm('arco_plantare_sx', 'Arco plantare mediale SX', 'ApS', 'frontale_anteriore', 'sinistro', 'foot'),
]

const FRONTALE_POSTERIORE: LandmarkCatalogEntry[] = [
  lm('occipite', 'Protuberanza occipitale esterna', 'Occ', 'frontale_posteriore', 'linea_mediana', 'head'),
  lm('linea_nucale', 'Linea nucale', 'Nuc', 'frontale_posteriore', 'linea_mediana', 'head'),
  ...['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map((c) =>
    lm(`cervicale_${c.toLowerCase()}`, `Processo spinoso ${c}`, c, 'frontale_posteriore', 'linea_mediana', 'spine'),
  ),
  ...Array.from({ length: 12 }, (_, i) => {
    const n = i + 1
    return lm(`toracico_t${n}`, `Processo spinoso T${n}`, `T${n}`, 'frontale_posteriore', 'linea_mediana', 'spine')
  }),
  ...['l1', 'l2', 'l3', 'l4', 'l5'].map((level) =>
    lm(
      `lombare_${level}`,
      `Processo spinoso ${level.toUpperCase()}`,
      level.toUpperCase(),
      'frontale_posteriore',
      'linea_mediana',
      'spine',
    ),
  ),
  lm('psis_dx', 'PSIS destro', 'PSD', 'frontale_posteriore', 'destro', 'pelvis'),
  lm('psis_sx', 'PSIS sinistro', 'PSS', 'frontale_posteriore', 'sinistro', 'pelvis'),
  lm('cresta_iliaca_post_dx', 'Cresta iliaca post. DX', 'CIPD', 'frontale_posteriore', 'destro', 'pelvis'),
  lm('cresta_iliaca_post_sx', 'Cresta iliaca post. SX', 'CIPS', 'frontale_posteriore', 'sinistro', 'pelvis'),
  lm('sacro_superiore', 'Sacro superiore / base sacrale', 'SaS', 'frontale_posteriore', 'linea_mediana', 'pelvis'),
  lm('base_sacrale', 'Base sacrale', 'BaS', 'frontale_posteriore', 'linea_mediana', 'pelvis'),
  lm('sacro_medio', 'Sacro medio', 'SaM', 'frontale_posteriore', 'linea_mediana', 'pelvis'),
  lm('apice_sacrale', 'Apice sacrale', 'SaA', 'frontale_posteriore', 'linea_mediana', 'pelvis'),
  lm('solco_intergluteo', 'Solco intergluteo', 'SIG', 'frontale_posteriore', 'linea_mediana', 'pelvis'),
  lm('angolo_scapola_sup_dx', 'Angolo scapola sup. DX', 'ASuD', 'frontale_posteriore', 'destro', 'shoulder_girdle'),
  lm('angolo_scapola_sup_sx', 'Angolo scapola sup. SX', 'ASuS', 'frontale_posteriore', 'sinistro', 'shoulder_girdle'),
  lm('angolo_scapola_inf_dx', 'Angolo scapola inf. DX', 'AInD', 'frontale_posteriore', 'destro', 'shoulder_girdle'),
  lm('angolo_scapola_inf_sx', 'Angolo scapola inf. SX', 'AInS', 'frontale_posteriore', 'sinistro', 'shoulder_girdle'),
  lm('margine_scapola_dx', 'Margine mediale scapola DX', 'MSD', 'frontale_posteriore', 'destro', 'shoulder_girdle'),
  lm('margine_scapola_sx', 'Margine mediale scapola SX', 'MSS', 'frontale_posteriore', 'sinistro', 'shoulder_girdle'),
  lm('spina_scapola_dx', 'Spina scapola DX', 'SpD', 'frontale_posteriore', 'destro', 'shoulder_girdle'),
  lm('spina_scapola_sx', 'Spina scapola SX', 'SpS', 'frontale_posteriore', 'sinistro', 'shoulder_girdle'),
  lm('acromion_post_dx', 'Acromion post. DX', 'AcrPD', 'frontale_posteriore', 'destro', 'shoulder_girdle'),
  lm('acromion_post_sx', 'Acromion post. SX', 'AcrPS', 'frontale_posteriore', 'sinistro', 'shoulder_girdle'),
  lm('plica_glutea_dx', 'Plica glutea DX', 'PlD', 'frontale_posteriore', 'destro', 'pelvis'),
  lm('plica_glutea_sx', 'Plica glutea SX', 'PlS', 'frontale_posteriore', 'sinistro', 'pelvis'),
  lm('trocantere_post_dx', 'Grande trocantere post. DX', 'TrPD', 'frontale_posteriore', 'destro', 'lower_limb'),
  lm('trocantere_post_sx', 'Grande trocantere post. SX', 'TrPS', 'frontale_posteriore', 'sinistro', 'lower_limb'),
  lm('fossa_poplitea_dx', 'Centro popliteo DX', 'PoD', 'frontale_posteriore', 'destro', 'lower_limb'),
  lm('fossa_poplitea_sx', 'Centro popliteo SX', 'PoS', 'frontale_posteriore', 'sinistro', 'lower_limb'),
  lm('testa_perone_dx', 'Testa del perone DX', 'PeD', 'frontale_posteriore', 'destro', 'lower_limb'),
  lm('testa_perone_sx', 'Testa del perone SX', 'PeS', 'frontale_posteriore', 'sinistro', 'lower_limb'),
  lm('achille_dx', 'Tendine Achille DX', 'AcD', 'frontale_posteriore', 'destro', 'foot'),
  lm('achille_sx', 'Tendine Achille SX', 'AcS', 'frontale_posteriore', 'sinistro', 'foot'),
  lm('calcagno_dx', 'Calcagno DX', 'CaD', 'frontale_posteriore', 'destro', 'foot'),
  lm('calcagno_sx', 'Calcagno SX', 'CaS', 'frontale_posteriore', 'sinistro', 'foot'),
]

function sagittalLandmarks(plane: 'sagittale_destro' | 'sagittale_sinistro'): LandmarkCatalogEntry[] {
  const s = plane === 'sagittale_destro' ? 'destro' : 'sinistro'
  return [
    lm(`vertex_${plane}`, 'Vertex', 'Vtx', plane, s, 'head'),
    lm(`trago_${plane}`, 'Trago', 'Tra', plane, s, 'head'),
    lm(`c7_${plane}`, 'C7', 'C7', plane, 'linea_mediana', 'spine'),
    lm(`t10_${plane}`, 'T10', 'T10', plane, 'linea_mediana', 'spine'),
    lm(`t11_${plane}`, 'T11', 'T11', plane, 'linea_mediana', 'spine'),
    lm(`t12_${plane}`, 'T12', 'T12', plane, 'linea_mediana', 'spine'),
    lm(`l1_${plane}`, 'L1', 'L1', plane, 'linea_mediana', 'spine'),
    lm(`l2_${plane}`, 'L2', 'L2', plane, 'linea_mediana', 'spine'),
    lm(`l3_${plane}`, 'L3', 'L3', plane, 'linea_mediana', 'spine'),
    lm(`l4_${plane}`, 'L4', 'L4', plane, 'linea_mediana', 'spine'),
    lm(`l5_${plane}`, 'L5', 'L5', plane, 'linea_mediana', 'spine'),
    lm(`s1_${plane}`, 'S1', 'S1', plane, 'linea_mediana', 'spine'),
    lm(`s2_${plane}`, 'S2', 'S2', plane, 'linea_mediana', 'spine'),
    lm(`acromion_${plane}`, 'Acromion', 'Acr', plane, s, 'shoulder_girdle'),
    lm(`xifoide_${plane}`, 'Processo xifoideo', 'Xif', plane, 'linea_mediana', 'thorax'),
    lm(`ombelico_${plane}`, 'Ombelico', 'Omb', plane, 'linea_mediana', 'thorax'),
    lm(`sias_${plane}`, 'SIAS', 'SIAS', plane, s, 'pelvis'),
    lm(`sips_${plane}`, 'SIPS', 'SIPS', plane, s, 'pelvis'),
    lm(`cresta_iliaca_${plane}`, 'Cresta iliaca', 'CI', plane, s, 'pelvis'),
    lm(`trocantere_${plane}`, 'Grande trocantere', 'Tr', plane, s, 'lower_limb'),
    lm(`ginocchio_${plane}`, 'Ginocchio', 'Gn', plane, s, 'lower_limb'),
    lm(`malleolo_lat_${plane}`, 'Malleolo laterale', 'Mal', plane, s, 'foot'),
    lm(`calcagno_${plane}`, 'Calcagno', 'Cal', plane, s, 'foot'),
    lm(`avampiede_${plane}`, 'Avampiede', 'Avp', plane, s, 'foot'),
    lm(`sacro_${plane}`, 'Apice sacrale', 'Sac', plane, 'linea_mediana', 'pelvis'),
  ]
}

const TRASVERSO: LandmarkCatalogEntry[] = [
  lm('cranio_anteriore_trasv', 'Asse cranico anteriore', 'CrA', 'trasverso', 'linea_mediana', 'head'),
  lm('cranio_posteriore_trasv', 'Asse cranico posteriore', 'CrP', 'trasverso', 'linea_mediana', 'head'),
  lm('scapola_trasv_dx', 'Angolo inferiore scapola DX', 'DX', 'trasverso', 'destro', 'shoulder_girdle'),
  lm('scapola_trasv_sx', 'Angolo inferiore scapola SX', 'SX', 'trasverso', 'sinistro', 'shoulder_girdle'),
  lm('margine_scapola_trasv_dx', 'Margine mediale scapola DX', 'DX', 'trasverso', 'destro', 'shoulder_girdle'),
  lm('margine_scapola_trasv_sx', 'Margine mediale scapola SX', 'SX', 'trasverso', 'sinistro', 'shoulder_girdle'),
  lm('psis_trasv_dx', 'PSIS DX', 'DX', 'trasverso', 'destro', 'pelvis'),
  lm('psis_trasv_sx', 'PSIS SX', 'SX', 'trasverso', 'sinistro', 'pelvis'),
  lm('calcagno_trasv_dx', 'Calcagno DX', 'DX', 'trasverso', 'destro', 'foot'),
  lm('calcagno_trasv_sx', 'Calcagno SX', 'SX', 'trasverso', 'sinistro', 'foot'),
  lm('secondo_raggio_dx', 'Secondo raggio DX', 'DX', 'trasverso', 'destro', 'foot'),
  lm('secondo_raggio_sx', 'Secondo raggio SX', 'SX', 'trasverso', 'sinistro', 'foot'),
  lm('scapulum_trasv_dx', 'Scapulum DX', 'DX', 'trasverso', 'destro', 'shoulder_girdle'),
  lm('scapulum_trasv_sx', 'Scapulum SX', 'SX', 'trasverso', 'sinistro', 'shoulder_girdle'),
  lm('ileo_trasv_dx', 'Ileo DX', 'DX', 'trasverso', 'destro', 'pelvis'),
  lm('ileo_trasv_sx', 'Ileo SX', 'SX', 'trasverso', 'sinistro', 'pelvis'),
  lm('asse_piede_trasv_dx', 'Asse piede (riferimento intermedio) DX', 'DX', 'trasverso', 'destro', 'foot'),
  lm('asse_piede_trasv_sx', 'Asse piede (riferimento intermedio) SX', 'SX', 'trasverso', 'sinistro', 'foot'),
]

export const LANDMARK_CATALOG: LandmarkCatalogEntry[] = [
  ...FRONTALE_ANTERIORE,
  ...FRONTALE_POSTERIORE,
  ...sagittalLandmarks('sagittale_destro'),
  ...sagittalLandmarks('sagittale_sinistro'),
  ...TRASVERSO,
]

export function getLandmarksForPlane(
  plane: AnatomicalPlane,
): LandmarkCatalogEntry[] {
  return LANDMARK_CATALOG.filter((l) => l.plane === plane)
}

export function getLandmarkCatalogEntry(id: string): LandmarkCatalogEntry | undefined {
  return LANDMARK_CATALOG.find((l) => l.id === id)
}

/** @deprecated compat */
export function getLandmarkDefinition(id: string): {
  type: string
  label: string
  shortLabel: string
  color: string
  bilateral: boolean
} {
  const entry = getLandmarkCatalogEntry(id)
  if (!entry) {
    return {
      type: id,
      label: id,
      shortLabel: id.slice(0, 3),
      color: '#64748b',
      bilateral: false,
    }
  }
  return {
    type: entry.id,
    label: entry.label,
    shortLabel: entry.shortLabel,
    color: LANDMARK_CATEGORY_COLORS[entry.category],
    bilateral:
      entry.side === 'destro' ||
      entry.side === 'sinistro' ||
      entry.side === 'bilaterale',
  }
}

export const ANATOMICAL_LANDMARKS = LANDMARK_CATALOG.map((e) => ({
  type: e.id,
  label: e.label,
  shortLabel: e.shortLabel,
  color: LANDMARK_CATEGORY_COLORS[e.category],
  bilateral: e.side === 'destro' || e.side === 'sinistro',
}))

/** Order and labels used by transverse landmark dropdowns only. */
export const TRANSVERSE_LANDMARK_GROUPS = [
  { category: 'shoulder_girdle', label: 'SCAPOLE' }, { category: 'pelvis', label: 'BACINO' },
  { category: 'foot', label: 'PIEDI' }, { category: 'head', label: 'CAPO' },
] as const
