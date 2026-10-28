import type { Assessment, AnatomicalPlane } from '@/types'
import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import { getPlaneConfig } from '@/data/planes'
import { createEmptyAssessment } from '@/utils/storage'
import { normalizePlacedLandmark } from '@/utils/landmarkMigration'

/** Synthetic only: matches the reported counts, never a patient's actual geometry. */
export function reportAssessment(): Assessment {
  const a = createEmptyAssessment()
  a.patient = { ...a.patient, nome: 'Sintetico', cognome: 'Test', eta: 40, antropometria: { pesoKg: 70, altezzaCm: 175 } }
  const catalogs = new Map(a.photos.map(p => [p.plane, [...getLandmarksForPlane(p.plane)]]))
  let total = 0
  while (total < 67) {
    let added = false
    for (const photo of a.photos) {
      const entry = catalogs.get(photo.plane)?.shift()
      if (!entry || total >= 67) continue
      const i = photo.annotations.landmarks.manual.length
      photo.annotations.landmarks.manual.push(normalizePlacedLandmark({
        ...entry, id: `synthetic-${total}`, landmarkId: entry.id,
        position: { x: entry.side === 'destro' ? 0.35 : entry.side === 'sinistro' ? 0.65 : 0.5, y: 0.05 + i * 0.04 },
        confidence: 1, validationState: 'manuale_confermato', detectionSource: 'manual',
      }, photo.plane))
      total++; added = true
    }
    if (!added) throw new Error('Insufficient synthetic catalog entries')
  }
  a.photos.forEach(photo => { photo.dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/wAAAABJRU5ErkJggg=='; photo.fileName = `${photo.plane}.png` })
  a.planeAssessments.forEach((pa, i) => {
    const definitions = getPlaneConfig(pa.plane as AnatomicalPlane).alterations
    pa.alterations = Array.from({ length: i < 4 ? 6 : 5 }, (_, index) => ({
      instanceId: `test-${pa.plane}-${index}`, alterationId: definitions[index % definitions.length].id,
      descriptor: 'tilt', severity: 'lieve', side: 'destro', source: 'manual',
    }))
  })
  return a
}
