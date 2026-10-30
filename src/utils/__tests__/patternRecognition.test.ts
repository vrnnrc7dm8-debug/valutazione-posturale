import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PlacedLandmark, ClinicalObservation } from '@/types'
import { analyzePosterior } from '../posteriorAnalysis'
import { computeAutoMeasurements, buildBiomechanicalAxes } from '../biomechanicsEngine'
import { observationsFromAutoMeasurements } from '../automaticObservations'
import { runClinicalPipeline } from '../clinicalPipeline'
import { buildMultiplanarGlobalPatterns } from '../patternRecognition'
import { computePlanePriority } from '../planePriority'
import { GLOBAL_PATTERN_CATALOG } from '@/data/globalPatternCatalog'
import { recognizedPatternReportLines } from '../globalPatternFormat'
import { GlobalPatternPanel } from '@/components/GlobalPatternPanel'
import { createEmptyAssessment, hydrateAssessment } from '../storage'
import { generateAssessmentReport } from '../reportGeneration'
import { buildTextReportLines } from '../export'

const lm=(id:string,x:number,y:number):PlacedLandmark=>({id,landmarkId:id,label:id,shortLabel:id,plane:'frontale_posteriore',position:{x,y},side:'linea_mediana',category:'spine',confidence:1,detectionSource:'manual'})
const posterior=(t6=.5,t11=.5)=>[
  lm('occipite',.5,.1),lm('cervicale_c7',.5,.2),lm('toracico_t6',t6,.35),lm('toracico_t11',t11,.5),lm('lombare_l2',.5,.65),
  lm('acromion_post_dx',.65,.22),lm('acromion_post_sx',.35,.22),lm('psis_dx',.6,.75),lm('psis_sx',.4,.751),lm('calcagno_dx',.6,.95),lm('calcagno_sx',.4,.95),
]
const observe=(id:string,patch:Partial<ClinicalObservation>={}):ClinicalObservation=>({id,plane:'sagittale_destro',district:'toracica',phenomenon:'deviazione_rachidea',descriptor:'shift',direction:'anteriore',severity:'moderato',quantitative:{value:5,unit:'percentuale'},source:'manual',sourceIds:[id],status:'confirmed',...patch})
const recognize=(points:PlacedLandmark[])=>buildMultiplanarGlobalPatterns([],computeAutoMeasurements('frontale_posteriore',points))

