// @vitest-environment jsdom
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoUploadPanel } from '@/components/PhotoUploadPanel'
import { createEmptyPhotos } from '@/utils/storage'
import type { PhotoSlot } from '@/types'
import { PLANE_LABELS } from '@/types'
import { acquirePlanePhoto, beginClipboardImageRead, checkPhotoDimensions, clipboardEventImages, extractImageFromClipboard, copyPhotoToClipboard, imageMime, isPhotoClipboardBlocked, MAX_PHOTO_BYTES, preparePhoto, readClipboardPhoto, replacePlanePhoto } from '@/utils/photoClipboard'

// All images, clipboard contents, decoders and persistence callbacks are synthetic.
vi.mock('@/components/PhotoAnnotationEditor', () => ({ PhotoAnnotationEditor: () => createElement('div', { 'data-testid': 'landmark-editor' }, 'Editor landmark') }))
vi.mock('@/components/PhotoComparisonView', () => ({ PhotoComparisonView: () => createElement('div', { 'data-testid': 'comparison' }, 'Confronto') }))
vi.mock('@/components/PhotoAnnotationPreview', () => ({ PhotoAnnotationPreview: () => createElement('div', { 'data-testid': 'annotation-preview' }) }))

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/wAAAABJRU5ErkJggg=='
const DATA = `data:image/png;base64,${PNG}`
const imageFile = () => new File([Buffer.from(PNG, 'base64')], 'sintetica.png', { type: 'image/png' })
const jpegFile = () => new File([new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70])], 'sintetica.jpeg', { type: 'image/jpeg' })
let host: HTMLDivElement
let root: Root
let latest: PhotoSlot[]
let changed: ReturnType<typeof vi.fn>
let decodeFailure = false
let decoderWidth = 1
let clipboard: { read: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> }
let written: Blob | undefined

