import { BILATERAL_ASYMMETRY_THRESHOLD } from './bilateralConsolidation'
import type { PatternEvidence, RegionalPosturalPattern } from '@/types/patternRecognition'
import type { PosturalPattern } from '@/types'
import type { AutoMeasurement } from './biomechanicsEngine'
import { unique } from './functionalEvidence'
import { formatOperatorDirection } from '@/data/clinicalOperators'

export function regionalClinicalSummary(region:RegionalPosturalPattern['region'],sources:PatternEvidence[],measurements:AutoMeasurement[],patterns:PosturalPattern[]) {
  const curves=sources.filter(e=>e.tags.includes('spinal_curve')&&e.convexityDirection)
  const convex=unique(curves.flatMap(e=>e.convexityDirection?[e.convexityDirection]:[]))
  if(curves.length&&convex.length===1) {
    const side=convex[0],bend=side==='sx'?'dx' as const:'sx' as const
    const location=region==='thoracic'?'toracica':region==='cervical'?'cervicale':curves.some(e=>e.tags.includes('thoracolumbar_curve'))?'toraco-lombare':'lombare'
    const name=`Curva ${location} ${side==='sx'?'sinistro':'destro'}-convessa`
    const composite=measurements.find(m=>m.spinalCurve?.present)?.spinalCurve
    return{name,convexityDirection:side,bendDirection:bend,
      components:[...curves.map(e=>`${e.id.includes('t6')?'T6':'T11'}: offset ${e.convexityDirection?.toUpperCase()} ${Math.abs(e.value??0)}% dalla corda C7–L2`),...measurements.filter(m=>/^post_(segment|turn)_/.test(m.id)&&m.reportEligible!==false).map(m=>`${m.label}: ${Math.abs(m.numericValue??0)}°${m.direction?` verso ${m.direction.toUpperCase()}`:''}`)],interpretation:`${name}${composite?.lowerCompensationDirection?` con compenso inferiore ${composite.lowerCompensationDirection==='dx'?'destro':'sinistro'}`:''}.`}
  }
  const bilateral=patterns.find(p=>p.bilateral&&p.observationIds.some(id=>sources.some(e=>e.sourceObservationIds.includes(id))))
  const geometricBilateral = bilateralHeadSummary(sources)
  const components=unique(sources.filter(e=>!e.derived).map(e=>{
    if(e.tags.includes('head_anterior'))return bilateral?`Anteriorizzazione cefalica bilaterale${bilateral.bilateral?.dominantSide?` con prevalenza ${bilateral.bilateral.dominantSide==='destro'?'DX':'SX'}`:''}`:geometricBilateral?.label??'Anteriorizzazione cefalica'
    if(e.tags.includes('head_tilt'))return formatOperatorDirection('tilt',e.direction==='dx'||e.direction==='sx'?e.direction:undefined)
    if(e.tags.includes('head_shift'))return formatOperatorDirection('shift',e.direction==='dx'||e.direction==='sx'?e.direction:undefined)
    if(e.tags.includes('axial_rotation'))return formatOperatorDirection('rotation',e.direction==='rotazione_dx'||e.direction==='rotazione_sx'?e.direction:undefined)
    return e.description
  }))
  return{name:region==='head'||region==='cervical'?`Pattern cranio-cervicale${components.length>1?' combinato':''}`:region==='scapular'?'Pattern del cingolo scapolare':region==='pelvic'?'Pattern pelvico':region==='lower_limb'?'Pattern degli arti inferiori':region==='distal'?'Pattern distale':`Pattern ${region==='thoracic'?'toracico':'lombare'}`,components,interpretation:components.join('; ')}
}

export function bilateralHeadSummary(sources:PatternEvidence[]) {
  const anterior=sources.filter(e=>e.tags.includes('head_anterior'))
  const side=(e:PatternEvidence)=>e.side??(e.plane==='sagittale_destro'?'destro':e.plane==='sagittale_sinistro'?'sinistro':undefined)
  const r=anterior.find(e=>side(e)==='destro'),l=anterior.find(e=>side(e)==='sinistro')
  if(!r||!l||!r.unit||r.unit!==l.unit||r.value===undefined||l.value===undefined)return undefined
  const threshold=BILATERAL_ASYMMETRY_THRESHOLD[r.unit as keyof typeof BILATERAL_ASYMMETRY_THRESHOLD]
  if(threshold===undefined)return undefined
  const dominantSide=Math.abs(Math.abs(r.value)-Math.abs(l.value))>threshold?(Math.abs(r.value)>Math.abs(l.value)?'destro' as const:'sinistro' as const):undefined
  return{dominantSide,label:`Anteriorizzazione cefalica bilaterale${dominantSide?` con prevalenza ${dominantSide==='destro'?'DX':'SX'}`:' simmetrica'} · DX ${r.value} ${r.unit} · SX ${l.value} ${l.unit}`}
}