describe('polilinea posteriore e riconoscimento fotografico',()=>{
  it('A: rettilineo non produce curvature né pattern C/S',()=>{
    const r=recognize(posterior())
    expect(r.evidence.filter(e=>e.tags.includes('spinal_curve')).every(e=>e.severity==='normale')).toBe(true)
    expect(r.globalPatterns.some(g=>g.signatureId.startsWith('functional_curve'))).toBe(false)
    expect(r.globalPatterns.some(g=>g.signatureId==='thoracic_dominant'||g.signatureId==='lumbar_dominant')).toBe(false)
  })
  it('B: offset SX coerenti → convessità SX, bend DX e curva C; il segno non è hardcoded',()=>{
    const points=posterior(.45,.46),before=structuredClone(points),measurements=computeAutoMeasurements('frontale_posteriore',points)
    const t6=measurements.find(m=>m.id==='post_chord_toracico_t6')!
    expect(t6.numericValue).toBe(-5)
    expect(t6.patternEvidence).toMatchObject({convexityDirection:'sx',bendDirection:'dx'})
    expect(t6.clinicalSuggestion?.direction).toBe('dx')
    const proposals=observationsFromAutoMeasurements(measurements)
    expect(proposals.find(o=>o.id.endsWith('post_chord_toracico_t6'))).toMatchObject({direction:'dx',descriptor:'bend',anatomicalDetails:{convexity:'sx',region:'toracica'}})
    expect(recognize(points).globalPatterns.find(g=>g.signatureId==='functional_curve_C')?.direction).toBe('C')
    expect(recognize(posterior(.55,.54)).globalPatterns.find(g=>g.signatureId==='thoracic_dominant')?.direction).toBe('convessità DX')
    expect(points).toEqual(before)
  })
  it('C: offset di segno opposto → inversione e pattern fotografico a S',()=>{
    const r=recognize(posterior(.45,.55))
    expect(r.globalPatterns.some(g=>g.signatureId==='functional_curve_S')).toBe(true)
    expect(r.globalPatterns.some(g=>g.signatureId==='functional_curve_C')).toBe(false)
    expect(computeAutoMeasurements('frontale_posteriore',posterior(.45,.55)).filter(m=>m.id.startsWith('post_turn_'))).toHaveLength(2)
  })
  it('D: occipite traslato senza linea cranica → shift, nessun tilt o rotazione assiale inventati',()=>{
    const points=posterior();points[0].position.x=.56
    const m=computeAutoMeasurements('frontale_posteriore',points),r=recognize(points)
    expect(m.find(x=>x.id==='post_occipital_shift')?.numericValue).toBe(6)
    expect(observationsFromAutoMeasurements(m).some(o=>o.phenomenon==='shift_capo')).toBe(true)
    expect(observationsFromAutoMeasurements(m).some(o=>o.phenomenon==='rotazione_capo'||o.phenomenon==='tilt_capo')).toBe(false)
    expect(r.unresolvedPotentialPatterns.some(u=>u.signatureId==='head_axial_rotation')).toBe(true)
  })
  it('E/F: PSIS quasi neutre non abbassano la priorità di una curva moderata',()=>{
    const measurements=computeAutoMeasurements('frontale_posteriore',posterior(.46,.465))
    expect(measurements.find(m=>m.id==='dislivello_psis_auto')?.numericValue).toBeCloseTo(.1)
    const r=buildMultiplanarGlobalPatterns([],measurements)
    const score=computePlanePriority({plane:'frontale_posteriore',alterations:[]},measurements,r)
    expect(['media','alta']).toContain(score.priority)
    expect(score.score).toBeGreaterThanOrEqual(5)
    expect(computePlanePriority({plane:'frontale_posteriore',alterations:[]},[...measurements,...measurements],r)).toEqual(score)
  })
  it('G: posteriore + sagittale generano un pattern misto senza esigere cinque piani',()=>{
    const measurements=computeAutoMeasurements('frontale_posteriore',posterior(.45,.46))
    const r=buildMultiplanarGlobalPatterns([observe('sagittal')],measurements)
    const global=r.globalPatterns.find(g=>g.signatureId==='multiplanar_mixed')!
    expect(global.supportedPlanes).toEqual(expect.arrayContaining(['frontale_posteriore','sagittale_destro']))
    expect(global.independentEvidenceCount).toBeGreaterThanOrEqual(2)
    expect(global.confirmed).toBe(false)
    expect(r.globalPatterns.some(g=>g.signatureId==='global_torsional')).toBe(false)
  })
  it('H: posteriore + trasverso orientato e crociato sostengono un pattern torsionale, senza calcagni obbligatori',()=>{
    const observations=[
      observe('scapula',{plane:'trasverso',district:'cintura_scapolare',phenomenon:'posizione_scapulum',descriptor:'anteposizione',direction:'anteriore',side:'destro'}),
      observe('pelvis',{plane:'trasverso',district:'pelvico',phenomenon:'posizione_ileo',descriptor:'retroposizione',direction:'posteriore',side:'sinistro'}),
      observe('cross',{plane:'trasverso',district:'cintura_scapolare',phenomenon:'relazione_scapulum_ileo',descriptor:'compenso_crociato',direction:undefined,side:'destro',transverseRelation:{reference:'scapulum_ileo',referenceSide:'sx',relationType:'compenso_crociato',orientation:'dx_anteposto'}}),
    ]
    const r=buildMultiplanarGlobalPatterns(observations,computeAutoMeasurements('frontale_posteriore',posterior(.45,.46)))
    expect(r.globalPatterns.find(g=>g.signatureId==='global_torsional')?.direction).toBe('DX→SX')
    expect(r.globalPatterns.find(g=>g.signatureId==='crossed')?.myersCompatibility).toContain('spiral_right')
    const opposite={...observations[2],id:'opposite',transverseRelation:{...observations[2].transverseRelation!,orientation:'sx_anteposto' as const}}
    expect(buildMultiplanarGlobalPatterns([...observations,opposite],[]).globalPatterns.some(g=>g.signatureId==='global_torsional')).toBe(false)
  })
  it('I: direzione/riferimento non risolti rimangono nel debug e fuori dal report',()=>{
    const unresolved=observe('unknown',{plane:'trasverso',district:'cervicale',phenomenon:'rotazione_capo',descriptor:'rotation',direction:undefined})
    const r=buildMultiplanarGlobalPatterns([unresolved],[])
    expect(r.regionalPatterns).toEqual([]);expect(r.globalPatterns).toEqual([])
    expect(recognizedPatternReportLines(r).join('\n')).not.toContain('unknown')
    expect(renderToStaticMarkup(createElement(GlobalPatternPanel,{result:r}))).not.toContain('potenziali pattern non risolti')
    expect(renderToStaticMarkup(createElement(GlobalPatternPanel,{result:r,debug:true}))).toContain('potenziali pattern non risolti')
  })
  it('mirroring e traslazione rigida conservano convessità anatomica; scala non inventa direzioni',()=>{
    const points=posterior(.45,.46)
    const mirrored=points.map(l=>({...l,position:{x:1-l.position.x,y:l.position.y}}))
    expect(recognize(mirrored).globalPatterns.find(g=>g.signatureId==='thoracic_dominant')?.direction).toBe('convessità SX')
    const shifted=points.map(l=>({...l,position:{x:l.position.x+.1,y:l.position.y}}))
    expect(analyzePosterior(shifted).measurements.find(m=>m.id==='post_chord_toracico_t6')?.numericValue).toBe(-5)
    const incomplete=analyzePosterior(points.filter(l=>l.landmarkId!=='lombare_l2'))
    expect(incomplete.measurements.some(m=>m.id.startsWith('post_chord'))).toBe(false)
    expect(incomplete.unresolvedPotentialPatterns.length).toBeGreaterThan(0)
  })
  it('mastoidi bilaterali abilitano il solo tilt; landmark AI non confermati non entrano nella geometria',()=>{
    const points=[...posterior(),lm('mastoide_dx',.55,.1),lm('mastoide_sx',.45,.09)]
    const result=analyzePosterior(points,{imageAspectRatio:1})
    expect(result.measurements.find(m=>m.id==='post_cranial_tilt')?.severity).not.toBe('normale')
    expect(observationsFromAutoMeasurements(result.measurements).some(o=>o.phenomenon==='tilt_capo')).toBe(true)
    expect(result.measurements.some(m=>m.clinicalSuggestion?.phenomenon==='rotazione_capo')).toBe(false)
    const proposed=points.map(l=>({...l,detectionSource:'automatic' as const,needsConfirmation:true}))
    expect(analyzePosterior(proposed).measurements).toEqual([])
  })
  it('polilinea e corda sono disponibili anche nella sovrapposizione grafica',()=>{
    expect(buildBiomechanicalAxes('frontale_posteriore',posterior()).filter(a=>a.id.startsWith('polilinea'))).toHaveLength(3)
    expect(buildBiomechanicalAxes('frontale_posteriore',posterior()).some(a=>a.id==='corda_c7_l2')).toBe(true)
  })
  it('solo conferma abilita Myers, e ogni deduzione risale a misure e fonti',()=>{
    const measurements=computeAutoMeasurements('frontale_posteriore',posterior(.45,.46))
    const suggested=runClinicalPipeline([{plane:'frontale_posteriore',alterations:[]}],measurements)
    expect(suggested.patternRecognition.globalPatterns.length).toBeGreaterThan(0)
    expect(suggested.inferences).toEqual([])
    const observations=suggested.observations.map(o=>({...o,status:'confirmed' as const}))
    const confirmed=runClinicalPipeline([{plane:'frontale_posteriore',alterations:[],observations}],measurements)
    expect(confirmed.inferences.some(i=>i.lines.length>0)).toBe(true)
    const pattern=confirmed.patternRecognition.globalPatterns.find(g=>g.signatureId==='thoracic_dominant')!
    expect(pattern.sourceObservationIds.length).toBeGreaterThan(0)
    expect(pattern.sourcePatternIds.length).toBeGreaterThan(0)
    expect(pattern.sourceMeasurementIds.every(id=>id.startsWith('recorded_measurement:')||measurements.some(m=>id===`automatic_measurement:${m.plane}:${m.id}`))).toBe(true)
    const excluded=runClinicalPipeline([{plane:'frontale_posteriore',alterations:[],observations:observations.map(o=>({...o,status:'excluded'}))}],measurements)
    expect(excluded.patternRecognition.globalPatterns.some(g=>g.signatureId==='thoracic_dominant')).toBe(false)
  })
  it('regressione completa: gli undici landmark con PSIS neutre non producono soltanto una misura',()=>{
    const a=createEmptyAssessment(),points=posterior(.45,.46)
    const photo=a.photos.find(p=>p.plane==='frontale_posteriore')!
    photo.dataUrl='data:image/png;base64,c3ludGhldGlj';photo.annotations.landmarks.manual=points
    const before=structuredClone(a),generated=generateAssessmentReport(a)
    expect(a).toEqual(before)
    const section=generated.report!.sections.find(s=>s.plane==='frontale_posteriore')!
    expect(section.autoMeasurements.length).toBeGreaterThan(10)
    expect(section.therapeuticPriority).not.toBe('bassa')
    const text=buildTextReportLines(generated)!.join('\n')
    expect(text).toContain('Pattern scoliotico funzionale/fotografico a C')
    expect(text).toContain('Perché questo pattern?')
    expect(text).not.toContain('Tilt capo non valutabile')
    expect(hydrateAssessment(JSON.parse(JSON.stringify(generated))).report).toEqual(generated.report)
  })
  it('catalogo strutturato estendibile: tutte le firme esplicitano copertura, direzione, contraddizioni e limiti',()=>{
    expect(GLOBAL_PATTERN_CATALOG.length).toBeGreaterThanOrEqual(16)
    expect(new Set(GLOBAL_PATTERN_CATALOG.map(s=>s.id)).size).toBe(GLOBAL_PATTERN_CATALOG.length)
    for(const s of GLOBAL_PATTERN_CATALOG) {
      expect(s.requiredEvidence.length).toBeGreaterThan(0)
      expect(s.minimumIndependentEvidence).toBeGreaterThanOrEqual(1)
      expect(s.reportEligibility).toBe('resolved_geometry_or_confirmed')
      expect(s.contradictingEvidence).toBeDefined();expect(s.incompatibleEvidence).toBeDefined()
    }
  })
})

