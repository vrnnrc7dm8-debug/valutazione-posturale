import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ClinicalObservation, PlacedLandmark } from '@/types'
import type { AutoMeasurement } from '../biomechanicsEngine'
import { computeAutoMeasurements } from '../biomechanicsEngine'
import { computeSpinalCurveEvidence, SPINAL_CURVE_THRESHOLDS } from '../spinalCurveEvidence'
import { consolidateBilateralObservations } from '../bilateralConsolidation'
import { consolidateObservations, formatPattern, runClinicalPipeline, observationSummaries } from '../clinicalPipeline'
import { buildMultiplanarGlobalPatterns } from '../patternRecognition'
import { buildFunctionalGlobalPatterns, corroborateGlobalPosturalPattern } from '../clinicalCorroboration'
import { inferMyersFromFunctionalGlobalPatterns } from '../functionalGlobalMyers'
import { functionalModelToLines } from '../functionalFormat'
import { recognizedPatternReportLines } from '../globalPatternFormat'
import { GlobalPatternPanel } from '@/components/GlobalPatternPanel'

// Exact geometric values supplied by the user; no patient identifier or image is involved.
const measured=(id:string,value:number,unit:'gradi'|'percentuale'):AutoMeasurement=>({id,numericValue:value,value:String(value),label:id,unit,plane:'frontale_posteriore',severity:'normale',reportEligible:true,landmarkValidated:true})
const realMetrics=()=>[
  measured('post_chord_toracico_t6',-.51,'percentuale'),measured('post_chord_toracico_t11',-.73,'percentuale'),
  measured('post_segment_0',-1.23,'gradi'),measured('post_segment_1',-.38,'gradi'),measured('post_segment_2',3.6,'gradi'),
  measured('post_turn_0',.85,'gradi'),measured('post_turn_1',3.98,'gradi'),
]
const head=(id:string,plane:ClinicalObservation['plane'],value:number):ClinicalObservation=>({id,plane,phenomenon:'anteriorizzazione_capo',district:'cranio_cervicale',descriptor:'shift',direction:'anteriore',severity:value>=12?'severo':'moderato',quantitative:{value,unit:'percentuale'},source:'manual',sourceIds:[id],status:'confirmed'})
const lm=(id:string,x:number,y:number):PlacedLandmark=>({id,landmarkId:id,label:id,shortLabel:id,position:{x,y},plane:'frontale_posteriore',side:'linea_mediana',category:'spine',confidence:1,detectionSource:'manual'})
const points=()=>[lm('cervicale_c7',.5,.2),lm('toracico_t6',.49,.35),lm('toracico_t11',.485,.5),lm('lombare_l2',.5,.65),lm('psis_dx',.6,.75),lm('psis_sx',.4,.751)]

describe('A–C: criterio rachideo composito',()=>{
  it('A/B: riconosce i valori del caso reale anche sotto la vecchia soglia offset',()=>{
    const curve=computeSpinalCurveEvidence(realMetrics())
    expect(curve).toMatchObject({present:true,shape:'C',convexityDirection:'sx',bendDirection:'dx',lowerCompensationDirection:'dx',severity:'moderato'})
    expect(curve.score).toBeGreaterThanOrEqual(SPINAL_CURVE_THRESHOLDS.detectionScore)
    expect(curve.segmentCount).toBe(3)
    expect(curve.sourceMeasurementIds).toHaveLength(7)
  })
  it('C: offset modesti senza supporto angolare non diventano curva',()=>{
    const neutral=realMetrics().map(m=>({...m,numericValue:m.unit==='gradi'?0:m.numericValue}))
    expect(computeSpinalCurveEvidence(neutral).present).toBe(false)
    expect(computeSpinalCurveEvidence(realMetrics().map(m=>({...m,numericValue:0}))).score).toBe(0)
  })
  it('score monotono per ogni componente di ampiezza, con segni e copertura invariati',()=>{
    const baseline=computeSpinalCurveEvidence(realMetrics()).score
    for(let i=0;i<7;i++) {
      const increased=realMetrics().map((m,n)=>n===i?{...m,numericValue:m.numericValue!*1.5}:m)
      expect(computeSpinalCurveEvidence(increased).score).toBeGreaterThanOrEqual(baseline)
    }
    const mirrored=computeSpinalCurveEvidence(realMetrics().map(m=>({...m,numericValue:-m.numericValue!})))
    expect(mirrored).toMatchObject({present:true,convexityDirection:'dx',bendDirection:'sx',lowerCompensationDirection:'sx'})
    expect(mirrored.score).toBe(baseline)
  })
  it('non usa angoli preliminari né orientamenti incompatibili per completare una curva',()=>{
    expect(computeSpinalCurveEvidence(realMetrics().map(m=>({...m,reportEligible:m.unit!=='gradi'}))).present).toBe(false)
    expect(computeSpinalCurveEvidence(realMetrics().map(m=>m.id==='post_segment_2'?{...m,numericValue:-3.6}:m)).present).toBe(false)
  })
  it('trasforma la polilinea in nomi regionali espliciti, non in una lista di direzioni mescolate',()=>{
    const measurements=computeAutoMeasurements('frontale_posteriore',points(),{imageAspectRatio:1})
    const result=buildMultiplanarGlobalPatterns([],measurements)
    const thoracic=result.regionalPatterns.find(r=>r.region==='thoracic')!
    expect(thoracic.name).toBe('Curva toracica sinistro-convessa')
    expect(thoracic.interpretation).toContain('compenso inferiore destro')
    expect(measurements.some(m=>m.id==='post_spine_neutral')).toBe(false)
    expect(thoracic.components?.some(c=>c.includes('T6: offset SX'))).toBe(true)
  })
})

