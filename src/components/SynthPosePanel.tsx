import { useEffect, useRef, useState } from 'react'
import type { AnatomicalPlane, PlacedLandmark, StructuredLandmarkCollection } from '@/types'
import { synthposeToAutoProposals, type SynthposeResult } from '@/utils/synthposeAdapter'
import { detectSynthpose, synthposeStatus } from '@/utils/synthposeClient'
import { Button } from './ui/button'

interface Props {
  image: string
  plane: AnatomicalPlane
  collection: StructuredLandmarkCollection
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  onProposals: (proposals: PlacedLandmark[]) => void
  onAccept: (id: string) => void
  onAcceptReliable: () => void
  onReject: (id: string) => void
  onMove: (id: string) => void
  onDebug: (result: SynthposeResult | null) => void
}

export function SynthPosePanel(props: Props) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [debug, setDebug] = useState(false)
  const [result, setResult] = useState<SynthposeResult | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [props.image, props.plane])
  const { plane, onDebug } = props
  useEffect(() => { if (plane === 'trasverso') onDebug(null) }, [plane, onDebug])
  const proposals = props.collection.autoProposals.filter(l => l.aiProposal)

  async function run(statusOnly = false) {
    if (request.current && !request.current.signal.aborted) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setMessage('')
    try {
      if (statusOnly) {
        const status = await synthposeStatus(controller.signal)
        setMessage(status.available ? `Modello locale disponibile · ${status.device === 'not_loaded' ? 'caricamento al primo rilevamento' : status.device}` : status.message ?? 'SynthPose non installato.')
        return
      }
      const detected = await detectSynthpose(props.image, props.plane, controller.signal)
      if (controller.signal.aborted) return
      setResult(detected)
      props.onProposals(synthposeToAutoProposals(detected, props.plane))
      props.onVisibleChange(true)
      props.onDebug(debug ? detected : null)
      setMessage(`Rilevamento completato (${detected.device}). Confermare o correggere le proposte.`)
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Servizio SynthPose locale non disponibile.')
    } finally {
      if (request.current === controller) request.current = null
      setBusy(false)
    }
  }

  if (props.plane === 'trasverso') return <section aria-label="SynthPose sperimentale" className="border-b border-amber-200 bg-amber-50 p-2 text-xs">
    <p className="font-semibold">Piano trasverso · modalità manuale assistita consigliata</p>
    <p>Il rilevamento AI per il piano trasverso è attualmente limitato. Per questo piano è consigliata la modalità manuale assistita. SynthPose non è validato per questa vista dall’alto / postero-superiore: nessuna proposta automatica. Posizionare solo repere visibili e confermarli manualmente.</p>
  </section>

  return <section aria-label="SynthPose sperimentale" className="shrink-0 border-b border-violet-200 bg-violet-50 p-2 text-xs">
    <p className="font-semibold">SynthPose locale · sperimentale</p>
    <p className="mb-2 text-[10px]">Una persona, corpo intero, centrata. Le proposte non entrano nel report prima della conferma. Soglie sperimentali, non validate clinicamente.</p>
    <div className="flex flex-wrap gap-1">
      <Button type="button" size="sm" disabled={busy} onClick={() => void run()}>Rileva landmark AI</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(true)}>Verifica AI</Button>
    </div>
    {busy && <p role="status">Elaborazione locale SynthPose…</p>}
    {message && <p role="status" className="my-1">{message}</p>}
    {proposals.length > 0 && <>
      <div className="my-2 flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={props.onAcceptReliable}>Accetta tutti affidabili</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => props.onVisibleChange(!props.visible)}>{props.visible ? 'Nascondi proposte AI' : 'Mostra proposte AI'}</Button>
      </div>
      <ul className="max-h-40 space-y-2 overflow-y-auto">
        {proposals.map(p => <li key={p.id} className="rounded border border-amber-200 bg-white p-1">
          <p>{p.label} · {Math.round(p.aiProposal!.rawConfidence * 100)}% · {p.aiProposal!.mappingType === 'direct' ? p.aiProposal!.bulkEligible ? 'diretto, alta confidenza' : 'diretto, da verificare' : 'approssimativo, conferma singola'}</p>
          <p className="text-[10px]">{p.notes}</p>
          <div className="flex gap-1">
            <button type="button" className="underline" onClick={() => props.onAccept(p.id)}>Accetta singolo</button>
            <button type="button" className="underline" onClick={() => { props.onVisibleChange(true); props.onMove(p.id) }}>Sposta</button>
            <button type="button" className="underline" onClick={() => props.onReject(p.id)}>Rifiuta</button>
          </div>
        </li>)}
      </ul>
    </>}
    <label className="mt-2 flex gap-1"><input type="checkbox" checked={debug} onChange={e => { setDebug(e.target.checked); props.onDebug(e.target.checked ? result : null) }} />Debug: tutti i 52 marker grezzi</label>
    {debug && result && <ul className="max-h-32 overflow-y-auto font-mono text-[10px]">
      {result.keypoints.map(p => <li key={p.index}>{p.index} · {p.name} · {Math.round(p.confidence * 100)}% · ({p.xPx.toFixed(1)}, {p.yPx.toFixed(1)})</li>)}
    </ul>}
  </section>
}


export function SynthPoseDebugOverlay({ result, rect }: { result: SynthposeResult; rect: { left: number; top: number; width: number; height: number } }) {
  return <div className="pointer-events-none absolute inset-0 z-40" aria-label="Overlay debug SynthPose">
    {result.keypoints.map(k => <span key={k.index} className="absolute text-[9px] text-fuchsia-200" style={{ left: rect.left + k.xNormalized * rect.width, top: rect.top + k.yNormalized * rect.height }}>● {k.index} {k.name} {Math.round(k.confidence * 100)}%</span>)}
  </div>
}
