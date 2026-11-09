// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResizableDraggableModal } from '@/components/ResizableDraggableModal'
import { PhotoAnnotationEditor } from '@/components/PhotoAnnotationEditor'
import { synthposeFixture } from '@/testFixtures/synthpose'
import { synthposeToAutoProposals, mergeSynthposeProposals } from '@/utils/synthposeAdapter'
import { createEmptyAnnotations } from '@/types'
let host: HTMLDivElement, root: Root
const close = vi.fn()
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  close.mockClear()
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
const click = async (label: string) => act(async () => {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  expect(button).toBeTruthy(); button!.click()
})
const shell = () => host.querySelector<HTMLElement>('[role="dialog"]')!
const geometry = () => shell().getAttribute('style')
const pointer = async (target: EventTarget, type: string, x: number, y: number) => act(async () => {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }))
})
const mount = async () => act(async () => root.render(createElement(ResizableDraggableModal, {
  title: 'Annotazione e analisi clinica', onClose: close, children: createElement('input', { defaultValue: 'modifica non salvata' }),
})))
it('apre espansa, riduce, espande, ripristina la dimensione precedente con doppio click e chiude solo con X', async () => {
  await mount(); expect(shell().dataset.windowState).toBe('expanded')
  await click('Riduci'); expect(shell().dataset.windowState).toBe('compact')
  const compact = geometry()
  await click('Espandi'); expect(shell().style.width).toBe('1384px')
  await act(async () => host.querySelector('header')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
  expect(geometry()).toBe(compact)
  expect(close).not.toHaveBeenCalled(); await click('Chiudi'); expect(close).toHaveBeenCalledOnce()
})
it('minimizza senza overlay e mantiene DOM, modifiche, posizione e dimensione', async () => {
  await mount(); await click('Riduci')
  const before = geometry(), input = host.querySelector('input')!
  input.value = 'ancora non salvata'
  await click('Minimizza'); expect(shell().hasAttribute('inert')).toBe(true); expect(shell().style.visibility).toBe('hidden')
  expect(host.querySelector('.inset-0')).toBeNull()
  await click('Ripristina'); expect(geometry()).toBe(before)
  expect(host.querySelector('input')).toBe(input); expect(input.value).toBe('ancora non salvata')
  expect(close).not.toHaveBeenCalled()
})
it('offre otto maniglie, rispetta minimi e viewport durante resize e drag', async () => {
  await mount(); await click('Riduci'); expect(host.querySelectorAll('[data-resize]')).toHaveLength(8)
  await pointer(host.querySelector('[data-resize="se"]')!, 'pointerdown', 100, 100)
  await pointer(window, 'pointermove', -3000, -3000); await pointer(window, 'pointerup', 0, 0)
  expect(shell().style.width).toBe('760px'); expect(shell().style.height).toBe('530px')
  await pointer(host.querySelector('header')!, 'pointerdown', 100, 100)
  await pointer(window, 'pointermove', 9000, 9000); await pointer(window, 'pointerup', 0, 0)
  expect(parseFloat(shell().style.left) + 760).toBeLessThanOrEqual(1392)
  expect(parseFloat(shell().style.top) + 530).toBeLessThanOrEqual(992)
  const before = geometry()
  await pointer(host.querySelector('input')!, 'pointerdown', 100, 100)
  await pointer(window, 'pointermove', 200, 200); expect(geometry()).toBe(before)
})
it('recupera la finestra anche con viewport piccolo e minimizzata', async () => {
  await mount(); await click('Riduci'); await click('Minimizza')
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
  await act(async () => window.dispatchEvent(new Event('resize')))
  await click('Ripristina'); expect(shell().style.width).toBe('374px'); expect(shell().style.left).toBe('8px')
  expect(parseFloat(shell().style.height)).toBeLessThanOrEqual(584)
})
it('editor reale: preserva pannello SynthPose montato, dati e toolbar senza chiamate cliniche dopo collapse e minimize', async () => {
  const change = vi.fn(), assessmentChange = vi.fn()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: false }) }))
  const annotations = createEmptyAnnotations()
  annotations.imageView = { zoom: 1.7, panX: 35, panY: -22 }
  annotations.landmarks = mergeSynthposeProposals(annotations.landmarks, synthposeToAutoProposals(synthposeFixture('sagittale_destro'), 'sagittale_destro'))
  const snapshot = JSON.stringify(annotations)
  await act(async () => root.render(createElement(PhotoAnnotationEditor, {
    imageUrl: 'data:image/png;base64,synthetic', plane: 'sagittale_destro', planeLabel: 'Piano sagittale DX',
    annotations, onChange: change, planeAssessment: { plane: 'sagittale_destro', alterations: [] },
    onPlaneAssessmentChange: assessmentChange, onClose: close,
  })))
  expect(annotations.landmarks.autoProposals.length).toBeGreaterThan(1)
  const panel = host.querySelector('[aria-label="SynthPose sperimentale"]')!
  expect(panel).toBeTruthy()
  const proposalCount = panel.querySelectorAll('li').length
  await act(async () => [...panel.querySelectorAll('button')].find(b => b.textContent === 'Sposta')!.click())
  const instruction = host.querySelector('span.opacity-90')?.textContent
  expect(instruction).toBeTruthy()
  await click('Nascondi pannello'); expect(host.querySelector('aside')!.hidden).toBe(true)
  await click('Minimizza')
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }))
  })
  await click('Ripristina'); await click('Mostra pannello'); await click('Riduci')
  expect(host.querySelector('[aria-label="SynthPose sperimentale"]')).toBe(panel)
  expect(host.querySelector('aside')!.hidden).toBe(false)
  expect(panel.querySelectorAll('li')).toHaveLength(proposalCount)
  expect(host.querySelector('span.opacity-90')?.textContent).toBe(instruction)
  expect(host.textContent).toContain('Zoom 170%')
  expect([...host.querySelectorAll('button')].some(b => b.textContent?.includes('Pan immagine'))).toBe(true)
  expect(JSON.stringify(annotations)).toBe(snapshot)
  expect(change).not.toHaveBeenCalled(); expect(assessmentChange).not.toHaveBeenCalled()
})
it.each(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])('ridimensiona dal bordo/angolo %s senza uscire dal viewport', async edge => {
  await mount(); await click('Riduci')
  const before = geometry()
  await pointer(host.querySelector(`[data-resize="${edge}"]`)!, 'pointerdown', 400, 400)
  await pointer(window, 'pointermove', 430, 430); await pointer(window, 'pointerup', 430, 430)
  expect(geometry()).not.toBe(before)
  expect(parseFloat(shell().style.width)).toBeGreaterThanOrEqual(760)
  expect(parseFloat(shell().style.height)).toBeGreaterThanOrEqual(530)
  expect(parseFloat(shell().style.left)).toBeGreaterThanOrEqual(8)
  expect(parseFloat(shell().style.top)).toBeGreaterThanOrEqual(8)
})
