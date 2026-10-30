import type { TransverseRelation } from '@/data/transverseRelations'
import type { PlacedLandmark } from '@/types'
import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import { isReportEligibleLandmark } from './landmarkValidation'
import type { AutoMeasurement, BiomechanicalAxis } from './biomechanicsEngine'
import { severityFromNormalizedMagnitude, autoSeverityFromDegrees } from './severityFromMeasurement'

/** Projected indices only. No camera calibration or 3D anatomical rotation is inferred. */
export function analyzeTransverse(landmarks: PlacedLandmark[]): { measurements: AutoMeasurement[]; axes: BiomechanicalAxis[] } {
  const catalog = getLandmarksForPlane('trasverso')
  const points = new Map(landmarks.filter(l => isReportEligibleLandmark(l) && catalog.some(c => c.id === l.landmarkId) &&
    Number.isFinite(l.position.x) && Number.isFinite(l.position.y) && l.position.x >= 0 && l.position.x <= 1 && l.position.y >= 0 && l.position.y <= 1).map(l => [l.landmarkId, l.position]))
  const measurements: AutoMeasurement[] = []
  const axes: BiomechanicalAxis[] = []
  const wrap = (a: number) => ((a + 90) % 180 + 180) % 180 - 90
  function axis(id: string, label: string, from: string, to: string, vertical = false): number | undefined {
    const a = points.get(from), b = points.get(to)
    if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 0.005) return undefined
    axes.push({ id, label, from: a, to: b, color: '#8b5cf6', plane: 'trasverso' })
    return wrap((vertical ? Math.atan2(b.x - a.x, a.y - b.y) : Math.atan2(b.y - a.y, b.x - a.x)) * 180 / Math.PI)
  }
  function add(id: string, label: string, angle: number | undefined, missing: string, side?: 'destro' | 'sinistro') {
    if (angle === undefined) {
      measurements.push({ id, label, plane: 'trasverso', severity: 'normale', value: `${label} non calcolabile: ${missing}.` })
      return
    }
    measurements.push({ id, label, plane: 'trasverso', side, numericValue: angle, unit: 'gradi', severity: autoSeverityFromDegrees(angle),
      value: `${angle.toFixed(1)}° (indice proiettato normalizzato)`,
      observationNote: 'Indice 2D su coordinate normalizzate, sensibile a prospettiva e formato immagine. Segno positivo: orario nella foto. Specificare manualmente Rotazione DX/SX anatomica prima della conferma; non è una misura di rotazione 3D.',
    })
  }
  const head = axis('asse_cranico_trasv', 'Asse cranico', 'cranio_posteriore_trasv', 'cranio_anteriore_trasv', true)
  const thorax = axis('asse_scapolare_trasv', 'Asse scapolare', 'scapulum_trasv_sx', 'scapulum_trasv_dx')
  const pelvis = axis('asse_pelvico_trasv', 'Asse iliaco', 'ileo_trasv_sx', 'ileo_trasv_dx')
  const relative = (a?: number, b?: number) => a === undefined || b === undefined ? undefined : wrap(a - b)
  add('trasv_capo', 'Orientamento capo rispetto alla foto', head, 'mancano riferimenti cranici confermati o asse degenere')
  add('trasv_capo_torace', 'Rotazione relativa capo-torace', relative(head, thorax), 'mancano riferimenti cranici/scapolari confermati o asse degenere')
  add('trasv_torace', 'Orientamento scapolare / toracico', thorax, 'mancano scapulum confermati o asse degenere')
  add('trasv_bacino', 'Orientamento bacino', pelvis, 'mancano landmark iliaci confermati o asse degenere')
  add('trasv_torace_bacino', 'Dissociazione torace-bacino', relative(thorax, pelvis), 'mancano landmark scapulum/ileo confermati o asse degenere')
  const scapular: Partial<Record<'dx' | 'sx', number>> = {}
  for (const side of ['dx', 'sx'] as const) {
    scapular[side] = axis(`orientamento_scapola_${side}_trasv`, `Asse scapola ${side.toUpperCase()}`, `margine_scapola_trasv_${side}`, `scapola_trasv_${side}`, true)
    add(`trasv_scapola_${side}`, `Orientamento scapola ${side.toUpperCase()}`, scapular[side], 'mancano margine mediale/angolo inferiore confermati o asse degenere', side === 'dx' ? 'destro' : 'sinistro')
  }
  add('trasv_asimmetria_scapole', 'Asimmetria orientamento scapole', relative(scapular.dx, scapular.sx), 'mancano entrambi gli assi scapolari confermati')
  const foot: Partial<Record<'dx' | 'sx', number>> = {}
  for (const side of ['dx', 'sx'] as const) {
    foot[side] = axis(`asse_piede_${side}_trasv`, `Asse piede ${side.toUpperCase()}`, `calcagno_trasv_${side}`, `secondo_raggio_${side}`, true)
    add(`trasv_piede_${side}`, `Orientamento piede ${side.toUpperCase()}`, foot[side], 'mancano calcagno/secondo raggio confermati o asse degenere', side === 'dx' ? 'destro' : 'sinistro')
  }
  add('trasv_divergenza_piedi', 'Differenza orientamento piedi', relative(foot.dx, foot.sx), 'mancano entrambi gli assi podalici confermati')
  type Suggestion = NonNullable<AutoMeasurement['clinicalSuggestion']>
  const note = 'Indice geometrico proiettato su coordinate normalizzate; non misura profondità, carico, pressione o forza di taglio e non identifica patologie. Ante/retro sono relativi al controlaterale lungo l’asse cranico anteriore confermato. Verificare visibilità, prospettiva e repere omologhi prima di confermare.'
  function index(id: string, label: string, value: number | undefined, missing: string, suggestion?: Suggestion, side?: 'destro' | 'sinistro', degrees = false) {
    if (value === undefined || !Number.isFinite(value)) {
      measurements.push({ id, label, plane: 'trasverso', severity: 'normale', value: `${label} non calcolabile: ${missing}.` }); return
    }
    measurements.push({ id, label, plane: 'trasverso', side, numericValue: value, unit: degrees ? 'gradi' : 'percentuale',
      value: `${value.toFixed(1)}${degrees ? '°' : '%'} (indice proiettato)`, severity: degrees ? autoSeverityFromDegrees(value) : severityFromNormalizedMagnitude(value / 100),
      observationNote: note, clinicalSuggestion: suggestion })
  }
  const anterior = points.get('cranio_anteriore_trasv'), posterior = points.get('cranio_posteriore_trasv')
  const cranialLength = anterior && posterior ? Math.hypot(anterior.x - posterior.x, anterior.y - posterior.y) : 0
  const ap = anterior && posterior && cranialLength >= .005 ? { x: (anterior.x - posterior.x) / cranialLength, y: (anterior.y - posterior.y) / cranialLength } : undefined
  const subtract = (a: string, b: string) => {
    const p = points.get(a), q = points.get(b)
    return p && q ? { x: p.x - q.x, y: p.y - q.y } : undefined
  }
  for (const [prefix, label, phenomenon, district] of [
    ['scapulum_trasv', 'Scapulum', 'posizione_scapulum', 'cintura_scapolare'],
    ['ileo_trasv', 'Ileo', 'posizione_ileo', 'pelvico'],
  ] as const) {
    for (const side of ['dx', 'sx'] as const) {
      const delta = subtract(`${prefix}_${side}`, `${prefix}_${side === 'dx' ? 'sx' : 'dx'}`)
      const value = ap && delta ? (delta.x * ap.x + delta.y * ap.y) * 100 : undefined
      const descriptor = value !== undefined && value < 0 ? 'retroposizione' : 'anteposizione'
      index(`trasv_ap_${prefix}_${side}`, `${label} ${side.toUpperCase()} — indice AP relativo al controlaterale`, value,
        'servono repere omologhi bilaterali e asse cranico anteriore confermato',
        { phenomenon, district, descriptor, direction: descriptor === 'anteposizione' ? 'anteriore' : 'posteriore' }, side === 'dx' ? 'destro' : 'sinistro')
    }
  }
  for (const [prefix, label, phenomenon, district] of [
    ['scapulum_trasv', 'scapolare', 'asimmetria_cingolo_scapolare', 'cintura_scapolare'],
    ['ileo_trasv', 'pelvico', 'asimmetria_cingolo_pelvico', 'pelvico'],
  ] as const) {
    const delta = subtract(`${prefix}_dx`, `${prefix}_sx`)
    index(`trasv_asimmetria_${prefix}`, `Asimmetria AP del cingolo ${label}`, ap && delta ? (delta.x * ap.x + delta.y * ap.y) * 100 : undefined,
      'servono repere omologhi bilaterali e asse cranico anteriore confermato', { phenomenon, district, descriptor: 'dissociazione' })
  }
  for (const side of ['dx', 'sx'] as const) {
    const iliacPsis = subtract(`ileo_trasv_${side}`, `psis_trasv_${side}`)
    const len = iliacPsis ? Math.hypot(iliacPsis.x, iliacPsis.y) : 0
    index(`trasv_ileo_psis_${side}`, `Ileo / PSIS ${side.toUpperCase()} — orientamento relativo al riferimento anteriore`,
      ap && iliacPsis && len >= .005 ? wrap(Math.atan2(ap.x * iliacPsis.y - ap.y * iliacPsis.x, ap.x * iliacPsis.x + ap.y * iliacPsis.y) * 180 / Math.PI) : undefined,
      'servono ileo, PSIS omolaterale e asse cranico anteriore confermati e distinti', undefined, side === 'dx' ? 'destro' : 'sinistro', true)
  }
  // Explicit ipsilateral and crossed segment vectors, measured relative to the anterior reference.
  for (const [scap, iliac] of [['dx', 'dx'], ['sx', 'sx'], ['dx', 'sx'], ['sx', 'dx']] as const) {
    const delta = subtract(`scapulum_trasv_${scap}`, `ileo_trasv_${iliac}`)
    const length = delta ? Math.hypot(delta.x, delta.y) : 0
    const angle = ap && delta && length >= .005 ? wrap(Math.atan2(ap.x * delta.y - ap.y * delta.x, ap.x * delta.x + ap.y * delta.y) * 180 / Math.PI) : undefined
    index(`trasv_relazione_${scap}_${iliac}`, `Scapulum ${scap.toUpperCase()} / Ileo ${iliac.toUpperCase()} — ${scap === iliac ? 'omolaterale' : 'crociato'}`, angle,
      'servono scapulum, ileo e asse cranico anteriore confermati',
      { phenomenon: 'relazione_scapulum_ileo', district: 'toraco_lombare', descriptor: 'dissociazione', transverseRelation: { relationType: 'dissociazione', reference: 'scapulum_ileo', referenceSide: iliac, orientation: 'indeterminabile' } }, scap === 'dx' ? 'destro' : 'sinistro', true)
  }
  const dissociation = relative(thorax, pelvis)
  const relationMeasure = measurements.find(m => m.id === 'trasv_torace_bacino')
  if (relationMeasure) { relationMeasure.clinicalSuggestion = { phenomenon: 'relazione_scapolo_pelvica', district: 'toraco_lombare', descriptor: 'dissociazione' }; relationMeasure.observationNote = note }
  index('trasv_compenso_crociato', 'Compenso crociato — indice di opposizione dei cingoli',
    thorax !== undefined && pelvis !== undefined ? (thorax * pelvis < 0 ? Math.abs(dissociation!) : 0) : undefined,
    'servono entrambi gli assi dei cingoli confermati', { phenomenon: 'relazione_scapolo_pelvica', district: 'toraco_lombare', descriptor: 'compenso_crociato' }, undefined, true)
  const sd = points.get('scapulum_trasv_dx'), ss = points.get('scapulum_trasv_sx'), pd = points.get('ileo_trasv_dx'), ps = points.get('ileo_trasv_sx')
  const centroidDelta = sd && ss && pd && ps ? { x: (sd.x + ss.x - pd.x - ps.x) / 2, y: (sd.y + ss.y - pd.y - ps.y) / 2 } : undefined
  const shear = centroidDelta && ap ? (centroidDelta.x * -ap.y + centroidDelta.y * ap.x) * 100 : undefined
  index('trasv_taglio_proiettivo', 'Taglio stimato — disassamento laterale dei centri dei cingoli (non forza)', shear,
    'servono cingoli bilaterali e asse cranico anteriore confermati', { phenomenon: 'relazione_scapolo_pelvica', district: 'toraco_lombare', descriptor: 'taglio_stimato' })
  for (const side of ['dx', 'sx'] as const) {
    const intermediate = points.get(`asse_piede_trasv_${side}`), heel = points.get(`calcagno_trasv_${side}`)
    index(`trasv_asse_intermedio_${side}`, `Calcagno / asse piede ${side.toUpperCase()} — orientamento`,
      intermediate && heel && Math.hypot(intermediate.x - heel.x, intermediate.y - heel.y) >= .005 ? wrap(Math.atan2(intermediate.x - heel.x, heel.y - intermediate.y) * 180 / Math.PI) : undefined,
      'servono calcagno e riferimento intermedio asse piede confermati', undefined, side === 'dx' ? 'destro' : 'sinistro', true)
    for (const [label, angle] of [['pelvico', pelvis], ['scapolare', thorax]] as const) {
      index(`trasv_${label}_piede_${side}`, `Cingolo ${label} / asse piede ${side.toUpperCase()}`, relative(foot[side], angle),
        'servono asse del cingolo bilaterale e calcagno–secondo raggio confermati',
        { phenomenon: 'relazione_cingoli_piedi', district: 'globale', descriptor: 'dissociazione' }, side === 'dx' ? 'destro' : 'sinistro', true)
    }
  }
  const calcaneal = axis('linea_bicalcaneare_trasv', 'Linea bicalcaneare', 'calcagno_trasv_sx', 'calcagno_trasv_dx')
  index('trasv_pelvi_bicalcaneare', 'Dissociazione cingolo pelvico–linea bicalcaneare', relative(pelvis, calcaneal),
    'servono ilei e calcagni bilaterali confermati (asse completo dei piedi non richiesto)',
    { phenomenon: 'relazione_pelvi_calcagni', district: 'pelvico', descriptor: 'dissociazione' }, undefined, true)
  index('trasv_scapole_bicalcaneare', 'Dissociazione cingolo scapolare–linea bicalcaneare', relative(thorax, calcaneal),
    'servono scapulum e calcagni bilaterali confermati (asse completo dei piedi non richiesto)',
    { phenomenon: 'relazione_scapole_calcagni', district: 'cintura_scapolare', descriptor: 'dissociazione' }, undefined, true)
  const heelAxis = subtract('calcagno_trasv_dx', 'calcagno_trasv_sx')
  const rightFoot = subtract('secondo_raggio_dx', 'calcagno_trasv_dx'), leftFoot = subtract('secondo_raggio_sx', 'calcagno_trasv_sx')
  const heelWidth = heelAxis ? Math.hypot(heelAxis.x, heelAxis.y) : 0
  const dr = rightFoot ? Math.hypot(rightFoot.x, rightFoot.y) : 0, dl = leftFoot ? Math.hypot(leftFoot.x, leftFoot.y) : 0
  const spread = heelAxis && rightFoot && leftFoot && heelWidth >= .005 && dr >= .005 && dl >= .005
    ? ((rightFoot.x / dr - leftFoot.x / dl) * heelAxis.x + (rightFoot.y / dr - leftFoot.y / dl) * heelAxis.y) / heelWidth * 50 : undefined
  index('trasv_apertura_piedi', 'Convergenza / divergenza proiettata degli assi podalici', spread,
    'servono entrambi gli assi calcagno–secondo raggio e una linea calcaneare non degenere',
    { phenomenon: 'convergenza_piedi', district: 'arto_inferiore', descriptor: spread !== undefined && spread < 0 ? 'convergenza' : 'divergenza' })
  // Reference-relative anatomical orientation, never an unqualified screen DX/SX.
  function orientation(subject: string, reference: string): TransverseRelation['orientation'] {
    const delta = subtract(`${subject}_dx`, `${subject}_sx`), ref = subtract(`${reference}_dx`, `${reference}_sx`)
    if (!ap || !delta || !ref || Math.hypot(ref.x, ref.y) < .005) return 'indeterminabile'
    const len = Math.hypot(ref.x, ref.y)
    let normal = { x: -ref.y / len, y: ref.x / len }
    const dot = normal.x * ap.x + normal.y * ap.y
    if (Math.abs(dot) < .1) return 'indeterminabile'
    if (dot < 0) normal = { x: -normal.x, y: -normal.y }
    const value = delta.x * normal.x + delta.y * normal.y
    return Math.abs(value) < .005 ? 'indeterminabile' : value > 0 ? 'dx_anteposto' : 'sx_anteposto'
  }
  for (const m of measurements) {
    const suggestion = m.clinicalSuggestion
    if (!suggestion || !['dissociazione', 'compenso_crociato', 'taglio_stimato'].includes(suggestion.descriptor)) continue
    const reference: TransverseRelation['reference'] = suggestion.transverseRelation?.reference ?? (m.id === 'trasv_pelvi_bicalcaneare' ? 'pelvico_bicalcaneare'
      : m.id === 'trasv_scapole_bicalcaneare' ? 'scapolare_bicalcaneare'
      : m.id === 'trasv_asimmetria_scapulum_trasv' ? 'scapulum_controlaterale'
      : m.id === 'trasv_asimmetria_ileo_trasv' ? 'ileo_controlaterale'
      : m.id.startsWith('trasv_pelvico_piede') ? 'pelvico_asse_piede'
      : m.id.startsWith('trasv_scapolare_piede') ? 'scapolare_asse_piede' : 'scapolare_pelvico')
    let anatomical: TransverseRelation['orientation'] = 'indeterminabile'
    if (reference === 'scapolare_pelvico') anatomical = orientation('scapulum_trasv', 'ileo_trasv')
    if (reference === 'pelvico_bicalcaneare') anatomical = orientation('ileo_trasv', 'calcagno_trasv')
    if (reference === 'scapolare_bicalcaneare') anatomical = orientation('scapulum_trasv', 'calcagno_trasv')
    if (reference.endsWith('controlaterale') && m.numericValue !== undefined && Math.abs(m.numericValue) >= .5) anatomical = m.numericValue > 0 ? 'dx_anteposto' : 'sx_anteposto'
    suggestion.transverseRelation = { relationType: suggestion.descriptor === 'compenso_crociato' ? 'compenso_crociato' : suggestion.descriptor === 'taglio_stimato' ? 'shear' : 'dissociazione',
      reference, referenceSide: suggestion.transverseRelation?.referenceSide, orientation: anatomical, orientationSource: 'geometric_suggestion' }
    suggestion.direction = undefined
    m.observationNote = 'Relazione geometrica 2D proiettata, riferita ai segmenti e al riferimento indicati. L’orientamento geometrico è da verificare e confermare clinicamente. Non misura profondità, carico, pressione o forze e non identifica patologie; prospettiva e formato immagine influenzano gli indici.'
  }
  return { measurements, axes }
}
