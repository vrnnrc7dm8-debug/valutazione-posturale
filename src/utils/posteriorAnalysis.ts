import { computeSpinalCurveEvidence } from './spinalCurveEvidence'
import type { PlacedLandmark, Point2D, ClinicalDirection } from '@/types'
import type { AutoMeasurement } from './biomechanicsEngine'
import type { GeometricPatternEvidence, ElementarySuggestion } from '@/types/patternRecognition'
import { severityFromNormalizedMagnitude, autoSeverityFromDegrees } from './severityFromMeasurement'
import { CLINICAL_THRESHOLDS } from '@/data/clinicalThresholds'
import { isReportEligibleLandmark } from './landmarkValidation'
import { normalizeLineTiltDegrees } from './angleCalculations'

export interface PosteriorAnalysisOptions { mirrored?: boolean; imageAspectRatio?: number }
/** All signs refer to the patient. Named bilateral references take precedence over screen convention. */
export function analyzePosterior(landmarks: PlacedLandmark[], options: PosteriorAnalysisOptions = {}) {
  const points = new Map(landmarks.filter(l => isReportEligibleLandmark(l) && Number.isFinite(l.position.x) && Number.isFinite(l.position.y) && l.position.x >= 0 && l.position.x <= 1 && l.position.y >= 0 && l.position.y <= 1).map(l => [l.landmarkId || l.type!, l.position]))
  const get = (id: string) => points.get(id)
  const measurements: AutoMeasurement[] = []
  const unresolved: string[] = []
  const signs = [['acromion_post_dx','acromion_post_sx'],['psis_dx','psis_sx'],['calcagno_dx','calcagno_sx'],['mastoide_dx','mastoide_sx']].flatMap(([r,l]) => {
    const a = get(r), b = get(l); return a && b && Math.abs(a.x-b.x) > .005 ? [Math.sign(a.x-b.x)] : []
  })
  const sign = new Set(signs).size > 1 ? undefined : signs[0] ?? (options.mirrored ? -1 : 1)
  if (!sign) unresolved.push('Riferimenti DX/SX incompatibili: verificare lateralità e mirroring.')
  const ratio = options.imageAspectRatio && options.imageAspectRatio > 0 ? options.imageAspectRatio : 1
  const dx = (n: number) => sign ? n * sign : undefined
  const direction = (n: number | undefined): ClinicalDirection | undefined => n === undefined || Math.abs(n) < 1e-9 ? undefined : n > 0 ? 'dx' : 'sx'
  const mid = (a?: Point2D,b?: Point2D) => a && b ? {x:(a.x+b.x)/2,y:(a.y+b.y)/2} : undefined
  const round = (n: number) => Math.round(n*100)/100 || 0
  const add = (id: string, label: string, value: number, unit: 'gradi'|'percentuale', meta: GeometricPatternEvidence, suggestion?: ElementarySuggestion, dir = direction(value)) => {
    const severity = unit === 'gradi' ? autoSeverityFromDegrees(value, CLINICAL_THRESHOLDS.plumb_line_gradi) : severityFromNormalizedMagnitude(value / 100, CLINICAL_THRESHOLDS.deviazione_spinous_posterior)
    measurements.push({ id, label, value: `${round(value)}${unit === 'gradi' ? '°' : '% larghezza immagine'}${dir ? ` · ${dir.toUpperCase()}` : ''}`, numericValue: round(value), unit, severity, plane:'frontale_posteriore', direction: dir,
      landmarkValidated: true, reportEligible: !!sign && (unit !== 'gradi' || !!options.imageAspectRatio), patternEvidence: meta, clinicalSuggestion: suggestion && dir ? { ...suggestion, direction: suggestion.direction ?? dir } : undefined,
      observationNote: `Riferimenti: ${meta.landmarkIds.join(' → ')}.${unit === 'gradi' && !options.imageAspectRatio ? ' Angolo nel sistema normalizzato; rapporto immagine non disponibile.' : ''}` })
  }
  const c7=get('cervicale_c7'),t6=get('toracico_t6'),l2=get('lombare_l2'),occ=get('occipite')
  const shoulders=mid(get('acromion_post_dx'),get('acromion_post_sx')),pelvis=mid(get('psis_dx'),get('psis_sx')),heels=mid(get('calcagno_dx'),get('calcagno_sx'))
  const spine = ['cervicale_c7','toracico_t6','toracico_t11','lombare_l2']
  const offsets: number[]=[]
  if (c7 && l2 && l2.y-c7.y > .02 && (!t6 || !get('toracico_t11') || t6.y < get('toracico_t11')!.y)) {
    for (const [id,region] of [['toracico_t6','thoracic'],['toracico_t11','lumbar']] as const) {
      const p=get(id); if (!p || p.y <= c7.y || p.y >= l2.y) continue
      // Horizontal signed distance to C7–L2 at the same height, not distance to a plumb line.
      const offset=dx(p.x-(c7.x+(l2.x-c7.x)*(p.y-c7.y)/(l2.y-c7.y)))
      if (offset === undefined) continue
      offsets.push(offset)
      const convex=direction(offset) as 'dx'|'sx'|undefined,bend=convex === 'dx' ? 'sx' : convex === 'sx' ? 'dx' : undefined
      add(`post_chord_${id}`,`${id === 'toracico_t6' ? 'T6' : 'T11'} — offset signed dalla corda C7–L2`,offset*100,'percentuale', { region,tags:['spinal_curve','frontal',region === 'thoracic' ? 'thoracic_curve' : 'thoracolumbar_curve'], independenceKey:`posterior:curve:${id}`,landmarkIds:['cervicale_c7',id,'lombare_l2'],multiSegment:true,bendDirection:bend,convexityDirection:convex }, {phenomenon:'deviazione_rachidea',district:region === 'thoracic' ? 'toracica' : 'toraco_lombare',descriptor:'bend',direction:bend,anatomicalDetails:{region:region === 'thoracic' ? 'toracica' : 'toraco_lombare',convexity:convex,apex:id === 'toracico_t6' ? 'T6' : 'T11'}})
    }
  } else unresolved.push('Polilinea C7–T6–T11–L2 incompleta o corda non valida.')
  const angle=(a:Point2D,b:Point2D)=>Math.atan2((b.x-a.x)*ratio,b.y-a.y)*180/Math.PI
  if(c7&&l2&&l2.y-c7.y>.02)add('post_chord_tilt','Inclinazione corda C7–L2',angle(c7,l2)*(sign??1),'gradi',{region:'thoracic',tags:['spinal_reference','frontal'],landmarkIds:['cervicale_c7','lombare_l2'],independenceKey:'posterior:chord'})
  for(let i=0;i<spine.length-1;i++) {
    const a=get(spine[i]),b=get(spine[i+1]);if(!a||!b||b.y-a.y<=.005)continue
    add(`post_segment_${i}`,`Inclinazione ${['C7–T6','T6–T11','T11–L2'][i]}`,angle(a,b)*(sign??1),'gradi',{region:i<2?'thoracic':'lumbar',tags:['spinal_segment','frontal'],landmarkIds:[spine[i],spine[i+1]],independenceKey:`posterior:segment:${i}`})
    if(i<2) {const c=get(spine[i+2]);if(c&&c.y-b.y>.005)add(`post_turn_${i}`,`Cambio angolare ${i===0?'C7–T6–T11':'T6–T11–L2'}`,normalizeLineTiltDegrees(angle(b,c)-angle(a,b))*(sign??1),'gradi',{region:i===0?'thoracic':'lumbar',tags:['spinal_turn','frontal'],landmarkIds:spine.slice(i,i+3),independenceKey:`posterior:curve:${spine[i+1]}`,multiSegment:true})}
  }
  const shift=(id:string,label:string,a:Point2D|undefined,b:Point2D|undefined,region:GeometricPatternEvidence['region'],ids:string[],phenomenon:string)=>{
    if(a&&b&&sign)add(id,label,dx(a.x-b.x)!*100,'percentuale',{region,tags:['shift','frontal', ...(region==='cervical'?['head_shift']:[])],landmarkIds:ids,independenceKey:`posterior:shift:${id}`},{phenomenon,district:region==='cervical'?'cervicale':region==='thoracic'?'toracica':region==='lumbar'?'lombare':'globale',descriptor:'shift',anatomicalDetails:phenomenon==='deviazione_rachidea'?{region:region==='thoracic'?'toracica':'lombare'}:undefined})
  }
  shift('post_trunk_shift','Shift tronco rispetto al bacino',shoulders,pelvis,'thoracic',['acromion_post_dx','acromion_post_sx','psis_dx','psis_sx'],'shift_laterale_post')
  shift('post_thoracic_shift','Shift C7 rispetto al bacino',c7,pelvis,'thoracic',['cervicale_c7','psis_dx','psis_sx'],'deviazione_rachidea')
  shift('post_lumbar_shift','Shift L2 rispetto al bacino',l2,pelvis,'lumbar',['lombare_l2','psis_dx','psis_sx'],'deviazione_rachidea')
  shift('post_spine_shift','Shift globale C7 rispetto a L2',c7,l2,'thoracic',['cervicale_c7','lombare_l2'],'shift_laterale_post')
  shift('post_occipital_shift','Shift occipite rispetto a C7',occ,c7,'cervical',['occipite','cervicale_c7'],'shift_capo')
  shift('post_c7_scapular_shift','Rapporto C7–centro scapolare',c7,shoulders,'scapular',['cervicale_c7','acromion_post_dx','acromion_post_sx'],'shift_cingolo_scapolare')
  shift('post_pelvis_heels_shift','Rapporto bacino–centro bicalcaneare',pelvis,heels,'pelvic',['psis_dx','psis_sx','calcagno_dx','calcagno_sx'],'shift_bacino')
  if(occ&&c7&&c7.y-occ.y>.005) {
    add('post_occipital_axis','Inclinazione asse occipite–C7 (non tilt cefalico)',angle(occ,c7)*(sign??1),'gradi',{region:'cervical',tags:['cervical_axis','frontal'],landmarkIds:['occipite','cervicale_c7'],independenceKey:'posterior:shift:post_occipital_shift'})
    if(t6&&t6.y-c7.y>.005)add('post_cervical_thoracic_angle','Rapporto angolare occipite–C7–T6',normalizeLineTiltDegrees(angle(c7,t6)-angle(occ,c7))*(sign??1),'gradi',{region:'cervical',tags:['cervicothoracic_relation','frontal'],landmarkIds:['occipite','cervicale_c7','toracico_t6'],independenceKey:'posterior:cervicothoracic'})
  }
  const axes: Record<string,number>={}
  for(const [id,r,l,region,phenomenon] of [
    ['scapular','acromion_post_dx','acromion_post_sx','scapular','dislivello_acromiale'],
    ['pelvic','psis_dx','psis_sx','pelvic','dislivello_psis'],
    ['cranial','mastoide_dx','mastoide_sx','head','tilt_capo'],
    ['heels','calcagno_dx','calcagno_sx','distal','linea_bicalcaneare'],
  ] as const) {
    const a=get(r),b=get(l);if(!a||!b||Math.abs(a.x-b.x)<.005)continue
    // Positive means right end is lower, independent of image reflection.
    const tilt=Math.atan2(a.y-b.y,Math.abs(a.x-b.x)*ratio)*180/Math.PI
    axes[id]=tilt
    add(`post_${id}_tilt`,`${id==='scapular'?'Linea bisacromiale':id==='pelvic'?'Asse pelvico':id==='cranial'?'Linea bimastoidea':'Linea bicalcaneare'} — inclinazione`,tilt,'gradi',{region,tags:['tilt','frontal',...(id==='cranial'?['head_tilt']:[])],landmarkIds:[r,l],independenceKey:`posterior:axis:${id}`},{phenomenon,district:region==='head'?'cranio_cervicale':region==='scapular'?'cintura_scapolare':region==='pelvic'?'pelvico':'arto_inferiore',descriptor:'tilt'})
    if(id==='scapular')add('post_scapular_height','Dislivello acromiale posteriore',(a.y-b.y)*100,'percentuale',{region,tags:['scapular_height','frontal'],landmarkIds:[r,l],independenceKey:`posterior:axis:${id}`})
  }
  if(axes.scapular!==undefined&&axes.pelvic!==undefined)add('post_girdle_relation','Rapporto asse scapolare–pelvico',normalizeLineTiltDegrees(axes.scapular-axes.pelvic),'gradi',{region:'scapular',tags:['girdle_relation','frontal',...(axes.scapular*axes.pelvic<0?['girdle_opposition']:[])],landmarkIds:['acromion_post_dx','acromion_post_sx','psis_dx','psis_sx'],independenceKey:'posterior:girdle_relation'})
  if(axes.pelvic!==undefined&&axes.heels!==undefined)add('post_pelvis_heels_angle','Rapporto asse pelvico–bicalcaneare',normalizeLineTiltDegrees(axes.pelvic-axes.heels),'gradi',{region:'pelvic',tags:['distal_relation','frontal'],landmarkIds:['psis_dx','psis_sx','calcagno_dx','calcagno_sx'],independenceKey:'posterior:pelvis_heel_relation'})
  const curve = computeSpinalCurveEvidence(measurements)
  if (curve.present) {
    const rank = { normale:0, lieve:1, moderato:2, severo:3 }
    for (const m of measurements.filter(m => m.id.startsWith('post_chord_toracico_'))) {
      m.spinalCurve = curve
      if (rank[curve.severity] > rank[m.severity]) m.severity = curve.severity
    }
    const dominant = offsets.reduce((a,b) => Math.abs(a)>Math.abs(b)?a:b,0)
    add('post_curve_shape',`Configurazione rachidea fotografica a ${curve.shape}`,dominant*100,'percentuale',{region:'thoracic',tags:['spinal_shape',`shape_${curve.shape}`,'frontal'],shape:curve.shape,independenceKey:'posterior:curve:shape',landmarkIds:spine,multiSegment:true})
    const summary = measurements[measurements.length-1]
    summary.severity=curve.severity; summary.spinalCurve=curve
  } else {
    if(curve.segmentCount===3) for(const m of measurements.filter(m=>m.id.startsWith('post_chord_')&&m.patternEvidence?.tags.includes('spinal_curve'))) {
      m.patternEvidence!.tags=m.patternEvidence!.tags.filter(t=>!['spinal_curve','thoracic_curve','thoracolumbar_curve'].includes(t)).concat('spinal_offset')
      m.clinicalSuggestion=undefined
    }
  }
  if (!curve.present && curve.segmentCount===3 && offsets.length===2 && offsets.every(v=>Math.abs(v)<CLINICAL_THRESHOLDS.deviazione_spinous_posterior.detection) && curve.components.segmentAngle<.75 && curve.components.angularChange<.5) {
    add('post_spine_neutral','Polilinea entro le soglie fotografiche configurate',0,'percentuale',{region:'thoracic',tags:['spine_neutral','frontal'],independenceKey:'posterior:curve:neutral',landmarkIds:spine,multiSegment:true})
  } else if(!curve.present) unresolved.push('Curva rachidea: evidenze composite non sufficienti o orientamenti non coerenti.')
  if(axes.cranial===undefined)unresolved.push('Tilt capo non valutabile: mancano landmark cranici bilaterali visibili e confermati.')
  unresolved.push('Rotazione assiale capo non determinabile dalla sola proiezione posteriore: serve un riferimento orientativo clinico indipendente, oltre ai punti cranici bilaterali.')
  return {measurements,unresolvedPotentialPatterns:unresolved}
}
