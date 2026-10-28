import type { PhotoSlot } from '@/types'
import { createEmptyAnnotations } from '@/types'
import { blobToDataUrl, normalizePhotoSlot, parseDataUrl } from '@/utils/imageDataUrl'

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
export const MAX_PHOTO_PIXELS = 40_000_000
export const MAX_PHOTO_SIDE = 16_384
export const PHOTO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff'
function clipboardAccessDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && ['NotAllowedError', 'SecurityError'].includes(String(error.name))
}

export const NO_CLIPBOARD_IMAGE = 'Nessuna immagine rilevata negli Appunti. Copia una foto e riprova.'
export const SELECT_PHOTO_PLANE = 'Seleziona prima un piano fotografico, poi incolla l’immagine.'


export function imageMime(bytes: Uint8Array): string {
  const starts = (...values: number[]) => values.every((v, i) => bytes[i] === v)
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'image/png'
  if (starts(255, 216, 255)) return 'image/jpeg'
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (starts(66, 77)) return 'image/bmp'
  if (starts(73, 73, 42, 0) || starts(77, 77, 0, 42)) return 'image/tiff'
  throw new Error('Formato immagine non supportato o contenuto non valido. Usa PNG, JPEG, WebP, GIF, oppure BMP/TIFF se decodificabili dal browser. Converti HEIC/HEIF in PNG o JPEG con Anteprima.')
}

export function checkPhotoDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_PHOTO_SIDE || height > MAX_PHOTO_SIDE || width * height > MAX_PHOTO_PIXELS) {
    throw new Error('Dimensioni immagine non valide: massimo 40 megapixel e 16384 pixel per lato.')
  }
}

async function decodePhoto(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Immagine danneggiata o non decodificabile dal browser. Converti il file in PNG o JPEG.'))
      image.src = url
    })
    checkPhotoDimensions(image.naturalWidth, image.naturalHeight)
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function encodePng(image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Conversione immagine non disponibile in questo browser.')
  context.drawImage(image, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    canvas.width = canvas.height = 0
    if (blob) resolve(blob)
    else reject(new Error('Conversione PNG non riuscita.'))
  }, 'image/png'))
}

export async function preparePhoto(blob: Blob, name?: string): Promise<{ dataUrl: string; fileName: string }> {
  if (!blob.size || blob.size > MAX_PHOTO_BYTES) throw new Error('Immagine vuota o troppo grande: massimo 20 MB per foto.')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mime = imageMime(bytes)
  // Inspect PNG dimensions before allocating the decoded bitmap.
  if (mime === 'image/png' && bytes.length >= 24) {
    const view = new DataView(bytes.buffer)
    checkPhotoDimensions(view.getUint32(16), view.getUint32(20))
  }
  const typed = new Blob([bytes], { type: mime })
  const image = await decodePhoto(typed)
  const output = ['image/bmp', 'image/tiff'].includes(mime) ? await encodePng(image) : typed
  if (output.size > MAX_PHOTO_BYTES) throw new Error('Immagine convertita troppo grande: massimo 20 MB.')
  const ext = output.type.split('/')[1].replace('jpeg', 'jpg')
  return { dataUrl: await blobToDataUrl(output), fileName: name && output === typed ? name : `foto-appunti-${crypto.randomUUID()}.${ext}` }
}

/** Both upload and paste replace only this plane; stale calibration cannot follow a new image. */
export function replacePlanePhoto(photos: PhotoSlot[], plane: PhotoSlot['plane'], image: { dataUrl: string; fileName: string }): PhotoSlot[] {
  if (!photos.some(p => p.plane === plane)) throw new Error(SELECT_PHOTO_PLANE)
  return photos.map(photo => photo.plane === plane ? normalizePhotoSlot({
    ...photo, ...image, originalPath: undefined, calibration: undefined,
    annotations: createEmptyAnnotations(), baseline: undefined,
  }) : photo)
}

export async function acquirePlanePhoto(options: {
  blob: Blob
  name?: string
  plane: PhotoSlot['plane'] | null
  getPhotos: () => PhotoSlot[]
  confirmReplace: () => boolean
  commit: (photos: PhotoSlot[]) => void | Promise<void>
}): Promise<boolean> {
  if (!options.plane || !options.getPhotos().some(p => p.plane === options.plane)) throw new Error(SELECT_PHOTO_PLANE)
  const image = await preparePhoto(options.blob, options.name)
  const current = options.getPhotos().find(p => p.plane === options.plane)
  if (current?.dataUrl && !options.confirmReplace()) return false
  await options.commit(replacePlanePhoto(options.getPhotos(), options.plane, image))
  return true
}

/** Snapshot DataTransfer while the native event is active (Safari protects it afterwards). */
export function extractImageFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null
  for (const item of Array.from(data.items ?? [])) {
    if (!item.type?.toLowerCase().startsWith('image/')) continue
    try {
      const file = item.getAsFile()
      if (file?.size) return file
    } catch { /* Safari may expose an unavailable representation; try files next. */ }
  }
  for (const file of Array.from(data.files ?? [])) {
    const untypedImage = (!file.type || file.type === 'application/octet-stream') && /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name)
    if (file.size && (file.type.toLowerCase().startsWith('image/') || untypedImage)) return file
  }
  return null
}