describe('D/E/J: consolidamento bilaterale',()=>{
  it('genera un solo pattern con due valori, fonti e prevalenza SX',()=>{
    const observations=[head('right','sagittale_destro',9.5),head('left','sagittale_sinistro',14.8)]
    const patterns=consolidateBilateralObservations(consolidateObservations(observations))
    expect(patterns).toHaveLength(1)
    expect(patterns[0]).toMatchObject({side:'bilaterale',severity:'severo',bilateral:{classification:'asymmetric',dominantSide:'sinistro',right:{value:9.5},left:{value:14.8},sourceObservationIds:['right','left']}})
    expect(patterns[0].bilateral?.sourceMeasurementIds).toHaveLength(2)
    expect(formatPattern(patterns[0])).toContain('Anteriorizzazione cefalica bilaterale con prevalenza SX')
    expect(observationSummaries(observations)).toHaveLength(1)
  })
  it('distingue simmetria, assenza del lato opposto e direzioni/operatori opposti',()=>{
    const a=head('a','sagittale_destro',9.5),b=head('b','sagittale_sinistro',10)
    expect(consolidateBilateralObservations(consolidateObservations([a,b]))[0].bilateral?.classification).toBe('symmetric')
    expect(consolidateBilateralObservations(consolidateObservations([a]))[0].bilateral).toBeUndefined()
    expect(consolidateBilateralObservations(consolidateObservations([a,{...b,direction:'posteriore'}]))).toHaveLength(2)
    expect(consolidateBilateralObservations(consolidateObservations([a,{...b,descriptor:'rotation',direction:'rotazione_sx'}]))).toHaveLength(2)
  })
  it('mantiene unità diverse e pattern con apici/regione differenti separati',()=>{
    const a=head('a','sagittale_destro',9.5),b=head('b','sagittale_sinistro',10)
    expect(consolidateBilateralObservations(consolidateObservations([a,{...b,quantitative:{value:10,unit:'gradi'}}]))).toHaveLength(2)
  })
})

