import { expect, it } from 'vitest'
import { imageAspectRatio } from '../imageAspectRatio'
import { analyzePosterior } from '../posteriorAnalysis'
import type { PlacedLandmark } from '@/types'
const data=(bytes:number[])=>'data:image/jpeg;base64,'+btoa(String.fromCharCode(...bytes))
it('legge dimensioni PNG e JPEG, rispetta EXIF ruotato e rifiuta header malformati',()=>{
  const png=[137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,1,144,0,0,3,32]
  expect(imageAspectRatio(data(png))).toBe(.5)
  const frame=[255,192,0,11,8,3,32,1,144,1,1,17,0]
  expect(imageAspectRatio(data([255,216,...frame,255,217]))).toBe(.5)
  const exif=[69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]
  expect(imageAspectRatio(data([255,216,255,225,0,exif.length+2,...exif,...frame,255,217]))).toBe(2)
  expect(imageAspectRatio('data:image/png;base64,invalid%')).toBeUndefined()
  expect(imageAspectRatio('https://example.test/image.png')).toBeUndefined()
})
it('usa gli assi della fotografia per i gradi; se la scala manca mantiene gli angoli fuori dal referto',()=>{
  const lm=(id:string,x:number,y:number)=>({id,landmarkId:id,position:{x,y},confidence:1} as PlacedLandmark)
  const points=[lm('mastoide_dx',.6,.2),lm('mastoide_sx',.4,.18)]
  const normalized=analyzePosterior(points),photo=analyzePosterior(points,{imageAspectRatio:.5})
  expect(normalized.measurements[0].reportEligible).toBe(false)
  expect(photo.measurements[0].reportEligible).toBe(true)
  expect(photo.measurements[0].numericValue).toBeCloseTo(Math.atan2(.02,.1)*180/Math.PI,1)
})