it('esclude anche i sentinel storici non risolti da nuovi referti senza alterare gli originali',()=>{
  const a=createEmptyAssessment()
  a.planeAssessments.find(pa=>pa.plane==='trasverso')!.observations=[observe('unresolved-rotation',{plane:'trasverso',district:'cervicale',phenomenon:'rotazione_capo',descriptor:'rotation',direction:undefined}),observe('unresolved-reference',{plane:'trasverso',district:'pelvico',phenomenon:'relazione_scapolo_pelvica',descriptor:'dissociazione',transverseRelation:{reference:'non_specificato',relationType:'dissociazione',orientation:'indeterminabile'}})]
  a.planeAssessments.find(pa=>pa.plane==='frontale_posteriore')!.observations=[observe('unresolved-region',{plane:'frontale_posteriore',district:'globale',phenomenon:'deviazione_rachidea',descriptor:'bend',direction:'dx',anatomicalDetails:{region:'indeterminata'}})]
  const before=structuredClone(a),generated=generateAssessmentReport(a)
  expect(a).toEqual(before)
  expect(generated.report!.clinicalPipeline!.observations).toEqual([])
  expect(generated.report!.clinicalPipeline!.patterns).toEqual([])
  const text=buildTextReportLines(generated)!.join('\n')
  expect(text).not.toContain('unresolved-rotation');expect(text).not.toContain('unresolved-reference');expect(text).not.toContain('unresolved-region')
})