describe('F–I: corroborazione e ponte funzionale/Myers',()=>{
  it('F/I: geometria validata sufficiente passa senza una seconda conferma e alimenta Myers locale',()=>{
    const measurements=computeAutoMeasurements('frontale_posteriore',points(),{imageAspectRatio:1})
    const pipeline=runClinicalPipeline([{plane:'frontale_posteriore',alterations:[]}],measurements)
    expect(pipeline.patterns).toEqual([]) // Elementary suggestions are still editable, not silently confirmed.
    const global=pipeline.functionalModel.globalPatterns.find(g=>g.posturalPatternId?.includes('recognized:functional_curve_C:'))!
    expect(global).toBeDefined();expect(global.supportTypes).toContain('geometricSupport')
    expect(pipeline.functionalGlobalInferences.some(i=>i.lines.some(l=>l.lineId==='lateral_left'))).toBe(true)
    expect(pipeline.functionalGlobalInferences.some(i=>i.lines.some(l=>l.lineId.startsWith('spiral_')))).toBe(false)
    expect(pipeline.functionalModel.tissues.every(t=>t.state==='undetermined')).toBe(true)
    expect(measurements.filter(m=>m.id.startsWith('post_chord_toracico_')).map(m=>m.numericValue)).toEqual([-1,-1.5])
  })
  it('G: riferimento non specificato, direzione assente, fonte non validata o contraddizione impediscono il trasferimento',()=>{
    const measurements=computeAutoMeasurements('frontale_posteriore',points(),{imageAspectRatio:1})
    const r=buildMultiplanarGlobalPatterns([],measurements),g=r.globalPatterns.find(g=>g.signatureId==='functional_curve_C')!
    expect(corroborateGlobalPosturalPattern({...g,direction:'indeterminabile'},r).eligible).toBe(false)
    expect(corroborateGlobalPosturalPattern(g,{...r,evidence:r.evidence.map(e=>({...e,reference:'non_specificato'}))}).eligible).toBe(false)
    expect(buildFunctionalGlobalPatterns({...r,evidence:r.evidence.map(e=>({...e,landmarkValidated:false,confirmed:false}))})).toEqual([])
    const neutral={...r.evidence[0],id:'neutral',tags:['spine_neutral'],severity:'normale' as const}
    expect(corroborateGlobalPosturalPattern(g,{...r,evidence:[...r.evidence,neutral]}).eligible).toBe(false)
  })
  it('H: pattern scapolo-pelvico corroborato permette Spirale/Linee Funzionali solo con incrocio orientato',()=>{
    const observations:ClinicalObservation[]=[
      {...head('s','trasverso',8),phenomenon:'posizione_scapulum',district:'cintura_scapolare',descriptor:'anteposizione',side:'destro'},
      {...head('p','trasverso',8),phenomenon:'posizione_ileo',district:'pelvico',descriptor:'retroposizione',direction:'posteriore',side:'sinistro'},
      {...head('r','trasverso',8),phenomenon:'relazione_scapulum_ileo',district:'cintura_scapolare',descriptor:'compenso_crociato',direction:undefined,side:'destro',transverseRelation:{reference:'scapulum_ileo',referenceSide:'sx',relationType:'compenso_crociato',orientation:'dx_anteposto'}},
    ]
    const patterns=consolidateObservations(observations),r=buildMultiplanarGlobalPatterns(observations,[],patterns)
    const globals=buildFunctionalGlobalPatterns(r),inferences=inferMyersFromFunctionalGlobalPatterns(globals)
    expect(inferences.some(i=>i.lines.some(l=>l.lineId==='spiral_right'))).toBe(true)
    expect(inferences.some(i=>i.lines.some(l=>l.lineId==='functional_back'))).toBe(true)
    expect(r.globalPatterns.find(g=>g.signatureId==='global_torsional')?.supportTypes).toContain('clinicalObservationSupport')
  })
  it('report clinico senza source ids o tessuti indeterminabili; debug e JSON conservano tutto',()=>{
    const measurements=computeAutoMeasurements('frontale_posteriore',points(),{imageAspectRatio:1})
    const p=runClinicalPipeline([{plane:'frontale_posteriore',alterations:[]}],measurements)
    const text=[...functionalModelToLines(p.functionalModel),...recognizedPatternReportLines(p.patternRecognition)].join('\n')
    expect(text).not.toContain('sourceObservationIds');expect(text).not.toContain('sourceMeasurementIds');expect(text).not.toContain('sourcePatternIds')
    expect(text).not.toContain('Non sufficientemente determinabile')
    const html=renderToStaticMarkup(createElement(GlobalPatternPanel,{result:p.patternRecognition}))
    expect(html).toContain('Curva toracica sinistro-convessa');expect(html).not.toContain('sourceMeasurementIds')
    expect(renderToStaticMarkup(createElement(GlobalPatternPanel,{result:p.patternRecognition,debug:true}))).toContain('sourceMeasurementIds')
    expect(JSON.parse(JSON.stringify(p.patternRecognition))).toEqual(p.patternRecognition)
  })
})