class TestClipboardItem {
  types: string[]
  values: Record<string, Blob | Promise<Blob>>
  constructor(values: Record<string, Blob | Promise<Blob>>) { this.values = values; this.types = Object.keys(values) }
  async getType(type: string) { return this.values[type] }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('File', NodeFile)
  vi.stubGlobal('ClipboardItem', TestClipboardItem)
  vi.stubGlobal('Image', class {
    naturalWidth = decoderWidth
    naturalHeight = 1
    onload?: () => void
    onerror?: () => void
    set src(_value: string) { queueMicrotask(() => decodeFailure ? this.onerror?.() : this.onload?.()) }
  })
  vi.stubGlobal('FileReader', class {
    result: string | null = null
    onload?: () => void
    onerror?: () => void
    readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(bytes => { this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`; this.onload?.() }) }
  })
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:synthetic-test') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob([Buffer.from(PNG, 'base64')], { type: 'image/png' })))
  vi.stubGlobal('confirm', vi.fn(() => true))
  clipboard = {
    read: vi.fn(async () => [new TestClipboardItem({ 'image/png': imageFile() })]),
    write: vi.fn(async (items: TestClipboardItem[]) => { written = await items[0].getType('image/png') }),
  }
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  changed = vi.fn()
  written = undefined
  decodeFailure = false
  decoderWidth = 1
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  document.querySelectorAll('[data-test-overlay]').forEach(el => el.remove())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function render(photos = createEmptyPhotos()) {
  function Harness() {
    const [current, setCurrent] = useState(photos)
    latest = current
    return createElement(PhotoUploadPanel, { photos: current, planeAssessments: [], onChange: next => { changed(next); setCurrent(next) }, onPlaneAssessmentsChange: vi.fn() })
  }
  await act(async () => root.render(createElement(Harness)))
}
function button(text: string, scope: ParentNode = host) {
  const found = Array.from(scope.querySelectorAll('button')).find(el => el.textContent?.includes(text))
  if (!found) throw new Error(`Button missing: ${text}`)
  return found
}
const group = (plane: PhotoSlot['plane']) => host.querySelector(`[role="group"][aria-label="${PLANE_LABELS[plane]}"]`)!
async function click(el: Element) { await act(async () => { (el as HTMLElement).click(); await vi.advanceTimersByTimeAsync(120) }) }
async function paste(files = [imageFile()], target: EventTarget = document.body) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { items: files.map(file => ({ kind: 'file', type: file.type, getAsFile: () => file })), files } })
  await act(async () => { target.dispatchEvent(event) })
  return event
}
async function copyKey(modifier: 'metaKey' | 'ctrlKey', target: EventTarget = document.body, extras = {}) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'c', [modifier]: true, ...extras })
  await act(async () => { target.dispatchEvent(event) })
  return event
}

async function pasteData(data: Partial<DataTransfer>, target: EventTarget = document.body) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: data })
  await act(async () => { target.dispatchEvent(event) })
  return event
}
async function pasteKey(modifier: 'metaKey' | 'ctrlKey', target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', [modifier]: true })
  await act(async () => { target.dispatchEvent(event) })
  return event
}

describe('Fotografie: pulsanti, piano e scorciatoie', () => {
  it('offre Incolla foto per tutti i cinque piani e non assegna senza selezione', async () => {
    await render()
    expect(host.querySelectorAll('button[aria-label^="Incolla foto"]')).toHaveLength(5)
    await paste()
    expect(host.textContent).toContain('Seleziona prima un piano fotografico, poi incolla l’immagine.')
    expect(changed).not.toHaveBeenCalled()
  })
  it.each(['frontale_anteriore', 'frontale_posteriore', 'sagittale_destro', 'sagittale_sinistro', 'trasverso'] as const)('incolla nel piano %s e mostra anteprima e Annota', async plane => {
    await render()
    await click(button('Seleziona', group(plane)))
    expect(group(plane).className).toContain('ring-2')
    await paste()
    expect(latest.find(p => p.plane === plane)?.dataUrl).toBe(DATA)
    expect(latest.filter(p => p.dataUrl)).toHaveLength(1)
    expect(group(plane).querySelector('img')?.getAttribute('src')).toBe(DATA)
    expect(group(plane).querySelector('[data-testid="annotation-preview"]')).not.toBeNull()
    await click(button('Annota', group(plane)))
    expect(host.parentElement?.querySelector('[data-testid="landmark-editor"]')).not.toBeNull()
    const calls = changed.mock.calls.length
    expect((await paste()).defaultPrevented).toBe(false)
    expect(changed).toHaveBeenCalledTimes(calls)
  })
  it('il pulsante Incolla foto sceglie esplicitamente la destinazione e legge gli Appunti', async () => {
    await render()
    await click(button('Incolla foto', group('sagittale_sinistro')))
    expect(clipboard.read).toHaveBeenCalledOnce()
    expect(latest.find(p => p.plane === 'sagittale_sinistro')?.dataUrl).toBe(DATA)
  })
  it('accetta JPEG tramite evento incolla conservando MIME e nome JPEG', async () => {
    await render()
    await click(button('Seleziona', group('frontale_anteriore')))
    await paste([jpegFile()])
    expect(latest[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(latest[0].fileName).toBe('sintetica.jpeg')
  })
  it('accetta JPEG anche tramite il pulsante Appunti', async () => {
    clipboard.read.mockResolvedValue([new TestClipboardItem({ 'image/jpeg': jpegFile() })])
    await render()
    await click(button('Incolla foto', group('frontale_posteriore')))
    expect(latest[1].dataUrl).toMatch(/^data:image\/jpeg;base64,/)
  })
  it('Carica e Incolla condividono la procedura di acquisizione', async () => {
    await render()
    const input = group('trasverso').querySelector('input')!
    Object.defineProperty(input, 'files', { value: [jpegFile()] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(latest[4].dataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(input.value).toBe('')
  })
  it('non avvia un secondo incolla e conserva il piano scelto mentre gli Appunti rispondono', async () => {
    let release!: (items: TestClipboardItem[]) => void
    clipboard.read.mockReturnValue(new Promise<TestClipboardItem[]>(resolve => { release = resolve }))
    await render()
    await click(button('Incolla foto', group('frontale_anteriore')))
    await click(button('Seleziona', group('trasverso')))
    await paste([imageFile()])
    expect(changed).toHaveBeenCalledOnce()
    await act(async () => { release([new TestClipboardItem({ 'image/png': imageFile() })]) })
    expect(latest[0].dataUrl).toBe(DATA)
    expect(latest[4].dataUrl).toBeUndefined()
    expect(changed).toHaveBeenCalledOnce()
  })
  it('non sostituisce la foto quando il nuovo contenuto non è valido', async () => {
    const photos = createEmptyPhotos(); photos[0].dataUrl = DATA
    clipboard.read.mockResolvedValue([new TestClipboardItem({ 'image/jpeg': new Blob(['not a jpeg'], { type: 'image/jpeg' }) })])
    await render(photos)
    await click(button('Incolla foto', group('frontale_anteriore')))
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Formato immagine')
    expect(latest[0].dataUrl).toBe(DATA)
    expect(changed).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })
  it('annulla sostituzione senza cambiare foto, baseline o calibrazione', async () => {
    const photos = createEmptyPhotos()
    photos[0] = { ...photos[0], dataUrl: DATA, calibration: { mode: 'subject_height', status: 'estimated', subjectHeightCm: 170 }, baseline: { id: 'test', dataUrl: DATA, annotations: photos[0].annotations, capturedAt: '2026-01-01', label: 'test' } }
    vi.mocked(confirm).mockReturnValue(false)
    await render(photos)
    await click(button('Incolla foto', group('frontale_anteriore')))
    expect(confirm).toHaveBeenCalledOnce()
    expect(changed).not.toHaveBeenCalled()
    expect(latest[0]).toEqual(photos[0])
  })
  it('conferma sostituzione e azzera solo riferimenti geometrici della nuova foto', async () => {
    const photos = createEmptyPhotos()
    photos[0] = { ...photos[0], dataUrl: DATA, note: 'Nota sintetica', calibration: { mode: 'subject_height', status: 'estimated', subjectHeightCm: 170 } }
    await render(photos)
    await click(button('Incolla foto', group('frontale_anteriore')))
    expect(confirm).toHaveBeenCalledOnce()
    expect(latest[0].calibration).toBeUndefined()
    expect(latest[0].note).toBe('Nota sintetica')
    expect(latest[1]).toEqual(photos[1])
  })
  it.each(['metaKey', 'ctrlKey'] as const)('copia immagine reale con %s+C', async modifier => {
    const photos = createEmptyPhotos(); photos[0].dataUrl = DATA
    await render(photos)
    await click(button('Seleziona', group('frontale_anteriore')))
    expect((await copyKey(modifier)).defaultPrevented).toBe(true)
    expect(written?.type).toBe('image/png')
    expect(written?.size).toBeGreaterThan(0)
    expect(host.textContent).toContain('Foto copiata negli Appunti')
  })
  it('Copia foto converte JPEG in immagine PNG e non copia percorsi', async () => {
    const photos = createEmptyPhotos(); photos[0].dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    await render(photos)
    await click(button('Copia foto', group('frontale_anteriore')))
    expect(written?.type).toBe('image/png')
    expect(host.textContent).toContain('Foto copiata negli Appunti')
  })
  it('mostra diniego di copia e incolla senza finto successo', async () => {
    const photos = createEmptyPhotos(); photos[0].dataUrl = DATA
    clipboard.write.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    clipboard.read.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    await render(photos)
    await click(button('Copia foto', group('frontale_anteriore')))
    expect(host.textContent).toContain('Copia foto negata')
    expect(host.textContent).not.toContain('Foto copiata negli Appunti')
    await click(button('Incolla foto', group('frontale_anteriore')))
    expect(host.textContent).toContain('Accesso agli Appunti negato')
    expect(changed).not.toHaveBeenCalled()
  })
  it('non intercetta note, menu, modali, editor e selezione testuale', async () => {
    const photos = createEmptyPhotos(); photos[0].dataUrl = DATA
    await render(photos)
    await click(button('Seleziona', group('frontale_anteriore')))
    const note = group('frontale_anteriore').querySelector('textarea')!
    note.focus()
    expect((await paste([imageFile()], note)).defaultPrevented).toBe(false)
    expect((await copyKey('metaKey', note)).defaultPrevented).toBe(false)
    expect((await paste()).defaultPrevented).toBe(false) // focus remains in notes
    note.blur()
    for (const role of ['dialog', 'menu', 'listbox']) {
      const overlay = document.createElement('div'); overlay.setAttribute('role', role); overlay.setAttribute('data-test-overlay', ''); document.body.append(overlay)
      expect((await paste()).defaultPrevented).toBe(false)
      expect((await copyKey('ctrlKey')).defaultPrevented).toBe(false)
      overlay.remove()
    }
    const range = document.createRange(); range.selectNodeContents(button('Selezionato', group('frontale_anteriore')))
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    expect((await copyKey('metaKey')).defaultPrevented).toBe(false)
    window.getSelection()?.removeAllRanges()
    expect(clipboard.write).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
  })
  it('acquisisce la prima immagine leggibile e segnala gli Appunti vuoti', async () => {
    await render(); await click(button('Seleziona', group('trasverso')))
    await paste([imageFile(), imageFile()])
    expect(latest[4].dataUrl).toBe(DATA)
    expect(changed).toHaveBeenCalledOnce()
    clipboard.read.mockResolvedValue([])
    await paste([])
    expect(host.textContent).toContain('Nessuna immagine rilevata negli Appunti. Copia una foto e riprova.')
    expect(changed).toHaveBeenCalledOnce()
  })
  it.each(['metaKey', 'ctrlKey'] as const)('lascia al browser %s+V e acquisisce il successivo evento paste', async modifier => {
    await render(); await click(button('Seleziona', group('sagittale_destro')))
    const key = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'v', [modifier]: true })
    await act(async () => { document.body.dispatchEvent(key) })
    expect(key.defaultPrevented).toBe(false)
    await paste([jpegFile()])
    expect(latest[2].dataUrl).toMatch(/^data:image\/jpeg;base64,/)
  })
  it('rimuove la foto e tutti gli alias senza ricomparsa del contenuto precedente', async () => {
    await render(); await click(button('Incolla foto', group('trasverso')))
    await click(group('trasverso').querySelector('[aria-label="Rimuovi immagine"]')!)
    for (const field of ['dataUrl', 'imageUrl', 'photoUrl', 'src'] as const) expect(latest[4][field]).toBeUndefined()
    expect(group('trasverso').querySelector('img')).toBeNull()
  })
  it('preserva snapshot e confronto prima/dopo', async () => {
    await render(); await click(button('Incolla foto', group('trasverso')))
    await click(button('Salva prima', group('trasverso')))
    expect(latest[4].baseline?.dataUrl).toBe(DATA)
    await click(button('Confronta', group('trasverso')))
    expect(host.parentElement?.querySelector('[data-testid="comparison"]')).not.toBeNull()
  })
})

describe('validazione, errori e API Appunti', () => {
  it('verifica le firme effettive JPEG e PNG, ignorando MIME e suffisso fasulli', async () => {
    expect(imageMime(new Uint8Array([255, 216, 255]))).toBe('image/jpeg')
    expect(() => imageMime(new TextEncoder().encode('<svg></svg>'))).toThrow('Formato immagine')
    await expect(preparePhoto(new Blob(['not-an-image'], { type: 'image/jpeg' }))).rejects.toThrow('Formato immagine')
    const prepared = await preparePhoto(new Blob([Buffer.from(PNG, 'base64')], { type: 'text/plain' }))
    expect(prepared.dataUrl).toBe(DATA)
  })
  it('rifiuta immagini vuote, troppo grandi, corrotte o con dimensioni eccessive', async () => {
    await expect(preparePhoto(new Blob([]))).rejects.toThrow('vuota')
    await expect(preparePhoto({ size: MAX_PHOTO_BYTES + 1 } as Blob)).rejects.toThrow('20 MB')
    for (const [w, h] of [[0, 1], [20000, 1], [8000, 8000]]) expect(() => checkPhotoDimensions(w, h)).toThrow('Dimensioni')
    decodeFailure = true
    await expect(preparePhoto(imageFile())).rejects.toThrow('danneggiata')
    expect(URL.revokeObjectURL).toHaveBeenCalled()
    decodeFailure = false; decoderWidth = 20000
    await expect(preparePhoto(imageFile())).rejects.toThrow('Dimensioni')
  })
  it('non conferma sostituzioni né salva prima che la nuova foto sia validata', async () => {
    const confirmReplace = vi.fn(() => true); const commit = vi.fn()
    await expect(acquirePlanePhoto({ blob: new Blob(['invalid']), plane: 'frontale_anteriore', getPhotos: createEmptyPhotos, confirmReplace, commit })).rejects.toThrow('Formato')
    expect(commit).not.toHaveBeenCalled(); expect(confirmReplace).not.toHaveBeenCalled()
    await expect(acquirePlanePhoto({ blob: imageFile(), plane: null, getPhotos: createEmptyPhotos, confirmReplace, commit })).rejects.toThrow('Seleziona')
  })
  it('segnala API assenti, Appunti senza immagine e legge la prima immagine disponibile', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {} })
    await expect(readClipboardPhoto()).rejects.toThrow('non disponibile')
    await expect(copyPhotoToClipboard(DATA)).rejects.toThrow('non disponibile')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
    clipboard.read.mockResolvedValue([new TestClipboardItem({ 'text/plain': new Blob(['path']) })])
    await expect(readClipboardPhoto()).rejects.toThrow('Nessuna immagine rilevata')
    clipboard.read.mockResolvedValue([new TestClipboardItem({ 'image/png': imageFile() }), new TestClipboardItem({ 'image/jpeg': jpegFile() })])
    await expect(readClipboardPhoto()).resolves.toMatchObject({ type: 'image/png' })
  })
  it('riconosce i file degli eventi paste e blocca i target protetti', () => {
    expect(clipboardEventImages(null)).toEqual([])
    expect(clipboardEventImages({ items: [], files: [imageFile()] } as unknown as DataTransfer)).toHaveLength(1)
    for (const html of ['<input>', '<textarea></textarea>', '<select></select>', '<div contenteditable="true"><span></span></div>', '<div role="combobox"></div>', '<div role="dialog"></div>']) {
      const box = document.createElement('div'); box.innerHTML = html
      expect(isPhotoClipboardBlocked(box.querySelector('span') || box.firstElementChild)).toBe(true)
    }
  })
  it('preserva modifiche concorrenti alle note e propaga errori di persistenza', async () => {
    let current = createEmptyPhotos()
    const commit = vi.fn()
    const pending = acquirePlanePhoto({ blob: imageFile(), plane: 'trasverso', getPhotos: () => current, confirmReplace: () => true, commit })
    current = current.map(p => p.plane === 'trasverso' ? { ...p, note: 'Nota aggiunta durante la decodifica' } : p)
    await pending
    expect(commit.mock.calls[0][0][4].note).toBe('Nota aggiunta durante la decodifica')
    await expect(acquirePlanePhoto({ blob: imageFile(), plane: 'trasverso', getPhotos: () => current, confirmReplace: () => true, commit: async () => { throw new Error('Lexar non disponibile') } })).rejects.toThrow('Lexar non disponibile')
  })
  it('normalizza tutti gli alias foto preservando gli altri piani', () => {
    const photos = createEmptyPhotos(); photos[0].imageUrl = 'data:old'
    const next = replacePlanePhoto(photos, 'frontale_anteriore', { dataUrl: DATA, fileName: 'test.png' })
    expect(next[0].imageUrl).toBe(DATA)
    expect(next[0].src).toBe(DATA)
    expect(next[1]).toBe(photos[1])
  })
})


describe('Safari: eventi nativi, Universal Clipboard e fallback multipli', () => {
  it('usa items image/png anche senza kind e senza leggere nuovamente gli Appunti', async () => {
    await render(); await click(button('Seleziona', group('frontale_anteriore')))
    await pasteData({ items: [{ type: 'image/png', getAsFile: imageFile }] as unknown as DataTransferItemList })
    expect(latest[0].dataUrl).toBe(DATA)
    expect(clipboard.read).not.toHaveBeenCalled()
  })
  it('usa files quando items contiene solo testo o una rappresentazione immagine non leggibile', async () => {
    await render(); await click(button('Seleziona', group('frontale_posteriore')))
    await pasteData({ items: [{ type: 'text/plain', kind: 'file', getAsFile: () => new File(['path'], 'path.txt') }, { type: 'image/png', getAsFile: () => null }] as unknown as DataTransferItemList, files: [jpegFile()] as unknown as FileList })
    expect(latest[1].dataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(clipboard.read).not.toHaveBeenCalled()
  })
  it('gestisce anche gli eventi paste con target document, senza escluderli per il contenitore', async () => {
    await render(); await click(button('Seleziona', group('frontale_anteriore')))
    await pasteData({ files: [imageFile()] as unknown as FileList }, document)
    expect(latest[0].dataUrl).toBe(DATA)
  })
  it('usa files quando items è assente, come nel paste nativo di alcuni browser', async () => {
    await render(); await click(button('Seleziona', group('sagittale_sinistro')))
    await pasteData({ files: [imageFile()] as unknown as FileList })
    expect(latest[3].dataUrl).toBe(DATA)
  })
  it('legge navigator.clipboard.read se il paste event non espone file', async () => {
    await render(); await click(button('Seleziona', group('trasverso')))
    await pasteData({ items: [] as unknown as DataTransferItemList, files: [] as unknown as FileList })
    expect(clipboard.read).toHaveBeenCalledOnce()
    expect(latest[4].dataUrl).toBe(DATA)
  })
  it.each(['metaKey', 'ctrlKey'] as const)('usa il fallback di %s+V se Safari non invia paste', async modifier => {
    await render(); await click(button('Seleziona', group('sagittale_destro')))
    expect((await pasteKey(modifier)).defaultPrevented).toBe(false)
    expect(clipboard.read).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(120) })
    expect(latest[2].dataUrl).toBe(DATA)
    expect(changed).toHaveBeenCalledOnce()
  })
  it('inizia read nello stesso stack della scorciatoia, prima di timeout e await', async () => {
    await render(); await click(button('Seleziona', group('trasverso')))
    let duringGesture = false
    let calledDuringGesture = false
    clipboard.read.mockImplementation(() => { calledDuringGesture = duringGesture; return Promise.resolve([new TestClipboardItem({ 'image/png': imageFile() })]) })
    await act(async () => {
      duringGesture = true
      document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'v', metaKey: true }))
      duringGesture = false
      expect(calledDuringGesture).toBe(true)
      await vi.advanceTimersByTimeAsync(120)
    })
    expect(latest[4].dataUrl).toBe(DATA)
  })
  it.each(['metaKey', 'ctrlKey'] as const)('ignora %s+V nei campi di testo e contenteditable', async modifier => {
    await render(); await click(button('Seleziona', group('trasverso')))
    for (const tag of ['input', 'textarea', 'div']) {
      const target = document.createElement(tag)
      if (tag === 'div') { target.setAttribute('contenteditable', 'true'); target.tabIndex = 0 }
      group('trasverso').append(target)
      target.focus()
      expect((await pasteKey(modifier, target)).defaultPrevented).toBe(false)
      expect((await pasteKey(modifier)).defaultPrevented).toBe(false)
      target.remove()
    }
    expect(clipboard.read).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
  })
  it('richiede il piano anche quando gli Appunti sono vuoti senza eseguire letture', async () => {
    await render()
    await pasteKey('metaKey')
    expect(host.textContent).toContain('Seleziona prima un piano fotografico, poi incolla l’immagine.')
    await pasteData({})
    expect(host.textContent).toContain('Seleziona prima un piano fotografico, poi incolla l’immagine.')
    expect(clipboard.read).not.toHaveBeenCalled()
  })
  it('preferisce il file del paste nativo alla lettura API e importa una sola volta', async () => {
    await render(); await click(button('Seleziona', group('trasverso')))
    await pasteKey('metaKey')
    await paste([jpegFile()])
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(latest[4].dataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(changed).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
  })
  it('accetta il paste nativo anche quando read è negata durante lo stesso gesto', async () => {
    clipboard.read.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    await render(); await click(button('Seleziona', group('trasverso')))
    await pasteKey('metaKey')
    await paste()
    await act(async () => { await vi.advanceTimersByTimeAsync(120) })
    expect(latest[4].dataUrl).toBe(DATA)
    expect(host.textContent).not.toContain('Accesso agli Appunti negato')
  })
  it('offre un ricevitore paste nativo se il pulsante non può leggere da Safari', async () => {
    clipboard.read.mockResolvedValue([])
    await render(); await click(button('Incolla foto', group('frontale_anteriore')))
    expect(host.textContent).toContain('Nessuna immagine rilevata negli Appunti. Copia una foto e riprova.')
    const receiver = host.querySelector<HTMLElement>('[aria-label="Area incolla foto"]')!
    expect(document.activeElement).toBe(receiver)
    expect((await paste([jpegFile()], receiver)).defaultPrevented).toBe(true)
    expect(latest[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(changed).toHaveBeenCalledOnce()
    expect(host.querySelector('[aria-label="Area incolla foto"]')).toBeNull()
  })
  it('usa identiche validazioni per Carica, paste event e pulsante', async () => {
    await render()
    const invalid = new File(['not an image'], 'false.png', { type: 'image/png' })
    const input = group('trasverso').querySelector('input')!
    Object.defineProperty(input, 'files', { value: [invalid] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    const uploadError = host.querySelector('[role="alert"]')?.textContent
    await paste([invalid])
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(uploadError)
    clipboard.read.mockResolvedValue([new TestClipboardItem({ 'image/png': invalid })])
    await click(button('Incolla foto', group('trasverso')))
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(uploadError)
    expect(changed).not.toHaveBeenCalled()
  })
  it('prova MIME alternativi se getType png fallisce e ignora rappresentazioni vuote', async () => {
    const getType = vi.fn(async (type: string) => {
      if (type === 'image/png') throw new DOMException('missing', 'NotFoundError')
      return jpegFile()
    })
    clipboard.read.mockResolvedValue([{ types: ['text/plain', 'image/png', 'image/jpeg'], getType }])
    await expect(readClipboardPhoto()).resolves.toMatchObject({ type: 'image/jpeg' })
    expect(getType.mock.calls.map(call => call[0])).toEqual(['image/png', 'image/jpeg'])
    clipboard.read.mockResolvedValue([new TestClipboardItem({ 'image/png': new Blob([]) }), new TestClipboardItem({ 'image/jpeg': jpegFile() })])
    await expect(readClipboardPhoto()).resolves.toMatchObject({ type: 'image/jpeg' })
  })
  it('estrae file con MIME mancante e permette di annullare una richiesta pendente', async () => {
    const file = new File([Buffer.from(PNG, 'base64')], 'iphone.jpeg')
    expect(extractImageFromClipboard({ files: [file] } as unknown as DataTransfer)).toBe(file)
    const request = beginClipboardImageRead()
    const result = expect(request.result).rejects.toThrow('annullato')
    request.cancel()
    await result
    await vi.advanceTimersByTimeAsync(120)
  })
})