it('due viste sagittali non sono due piani geometrici indipendenti; duplicati non aumentano il peso',()=>{
  const a=observe('thorax'),b=observe('lumbar',{district:'lombare',plane:'sagittale_sinistro'})
  const r=buildMultiplanarGlobalPatterns([a,b],[])
  expect(r.globalPatterns.some(g=>g.signatureId==='multiplanar_mixed')).toBe(false)
  const m=computeAutoMeasurements('frontale_posteriore',posterior(.45,.46))
  expect(buildMultiplanarGlobalPatterns([],[...m,...m])).toEqual(buildMultiplanarGlobalPatterns([],m))
})

it('una curva derivata segue conferme, esclusioni e correzioni dei componenti, senza aggiungere un voto indipendente',()=>{
  const measurements=computeAutoMeasurements('frontale_posteriore',posterior(.45,.46))
  const observations=observationsFromAutoMeasurements(measurements).map(o=>({...o,status:'confirmed' as const}))
  const run=(items:ClinicalObservation[])=>runClinicalPipeline([{plane:'frontale_posteriore',alterations:[],observations:items}],measurements).patternRecognition
  const c=run(observations).globalPatterns.find(g=>g.signatureId==='functional_curve_C')!
  expect(c.confirmed).toBe(true)
  expect(c.sourceObservationIds).toEqual(expect.arrayContaining(observations.filter(o=>o.id.includes('post_chord')).map(o=>o.id)))
  const shape=run(observations).evidence.find(e=>e.tags.includes('spinal_shape'))!
  expect(shape.derived).toBe(true)
  const excluded=observations.map(o=>o.id.endsWith('post_chord_toracico_t11')?{...o,status:'excluded' as const}:o)
  expect(run(excluded).globalPatterns.some(g=>g.signatureId.startsWith('functional_curve'))).toBe(false)
  const corrected=observations.map(o=>o.id.endsWith('post_chord_toracico_t11')?{...o,status:'modified' as const,direction:'sx' as const,anatomicalDetails:{...o.anatomicalDetails,convexity:'dx' as const}}:o)
  expect(run(corrected).globalPatterns.some(g=>g.signatureId==='functional_curve_S')).toBe(true)
})

