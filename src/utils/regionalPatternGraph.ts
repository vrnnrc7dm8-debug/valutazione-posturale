import type { PatternEvidence, PatternRecognitionResult, RegionalPosturalPattern } from '@/types/patternRecognition'
import { mergeProvenance, planeFamily, unique } from './functionalEvidence'

/** Supported edges only; adjacency is anatomical possibility, never proof of propagation or causality. */
export function buildRegionalRelations(evidence: PatternEvidence[], regions: RegionalPosturalPattern[]): PatternRecognitionResult['regionalRelations'] {
  const edges:PatternRecognitionResult['regionalRelations']=[]
  const active=evidence.filter(e=>e.reportEligible&&e.severity!=='normale')
  const adjacency=['distal:lower_limb','lower_limb:pelvic','pelvic:lumbar','lumbar:thoracic','thoracic:scapular','thoracic:cervical','cervical:head']
  const add=(a:RegionalPosturalPattern,b:RegionalPosturalPattern,kind:typeof edges[number]['kind'],sources:PatternEvidence[],direction:string)=>{
    if(!sources.length)return
    edges.push({id:`regional-edge:${kind}:${a.id}:${b.id}`,from:a.id,to:b.id,kind,direction,evidenceIds:unique(sources.map(e=>e.id)),...mergeProvenance(sources)})
  }
  for(let i=0;i<regions.length;i++)for(const b of regions.slice(i+1)) {
    const a=regions[i],left=active.filter(e=>e.region===a.region),right=active.filter(e=>e.region===b.region)
    const related=active.filter(e=>e.tags.includes('girdle_relation')&&[a.region,b.region].includes('scapular')&&[a.region,b.region].includes('pelvic')||e.tags.includes('distal_relation')&&[a.region,b.region].includes('distal')&&[a.region,b.region].some(r=>r==='pelvic'||r==='scapular'))
    if(related.length) {
      const directions=unique(related.flatMap(e=>e.direction?[e.direction]:[]))
      if(directions.length===1)add(a,b,related.some(e=>e.tags.includes('crossed_relation'))?'crossed':'measured_relation',unique([...left,...right,...related]),directions[0])
      continue
    }
    const adjacent=adjacency.includes(`${a.region}:${b.region}`)||adjacency.includes(`${b.region}:${a.region}`)
    if(!adjacent)continue
    const pairs=left.flatMap(l=>right.flatMap(r=>l.direction&&r.direction&&l.direction===r.direction&&planeFamily(l.plane)===planeFamily(r.plane)&&l.side===r.side&&l.tags.some(t=>['shift','tilt','spinal_curve'].includes(t)&&r.tags.includes(t))?[l,r]:[]))
    if(pairs.length)add(a,b,'anatomical_continuity',unique(pairs),unique(pairs.map(e=>e.direction)).join('; '))
  }
  const lower=regions.find(r=>r.region==='lower_limb')
  if(lower) {
    const opposition=active.filter(e=>e.tags.includes('lower_opposition'))
    if(opposition.length)edges.push({id:'regional-edge:opposition:lower_limb',from:lower.id,to:lower.id,fromSide:'destro',toSide:'sinistro',kind:'opposition',direction:'opposto DX/SX',evidenceIds:opposition.map(e=>e.id),...mergeProvenance(opposition)})
    const pelvic=regions.find(r=>r.region==='pelvic'),cross=active.filter(e=>e.tags.includes('crossed_relation'))
    if(pelvic&&opposition.length&&cross.length) {
      const directions=unique(cross.flatMap(e=>e.direction?[e.direction]:[]))
      if(directions.length===1)add(lower,pelvic,'crossed',[...opposition,...cross,...active.filter(e=>e.region==='pelvic')],directions[0])
    }
  }
  return edges
}
