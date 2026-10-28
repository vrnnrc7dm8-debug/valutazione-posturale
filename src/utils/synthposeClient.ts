import type { AnatomicalPlane } from '@/types'
import { parseSynthposeResult, type SynthposeBoundingBox } from './synthposeAdapter'

async function responseJson(response: Response): Promise<unknown> {
  const data = await response.json() as { error?: string }
  if (!response.ok) throw new Error(data?.error ?? 'Servizio SynthPose locale non disponibile.')
  return data
}

export async function detectSynthpose(image: string, plane: AnatomicalPlane, signal: AbortSignal, boundingBox?: SynthposeBoundingBox) {
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(image)) throw new Error('SynthPose richiede una fotografia locale PNG, JPEG o WebP incorporata.')
  const response = await fetch('/api/ai/synthpose', {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json', 'X-Clinical-App': '1' },
    body: JSON.stringify({ image, plane, mode: 'single_person_posture_photo', boundingBox }),
  })
  return parseSynthposeResult(await responseJson(response), plane)
}

export async function synthposeStatus(signal: AbortSignal) {
  const response = await fetch('/api/ai/synthpose/status', { signal, credentials: 'same-origin', headers: { 'X-Clinical-App': '1' } })
  return await responseJson(response) as { available: boolean; message?: string; device?: string; offline: boolean }
}
