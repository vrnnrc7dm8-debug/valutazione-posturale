// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { SynthPosePanel } from '@/components/SynthPosePanel'
import { synthposeFixture } from '@/testFixtures/synthpose'
import { createEmptyLandmarkCollection } from '@/utils/landmarkCollection'
import { acceptReliableSynthposeProposals, acceptSynthposeProposal, mergeSynthposeProposals } from '@/utils/synthposeAdapter'
import type { StructuredLandmarkCollection } from '@/types'

it('richiede solo endpoint locale e mostra proposte, confidence, revisione e debug opzionale', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => synthposeFixture() })
  vi.stubGlobal('fetch', fetchMock)
  const host = document.createElement('div')
  const ui = createRoot(host)
  let latest: StructuredLandmarkCollection
  const onDebug = vi.fn()
  function Harness() {
    const [collection, setCollection] = useState(createEmptyLandmarkCollection)
    const [visible, setVisible] = useState(true)
    latest = collection
    return createElement(SynthPosePanel, {
      image: 'data:image/png;base64,synthetic', plane: 'frontale_anteriore', collection, visible,
      onVisibleChange: setVisible, onDebug,
      onProposals: proposals => setCollection(c => mergeSynthposeProposals(c, proposals)),
      onAccept: id => setCollection(c => acceptSynthposeProposal(c, id)),
      onAcceptReliable: () => setCollection(c => acceptReliableSynthposeProposals(c)),
      onMove: vi.fn(), onReject: id => setCollection(c => ({ ...c, autoProposals: c.autoProposals.filter(p => p.id !== id) })),
    })
  }
  const click = async (label: string) => act(async () => {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent === label)!
    expect(button).toBeTruthy()
    button.click()
  })
  try {
    await act(async () => ui.render(createElement(Harness)))
    expect(host.textContent).not.toContain('0 · Nose')
    await click('Rileva landmark AI')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/synthpose')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ plane: 'frontale_anteriore', mode: 'single_person_posture_photo' })
    expect(latest!.confirmed).toEqual([])
    expect(host.textContent).toContain('90%')
    expect(host.textContent).toContain('approssimativo, conferma singola')
    await click('Accetta tutti affidabili')
    expect(latest!.confirmed.length).toBeGreaterThan(0)
    expect(latest!.autoProposals.every(p => p.aiProposal?.mappingType === 'approximate')).toBe(true)
    await click('Nascondi proposte AI')
    expect(host.textContent).toContain('Mostra proposte AI')
    const checkbox = host.querySelector('input[type=checkbox]') as HTMLInputElement
    await act(async () => checkbox.click())
    expect(host.textContent).toContain('0 · Nose')
    expect(host.textContent).toContain('51 · T6')
    expect(onDebug).toHaveBeenLastCalledWith(synthposeFixture())
    await click('Rifiuta')
    await click('Accetta singolo')
  } finally {
    await act(async () => { ui.unmount() })
    vi.unstubAllGlobals()
  }
})

it('un errore del modello non modifica le annotazioni', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'SynthPose non installato. Eseguire backend/download_synthpose.py.' }) }))
  const host = document.createElement('div')
  const root = createRoot(host)
  const onProposals = vi.fn()
  try {
    await act(async () => root.render(createElement(SynthPosePanel, {
      image: 'data:image/png;base64,synthetic', plane: 'frontale_anteriore', collection: createEmptyLandmarkCollection(), visible: true,
      onProposals, onVisibleChange: vi.fn(), onDebug: vi.fn(), onAccept: vi.fn(), onAcceptReliable: vi.fn(), onReject: vi.fn(), onMove: vi.fn(),
    })))
    await act(async () => ([...host.querySelectorAll('button')].find(b => b.textContent === 'Rileva landmark AI') as HTMLButtonElement).click())
    expect(host.textContent).toContain('SynthPose non installato')
    expect(onProposals).not.toHaveBeenCalled()
    expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Rileva landmark AI')!.disabled).toBe(false)
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})

it('nel trasverso consiglia il manuale e non offre rilevamento, debug o proposte obsolete', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  const host = document.createElement('div'); const root = createRoot(host)
  try {
    await act(async () => root.render(createElement(SynthPosePanel, {
      image: 'data:image/png;base64,synthetic', plane: 'trasverso', collection: createEmptyLandmarkCollection(), visible: true,
      onVisibleChange: vi.fn(), onDebug: vi.fn(), onProposals: vi.fn(), onAccept: vi.fn(), onAcceptReliable: vi.fn(), onMove: vi.fn(), onReject: vi.fn(),
    })))
    expect(host.textContent).toContain('modalità manuale assistita consigliata')
    expect(host.textContent).toContain('nessuna proposta automatica')
    expect(host.querySelector('button')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
})
