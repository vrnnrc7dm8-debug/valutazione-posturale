import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
interface ResizableDraggableModalProps {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  headerActions?: ReactNode
  children: ReactNode
}

const MIN_W = 720
const MIN_H = 480

export function ResizableDraggableModal({
  title,
  subtitle,
  onClose,
  headerActions,
  children,
}: ResizableDraggableModalProps) {
  const [pos, setPos] = useState({ x: 24, y: 24 })
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [fullscreen, setFullscreen] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(
    null,
  )
  const resizeRef = useRef<{
    startX: number
    startY: number
    ow: number
    oh: number
  } | null>(null)

  const fitToViewport = useCallback(() => {
    const margin = 16
    setSize({
      w: Math.max(MIN_W, window.innerWidth - margin * 2),
      h: Math.max(MIN_H, window.innerHeight - margin * 2),
    })
    setPos({ x: margin, y: margin })
  }, [])

  useEffect(() => {
    fitToViewport()
    const onResize = () => {
      if (fullscreen) fitToViewport()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitToViewport, fullscreen])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragRef.current && !fullscreen) {
        setPos({
          x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
          y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
        })
      }
      if (resizeRef.current && !fullscreen) {
        setSize({
          w: Math.max(
            MIN_W,
            resizeRef.current.ow + (e.clientX - resizeRef.current.startX),
          ),
          h: Math.max(
            MIN_H,
            resizeRef.current.oh + (e.clientY - resizeRef.current.startY),
          ),
        })
      }
    }
    const onUp = () => {
      dragRef.current = null
      resizeRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [fullscreen])

  const shellClass = fullscreen
    ? 'fixed inset-2 z-50 flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl'
    : 'fixed z-50 flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200'

  const shellStyle = fullscreen
    ? undefined
    : {
        left: pos.x,
        top: pos.y,
        width: size.w || MIN_W,
        height: size.h || MIN_H,
      }

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <div className={shellClass} style={shellStyle}>
        <header
          className="flex cursor-grab items-center justify-between gap-2 border-b bg-clinical-50 px-4 py-2 active:cursor-grabbing"
          onPointerDown={(e) => {
            if (fullscreen || (e.target as HTMLElement).closest('button')) return
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              ox: pos.x,
              oy: pos.y,
            }
          }}
        >
          <div className="min-w-0 select-none">
            <div className="font-semibold text-clinical-900">{title}</div>
            {subtitle && (
              <p className="truncate text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? 'Esci da fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        {!fullscreen && (
          <div
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
            onPointerDown={(e) => {
              e.stopPropagation()
              resizeRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                ow: size.w || MIN_W,
                oh: size.h || MIN_H,
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
