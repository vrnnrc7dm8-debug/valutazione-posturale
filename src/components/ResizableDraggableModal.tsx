import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { Maximize2, Minus, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  onMinimizedChange?: (minimized: boolean) => void
  headerActions?: ReactNode
  children: ReactNode
}
type Rect = { x: number; y: number; w: number; h: number }
type Mode = 'expanded' | 'compact' | 'minimized'
const viewport = () => ({ w: window.innerWidth, h: window.innerHeight })
const expandedRect = (): Rect => ({ x: 8, y: 8, w: Math.max(1, viewport().w - 16), h: Math.max(1, viewport().h - 16) })
function constrainClinicalWindow(rect: Rect): Rect {
  const max = expandedRect()
  const w = Math.min(max.w, Math.max(Math.min(760, max.w), rect.w))
  const h = Math.min(max.h, Math.max(Math.min(530, max.h), rect.h))
  return { w, h, x: Math.max(8, Math.min(rect.x, viewport().w - w - 8)), y: Math.max(8, Math.min(rect.y, viewport().h - h - 8)) }
}
const compactRect = () => constrainClinicalWindow({ x: viewport().w * .12, y: viewport().h * .12, w: viewport().w * .76, h: viewport().h * .76 })
const interactive = (target: EventTarget) => (target as HTMLElement).closest('button,input,select,textarea,a,[role="button"],[role="combobox"],[contenteditable="true"]')

function WindowControl({ label, action, children }: { label: string; action: () => void; children: ReactNode }) {
  return <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={label} title={label} onClick={action}>{children}</Button>
}

export function ResizableDraggableModal({ title, subtitle, onClose, onMinimizedChange, headerActions, children }: Props) {
  const [mode, setMode] = useState<Mode>('expanded')
  const [rect, setRect] = useState(expandedRect)
  const previous = useRef<Rect | null>(null)
  const restoreMode = useRef<Mode>('expanded')
  const shell = useRef<HTMLDivElement>(null)
  const restoreButton = useRef<HTMLButtonElement>(null)
  const focused = useRef<HTMLElement | null>(null)
  const gesture = useRef<{ x: number; y: number; rect: Rect; edge: string } | null>(null)

  useEffect(() => {
    const resize = () => {
      gesture.current = null
      setRect(r => mode === 'expanded' || (mode === 'minimized' && restoreMode.current === 'expanded') ? expandedRect() : constrainClinicalWindow(r))
      if (previous.current) previous.current = constrainClinicalWindow(previous.current)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [mode])

  useEffect(() => {
    const end = () => { gesture.current = null }
    const move = (e: PointerEvent) => {
      const g = gesture.current
      if (!g) return
      const dx = e.clientX - g.x, dy = e.clientY - g.y
      const r = g.rect
      if (!g.edge) { setRect(constrainClinicalWindow({ ...r, x: r.x + dx, y: r.y + dy })); return }
      const max = expandedRect()
      let left = r.x, top = r.y, right = r.x + r.w, bottom = r.y + r.h
      const minW = Math.min(760, max.w), minH = Math.min(530, max.h)
      if (g.edge.includes('e')) right = Math.min(viewport().w - 8, Math.max(left + minW, right + dx))
      if (g.edge.includes('s')) bottom = Math.min(viewport().h - 8, Math.max(top + minH, bottom + dy))
      if (g.edge.includes('w')) left = Math.max(8, Math.min(right - minW, left + dx))
      if (g.edge.includes('n')) top = Math.max(8, Math.min(bottom - minH, top + dy))
      setRect({ x: left, y: top, w: right - left, h: bottom - top })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  const expand = () => { if (mode === 'compact') previous.current = rect; setRect(expandedRect()); setMode('expanded') }
  const toggle = () => {
    if (mode === 'compact') expand()
    else { setRect(constrainClinicalWindow(previous.current ?? compactRect())); setMode('compact') }
  }
  const start = (e: ReactPointerEvent, edge = '') => {
    if (e.button !== 0 || (!edge && interactive(e.target))) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (mode === 'expanded') setMode('compact')
    gesture.current = { x: e.clientX, y: e.clientY, rect, edge }
  }
  return <>
    <div ref={shell} role="dialog" aria-label="Annotazione e analisi clinica" data-window-state={mode}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, visibility: mode === 'minimized' ? 'hidden' : undefined }}
      inert={mode === 'minimized'}
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
      <header className="sticky top-0 z-20 flex shrink-0 touch-none cursor-grab flex-wrap items-center justify-between gap-2 border-b bg-clinical-50 px-4 py-2 active:cursor-grabbing"
        onPointerDown={e => start(e)} onDoubleClick={e => { if (!interactive(e.target)) toggle() }}>
        <div className="min-w-0 select-none"><div className="font-semibold text-clinical-900">{title}</div>{subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}</div>
        <div className="flex shrink-0 items-center gap-1">{headerActions}
          <WindowControl label="Minimizza" action={() => {
            focused.current = document.activeElement as HTMLElement
            restoreMode.current = mode
            gesture.current = null
            setMode('minimized'); onMinimizedChange?.(true)
            requestAnimationFrame(() => restoreButton.current?.focus())
          }}><Minus className="h-4 w-4" /></WindowControl>
          <WindowControl label={mode === 'expanded' ? 'Riduci' : 'Ripristina dimensione espansa'} action={toggle}><Square className="h-4 w-4" /></WindowControl>
          <WindowControl label="Espandi" action={expand}><Maximize2 className="h-4 w-4" /></WindowControl>
          <WindowControl label="Chiudi" action={onClose}><X className="h-4 w-4" /></WindowControl>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(edge => <div key={edge} data-resize={edge} aria-hidden="true"
        onPointerDown={e => start(e, edge)}
        style={{ position: 'absolute', zIndex: 30, touchAction: 'none', cursor: `${edge}-resize`,
          ...(edge.includes('n') ? { top: 0 } : edge.includes('s') ? { bottom: 0 } : { top: 8, bottom: 8 }),
          ...(edge.includes('w') ? { left: 0 } : edge.includes('e') ? { right: 0 } : { left: 8, right: 8 }),
          width: edge.includes('w') || edge.includes('e') ? 6 : undefined,
          height: edge.includes('n') || edge.includes('s') ? 6 : undefined }} />)}
    </div>
    {mode === 'minimized' && <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-32px)] flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-xl">
      <div><strong className="text-sm">Annotazione clinica</strong><div className="text-xs">{subtitle}</div></div>
      <Button ref={restoreButton} title="Ripristina" aria-label="Ripristina" onClick={() => {
        setMode(restoreMode.current); onMinimizedChange?.(false)
        requestAnimationFrame(() => { if (focused.current && shell.current?.contains(focused.current)) focused.current.focus() })
      }}>Ripristina</Button>
      <WindowControl label="Chiudi" action={onClose}><X className="h-4 w-4" /></WindowControl>
    </div>}
  </>
}