it('regressione dei valori reali attraverso landmark → curva regionale → pattern funzionale → Myers',()=>{
  const dy1=.0051/Math.tan(1.23*Math.PI/180),dy2=.0022/Math.tan(.38*Math.PI/180),dy3=.0073/Math.tan(3.6*Math.PI/180)
  const points=[lm('cervicale_c7',.5,.1),lm('toracico_t6',.4949,.1+dy1),lm('toracico_t11',.4927,.1+dy1+dy2),lm('lombare_l2',.5,.1+dy1+dy2+dy3),lm('psis_dx',.6,.85),lm('psis_sx',.4,.851)]
  const measurements=computeAutoMeasurements('frontale_posteriore',points,{imageAspectRatio:1})
  expect(measurements.find(m=>m.id==='post_chord_toracico_t6')?.numericValue).toBe(-.51)
  expect(measurements.find(m=>m.id==='post_chord_toracico_t11')?.numericValue).toBe(-.73)
  expect(measurements.find(m=>m.id==='post_turn_1')?.numericValue).toBe(3.98)
  const pipeline=runClinicalPipeline([{plane:'frontale_posteriore',alterations:[]}],measurements)
  expect(pipeline.patternRecognition.regionalPatterns.find(r=>r.region==='thoracic')?.interpretation).toContain('Curva toracica sinistro-convessa con compenso inferiore destro')
  expect(pipeline.functionalModel.globalPatterns.length).toBeGreaterThan(0)
  expect(pipeline.functionalGlobalInferences.some(i=>i.lines.some(l=>l.lineId==='lateral_left'))).toBe(true)
})

it('integra anteriorizzazione bilaterale e cingolo anteposto, preservando prevalenza e supporti senza una conferma ridondante',()=>{
  const observations=[head('right','sagittale_destro',9.5),head('left','sagittale_sinistro',14.8),{...head('scapula','trasverso',4),district:'cintura_scapolare' as const,phenomenon:'posizione_scapulum',descriptor:'anteposizione' as const}]
  const patterns=consolidateBilateralObservations(consolidateObservations(observations))
  const r=buildMultiplanarGlobalPatterns(observations,[],patterns)
  const g=r.globalPatterns.find(g=>g.signatureId==='cephalo_thoracic_anterior')!
  expect(g).toBeDefined();expect(g.prevalentSide).toBe('sinistro')
  expect(g.supportTypes).toContain('contralateralSupport');expect(g.supportTypes).toContain('multiplanarSupport')
  const inferences=inferMyersFromFunctionalGlobalPatterns(buildFunctionalGlobalPatterns(r))
  expect(inferences.some(i=>['superficial_front','superficial_back','deep_front'].every(id=>i.lines.some(l=>l.lineId===id)))).toBe(true)
  expect(recognizedPatternReportLines(r).join('\n')).toContain('Bilaterale, prevalenza SX')
})

it('una modifica clinica dell’operatore non conserva automaticamente i tag di curva precedenti',()=>{
  const measurements=computeAutoMeasurements('frontale_posteriore',points(),{imageAspectRatio:1})
  const id='automatic_measurement:frontale_posteriore:post_chord_toracico_t6'
  const changed:ClinicalObservation={...head(id,'frontale_posteriore',1),phenomenon:'deviazione_rachidea',district:'toracica',descriptor:'rotation',direction:'rotazione_sx',status:'modified',anatomicalDetails:{region:'toracica',convexity:'sx'},sourceIds:[id]}
  const r=buildMultiplanarGlobalPatterns([changed],measurements)
  const evidence=r.evidence.find(e=>e.sourceObservationIds.includes(id))!
  expect(evidence.tags).toContain('axial_rotation');expect(evidence.tags).not.toContain('spinal_curve')
  expect(r.globalPatterns.some(g=>g.signatureId==='functional_curve_C')).toBe(false)
})

it('il contributo rachideo è relativo alla corda e non scambia una inclinazione globale per maggiore curva',()=>{
  const base=computeSpinalCurveEvidence(realMetrics())
  const tilted=realMetrics().map(m=>m.id.startsWith('post_segment_')?{...m,numericValue:m.numericValue!+8}:m)
  const result=computeSpinalCurveEvidence([...tilted,measured('post_chord_tilt',8,'gradi')])
  expect(result.score).toBe(base.score)
  expect(result).toMatchObject({present:true,convexityDirection:'sx',lowerCompensationDirection:'dx'})
})
