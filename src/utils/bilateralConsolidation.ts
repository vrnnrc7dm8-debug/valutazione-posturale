import type { PosturalPattern, Side, Severity } from '@/types'
import { unique } from './functionalEvidence'

export const BILATERAL_ASYMMETRY_THRESHOLD={percentuale:2,gradi:2,normalizzato:.02,mm:5} as const
const severityRank:Record<Severity,number>={lieve:1,moderato:2,severo:3}
function anatomicalSide(p:PosturalPattern):Side|undefined {
  return p.side ?? (p.plane==='sagittale_destro'?'destro':p.plane==='sagittale_sinistro'?'sinistro':undefined)
}
/** Merge only homologous, same-direction components; retain every side's value and origin. */
export function consolidateBilateralObservations(patterns:PosturalPattern[]):PosturalPattern[] {
  const groups=new Map<string,PosturalPattern[]>()
  for(const p of patterns) {
    const direction=p.phenomenon==='anteriorizzazione_capo'&&(!p.direction||['anteriore','anteriorizzazione'].includes(p.direction))?'anteriore':p.direction
    const side=anatomicalSide(p)
    const key=direction&&(side==='destro'||side==='sinistro')?JSON.stringify([p.phenomenon,p.district,p.anatomicalDetails?.region,p.anatomicalDetails?.apex,p.anatomicalDetails?.level,p.anatomicalDetails?.startLevel,p.anatomicalDetails?.endLevel,p.anatomicalDetails?.convexity,p.descriptor,direction,p.quantitative?.unit]):p.id
    groups.set(key,[...groups.get(key)??[],p])
  }
  return [...groups.values()].flatMap(sources=>{
    const right=sources.filter(p=>anatomicalSide(p)==='destro'),left=sources.filter(p=>anatomicalSide(p)==='sinistro')
    if(!right.length||!left.length)return sources
    const representative=(side:PosturalPattern[])=>[...side].sort((a,b)=>(severityRank[b.severity??'lieve']-severityRank[a.severity??'lieve'])||Math.abs(b.quantitative?.value??0)-Math.abs(a.quantitative?.value??0))[0]
    const r=representative(right),l=representative(left),unit=r.quantitative?.unit
    const rv=r.quantitative?.value,lv=l.quantitative?.value
    const asymmetric=unit&&rv!==undefined&&lv!==undefined&&Math.abs(Math.abs(rv)-Math.abs(lv))>BILATERAL_ASYMMETRY_THRESHOLD[unit]
    const dominant=asymmetric?(Math.abs(rv!)>Math.abs(lv!)?'destro':'sinistro'):undefined
    const strongest=[...sources].sort((a,b)=>severityRank[b.severity??'lieve']-severityRank[a.severity??'lieve'])[0]
    return [{...r,sourceObservationIds:unique(sources.flatMap(p=>p.observationIds)),sourceMeasurementIds:unique(sources.flatMap(p=>p.observationIds.map(id=>id.startsWith('automatic_measurement:')?id:`recorded_measurement:${id}`))),id:`bilateral:${sources.map(p=>p.id).sort().join('|')}`,side:'bilaterale' as const,severity:strongest.severity,
      observationIds:unique(sources.flatMap(p=>p.observationIds)),supportedPlanes:unique(sources.flatMap(p=>p.supportedPlanes??[p.plane])),
      bilateral:{classification:asymmetric?'asymmetric' as const:rv===undefined||lv===undefined?'not_comparable' as const:'symmetric' as const,dominantSide:dominant,right:r.quantitative,left:l.quantitative,
        sourcePatternIds:sources.map(p=>p.id),sourceMeasurementIds:unique(sources.flatMap(p=>p.observationIds.map(id=>id.startsWith('automatic_measurement:')?id:`recorded_measurement:${id}`))),sourceObservationIds:unique(sources.flatMap(p=>p.observationIds))},
    }]
  })
}
