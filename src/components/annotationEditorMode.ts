import type { AnnotationTool } from '@/types'

export type EditorInteractionMode =
  | 'pan_image'
  | AnnotationTool

export interface EditorModeUx {
  id: EditorInteractionMode
  label: string
  shortLabel: string
  tooltip: string
  hint: string
  canvasCursor: string
  canvasCursorActive?: string
  cursorAccent: string
  toolRing: string
  toolBg: string
}

export const PAN_IMAGE_MODE: EditorModeUx = {
  id: 'pan_image',
  label: 'Pan immagine',
  shortLabel: 'Pan',
  tooltip: 'Sposta e ingrandisca la foto nel riquadro',
  hint: 'Trascina per spostare · Rotella o slider per zoom · I landmark non intercettano il drag',
  canvasCursor: 'cursor-editor-pan',
  canvasCursorActive: 'cursor-editor-pan-grabbing',
  cursorAccent: '#38bdf8',
  toolRing: 'ring-sky-400',
  toolBg: 'bg-sky-600',
}

export const TOOL_MODE_UX: Record<AnnotationTool, EditorModeUx> = {
  landmark: {
    id: 'landmark',
    label: 'Manuale assistita',
    shortLabel: 'Landmark',
    tooltip: 'Clicca per posizionare · Trascina i landmark per spostarli',
    hint: 'Clic vuoto = posiziona · Clic su punto = seleziona · Trascina = sposta',
    canvasCursor: 'cursor-editor-landmark',
    canvasCursorActive: 'cursor-editor-grabbing',
    cursorAccent: '#22c55e',
    toolRing: 'ring-emerald-400',
    toolBg: 'bg-emerald-600',
  },
  line: {
    id: 'line',
    label: 'Traccia linea',
    shortLabel: 'Linea',
    tooltip: 'Collega due landmark e misura lunghezza e pendenza',
    hint: 'Primo punto → secondo punto',
    canvasCursor: 'cursor-editor-line',
    cursorAccent: '#0ea5e9',
    toolRing: 'ring-sky-500',
    toolBg: 'bg-sky-600',
  },
  angle: {
    id: 'angle',
    label: 'Misura angolo',
    shortLabel: 'Angolo',
    tooltip: 'Tre landmark: vertice → primo lato → secondo lato',
    hint: 'Vertice, poi i due lati',
    canvasCursor: 'cursor-editor-angle',
    cursorAccent: '#f59e0b',
    toolRing: 'ring-amber-400',
    toolBg: 'bg-amber-600',
  },
  select: {
    id: 'select',
    label: 'Sposta landmark',
    shortLabel: 'Sposta',
    tooltip: 'Alias di Landmark — trascina i punti',
    hint: 'Trascina un landmark per spostarlo',
    canvasCursor: 'cursor-editor-select',
    canvasCursorActive: 'cursor-editor-grabbing',
    cursorAccent: '#a855f7',
    toolRing: 'ring-violet-400',
    toolBg: 'bg-violet-600',
  },
  delete: {
    id: 'delete',
    label: 'Elimina landmark',
    shortLabel: 'Elimina',
    tooltip: 'Clicca un landmark per rimuoverlo',
    hint: 'Rimuove anche linee e angoli collegati',
    canvasCursor: 'cursor-editor-delete',
    cursorAccent: '#ef4444',
    toolRing: 'ring-red-400',
    toolBg: 'bg-red-600',
  },
}

export function getActiveEditorMode(
  panImageMode: boolean,
  tool: AnnotationTool,
): EditorModeUx {
  return panImageMode ? PAN_IMAGE_MODE : TOOL_MODE_UX[tool]
}

export function canDragLandmarks(panImageMode: boolean, tool: AnnotationTool): boolean {
  return !panImageMode && (tool === 'landmark' || tool === 'select')
}

export function canPlaceLandmarks(panImageMode: boolean, tool: AnnotationTool): boolean {
  return !panImageMode && tool === 'landmark'
}

export interface EditorInstructionContext {
  draggingId?: string | null
  draggingLandmarkLabel?: string
  pendingLineStart?: string | null
  pendingAngleCount?: number
  catalogLabel?: string
  selectedLandmarkLabel?: string
}

export function getContextualInstruction(
  panImageMode: boolean,
  tool: AnnotationTool,
  ctx: EditorInstructionContext = {},
): string {
  if (ctx.draggingId) {
    return ctx.draggingLandmarkLabel
      ? `Trascina per spostare — ${ctx.draggingLandmarkLabel}`
      : 'Trascina per spostare il landmark'
  }

  if (panImageMode) {
    return PAN_IMAGE_MODE.hint
  }

  switch (tool) {
    case 'landmark':
      if (ctx.selectedLandmarkLabel) {
        return `Selezionato: ${ctx.selectedLandmarkLabel} · trascina per spostare · Elimina per rimuovere`
      }
      return ctx.catalogLabel
        ? `Posiziona ${ctx.catalogLabel} · trascina i punti esistenti`
        : 'Posiziona o trascina landmark'
    case 'line':
      if (!ctx.pendingLineStart) {
        return 'Seleziona il primo punto (landmark)'
      }
      return 'Seleziona il secondo punto (landmark)'
    case 'angle':
      if ((ctx.pendingAngleCount ?? 0) === 0) {
        return '1° clic: seleziona il vertice'
      }
      if (ctx.pendingAngleCount === 1) {
        return '2° clic: seleziona il primo lato'
      }
      return '3° clic: seleziona il secondo lato'
    case 'select':
      return TOOL_MODE_UX.select.hint
    case 'delete':
      return TOOL_MODE_UX.delete.hint
  }
}

export const LANDMARK_HITBOX_PX = 44
export const LANDMARK_HIT_TEST_PX = 22

/** Blocco pan frecce solo per campi di testo editabili — non per select/combobox landmark. */
export function isArrowPanBlockedTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase()
    if (type === 'range' || type === 'checkbox' || type === 'radio' || type === 'button') {
      return false
    }
    return true
  }
  if (el.isContentEditable) return true
  return false
}