/** Compatibility wrapper: a paste always acquires the first readable image. */
export function clipboardEventImages(data: DataTransfer | null): File[] {
  const file = extractImageFromClipboard(data)
  return file ? [file] : []
}

export async function readClipboardPhoto(data: DataTransfer | null = null): Promise<Blob> {
  const nativeImage = extractImageFromClipboard(data)
  if (nativeImage) return nativeImage
  if (!navigator.clipboard?.read) throw new Error(`${NO_CLIPBOARD_IMAGE} Lettura programmatica Appunti non disponibile. Usa l’area Incolla qui con Command+V / Ctrl+V, oppure Carica.`)
  try {
    // No awaits before read(): Safari must see the original click/keydown/paste gesture.
    const items = await navigator.clipboard.read()
    const preferred = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/x-tiff', 'image/x-ms-bmp']
    let deniedRepresentation: unknown
    for (const item of items) {
      const types = [...preferred.filter(type => item.types.includes(type)), ...item.types.filter(type => type.startsWith('image/') && !preferred.includes(type) && type !== 'image/svg+xml')]
      for (const type of types) {
        try {
          const blob = await item.getType(type)
          if (blob?.size) return blob
        } catch (error) {
          // Try another representation/item, but report a permission denial if none is readable.
          if (clipboardAccessDenied(error)) deniedRepresentation = error
        }
      }
    }
    if (deniedRepresentation) throw deniedRepresentation
    throw new Error(NO_CLIPBOARD_IMAGE)
  } catch (error) {
    if (clipboardAccessDenied(error)) throw new Error('Accesso agli Appunti negato da Safari o dal browser. Conferma Incolla nel menu del browser oppure usa l’area Incolla qui con Command+V / Ctrl+V.', { cause: error })
    throw error
  }
}

export interface ClipboardImageRequest {
  result: Promise<Blob>
  offerNative: (data: DataTransfer | null) => void
  cancel: () => void
}

/**
 * A gesture can produce both an async read and a native paste. Prefer native data,
 * start the API synchronously for Safari, and commit exactly one image.
 */
export function beginClipboardImageRead(): ClipboardImageRequest {
  let settled = false
  let accept!: (blob: Blob) => void
  let fail!: (error: unknown) => void
  const result = new Promise<Blob>((resolve, reject) => { accept = resolve; fail = reject })
  const finish = (blob: Blob) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    accept(blob)
  }
  // Let the default keyboard action dispatch paste before using the programmatic result.
  let releaseNativeWindow!: () => void
  const nativeWindow = new Promise<void>(resolve => { releaseNativeWindow = resolve })
  const timer = setTimeout(() => releaseNativeWindow(), 120)
  void readClipboardPhoto().then(async blob => {
    await nativeWindow
    finish(blob)
  }, async error => {
    await nativeWindow
    if (!settled) { settled = true; fail(error) }
  })
  return {
    result,
    offerNative: data => {
      const file = extractImageFromClipboard(data)
      if (file) { finish(file); releaseNativeWindow() }
    },
    cancel: () => {
      clearTimeout(timer)
      releaseNativeWindow()
      if (!settled) { settled = true; fail(new Error('Incolla annullato.')) }
    },
  }
}

async function photoAsPng(dataUrl: string): Promise<Blob> {
  const { bytes, mime } = parseDataUrl(dataUrl)
  const blob = new Blob([Uint8Array.from(bytes)], { type: mime })
  const image = await decodePhoto(blob)
  return mime === 'image/png' ? blob : encodePng(image)
}

export async function copyPhotoToClipboard(dataUrl: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Copia immagini non disponibile in questo browser. Usa un browser con Clipboard API su localhost o HTTPS.')
  try {
    // Invoke write synchronously within the user gesture, including Safari.
    const png = photoAsPng(dataUrl)
    void png.catch(() => undefined) // Avoid an unhandled decode failure if the browser rejects write immediately.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  } catch (error) {
    if (clipboardAccessDenied(error)) throw new Error('Copia foto negata dal browser. Consenti l’accesso agli Appunti e riprova: la foto non è stata copiata.', { cause: error })
    throw new Error('Copia foto non riuscita: il browser non ha scritto l’immagine negli Appunti.', { cause: error })
  }
}

export function isPhotoClipboardBlocked(target: EventTarget | null): boolean {
  const element = target as Element | null
  return Boolean(element?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="menu"], [role="menubar"], [role="menuitem"], [role="listbox"], [role="option"], dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-photo-shortcuts="off"]'))
}

export function hasPhotoClipboardOverlay(): boolean {
  return Boolean(document.querySelector('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [role="listbox"], [data-photo-shortcuts="off"]'))
}

export function canHandlePhotoClipboard(event: { target: EventTarget | null; defaultPrevented: boolean }, modalOpen: boolean): boolean {
  return !event.defaultPrevented && !modalOpen && !isPhotoClipboardBlocked(event.target) && !isPhotoClipboardBlocked(document.activeElement) && !hasPhotoClipboardOverlay()
}
