import { regionalClinicalSummary, bilateralHeadSummary } from './regionalClinicalSummary'
import { corroborateGlobalPosturalPattern } from './clinicalCorroboration'
import type { ClinicalObservation, AnatomicalPlane, PosturalPattern, MyofascialLineId } from '@/types'
import type { AutoMeasurement } from './biomechanicsEngine'
import type { PatternEvidence, PatternRegion, PatternRecognitionResult, RecognizedGlobalPattern } from '@/types/patternRecognition'
import { GLOBAL_PATTERN_CATALOG, type EvidenceSelector, type PatternSignature } from '@/data/globalPatternCatalog'
import { transverseRelationSide } from '@/data/transverseRelations'
import { buildRegionalRelations } from './regionalPatternGraph'
import { observationsFromAutoMeasurements, clinicalMappingForMeasurement } from './automaticObservations'
import { planeFamily, unique, mergeProvenance, FUNCTIONAL_SEVERITY_WEIGHT } from './functionalEvidence'

export const PATTERN_REGION_LABELS: Record<PatternRegion,string> = { head:'capo',cervical:'cervicale',thoracic:'toracico',lumbar:'lombare / toraco-lombare',scapular:'cingolo scapolare',pelvic:'bacino',lower_limb:'arti inferiori',distal:'appoggio distale / calcagni' }

