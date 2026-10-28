import { useState } from 'react'
import type { PhotoSlot } from '@/types'
import { PLANE_LABELS } from '@/types'
import { FrameOverlaySvg } from '@/components/FrameOverlaySvg'
import { ImageAnnotationsSvg } from '@/components/ImageAnnotationsSvg'
import { getAllLandmarks, getClinicalLandmarks } from '@/utils/landmarkCollection'
import { LANDMARK_CATEGORY_COLORS } from '@/data/anatomicalLandmarks'

export interface ReportImageSize { width: number; height: number }

/** Full photograph in image coordinates; editor pan/zoom never crops the clinical record. */
export function ReportPhotograph({ photo, size }: { photo: PhotoSlot; size?: ReportImageSize }) {
  const [decoded, setDecoded] = useState<ReportImageSize | null>(null)
  const [failed, setFailed] = useState(false)
  if (!photo.dataUrl) return null
  const dimensions = size ?? decoded ?? { width: 1000, height: 1400 }
  const width = 1000
  const height = width * dimensions.height / dimensions.width
  const all = getAllLandmarks(photo.annotations.landmarks)
  const landmarks = getClinicalLandmarks(photo.annotations.landmarks)
  return <figure className="report-photograph my-4 rounded-lg border bg-slate-50 p-3">
    {!size && <img src={photo.dataUrl} alt="" hidden onLoad={e => setDecoded({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} onError={() => setFailed(true)} />}
    {failed ? <p role="alert">Fotografia non leggibile: verificare il file originale prima di esportare.</p> : <svg role="img" aria-label={`Fotografia annotata: ${PLANE_LABELS[photo.plane]}`} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%', maxHeight: '720px' }}>
      <title>{`${PLANE_LABELS[photo.plane]} — fotografia con landmark e riferimenti grafici`}</title>
      <image href={photo.dataUrl} width={width} height={height} />
      <FrameOverlaySvg containerWidth={width} containerHeight={height} overlay={photo.annotations.overlay} />
      <ImageAnnotationsSvg annotations={photo.annotations} getLandmark={id => all.find(l => l.id === id)} />
      {landmarks.map((landmark, index) => <g key={landmark.id}>
        <circle data-report-landmark={landmark.id} cx={landmark.position.x * width} cy={landmark.position.y * height} r={10} fill={LANDMARK_CATEGORY_COLORS[landmark.category] ?? '#e11d48'} stroke="white" strokeWidth={2} />
        <text x={landmark.position.x * width + 14} y={landmark.position.y * height - 14} fontSize={28} fontWeight={700} fill="white" stroke="#0f172a" strokeWidth={4} paintOrder="stroke">{index + 1}</text>
      </g>)}
    </svg>}
    <figcaption className="mt-2 text-xs text-slate-600">{PLANE_LABELS[photo.plane]} · {landmarks.length} landmark validati. Fotografia intera; riferimenti grafici in coordinate immagine.</figcaption>
    {landmarks.length > 0 && <ol className="report-landmark-legend mt-2 grid gap-x-4 text-xs sm:grid-cols-2" aria-label={`Legenda landmark ${PLANE_LABELS[photo.plane]}`}>
      {landmarks.map((landmark, index) => <li key={landmark.id}>{index + 1}. {landmark.label} {landmark.side ? `(${landmark.side})` : ''}</li>)}
    </ol>}
  </figure>
}
