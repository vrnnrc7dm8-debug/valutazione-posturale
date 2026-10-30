import type { PlacedLandmark } from '@/types'
import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import { isReportEligibleLandmark } from './landmarkValidation'
import type { AutoMeasurement, BiomechanicalAxis } from './biomechanicsEngine'
import { autoSeverityFromDegrees } from './severityFromMeasurement'

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
  const thorax = axis('asse_scapolare_trasv', 'Asse scapolare', 'scapola_trasv_sx', 'scapola_trasv_dx')
  const pelvis = axis('asse_pelvico_trasv', 'Asse PSIS', 'psis_trasv_sx', 'psis_trasv_dx')
  const relative = (a?: number, b?: number) => a === undefined || b === undefined ? undefined : wrap(a - b)
  add('trasv_capo', 'Orientamento capo rispetto alla foto', head, 'mancano riferimenti cranici confermati o asse degenere')
  add('trasv_capo_torace', 'Rotazione relativa capo-torace', relative(head, thorax), 'mancano riferimenti cranici/scapolari confermati o asse degenere')
  add('trasv_torace', 'Orientamento scapolare / toracico', thorax, 'mancano angoli inferiori scapolari confermati o asse degenere')
  add('trasv_bacino', 'Orientamento bacino', pelvis, 'mancano landmark PSIS confermati o asse degenere')
  add('trasv_torace_bacino', 'Dissociazione torace-bacino', relative(thorax, pelvis), 'mancano landmark scapolari/PSIS confermati o asse degenere')
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
  return { measurements, axes }
}
