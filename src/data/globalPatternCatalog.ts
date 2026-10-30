import type { MyofascialLineId } from '@/types'
import type { PatternFamily, PatternRegion } from '@/types/patternRecognition'

export interface EvidenceSelector { tags?: string[]; regions?: PatternRegion[]; family?: 'frontal'|'sagittal'|'transverse' }
export interface PatternSignature {
  id: string
  name: string
  family: PatternFamily
  requiredEvidence: EvidenceSelector[]
  supportingEvidence: EvidenceSelector[]
  contradictingEvidence: EvidenceSelector[]
  incompatibleEvidence: EvidenceSelector[]
  regions: PatternRegion[]
  planes: Array<'frontal'|'sagittal'|'transverse'>
  minimumCoverage: number
  minimumIndependentEvidence: number
  directionResolver: 'coherent'|'curve'|'shape'|'crossed'|'opposite'|'configuration'
  severityResolver: 'weighted_evidence'
  myersCompatibility: MyofascialLineId[]
  reportEligibility: 'resolved_geometry_or_confirmed'
  allowMultisegment?: boolean
}
const frontalRegions: PatternRegion[]=['head','cervical','thoracic','lumbar','scapular','pelvic','lower_limb','distal']
const select=(tags:string[],regions?:PatternRegion[],family?:EvidenceSelector['family']):EvidenceSelector=>({tags,regions,family})
const signature=(id:string,name:string,family:PatternFamily,requiredEvidence:EvidenceSelector[],overrides:Partial<PatternSignature>={}):PatternSignature=>({
  id,name,family,requiredEvidence,supportingEvidence:[],contradictingEvidence:[],incompatibleEvidence:[],regions:frontalRegions,
  planes:family==='mixed'||family==='lower_limb'||family==='cranio_cervical'?['frontal','sagittal','transverse']:[family],minimumCoverage:2,minimumIndependentEvidence:2,
  directionResolver:'configuration',severityResolver:'weighted_evidence',myersCompatibility:[],reportEligibility:'resolved_geometry_or_confirmed',...overrides,
})
const frontalSupport=[select(['shift','tilt','spinal_curve'],undefined,'frontal')]
/** Declarative signatures, not patient-specific rules. Selectors are OR within tags/regions and AND between clauses. */
export const GLOBAL_PATTERN_CATALOG: PatternSignature[]=[
  signature('cephalo_thoracic_anterior','Pattern cefalo-toracico anteriore','sagittal',[select(['head_anterior'],['head','cervical']),select(['shift','sagittal_curve'],['thoracic','scapular','lumbar'],'sagittal')],{myersCompatibility:['superficial_front','superficial_back','deep_front'],directionResolver:'coherent'}),
  signature('cephalo_thoracic_lateral','Pattern cefalo-toracico laterale','frontal',[select(['head_shift','head_tilt'],['head','cervical']),select(['spinal_curve','shift'],['thoracic'],'frontal')],{directionResolver:'configuration',myersCompatibility:['lateral_right','lateral_left']}),
  signature('cervico_thoracic_torsional','Pattern cervico-toracico torsionale','transverse',[select(['axial_rotation'],['head','cervical']),select(['axial_rotation'],['thoracic','scapular'])],{planes:['frontal','transverse'],directionResolver:'configuration',myersCompatibility:['spiral_right','spiral_left']}),
  ...(['C','S'] as const).map(shape=>signature(`functional_curve_${shape}`,`Pattern scoliotico funzionale/fotografico a ${shape}`,'frontal',[select([`shape_${shape}`]),select(['spinal_curve'])],{minimumIndependentEvidence:1,allowMultisegment:true,directionResolver:'shape',incompatibleEvidence:[select([`shape_${shape==='C'?'S':'C'}`])],supportingEvidence:frontalSupport,contradictingEvidence:[select(['spine_neutral'])],myersCompatibility:['lateral_right','lateral_left','superficial_back']})),
  signature('thoracic_dominant','Pattern toracico dominante','frontal',[select(['thoracic_curve'],['thoracic'])],{minimumIndependentEvidence:1,allowMultisegment:true,directionResolver:'curve',supportingEvidence:frontalSupport,contradictingEvidence:[select(['spine_neutral'])],myersCompatibility:['lateral_right','lateral_left','superficial_back']}),
  signature('lumbar_dominant','Pattern lombare / toraco-lombare dominante','frontal',[select(['lumbar_curve','thoracolumbar_curve'],['lumbar'])],{minimumIndependentEvidence:1,allowMultisegment:true,directionResolver:'curve',supportingEvidence:frontalSupport,contradictingEvidence:[select(['spine_neutral'])],myersCompatibility:['lateral_right','lateral_left','deep_front']}),
  signature('scapulo_pelvic','Pattern scapolo-pelvico','mixed',[select(['girdle_relation']),select(['tilt','anteposizione','retroposizione','axial_rotation'],['scapular']),select(['tilt','anteposizione','retroposizione','axial_rotation'],['pelvic'])],{directionResolver:'configuration',myersCompatibility:['functional_back']}),
  signature('global_torsional','Pattern torsionale globale','transverse',[select(['crossed_relation','girdle_relation']),select(['anteposizione','retroposizione','axial_rotation'],['scapular']),select(['anteposizione','retroposizione','axial_rotation'],['pelvic'])],{directionResolver:'crossed',myersCompatibility:['spiral_right','spiral_left','functional_back']}),
  signature('crossed','Pattern crociato','mixed',[select(['crossed_relation']),select(['anteposizione','retroposizione','axial_rotation','lower_opposition'])],{directionResolver:'crossed',myersCompatibility:['functional_back','functional_front','spiral_right','spiral_left']}),
  signature('spiraliform','Pattern spiraliforme','mixed',[select(['crossed_relation']),select(['lower_opposition','distal_relation']),select(['anteposizione','retroposizione','axial_rotation'],['scapular','pelvic'])],{directionResolver:'crossed',myersCompatibility:['spiral_right','spiral_left','functional_back']}),
  signature('global_sagittal','Pattern sagittale globale','sagittal',[select(['shift','sagittal_curve'],undefined,'sagittal')],{minimumCoverage:3,directionResolver:'coherent',myersCompatibility:['superficial_front','superficial_back','deep_front']}),
  signature('global_lateral','Pattern laterale globale','frontal',[select(['shift','tilt','spinal_curve'],undefined,'frontal')],{minimumCoverage:3,directionResolver:'configuration',myersCompatibility:['lateral_right','lateral_left']}),
  signature('lower_interlateral','Pattern interlaterale degli arti inferiori','lower_limb',[select(['lower_opposition','lower_asymmetry'],['lower_limb'])],{minimumCoverage:1,minimumIndependentEvidence:2,directionResolver:'opposite',myersCompatibility:[]}),
  signature('distal_proximal','Pattern distale-prossimale coerente','mixed',[select(['distal_relation']),select(['tilt','shift','anteposizione','retroposizione','axial_rotation'],['pelvic','scapular']),select(['distal_alignment'],['distal'])],{directionResolver:'coherent',myersCompatibility:['superficial_back','deep_front']}),
  signature('multiplanar_mixed','Pattern misto multiplanare','mixed',[select(['spinal_curve','shift','tilt','anteposizione','retroposizione','axial_rotation'])],{minimumCoverage:2,directionResolver:'configuration',myersCompatibility:[]}),
]
