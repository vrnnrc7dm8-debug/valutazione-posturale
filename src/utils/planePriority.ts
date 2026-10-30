import type { AnatomicalPlane, PlaneAssessment, Severity } from '@/types'
import type { PatternRecognitionResult, PatternRegion } from '@/types/patternRecognition'
import type { AutoMeasurement } from './biomechanicsEngine'
import { observationRegion, supportedPlaneFamilies } from './patternRecognition'

const SEVERITY:Record<Severity,number>={lieve:1,moderato:2,severo:4}
const CENTRALITY:Record<PatternRegion,number>={head:1.4,cervical:2,thoracic:2.5,lumbar:2.5,scapular:1.5,pelvic:1.7,lower_limb:1,distal:.7}
export interface PlanePriority { priority:'bassa'|'media'|'alta'; score:number; evaluable:boolean; reasons:string[] }
/** Max per anatomical region, not a count of the number of measurements emitted by the software. */
export function computePlanePriority(assessment:PlaneAssessment,measurements:AutoMeasurement[]=[],recognition?:PatternRecognitionResult):PlanePriority {
  const plane:AnatomicalPlane=assessment.plane
  const evidence=recognition?.evidence.filter(e=>e.plane===plane&&e.reportEligible&&e.severity!=='normale')
  const sources=evidence?.map(e=>({region:e.region,severity:e.severity as Severity,spinal:e.tags.includes('spinal_curve')||e.tags.includes('spinal_segment'),multi:e.multiSegment,compensation:e.tags.includes('crossed_relation')||e.tags.includes('girdle_opposition')}))??[
    ...assessment.alterations.filter(a=>a.status!=='suggested'&&a.status!=='excluded').map(a=>({region:observationRegion({district:a.district??'globale',phenomenon:a.alterationId,anatomicalDetails:a.anatomicalDetails})??(/rachide/.test(a.alterationId)?'thoracic':'lower_limb') as PatternRegion,severity:a.severity,spinal:/rachide|scoliosi|curva/.test(a.alterationId),multi:false,compensation:a.descriptor==='compenso'||a.descriptor==='compenso_crociato'})),
    ...measurements.filter(m=>m.plane===plane&&m.reportEligible!==false&&m.severity!=='normale'&&Number.isFinite(m.numericValue)).map(m=>({region:m.patternEvidence?.region??observationRegion({district:m.clinicalSuggestion?.district??'globale',phenomenon:m.clinicalSuggestion?.phenomenon??m.id,anatomicalDetails:m.clinicalSuggestion?.anatomicalDetails})??'lower_limb',severity:m.severity as Severity,spinal:m.patternEvidence?.tags.some(t=>['spinal_curve','spinal_segment'].includes(t))??/spine_/.test(m.id),multi:m.patternEvidence?.multiSegment??false,compensation:m.patternEvidence?.tags.includes('girdle_opposition')??false})),
  ]
  const regions=new Map<PatternRegion,number>()
  for(const s of sources)regions.set(s.region,Math.max(regions.get(s.region)??0,SEVERITY[s.severity]*CENTRALITY[s.region]*(s.spinal?1.3:1)))
  const primary=Math.max(...regions.values(),0),diversity=Math.min(2,Math.max(0,regions.size-1)*.5),multi=sources.some(s=>s.multi)?1:0,compensation=sources.some(s=>s.compensation)?1:0
  const cross=recognition?.globalPatterns.some(g=>g.supportedPlanes.includes(plane)&&supportedPlaneFamilies(g.supportedPlanes).length>=2)?1:0
  const score=Math.round((primary+diversity+multi+compensation+cross)*100)/100
  const priority=score>=10?'alta':score>=5?'media':'bassa'
  const evaluable=(recognition?recognition.evidence.some(e=>e.plane===plane&&e.reportEligible):sources.length>0)||measurements.some(m=>m.plane===plane&&Number.isFinite(m.numericValue)&&m.reportEligible!==false)
  return{priority,score,evaluable,reasons:[`Massimo contributo anatomico: ${primary.toFixed(2)}`,`Regioni valutate: ${regions.size}`,`Supporto multisegmentario: ${multi? 'sì':'no'}`,`Relazioni compensatorie: ${compensation?'sì':'no'}`,`Supporto multiplanare: ${cross?'sì':'no'}`]}
}
