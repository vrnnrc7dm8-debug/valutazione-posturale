import type { PhotoSlot, PhotoSnapshot } from '@/types'

const IMAGE_EXT_FROM_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function extensionFromFileName(fileName?: string): string | undefined {
  if (!fileName) return undefined
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) return undefined
  if (ext === 'jpeg') return 'jpg'
  if (['jpg', 'png', 'webp', 'gif'].includes(ext)) return ext
  return undefined
}

export function detectImageExtension(
  bytes: Uint8Array,
  mime?: string,
  fileName?: string,
): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp'
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return 'gif'
  }

  const normalizedMime = mime?.split(';')[0]?.trim().toLowerCase()
  if (normalizedMime && IMAGE_EXT_FROM_MIME[normalizedMime]) {
    return IMAGE_EXT_FROM_MIME[normalizedMime]
  }

  const fromName = extensionFromFileName(fileName)
  if (fromName) return fromName

  return 'jpg'
}

export function mimeFromExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

export function parseDataUrl(dataUrl: string): {
  bytes: Uint8Array
  mime: string
  ext: string
} {
  const match = /^data:([^;,]*)(?:;[^,]*)?;base64,(.+)$/.exec(dataUrl)
  if (!match) {
    throw new Error('Data URL foto non valido')
  }
  const mime = match[1] || 'application/octet-stream'
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return {
    bytes,
    mime: mime || mimeFromExtension('jpg'),
    ext: detectImageExtension(bytes, mime),
  }
}

export function bytesToDataUrl(
  bytes: Uint8Array,
  extOrMime: string,
  fileName?: string,
): string {
  let ext = extOrMime
  if (!extOrMime.includes('/')) {
    const normalized = extOrMime.toLowerCase()
    if (normalized === 'bin' || normalized === 'octet-stream') {
      ext = detectImageExtension(bytes, undefined, fileName)
    }
  }
  const mime = ext.includes('/') ? extOrMime : mimeFromExtension(ext)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:${mime};base64,${btoa(binary)}`
}

export function isPersistablePhotoDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:')
}

/** Ignora path ZIP (es. photos/front.jpg) e blob: URL non persistenti. */
export function sanitizePhotoDataUrl(value: unknown): string | undefined {
  return isPersistablePhotoDataUrl(value) ? value : undefined
}

export type PhotoUrlFields = {
  dataUrl?: string
  imageUrl?: string
  photoUrl?: string
  src?: string
  originalPath?: string
}

export function resolvePersistablePhotoDataUrl(
  photo: PhotoUrlFields,
): string | undefined {
  for (const value of [
    photo.dataUrl,
    photo.imageUrl,
    photo.photoUrl,
    photo.src,
  ]) {
    const sanitized = sanitizePhotoDataUrl(value)
    if (sanitized) return sanitized
  }
  return undefined
}

/** Allinea tutti i campi URL foto al dataURL base64 persistente. */
export function normalizePhotoUrlFields<T extends PhotoUrlFields>(photo: T): T {
  const persistentUrl =
    photo.dataUrl ||
    photo.imageUrl ||
    photo.photoUrl ||
    photo.src ||
    ''
  const dataUrl = persistentUrl.startsWith('data:')
    ? persistentUrl
    : sanitizePhotoDataUrl(photo.dataUrl)
  const resolved = dataUrl ?? ''

  return {
    ...photo,
    imageUrl: resolved,
    photoUrl: resolved,
    src: resolved,
    dataUrl: resolved || undefined,
  }
}

export function normalizePhotoSnapshot(
  snapshot: PhotoSnapshot,
): PhotoSnapshot | undefined {
  const dataUrl = resolvePersistablePhotoDataUrl(snapshot)
  if (!dataUrl) return undefined
  return {
    ...normalizePhotoUrlFields({ ...snapshot, dataUrl }),
    dataUrl,
    annotations: snapshot.annotations,
  }
}

export function normalizePhotoSlot(photo: PhotoSlot): PhotoSlot {
  const normalized = normalizePhotoUrlFields(photo)
  const baseline = photo.baseline
    ? normalizePhotoSnapshot(photo.baseline)
    : undefined
  return {
    ...normalized,
    baseline,
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}
