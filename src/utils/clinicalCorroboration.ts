import type { PatternRecognitionResult, RecognizedGlobalPattern, GlobalSupportType } from '@/types/patternRecognition'
import type { GlobalTensegrityPattern } from '@/types/functional'
import { planeFamily, unique } from './functionalEvidence'

/** No new confirmation step for a deterministic derivation of validated geometry. */
export function corroborateGlobalPosturalPattern(g: RecognizedGlobalPattern, result: PatternRecognitionResult) {
  const sources=result.evidence.filter(e=>g.evidenceIds.includes(e.id))
  const independent=sources.filter(e=>!e.derived)
  const types:GlobalSupportType[]=[]
  if(independent.some(e=>e.landmarkValidated&&e.sourceMeasurementIds.length))types.push('geometricSupport')
  if(independent.some(e=>e.confirmed&&e.sourceObservationIds.length))types.push('clinicalObservationSupport')
  const families=unique(g.supportedPlanes.map(planeFamily))
  if(families.length>=2)types.push('multiplanarSupport')
  if(new Set(independent.flatMap(e=>e.side&&e.side!=='bilaterale'?[e.side]:[])).size===2)types.push('contralateralSupport')
  const reasons:string[]=[]
  if(!g.reportEligible||!g.direction||/indetermin|non_specificato/.test(g.direction))reasons.push('Direzione o riferimento non risolti.')
  if(!sources.length||sources.length!==new Set(g.evidenceIds).size||independent.some(e=>!e.reportEligible||!e.confirmed&&!e.landmarkValidated))reasons.push('Fonti non validate o incomplete.')
  if(sources.some(e=>e.reference==='non_specificato'||e.reference==='indeterminabile'))reasons.push('Riferimento non specificato.')
  if(!g.regionsInvolved.length)reasons.push('Regione non definita.')
  if(g.independentEvidenceCount<2&&g.regionsInvolved.length<2&&families.length<2)reasons.push('Copertura indipendente insufficiente.')
  const contrary=result.evidence.some(e=>e.tags.includes('spine_neutral')&&sources.some(s=>s.tags.includes('spinal_curve'))&&g.family==='frontal')
  const oriented=unique(sources.flatMap(e=>e.direction==='DX→SX'||e.direction==='SX→DX'?[e.direction]:[]))
  const conflict=independent.some((a,i)=>independent.slice(i+1).some(b=>a.region===b.region&&a.side===b.side&&a.reference===b.reference&&planeFamily(a.plane)===planeFamily(b.plane)&&a.direction&&b.direction&&a.direction!==b.direction&&a.tags.some(t=>['shift','tilt','axial_rotation','anteposizione','retroposizione'].includes(t)&&b.tags.includes(t))))
  if(contrary||oriented.length>1||conflict)reasons.push('Evidenze fortemente discordanti.')
  const score=Math.min(1,.45+(types.includes('geometricSupport')?.2:0)+(types.includes('clinicalObservationSupport')?.15:0)+(types.includes('multiplanarSupport')?.1:0)+(types.includes('contralateralSupport')?.1:0)+Math.min(.1,Math.max(0,g.independentEvidenceCount-1)*.05))
  return{eligible:reasons.length===0,supportScore:Math.round(score*100)/100,supportTypes:types,reasons}
}
export function buildFunctionalGlobalPatterns(result:PatternRecognitionResult):GlobalTensegrityPattern[] {
  return result.globalPatterns.flatMap(g=>{
    const c=corroborateGlobalPosturalPattern(g,result)
    if(!c.eligible)return[]
    const convex = [...new Set(result.evidence.filter(e=>g.evidenceIds.includes(e.id)).flatMap(e=>e.convexityDirection?[e.convexityDirection]:[]))]
    const clinicalDirection = g.direction==='C'&&convex.length===1?`Configurazione a C, convessità ${convex[0].toUpperCase()}`:g.direction
    const side=/convessità SX/.test(clinicalDirection)?'sinistro':/convessità DX/.test(clinicalDirection)?'destro':undefined
    const lineIds=g.myersCompatibility.filter(id=>!id.startsWith('lateral_')||!side||id===(side==='sinistro'?'lateral_left':'lateral_right'))
    return[{id:`functional:${g.id}`,kind:'recognized_global' as const,name:g.name,severity:g.severity,prevalentSide:g.prevalentSide,posturalPatternId:g.id,clinicalDirection,
      direction:g.direction==='DX→SX'||g.direction==='SX→DX'?g.direction:undefined,index:g.functionalIntensity,planes:unique(g.supportedPlanes.map(planeFamily)),supportedPlanes:g.supportedPlanes,
      localPatternIds:[],edgeIds:[],lineIds,supportScore:c.supportScore,supportTypes:c.supportTypes,regionsInvolved:g.regionsInvolved,explanation:g.explanation,
      consequences:g.consequences,sourceObservationIds:g.sourceObservationIds,sourceMeasurementIds:g.sourceMeasurementIds,sourcePatternIds:g.sourcePatternIds}]
  })
}

export const GLOBAL_SUPPORT_LABELS:Record<GlobalSupportType,string>={geometricSupport:'geometria da landmark validati',clinicalObservationSupport:'osservazioni cliniche confermate',multiplanarSupport:'supporto multiplanare',contralateralSupport:'confronto controlaterale'}