it('conserva componenti cefaliche indipendenti e riconosce una configurazione cervico-toracica senza dedurre una Spirale dal singolo lato',()=>{
  const observations=[
    observe('head-shift',{plane:'frontale_posteriore',district:'cranio_cervicale',phenomenon:'shift_capo',descriptor:'shift',direction:'dx'}),
    observe('head-rotation',{plane:'frontale_posteriore',district:'cranio_cervicale',phenomenon:'rotazione_capo',descriptor:'rotation',direction:'rotazione_sx'}),
    observe('thorax-rotation',{plane:'trasverso',district:'toracica',phenomenon:'rotazione_toracica',descriptor:'rotation',direction:'rotazione_dx'}),
  ]
  const result=buildMultiplanarGlobalPatterns(observations,[])
  expect(result.evidence.filter(e=>e.region==='head')).toHaveLength(2)
  expect(result.evidence.some(e=>e.tags.includes('head_tilt'))).toBe(false)
  const torsional=result.globalPatterns.find(g=>g.signatureId==='cervico_thoracic_torsional')!
  expect(torsional).toBeDefined();expect(torsional.myersCompatibility.some(id=>id.startsWith('spiral_'))).toBe(false)
  expect(torsional.direction).toContain('rotazione_dx');expect(torsional.direction).toContain('rotazione_sx')
})
