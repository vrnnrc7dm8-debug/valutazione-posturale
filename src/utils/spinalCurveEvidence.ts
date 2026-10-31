import type { AutoMeasurement } from './biomechanicsEngine'
import type { Severity } from '@/types'

export const SPINAL_CURVE_THRESHOLDS = {
  offsetScalePercent: .6, segmentScaleDegrees: 2, turnScaleDegrees: 3,
  minimumOffsetPercent: .15, strongOffsetPercent: 1.2,
  detectionScore: .65, moderateScore: 1, severeScore: 1.6,
  minimumTurnDegrees: 1.5,
} as const
export interface CompositeSpinalCurveEvidence {
  score: number
  present: boolean
  severity: Severity
  shape?: 'C'|'S'
  convexityDirection?: 'dx'|'sx'
  bendDirection?: 'dx'|'sx'
  lowerCompensationDirection?: 'dx'|'sx'
  segmentCount: number
  components: { offset: number; segmentAngle: number; angularChange: number; directionConsistency: number }
  sourceMeasurementIds: string[]
}
/** Magnitude score is monotone with each nonnegative component, with orientation/coverage held fixed. */
export function computeSpinalCurveEvidence(measurements: AutoMeasurement[]): CompositeSpinalCurveEvidence {
  const t=SPINAL_CURVE_THRESHOLDS
  const available=measurements.filter(m=>m.reportEligible!==false&&Number.isFinite(m.numericValue))
  const find=(id:string)=>available.find(m=>m.id===id)
  const offsets=['post_chord_toracico_t6','post_chord_toracico_t11'].map(find)
  const segments=[0,1,2].map(i=>find(`post_segment_${i}`))
  const turns=[0,1].map(i=>find(`post_turn_${i}`))
  const chord=find('post_chord_tilt')
  const relative=(m:AutoMeasurement)=>m.numericValue!-(chord?.numericValue??0)
  const normalized=(value:number,scale:number)=>Math.min(2,Math.abs(value)/scale)
  const validOffsets=offsets.flatMap(m=>m?[m.numericValue!]:[])
  const consistency=validOffsets.length===2&&validOffsets.every(v=>Math.abs(v)>=t.minimumOffsetPercent)?1:0
  const offset=validOffsets.reduce((s,v)=>s+normalized(v,t.offsetScalePercent),0)/2
  const segmentAngle=segments.reduce((s,m)=>s+(m?normalized(relative(m),t.segmentScaleDegrees):0),0)/3
  const angularChange=Math.max(...turns.map(m=>m?normalized(m.numericValue!,t.turnScaleDegrees):0),0)
  const score=Math.round((.35*offset+.25*segmentAngle+.30*angularChange+.10*consistency)*1000)/1000
  const strongOffsets=validOffsets.length===2&&validOffsets.every(v=>Math.abs(v)>=t.strongOffsetPercent)
  const nonneutral=validOffsets.length===2&&validOffsets.every(v=>Math.abs(v)>=t.minimumOffsetPercent)
  const candidate=nonneutral?(validOffsets[0]*validOffsets[1]>0?'C':'S'):undefined
  const hasAngles=segments.every(Boolean)&&turns.some(Boolean)
  const significantTurn=turns.some(m=>m&&Math.abs(m.numericValue!)>=t.minimumTurnDegrees)
  const outward=segments[0]&&Math.sign(relative(segments[0]))===Math.sign(validOffsets[0]??0)
  const inward=segments[2]&&Math.sign(relative(segments[2]))===-Math.sign(validOffsets[1]??0)
  const angularCoherence=hasAngles?significantTurn&&!!outward&&!!inward:strongOffsets
  const present=score>=t.detectionScore&&nonneutral&&angularCoherence
  const convex=present&&candidate==='C'?(validOffsets[0]<0?'sx':'dx'):undefined
  const bend=convex==='sx'?'dx':convex==='dx'?'sx':undefined
  const lower=present&&candidate==='C'&&segments[2]&&significantTurn?(relative(segments[2])>0?'dx':'sx'):undefined
  return{score,present,severity:score>=t.severeScore?'severo':score>=t.moderateScore?'moderato':'lieve',shape:present?candidate:undefined,
    convexityDirection:convex,bendDirection:bend,lowerCompensationDirection:lower,segmentCount:segments.filter(Boolean).length,
    components:{offset,segmentAngle,angularChange,directionConsistency:consistency},sourceMeasurementIds:[...offsets,...segments,...turns,chord].flatMap(m=>m?[`automatic_measurement:${m.plane}:${m.id}`]:[])}
}