export function observationRegion(o: Pick<ClinicalObservation,'district'|'phenomenon'|'anatomicalDetails'>): PatternRegion | undefined {
  const region=o.anatomicalDetails?.region ?? o.district
  if(/calcane|retropiede|podal|plantare|achille/.test(o.phenomenon))return 'distal'
  if(region==='cranio_cervicale')return 'head'
  if(region==='cervicale')return 'cervical'
  if(['toracica','cervico_dorsale'].includes(region))return 'thoracic'
  if(['lombare','lombosacrale','sacrale','toraco_lombare'].includes(region))return 'lumbar'
  if(region==='pelvico')return 'pelvic'
  if(region==='cintura_scapolare')return 'scapular'
  if(region==='arto_inferiore')return 'lower_limb'
  return undefined
}
function tagsFor(o: ClinicalObservation): string[] {
  const tags:string[]=[planeFamily(o.plane)]
  if(o.descriptor)tags.push(o.descriptor==='rotation'?'axial_rotation':o.descriptor)
  const region=observationRegion(o)
  if(/deviazione_rachidea|scoliosi|curva_primaria/.test(o.phenomenon)&&o.descriptor==='bend')tags.push('spinal_curve',region==='thoracic'?'thoracic_curve':region==='cervical'?'cervical_curve':'lumbar_curve')
  if(/cifosi|lordosi/.test(o.phenomenon))tags.push('sagittal_curve')
  if(/recurvatum/.test(o.phenomenon))tags.push('knee_sagittal','knee_extension')
  if(/flexum|flessione_ginocchio/.test(o.phenomenon))tags.push('knee_sagittal','knee_flexion')
  if(region==='head'||region==='cervical') {
    if(o.descriptor==='shift')tags.push('head_shift')
    if(o.descriptor==='tilt')tags.push('head_tilt')
    if(/anteriorizzazione|forward_head/.test(o.phenomenon)||['anteriore','anteriorizzazione'].includes(o.direction??''))tags.push('head_anterior')
  }
  if(o.transverseRelation) {
    const reference=o.transverseRelation.reference
    if(['scapolare_pelvico','scapulum_ileo'].includes(reference))tags.push('girdle_relation')
    if(o.descriptor==='compenso_crociato'||reference==='scapulum_ileo'&&o.side&&o.transverseRelation.referenceSide&&(o.side==='destro'?'dx':'sx')!==o.transverseRelation.referenceSide)tags.push('crossed_relation')
    if(/bicalcaneare|asse_piede/.test(reference))tags.push('distal_relation')
  }
  if(region==='distal')tags.push('distal_alignment')
  return unique(tags)
}
function sourceDirection(o: ClinicalObservation): PatternEvidence['direction'] {
  const side=transverseRelationSide(o.transverseRelation)
  if(side&&o.transverseRelation)return side==='destro'?'DX→SX':'SX→DX'
  if(o.descriptor==='anteposizione')return 'anteriore'
  if(o.descriptor==='retroposizione')return 'posteriore'
  if(o.descriptor==='bend') {
    if(o.anatomicalDetails?.convexity==='dx'||o.anatomicalDetails?.convexity==='sx')return o.anatomicalDetails.convexity
    if(o.direction==='dx'||o.direction==='sx')return o.direction==='dx'?'sx':'dx'
  }
  if(['indeterminabile','indeterminata','non_determinabile','non_specificato'].includes(o.direction as string))return undefined
  if(o.direction)return o.direction
  if(/anteriorizzazione|forward_head/.test(o.phenomenon))return 'anteriore'
  if(/recurvatum/.test(o.phenomenon))return 'posteriore'
  if(/flexum|flessione_ginocchio/.test(o.phenomenon))return 'anteriore'
}
export function extractPatternEvidence(observations: ClinicalObservation[], measurements: AutoMeasurement[], patterns: PosturalPattern[]): PatternEvidence[] {
  measurements = [...new Map(measurements.map(m => [`${m.plane}:${m.id}`,m])).values()]
  const result:PatternEvidence[]=[]
  const automatic = observationsFromAutoMeasurements(measurements)
  const excluded=new Set(observations.filter(o=>o.status==='excluded').flatMap(o=>[o.id,...o.sourceIds]))
  for(const m of measurements) {
    const id=`automatic_measurement:${m.plane}:${m.id}`
    if(!Number.isFinite(m.numericValue)||m.reportEligible===false||excluded.has(id))continue
    const decided=observations.find(o=>(o.id===id||o.sourceIds.includes(id))&&o.status!=='suggested')
    if(decided)continue // An edited or confirmed observation is the authority, not regenerated geometry.
    const meta=m.patternEvidence, suggestion=m.clinicalSuggestion, mapping=clinicalMappingForMeasurement(m)
    const placeholder:ClinicalObservation={id,plane:m.plane,phenomenon:mapping?.phenomenon??m.id,district:mapping?.district??'globale',descriptor:suggestion?.descriptor,direction:suggestion?.direction??m.direction,anatomicalDetails:suggestion?.anatomicalDetails,transverseRelation:suggestion?.transverseRelation,side:m.side,source:'automatic_measurement',sourceIds:[id],status:'suggested'}
    const mapped = automatic.find(o => o.id === id) ?? placeholder
    const region=meta?.region??observationRegion(mapped)
    if(!region)continue
    const dir=meta?.shape??meta?.convexityDirection??sourceDirection(mapped)
    result.push({id,plane:m.plane,region,tags:meta?.tags??tagsFor(mapped),independenceKey:meta?.independenceKey??id,direction:dir,
      reference:mapped.transverseRelation?.reference??meta?.landmarkIds.join('|')??mapped.phenomenon,side:m.side??mapped.side??(['lower_limb','head','cervical'].includes(region)&&m.plane.startsWith('sagittale_')?(m.plane==='sagittale_destro'?'destro':'sinistro'):undefined),severity:m.severity,value:m.numericValue===0?0:m.numericValue,unit:m.unit,description:`${m.label}: ${m.value}${m.observationNote?` · ${m.observationNote}`:''}`,
      multiSegment:meta?.multiSegment??false,confirmed:false,landmarkValidated:m.landmarkValidated===true,reportEligible:!!dir, bendDirection:meta?.bendDirection,convexityDirection:meta?.convexityDirection,
      sourceObservationIds:[],sourceMeasurementIds:unique([id,...(m.spinalCurve?.sourceMeasurementIds??[])]),sourcePatternIds:[]})
  }
  for(const o of observations.filter(o=>o.status==='confirmed'||o.status==='modified')) {
    const region=observationRegion(o),direction=sourceDirection(o)
    if(!region)continue
    const sourceIds=o.sourceIds.filter(id=>id.startsWith('automatic_measurement:'))
    const current=measurements.find(m=>sourceIds.includes(`automatic_measurement:${m.plane}:${m.id}`))
    const meta=current?.patternEvidence
    const changedOperator = current?.clinicalSuggestion && current.clinicalSuggestion.descriptor !== o.descriptor
    const semanticTags = (meta?.tags??[]).filter(t=>!changedOperator||!['spinal_curve','thoracic_curve','thoracolumbar_curve','lumbar_curve','head_shift','head_tilt','tilt','shift','axial_rotation'].includes(t))
    const invalidDirection = ['indeterminabile','indeterminata','non_determinabile'].includes(o.direction as string)
    const invalidReference=o.transverseRelation?.reference==='non_specificato'||o.transverseRelation?.orientation==='indeterminabile'
    result.push({id:`observation:${o.id}`,plane:o.plane,region,tags:unique([...tagsFor(o),...semanticTags]),independenceKey:meta?.independenceKey??sourceIds[0]??`observation:${o.id}`,direction,reference:o.transverseRelation?.reference??meta?.landmarkIds.join('|')??o.phenomenon,side:o.side??(['lower_limb','head','cervical'].includes(region)&&o.plane.startsWith('sagittale_')?(o.plane==='sagittale_destro'?'destro':'sinistro'):undefined),severity:o.severity??'lieve',value:o.quantitative?.value,unit:o.quantitative?.unit,
      description:`${o.phenomenon.replaceAll('_',' ')} · ${direction??'direzione da verificare'}${o.quantitative?` · ${o.quantitative.value} ${o.quantitative.unit}`:''}`,
      multiSegment:meta?.multiSegment??false,confirmed:true,landmarkValidated:current?.landmarkValidated===true,reportEligible:!!direction&&!invalidReference&&!invalidDirection&&!(o.descriptor==='bend'&&(o.direction==='dx'||o.direction==='sx')&&o.anatomicalDetails?.convexity===o.direction),
      bendDirection:o.descriptor==='bend'&&(o.direction==='dx'||o.direction==='sx')?o.direction:undefined,convexityDirection:o.descriptor==='bend'?(o.anatomicalDetails?.convexity==='dx'||o.anatomicalDetails?.convexity==='sx'?o.anatomicalDetails.convexity:o.direction==='dx'?'sx':o.direction==='sx'?'dx':undefined):undefined,
      sourceObservationIds:[o.id],sourceMeasurementIds:unique([...sourceIds,...(current?.spinalCurve?.sourceMeasurementIds??[]),...(o.quantitative?[`recorded_measurement:${o.id}`]:[])]),sourcePatternIds:patterns.filter(p=>p.observationIds.includes(o.id)).map(p=>p.id)})
  }
  // Shape is derived from the two authoritative curve components, never another independent vote.
  for (const shape of result.filter(e => e.tags.includes('spinal_shape'))) {
    const curves = result.filter(e => e.plane === shape.plane && e.tags.includes('spinal_curve') && e.severity !== 'normale' && e.reportEligible)
    const offsets = curves.filter(e => /post_chord_toracico_t[16]/.test(e.id) || e.sourceMeasurementIds.some(id => /post_chord_toracico_t[16]/.test(id)))
    shape.derived = true
    if (offsets.length !== 2) { shape.reportEligible = false; continue }
    const sides = offsets.map(e => e.convexityDirection ?? e.direction)
    const actual = sides[0] === sides[1] ? 'C' : 'S'
    shape.direction = actual
    shape.tags = shape.tags.filter(t => !t.startsWith('shape_')).concat(`shape_${actual}`)
    shape.description = `Configurazione fotografica a ${actual}, derivata dai componenti: ${offsets.map(e => e.description).join('; ')}`
    shape.severity = maxSeverity(offsets)
    shape.confirmed = offsets.every(e => e.confirmed)
    shape.landmarkValidated = offsets.every(e => e.landmarkValidated===true)
    Object.assign(shape, mergeProvenance([shape, ...offsets]))
  }
  // Bilateral comparison is relational evidence, not an extra independent measurement.
  const lower=result.filter(e=>e.region==='lower_limb'&&e.severity!=='normale'&&e.reportEligible)
  const categories=(e:PatternEvidence)=>e.tags.includes('knee_sagittal')?'knee_sagittal':e.tags.includes('axial_rotation')?'rotation':e.tags.includes('tilt')?'tilt':'alignment'
  for(const category of unique(lower.map(categories))) {
    const group=lower.filter(e=>categories(e)===category),right=group.filter(e=>e.side==='destro'),left=group.filter(e=>e.side==='sinistro')
    if(!right.length||!left.length)continue
    const polarity=(e:PatternEvidence)=>['dx','rotazione_dx','valgo','extrarotazione','anteriore','anteriorizzazione'].includes(e.direction??'')?1:['sx','rotazione_sx','varo','intrarotazione','posteriore','posteriorizzazione'].includes(e.direction??'')?-1:0
    const opposite=right.some(r=>left.some(l=>polarity(r)*polarity(l)<0))
    if(!opposite&&new Set(group.map(e=>e.severity)).size===1)continue
    result.push({id:`interlateral:${category}`,plane:group[0].plane,region:'lower_limb',tags:[opposite?'lower_opposition':'lower_asymmetry'],independenceKey:`bilateral:${category}`,direction:opposite?'opposto':undefined,derived:true,severity:maxSeverity(group),description:opposite?'Organizzazione opposta DX/SX':'Alterazione bilaterale asimmetrica',multiSegment:false,confirmed:group.every(e=>e.confirmed),landmarkValidated:group.every(e=>e.landmarkValidated===true),reportEligible:true,
      ...mergeProvenance(group)})
  }
  return [...new Map(result.map(e => [e.id,e])).values()]
}
const weight=(e:PatternEvidence)=>e.severity==='normale'?0:FUNCTIONAL_SEVERITY_WEIGHT[e.severity]
const maxSeverity=(items:PatternEvidence[])=>Math.max(...items.map(weight),0)>=.85?'severo':Math.max(...items.map(weight),0)>=.55?'moderato':'lieve'
const matches=(e:PatternEvidence,s:EvidenceSelector)=>(!s.tags||s.tags.some(tag=>e.tags.includes(tag)))&&(!s.regions||s.regions.includes(e.region))&&(!s.family||planeFamily(e.plane)===s.family)
function directionFor(signature:PatternSignature,evidence:PatternEvidence[]):string|undefined {
  const canonical = (direction: NonNullable<PatternEvidence['direction']>) => direction==='anteriorizzazione'?'anteriore':direction==='posteriorizzazione'?'posteriore':direction
  const directions=unique(evidence.flatMap(e=>e.direction?[canonical(e.direction)]:[]))
  if(signature.directionResolver==='shape')return evidence.find(e=>e.tags.some(t=>t===`shape_${signature.id.endsWith('S')?'S':'C'}`))?.direction
  if(signature.directionResolver==='crossed') {
    const explicit=directions.filter(d=>d==='DX→SX'||d==='SX→DX');return explicit.length===1?explicit[0]:undefined
  }
  if(signature.directionResolver==='opposite')return evidence.some(e=>e.tags.includes('lower_opposition'))?'opposto DX/SX':'asimmetrico DX/SX'
  if(signature.directionResolver==='curve') {
    const curved=evidence.filter(e=>e.tags.includes(signature.id==='thoracic_dominant'?'thoracic_curve':'lumbar_curve')||signature.id==='lumbar_dominant'&&e.tags.includes('thoracolumbar_curve'))
    const sides=unique(curved.flatMap(e=>e.convexityDirection?[e.convexityDirection]:e.direction?[e.direction]:[]));return sides.length===1?`convessità ${sides[0].toUpperCase()}`:undefined
  }
  if(signature.directionResolver==='coherent') {
    const simple=directions.filter(d=>!['C','S'].includes(d))
    return simple.length===1?simple[0]:undefined
  }
  // Configuration preserves explicit directions per region; never reinterprets shift or tilt as rotation.
  return directions.length?unique(evidence.filter(e=>e.direction).map(e=>`${e.region}: ${e.direction}`)).join('; '):undefined
}
function independentCount(evidence:PatternEvidence[]):number {
  return new Set(evidence.filter(e=>!e.derived).map(e=>e.independenceKey)).size
}
export function buildMultiplanarGlobalPatterns(observations:ClinicalObservation[],measurements:AutoMeasurement[],patterns:PosturalPattern[]=[]):PatternRecognitionResult {
  const evidence=extractPatternEvidence(observations,measurements,patterns)
  const regionalPatterns:PatternRecognitionResult['regionalPatterns']=unique(evidence.filter(e=>e.reportEligible&&e.severity!=='normale').map(e=>e.region)).map(region=>{
    const sources=evidence.filter(e=>e.region===region&&e.reportEligible&&e.severity!=='normale')
    const lower = sources.filter(e=>e.region==='lower_limb'&&!e.id.startsWith('interlateral:'))
    const sides = unique(lower.flatMap(e=>e.side&&e.side!=='bilaterale'?[e.side]:[]))
    const normalOpposite = sides.length===1&&evidence.some(e=>e.region==='lower_limb'&&e.side&&e.side!==sides[0]&&e.severity==='normale'&&lower.some(l=>e.tags.some(t=>['knee_sagittal','axial_rotation','tilt','shift'].includes(t)&&l.tags.includes(t))))
    const bilateralOrganization = region!=='lower_limb'?undefined:normalOpposite?'unilateral_alteration' as const:sources.some(e=>e.tags.includes('lower_opposition'))?'opposite' as const:sides.length<2?'not_comparable' as const:sources.some(e=>e.tags.includes('lower_asymmetry'))?'asymmetric' as const:new Set(lower.map(e=>e.severity)).size===1?'symmetric' as const:'bilateral_alteration' as const
    return{id:`regional:${region}`,region,bilateralOrganization,...regionalClinicalSummary(region,sources,measurements,patterns),evidenceIds:sources.map(e=>e.id),supportedPlanes:unique(sources.map(e=>e.plane)),directions:unique(sources.flatMap(e=>e.direction?[e.direction]:[])),severity:maxSeverity(sources),confirmed:sources.every(e=>e.confirmed),...mergeProvenance(sources)}
  })
  const unresolvedPotentialPatterns:PatternRecognitionResult['unresolvedPotentialPatterns']=[]
  const globalPatterns:RecognizedGlobalPattern[]=[]
  for(const signature of GLOBAL_PATTERN_CATALOG) {
    const pool=evidence.filter(e=>signature.regions.includes(e.region)&&signature.planes.includes(planeFamily(e.plane))&&e.reportEligible&&e.severity!=='normale')
    const required=signature.requiredEvidence.map(selector=>pool.filter(e=>matches(e,selector)))
    if(!required.some(items=>items.length))continue
    const missing=signature.requiredEvidence.filter((_,i)=>!required[i].length).map(s=>s.tags?.join(' / ')??s.regions?.join(' / ')??'evidenza')
    const sources=unique([...required.flat(),...pool.filter(e=>signature.supportingEvidence.some(s=>matches(e,s)))])
    // Interlateral derived feature requires original bilateral sources, not another vote from itself.
    if(sources.some(e=>e.id.startsWith('interlateral:'))) sources.push(...pool.filter(e=>e.region==='lower_limb'&&!sources.includes(e)))
    const regions=unique(sources.map(e=>e.region)),families=unique(sources.map(e=>planeFamily(e.plane)))
    const independent=independentCount(sources),multiSegment=!!signature.allowMultisegment&&sources.some(e=>e.multiSegment)
    const planes=unique(sources.map(e=>e.plane))
    const coverage=regions.length>=signature.minimumCoverage||multiSegment||families.length>=2
    const integrated=regions.length>=2||families.length>=2||multiSegment||signature.id==='lower_interlateral'&&independent>=2
    const contradiction=evidence.some(e=>signature.contradictingEvidence.some(s=>matches(e,s)))||pool.some(e=>signature.incompatibleEvidence.some(s=>matches(e,s)))
    const mixed=signature.id==='multiplanar_mixed'&&families.length<2
    const direction=directionFor(signature,sources)
    if(missing.length||!coverage||!integrated||independent<signature.minimumIndependentEvidence||contradiction||mixed||!direction) {
      unresolvedPotentialPatterns.push({signatureId:signature.id,reason:contradiction?'Evidenza contraddittoria: sintesi sospesa.':!direction?'Direzione non sufficientemente determinabile.':'Copertura o riscontri indipendenti insufficienti.',missingEvidence:missing.length?missing:[...(!coverage?['regioni o piani aggiuntivi']:[]),...(independent<signature.minimumIndependentEvidence?['riscontro indipendente']:[]),...(mixed?['seconda famiglia di piano']:[])]});continue
    }
    // A dominant curve must not be smaller than the other measured spinal region.
    if(['thoracic_dominant','lumbar_dominant'].includes(signature.id)) {
      const own=signature.id==='thoracic_dominant'?'thoracic':'lumbar'
      const magnitude=(region:PatternRegion)=>Math.max(...evidence.filter(e=>e.region===region&&e.tags.includes('spinal_curve')).map(e=>Math.abs(e.value??0)),0)
      if(magnitude(own)<magnitude(own==='thoracic'?'lumbar':'thoracic'))continue
    }
    const distinct=[...new Map(sources.filter(e=>!e.derived).map(e=>[e.independenceKey,e])).values()]
    const intensity=Math.min(100,Math.round(distinct.reduce((s,e)=>s+weight(e),0)/Math.max(1,distinct.length)*100*(.65+.1*(families.length-1)+.05*(regions.length-1))))
    const compatibility=signature.myersCompatibility.filter(id=>!id.startsWith('spiral_')||direction==='DX→SX'&&id==='spiral_right'||direction==='SX→DX'&&id==='spiral_left')
    globalPatterns.push({id:`recognized:${signature.id}:${sources.map(e=>e.id).sort().join('|')}`,signatureId:signature.id,name:signature.name,family:signature.family,evidenceIds:sources.map(e=>e.id),regionalPatternIds:regionalPatterns.filter(r=>regions.includes(r.region)).map(r=>r.id),supportedPlanes:planes,independentEvidenceCount:independent,regionsInvolved:regions,direction,functionalIntensity:intensity,severity:maxSeverity(sources),confirmed:sources.every(e=>e.confirmed),reportEligible:true,myersCompatibility:compatibility,
      explanation:sources.map(e=>e.description),consequences:['Configurazione fotografica compatibile con un adattamento tra le sole regioni documentate; da verificare clinicamente.',...(signature.directionResolver==='crossed'?['Possibile componente torsionale o di taglio organizzativo; nessuna forza o diagnosi dedotta.']:[])],...mergeProvenance(sources)})
  }
  if(!measurements.some(m=>m.id==='post_cranial_tilt'))unresolvedPotentialPatterns.push({signatureId:'posterior_head_tilt',reason:'Tilt capo non valutabile senza riferimenti cranici bilaterali visibili.',missingEvidence:['mastoide DX','mastoide SX']})
  if(!evidence.some(e=>(e.region==='head'||e.region==='cervical')&&e.tags.includes('axial_rotation')&&e.reportEligible))unresolvedPotentialPatterns.push({signatureId:'head_axial_rotation',reason:'Rotazione assiale non deducibile da occipite–C7; manca un riferimento orientativo indipendente.',missingEvidence:['riferimenti cranici bilaterali e orientamento clinico']})
  const provisional:PatternRecognitionResult={version:'pattern-recognition-v1',evidence,regionalPatterns,regionalRelations:[],globalPatterns,unresolvedPotentialPatterns}
  for (const global of globalPatterns) {
    const regional = regionalPatterns.filter(r=>global.regionalPatternIds.includes(r.id))
    global.explanation = unique(regional.flatMap(r=>r.components??[]).concat(global.explanation.map(text=>text.split(' · Riferimenti:')[0]).filter(text=>!text.includes('Configurazione fotografica a'))))
    const corroboration=corroborateGlobalPosturalPattern(global,provisional)
    global.supportScore=corroboration.supportScore; global.supportTypes=corroboration.supportTypes
    global.corroboration={eligible:corroboration.eligible,reasons:corroboration.reasons}
    const bilateral=patterns.find(p=>p.bilateral&&p.observationIds.some(id=>global.sourceObservationIds.includes(id)))
    if(bilateral?.bilateral?.dominantSide)global.prevalentSide=bilateral.bilateral.dominantSide
    else global.prevalentSide=bilateralHeadSummary(evidence.filter(e=>global.evidenceIds.includes(e.id)))?.dominantSide
  }
  const regionalRelations = buildRegionalRelations(evidence,regionalPatterns)
  return{version:'pattern-recognition-v1',evidence,regionalPatterns,regionalRelations,globalPatterns,unresolvedPotentialPatterns}
}
/** Candidate line families are not propagated to remote tissues; only confirmed sources can corroborate existing Myers. */
export function globalMyersSupport(recognition:PatternRecognitionResult,patternId:string,lineId:MyofascialLineId):string[] {
  return recognition.globalPatterns.filter(g=>g.confirmed&&g.sourcePatternIds.includes(patternId)&&g.myersCompatibility.includes(lineId)).map(g=>g.id)
}
export const supportedPlaneFamilies=(planes:AnatomicalPlane[])=>unique(planes.map(planeFamily))
