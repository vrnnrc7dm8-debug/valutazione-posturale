import type { AlterationMyersInference, MyofascialLineResult } from '@/types'
import type { GlobalTensegrityPattern } from '@/types/functional'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'

export function inferMyersFromFunctionalGlobalPatterns(globals:GlobalTensegrityPattern[]):AlterationMyersInference[] {
  return globals.filter(g=>g.posturalPatternId&&g.lineIds.length).map(g=>{
    const direction=g.clinicalDirection??g.direction??''
    const side=g.direction==='DX→SX'?'destro' as const:g.direction==='SX→DX'?'sinistro' as const:/convessità SX/.test(direction)?'sinistro' as const:/convessità DX/.test(direction)?'destro' as const:'bilaterale' as const
    const lines=g.lineIds.filter(id=>!id.startsWith('lateral_')||side==='bilaterale'||id===(side==='destro'?'lateral_right':'lateral_left')).filter(id=>!id.startsWith('spiral_')||!!g.direction)
    return{instanceId:g.id,alterationId:g.name??'Pattern globale funzionale',plane:g.supportedPlanes?.[0]??'frontale_posteriore',lines:lines.map(lineId=>({lineId,lineName:MYOFASCIAL_LINES[lineId].name,side,
      score:Math.round(g.index/100*(g.supportScore??0)*3*100)/100,severity:g.severity??(g.index>=65?'severo' as const:g.index>=35?'moderato' as const:'lieve' as const),
      functionalState:'compenso' as const,confidence:g.supportScore??0,corroboratedBy:g.sourcePatternIds,tissues:[]}))}
  })
}
/** Use the strongest corroborated contribution, never sum overlapping signature variants. */
export function mergeFunctionalGlobalMyersResults(base:MyofascialLineResult[],inferences:AlterationMyersInference[]):MyofascialLineResult[] {
  const merged=new Map(base.map(b=>[b.lineId,b]))
  for(const inference of inferences)for(const line of inference.lines) {
    const previous=merged.get(line.lineId)
    if(!previous||line.score>previous.score)merged.set(line.lineId,{lineId:line.lineId,score:line.score,severity:line.severity,prevalentSide:line.side,possibleState:'compenso',involvedDistricts:[],softTissues:[]})
  }
  return[...merged.values()].sort((a,b)=>b.score-a.score)
}
