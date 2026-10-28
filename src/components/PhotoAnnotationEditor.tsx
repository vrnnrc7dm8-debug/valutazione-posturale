import { SynthPosePanel, SynthPoseDebugOverlay } from '@/components/SynthPosePanel'
import { getSynthposeDisplayLandmarks, acceptReliableSynthposeProposals, acceptSynthposeProposal, mergeSynthposeProposals, type SynthposeResult } from '@/utils/synthposeAdapter'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Crosshair,
  ChevronDown,
  ChevronRight,
  Eraser,
  Focus,
  Hand,
  LineChart,
  ClipboardList,
  Magnet,
  Maximize2,
  Minus,
  Move,
  Plus,
  Redo2,
  CheckCircle2,
  Trash2,
  Undo2,
} from 'lucide-react'
import {
  getLandmarkCatalogEntry,
  getLandmarkDefinition,
  getLandmarksForPlane,
  LANDMARK_CATEGORY_COLORS,
} from '@/data/anatomicalLandmarks'
import { getPlaneConfig } from '@/data/planes'
import { BiomechanicalAxesLayer } from '@/components/BiomechanicalAxesLayer'
import { AnnotationDrawingPreview } from '@/components/AnnotationDrawingPreview'
import { FrameOverlaySvg } from '@/components/FrameOverlaySvg'
import { ImageAnnotationsSvg } from '@/components/ImageAnnotationsSvg'
import { useAnnotationHistory } from '@/hooks/useAnnotationHistory'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { useImagePanZoom } from '@/hooks/useImagePanZoom'
import type {
  AnatomicalPlane,
  AnnotationTool,
  ImageViewState,
  PhotoAnnotations,
  PhotoCalibration,
  PlaneAssessment,
  PlacedLandmark,
} from '@/types'
import { createDefaultCalibration, createEmptyAnnotations } from '@/types'
import {
  centerImageInContainer,
  computeImageDisplayMetrics,
  computeTransformedImageRect,
  containerToImageNormClamped,
  imageNormToContainer,
  measureImageLayerRect,
  type TransformedImageRect,
} from '@/utils/geometry'
import { normalizePhotoAnnotations } from '@/utils/normalizeAnnotations'
import { EditorErrorBoundary } from '@/components/EditorErrorBoundary'
import { ResizableDraggableModal } from '@/components/ResizableDraggableModal'
import { AnnotationClinicalPanel } from '@/components/AnnotationClinicalPanel'
import { CollapsibleLandmarkPanel } from '@/components/CollapsibleLandmarkPanel'
import { buildBiomechanicalAxes } from '@/utils/biomechanicsEngine'
import { normalizePlacedLandmark } from '@/utils/landmarkMigration'
import {
  addManualLandmark,
  confirmProposalById,
  findLandmarkById,
  getAllLandmarks,
  removeLandmarkById,
  updateLandmarkPosition,
  type LandmarkEditorDisplayMode,
} from '@/utils/landmarkCollection'
import {
  LandmarkEditor,
  landmarkSourceColor,
  landmarkSourceRingClass,
} from '@/components/LandmarkEditor'
import { LandmarkVisualIndicator } from '@/components/LandmarkVisualIndicator'
import { normalizeLandmarkId } from '@/utils/analysisEngine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  getActiveEditorMode,
  getContextualInstruction,
  canDragLandmarks,
  canPlaceLandmarks,
  isArrowPanBlockedTarget,
  LANDMARK_HIT_TEST_PX,
  LANDMARK_HITBOX_PX,
  PAN_IMAGE_MODE,
  TOOL_MODE_UX,
} from '@/components/annotationEditorMode'
import {
  LINE_REFERENCE_LABELS,
  type LineMeasurementReference,
} from '@/utils/lineMeasurements'
import type { Point2D } from '@/types'

/** Debug drag landmark — disabilitato in produzione per evitare log a ogni pointermove. */
const DEBUG_LANDMARK_DRAG = false

const ARROW_PAN_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])
const ARROW_PAN_STEP_PX = { normal: 10, shift: 30, fine: 1 } as const

interface PhotoAnnotationEditorProps {
  imageUrl: string
  plane: AnatomicalPlane
  planeLabel: string
  annotations: PhotoAnnotations
  onChange: (annotations: PhotoAnnotations) => void | Promise<void>
  planeAssessment: PlaneAssessment
  onPlaneAssessmentChange: (assessment: PlaneAssessment) => void
  calibration?: PhotoCalibration
  onCalibrationChange?: (calibration: PhotoCalibration) => void
  subjectHeightCm?: number
  onSubjectHeightChange?: (heightCm: number | undefined) => void
  onClose: () => void
}

const TOOLS: { id: AnnotationTool; label: string; icon: ReactNode }[] = [
  { id: 'landmark', label: 'Landmark', icon: <Crosshair className="h-4 w-4" /> },
  { id: 'line', label: 'Linea', icon: <LineChart className="h-4 w-4" /> },
  { id: 'angle', label: 'Angolo', icon: <span className="text-xs font-bold">°</span> },
  { id: 'delete', label: 'Elimina', icon: <Eraser className="h-4 w-4" /> },
]

function PhotoAnnotationEditorInner({
  imageUrl,
  plane,
  planeLabel,
  annotations: annotationsProp,
  onChange,
  planeAssessment,
  onPlaneAssessmentChange,
  calibration,
  onCalibrationChange,
  subjectHeightCm,
  onSubjectHeightChange,
  onClose,
}: PhotoAnnotationEditorProps) {
  const planeConfig = getPlaneConfig(plane)
  const catalogLandmarks = getLandmarksForPlane(plane)
  const defaultCatalogId = catalogLandmarks[0]?.id ?? 'vertex'
  const [annotations, setAnnotations] = useState(() =>
    normalizePhotoAnnotations(annotationsProp),
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const landmarkCatalogSelectRef = useRef<HTMLButtonElement>(null)
  const lineReferenceSelectRef = useRef<HTMLButtonElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations
  const skipPropSyncRef = useRef(false)
  const imageRectRef = useRef<ReturnType<typeof computeTransformedImageRect> | null>(
    null,
  )
  const dragPreviewRef = useRef<{ id: string; position: Point2D } | null>(null)
  const dragRafRef = useRef<number | null>(null)
  const dragCaptureRef = useRef<{ el: Element; pointerId: number } | null>(null)
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [tool, setTool] = useState<AnnotationTool>('landmark')
  const [panImageMode, setPanImageMode] = useState(false)
  const [catalogId, setCatalogId] = useState(defaultCatalogId)
  const [selectedLmId, setSelectedLmId] = useState<string | null>(null)
  const [pendingLineStart, setPendingLineStart] = useState<string | null>(null)
  const [pendingAngle, setPendingAngle] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingRef, setDraggingRef] = useState<
    'gravity' | 'horizontal' | null
  >(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [isPanningImage, setIsPanningImage] = useState(false)
  const [mouseInCanvas, setMouseInCanvas] = useState<{ x: number; y: number } | null>(
    null,
  )
  const mouseInCanvasRef = useRef<{ x: number; y: number } | null>(null)
  const previewFrameRef = useRef<number | null>(null)
  const [previewFrame, setPreviewFrame] = useState(0)
  /** Posizione locale durante drag — commit solo al rilascio (più fluido). */
  const [dragPreview, setDragPreview] = useState<{
    id: string
    position: Point2D
  } | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>(
    'idle',
  )
  const [clinicalPanelOpen, setClinicalPanelOpen] = useState(true)
  const [showAiProposals, setShowAiProposals] = useState(true)
  const [synthposeDebug, setSynthposeDebug] = useState<SynthposeResult | null>(null)
  const [landmarkToolsOpen, setLandmarkToolsOpen] = useState(false)
  const [landmarkEditorMode, setLandmarkEditorMode] =
    useState<LandmarkEditorDisplayMode>('manual')
  const [lineReference, setLineReference] =
    useState<LineMeasurementReference>('horizontal')

  const {
    canUndo,
    canRedo,
    recordBeforeChange,
    undo: undoHistory,
    redo: redoHistory,
  } = useAnnotationHistory()

  const activeMode = getActiveEditorMode(panImageMode, tool)
  const landmarkDragEnabled = canDragLandmarks(panImageMode, tool)
  const landmarkPlaceEnabled = canPlaceLandmarks(panImageMode, tool)
  const draggingLandmark = draggingId
    ? findLandmarkById(annotations.landmarks, draggingId)
    : null

  const imageView = annotations.imageView

  useEffect(() => {
    if (skipPropSyncRef.current) {
      skipPropSyncRef.current = false
      return
    }
    const next = normalizePhotoAnnotations(annotationsProp)
    setAnnotations((prev) => {
      const prevLm = JSON.stringify(prev.landmarks)
      const nextLm = JSON.stringify(next.landmarks)
      if (
        prevLm === nextLm &&
        prev.lines.length === next.lines.length &&
        prev.angles.length === next.angles.length &&
        prev.imageView.panX === next.imageView.panX &&
        prev.imageView.panY === next.imageView.panY &&
        prev.imageView.zoom === next.imageView.zoom &&
        prev.overlay.showGrid === next.overlay.showGrid &&
        prev.overlay.showGravityLine === next.overlay.showGravityLine &&
        prev.overlay.showHorizontalRef === next.overlay.showHorizontalRef &&
        prev.overlay.snapEnabled === next.overlay.snapEnabled &&
        prev.overlay.gravityLineX === next.overlay.gravityLineX &&
        prev.overlay.horizontalRefY === next.overlay.horizontalRefY
      ) {
        return prev
      }
      return next
    })
  }, [annotationsProp])

  useEffect(() => {
    if (!catalogLandmarks.some((l) => l.id === catalogId)) {
      setCatalogId((current) =>
        current === defaultCatalogId ? current : defaultCatalogId,
      )
    }
  }, [plane, catalogId, defaultCatalogId])

  const { debounced: debouncedSave, flush: flushSave } = useDebouncedCallback(
    async (next: PhotoAnnotations) => {
      await Promise.resolve(onChange(next))
      setSaveStatus('saved')
    },
    350,
  )

  const commit = useCallback(
    (next: PhotoAnnotations) => {
      skipPropSyncRef.current = true
      setAnnotations((prev) => (prev === next ? prev : next))
      setSaveStatus('saving')
      debouncedSave(next)
    },
    [debouncedSave],
  )

  const commitWithHistory = useCallback(
    (next: PhotoAnnotations) => {
      recordBeforeChange(annotationsRef.current)
      commit(next)
    },
    [commit, recordBeforeChange],
  )

  const handleUndo = useCallback(() => {
    const restored = undoHistory(annotationsRef.current)
    if (restored) commit(restored)
  }, [commit, undoHistory])

  const handleRedo = useCallback(() => {
    const restored = redoHistory(annotationsRef.current)
    if (restored) commit(restored)
  }, [commit, redoHistory])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      } else if (e.key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo, handleRedo])

  useEffect(() => {
    return () => {
      if (previewFrameRef.current !== null) {
        cancelAnimationFrame(previewFrameRef.current)
      }
    }
  }, [])

  const updateImageView = useCallback(
    (view: ImageViewState) => {
      const current = annotationsRef.current
      if (
        current.imageView.panX === view.panX &&
        current.imageView.panY === view.panY &&
        current.imageView.zoom === view.zoom
      ) {
        return
      }
      commit({ ...current, imageView: view })
    },
    [commit],
  )

  const previewImageView = useCallback((view: ImageViewState) => {
    const current = annotationsRef.current
    if (
      current.imageView.panX === view.panX &&
      current.imageView.panY === view.panY &&
      current.imageView.zoom === view.zoom
    ) {
      return
    }
    skipPropSyncRef.current = true
    setAnnotations({ ...current, imageView: view })
  }, [])

  const panZoom = useImagePanZoom(imageView, updateImageView, previewImageView)

  const focusCanvasAfterSelect = useCallback(() => {
    requestAnimationFrame(() => {
      landmarkCatalogSelectRef.current?.blur()
      lineReferenceSelectRef.current?.blur()
      containerRef.current?.focus({ preventScroll: true })
    })
  }, [])

  const handleCatalogIdChange = useCallback(
    (value: string) => {
      setCatalogId(value)
      focusCanvasAfterSelect()
    },
    [focusCanvasAfterSelect],
  )

  const handleLineReferenceChange = useCallback(
    (value: string) => {
      setLineReference(value as LineMeasurementReference)
      focusCanvasAfterSelect()
    },
    [focusCanvasAfterSelect],
  )

  useEffect(() => {
    const pressed = new Set<string>()
    let rafId: number | null = null
    let modifiers = { shiftKey: false, altKey: false }

    const stepPx = () => {
      if (modifiers.altKey) return ARROW_PAN_STEP_PX.fine
      if (modifiers.shiftKey) return ARROW_PAN_STEP_PX.shift
      return ARROW_PAN_STEP_PX.normal
    }

    const flushPersist = () => {
      const view = annotationsRef.current.imageView
      updateImageView({ ...view })
    }

    const tick = () => {
      if (pressed.size === 0) {
        rafId = null
        return
      }

      let dx = 0
      let dy = 0
      const step = stepPx()
      if (pressed.has('ArrowLeft')) dx -= step
      if (pressed.has('ArrowRight')) dx += step
      if (pressed.has('ArrowUp')) dy -= step
      if (pressed.has('ArrowDown')) dy += step

      if (dx !== 0 || dy !== 0) {
        const view = annotationsRef.current.imageView
        previewImageView({
          ...view,
          panX: view.panX + dx,
          panY: view.panY + dy,
        })
      }

      rafId = requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    const syncModifiers = (e: KeyboardEvent) => {
      modifiers = { shiftKey: e.shiftKey, altKey: e.altKey }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      syncModifiers(e)
      if (!ARROW_PAN_KEYS.has(e.key)) return
      if (isArrowPanBlockedTarget(e.target)) return

      e.preventDefault()
      pressed.add(e.key)
      startLoop()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      syncModifiers(e)
      if (ARROW_PAN_KEYS.has(e.key)) {
        pressed.delete(e.key)
      }
      if (pressed.size === 0) {
        stopLoop()
        flushPersist()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('keyup', onKeyUp, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('keyup', onKeyUp, { capture: true })
      stopLoop()
      if (pressed.size > 0) {
        flushPersist()
      }
    }
  }, [previewImageView, updateImageView])

  const applyOverlayLive = useCallback(
    (patch: Partial<PhotoAnnotations['overlay']>) => {
      const current = annotationsRef.current
      skipPropSyncRef.current = true
      setAnnotations({
        ...current,
        overlay: { ...current.overlay, ...patch },
      })
    },
    [],
  )

  const updateOverlay = (patch: Partial<PhotoAnnotations['overlay']>) => {
    commit({
      ...annotationsRef.current,
      overlay: { ...annotationsRef.current.overlay, ...patch },
    })
  }

  const baseMetrics = useMemo(
    () =>
      containerSize.w > 0 && imageSize.w > 0
        ? computeImageDisplayMetrics(
            containerSize.w,
            containerSize.h,
            imageSize.w,
            imageSize.h,
          )
        : null,
    [containerSize.w, containerSize.h, imageSize.w, imageSize.h],
  )

  const imageRect = useMemo(
    () =>
      baseMetrics
        ? computeTransformedImageRect(baseMetrics, imageView)
        : null,
    [
      baseMetrics,
      imageView.panX,
      imageView.panY,
      imageView.zoom,
    ],
  )
  imageRectRef.current = imageRect

  const [coordImageRect, setCoordImageRect] = useState<TransformedImageRect | null>(
    null,
  )

  const syncCoordImageRect = useCallback(() => {
    const containerEl = containerRef.current
    const imgEl = imageRef.current
    if (!containerEl || !imgEl || !baseMetrics) {
      setCoordImageRect(null)
      return
    }
    setCoordImageRect(measureImageLayerRect(containerEl, imgEl, baseMetrics))
  }, [baseMetrics])

  useLayoutEffect(() => {
    syncCoordImageRect()
  }, [
    syncCoordImageRect,
    imageView.panX,
    imageView.panY,
    imageView.zoom,
    containerSize.w,
    containerSize.h,
    imageSize.w,
    imageSize.h,
  ])

  const effectiveImageRect = coordImageRect ?? imageRect
  imageRectRef.current = effectiveImageRect

  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth
    const h = el.clientHeight
    setContainerSize((prev) =>
      prev.w === w && prev.h === h ? prev : { w, h },
    )
  }, [])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(() => measure())
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [measure])

  const containerPoint = (clientX: number, clientY: number) => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const pointerToImageNorm = useCallback((clientX: number, clientY: number) => {
    const rect = imageRectRef.current
    if (!rect || !containerRef.current) return null
    const bounds = containerRef.current.getBoundingClientRect()
    return containerToImageNormClamped(
      clientX - bounds.left,
      clientY - bounds.top,
      rect,
    )
  }, [])

  const placeLandmarkAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!landmarkPlaceEnabled) return
      if (findLandmarkAt(clientX, clientY)) return
      const norm = pointerToImageNorm(clientX, clientY)
      if (!norm) return
      const entry = getLandmarkCatalogEntry(catalogId)
      if (!entry) return
      const placed = normalizePlacedLandmark(
        {
          id: crypto.randomUUID(),
          landmarkId: catalogId,
          position: norm,
          confidence: 1,
          detectionSource: 'manual',
        },
        plane,
      )
      commitWithHistory({
        ...annotations,
        landmarks: addManualLandmark(annotations.landmarks, placed),
      })
    },
    [
      landmarkPlaceEnabled,
      pointerToImageNorm,
      catalogId,
      plane,
      annotations,
      commitWithHistory,
    ],
  )

  const dragDebug = useCallback(
    (phase: 'start' | 'move' | 'end', detail: Record<string, unknown>) => {
      if (!DEBUG_LANDMARK_DRAG) return
      void phase
      void detail
    },
    [],
  )

  const safeLandmarks = useMemo(
    () =>
      getSynthposeDisplayLandmarks(annotations.landmarks, landmarkEditorMode, showAiProposals).filter(
        (l) =>
          l?.position &&
          Number.isFinite(l.position.x) &&
          Number.isFinite(l.position.y),
      ),
    [annotations.landmarks, landmarkEditorMode, showAiProposals],
  )

  const isProposalLandmark = useCallback(
    (id: string) => annotations.landmarks.autoProposals.some((l) => l.id === id),
    [annotations.landmarks.autoProposals],
  )

  const displayLandmarks = useMemo(() => {
    if (!dragPreview) return safeLandmarks
    return safeLandmarks.map((l) =>
      l.id === dragPreview.id ? { ...l, position: dragPreview.position } : l,
    )
  }, [safeLandmarks, dragPreview])

  const findLandmarkAt = (
    clientX: number,
    clientY: number,
    thresholdPx = LANDMARK_HIT_TEST_PX,
  ) => {
    const rect = imageRectRef.current
    if (!rect) return null
    const pt = containerPoint(clientX, clientY)
    if (!pt) return null
    for (const lm of displayLandmarks) {
      const px = imageNormToContainer(lm.position, rect)
      if (Math.hypot(px.x - pt.x, px.y - pt.y) <= thresholdPx) return lm
    }
    return null
  }

  const normalizedLandmarks = safeLandmarks.map((l) => ({
    ...l,
    landmarkId: normalizeLandmarkId(l),
  }))

  const biomechAxes = buildBiomechanicalAxes(plane, normalizedLandmarks)

  const removeLandmarkCascade = (id: string) => {
    commitWithHistory({
      ...annotations,
      landmarks: removeLandmarkById(annotations.landmarks, id),
      lines: annotations.lines.filter(
        (l) => l.landmarkAId !== id && l.landmarkBId !== id,
      ),
      angles: annotations.angles.filter(
        (a) =>
          a.landmarkAId !== id &&
          a.vertexLandmarkId !== id &&
          a.landmarkCId !== id,
      ),
    })
  }

  const handleLandmarkClick = (hit: PlacedLandmark) => {
    if (tool === 'line') {
      if (!pendingLineStart) {
        setPendingLineStart(hit.id)
        return
      }
      if (pendingLineStart === hit.id) {
        setPendingLineStart(null)
        return
      }
      const exists = annotations.lines.some(
        (l) =>
          (l.landmarkAId === pendingLineStart && l.landmarkBId === hit.id) ||
          (l.landmarkBId === pendingLineStart && l.landmarkAId === hit.id),
      )
      if (!exists) {
        commitWithHistory({
          ...annotations,
          lines: [
            ...annotations.lines,
            {
              id: crypto.randomUUID(),
              landmarkAId: pendingLineStart,
              landmarkBId: hit.id,
              reference: lineReference,
            },
          ],
        })
      }
      setPendingLineStart(null)
      return
    }
    if (tool === 'angle') {
      if (pendingAngle.includes(hit.id)) {
        return
      }
      const next = [...pendingAngle, hit.id]
      if (next.length === 3) {
        const [vertexId, armAId, armCId] = next
        if (new Set(next).size < 3) {
          setPendingAngle([])
          return
        }
        commitWithHistory({
          ...annotations,
          angles: [
            ...annotations.angles,
            {
              id: crypto.randomUUID(),
              landmarkAId: armAId,
              vertexLandmarkId: vertexId,
              landmarkCId: armCId,
            },
          ],
        })
        setPendingAngle([])
      } else {
        setPendingAngle(next)
      }
      return
    }
    if (tool === 'delete') removeLandmarkCascade(hit.id)
  }

  const handlePointerDownContainer = (e: React.PointerEvent) => {
    if (draggingRef || draggingId) return

    if (landmarkPlaceEnabled) {
      const hit = findLandmarkAt(e.clientX, e.clientY)
      if (hit) return
      if (e.button === 0 && !e.altKey) {
        placeLandmarkAt(e.clientX, e.clientY)
        e.preventDefault()
      }
      return
    }

    if (panImageMode || e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanningImage(true)
      panZoom.startPan(e)
      e.preventDefault()
    }
  }

  const flushDragPreview = useCallback(() => {
    dragRafRef.current = null
    const preview = dragPreviewRef.current
    if (!preview) return
    setDragPreview((prev) => {
      if (
        prev?.id === preview.id &&
        prev.position.x === preview.position.x &&
        prev.position.y === preview.position.y
      ) {
        return prev
      }
      return preview
    })
  }, [])

  const scheduleDragPreview = useCallback(
    (clientX: number, clientY: number, activeId: string) => {
      const norm = pointerToImageNorm(clientX, clientY)
      if (!norm) return
      dragPreviewRef.current = { id: activeId, position: norm }
      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(flushDragPreview)
      }
    },
    [pointerToImageNorm, flushDragPreview],
  )

  const confirmLandmark = useCallback(
    (id: string) => {
      commitWithHistory({
        ...annotationsRef.current,
        landmarks: confirmProposalById(annotationsRef.current.landmarks, id),
      })
    },
    [commitWithHistory],
  )

  const finishLandmarkDrag = useCallback(
    (ev?: PointerEvent) => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
      flushDragPreview()

      const preview = dragPreviewRef.current
      dragPreviewRef.current = null

      if (preview) {
        dragDebug('end', { id: preview.id, position: preview.position })
        const current = annotationsRef.current
        commitWithHistory({
          ...current,
          landmarks: updateLandmarkPosition(
            current.landmarks,
            preview.id,
            preview.position,
          ),
        })
      }
      setDragPreview(null)
      setDraggingId(null)

      const capture = dragCaptureRef.current
      if (capture && capture.el.hasPointerCapture(capture.pointerId)) {
        capture.el.releasePointerCapture(capture.pointerId)
      }
      dragCaptureRef.current = null

      if (
        ev &&
        containerRef.current?.hasPointerCapture(ev.pointerId) &&
        !capture
      ) {
        containerRef.current.releasePointerCapture(ev.pointerId)
      }
    },
    [commitWithHistory, dragDebug, flushDragPreview],
  )

  const deleteSelectedLandmark = useCallback(() => {
    if (!selectedLmId) return
    removeLandmarkCascade(selectedLmId)
    setSelectedLmId(null)
  }, [selectedLmId, removeLandmarkCascade])

  const startLandmarkDrag = useCallback(
    (e: React.PointerEvent, lm: PlacedLandmark) => {
      if (!landmarkDragEnabled) return
      e.preventDefault()
      e.stopPropagation()
      recordBeforeChange(annotationsRef.current)
      setSelectedLmId(lm.id)
      setDraggingId(lm.id)

      const captureEl = e.currentTarget as Element
      captureEl.setPointerCapture(e.pointerId)
      dragCaptureRef.current = { el: captureEl, pointerId: e.pointerId }

      const norm = pointerToImageNorm(e.clientX, e.clientY) ?? lm.position
      const preview = { id: lm.id, position: norm }
      dragPreviewRef.current = preview
      setDragPreview(preview)

      dragDebug('start', {
        id: lm.id,
        label: lm.label,
        position: norm,
        pointerId: e.pointerId,
      })
    },
    [landmarkDragEnabled, dragDebug, recordBeforeChange, pointerToImageNorm],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!selectedLmId || panImageMode || !landmarkDragEnabled) return
      const target = e.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }
      e.preventDefault()
      deleteSelectedLandmark()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedLmId, panImageMode, landmarkDragEnabled, deleteSelectedLandmark])

  const handlePointerMove = (e: React.PointerEvent) => {
    const needsLineAnglePreview =
      !panImageMode &&
      (tool === 'line' || tool === 'angle') &&
      (pendingLineStart !== null || pendingAngle.length > 0)

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      mouseInCanvasRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      if (previewFrameRef.current === null) {
        previewFrameRef.current = requestAnimationFrame(() => {
          previewFrameRef.current = null
          setMouseInCanvas(mouseInCanvasRef.current)
          if (needsLineAnglePreview) {
            setPreviewFrame((n) => n + 1)
          }
        })
      }
    }

    if (draggingRef && baseMetrics) {
      const pt = containerPoint(e.clientX, e.clientY)
      if (!pt) return
      if (draggingRef === 'gravity') {
        applyOverlayLive({
          gravityLineX: Math.max(
            0,
            Math.min(1, pt.x / baseMetrics.containerWidth),
          ),
        })
      } else {
        applyOverlayLive({
          horizontalRefY: Math.max(
            0,
            Math.min(1, pt.y / baseMetrics.containerHeight),
          ),
        })
      }
      return
    }

    if (draggingId && landmarkDragEnabled) {
      scheduleDragPreview(e.clientX, e.clientY, draggingId)
      return
    }

    if (draggingId) {
      return
    }

    panZoom.movePan(e)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      finishLandmarkDrag(e.nativeEvent)
      return
    }
    if (draggingRef) {
      commit({ ...annotationsRef.current })
      setDraggingRef(null)
      return
    }
    panZoom.endPan()
    setIsPanningImage(false)
  }

  /**
   * Drag landmark: pointer capture sul landmark + move sul container (bubble).
   * Nessun listener window — evita doppio aggiornamento per frame.
   */

  const handleCanvasPointerLeave = () => {
    mouseInCanvasRef.current = null
    setMouseInCanvas(null)
    if (draggingRef) {
      commit({ ...annotationsRef.current })
      setDraggingRef(null)
    }
    if (!draggingId) {
      panZoom.endPan()
      setIsPanningImage(false)
    }
  }

  const canvasCursorClass = cn(
    draggingId || dragPreview
      ? 'cursor-editor-grabbing'
      : isPanningImage
        ? (activeMode.canvasCursorActive ?? 'cursor-editor-grabbing')
        : activeMode.canvasCursor,
  )

  const handleClose = () => {
    flushSave(annotations)
    onClose()
  }

  const clearAll = () => {
    if (confirm('Rimuovere tutti landmark, linee e angoli da questa foto?')) {
      commitWithHistory({
        ...createEmptyAnnotations(),
        overlay: annotations.overlay,
        imageView: annotations.imageView,
      })
      setPendingLineStart(null)
      setPendingAngle([])
    }
  }

  const overlay = annotations.overlay
  const imageReady = imageSize.w > 0 && imageSize.h > 0
  const selectedCatalogEntry = getLandmarkCatalogEntry(catalogId)

  const previewEnd = useMemo(() => {
    void previewFrame
    const pt = mouseInCanvasRef.current
    if (!pt || !effectiveImageRect) return null
    return containerToImageNormClamped(pt.x, pt.y, effectiveImageRect)
  }, [previewFrame, mouseInCanvas, effectiveImageRect])

  const instructionText = getContextualInstruction(panImageMode, tool, {
    draggingId,
    draggingLandmarkLabel: draggingLandmark?.label,
    pendingLineStart,
    pendingAngleCount: pendingAngle.length,
    catalogLabel: selectedCatalogEntry?.label,
    selectedLandmarkLabel: displayLandmarks.find((l) => l.id === selectedLmId)?.label,
  })

  return (
    <ResizableDraggableModal
      title="Annotazione e analisi clinica"
      subtitle={`${planeLabel} · ${planeConfig.shortLabel}`}
      onClose={handleClose}
      headerActions={
        <>
          <span
            className={cn(
              'text-[10px]',
              saveStatus === 'saved' && 'text-emerald-600',
              saveStatus === 'saving' && 'text-amber-600',
            )}
          >
            {saveStatus === 'saved'
              ? 'Salvato'
              : saveStatus === 'saving'
                ? 'Salvataggio…'
                : ''}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={clearAll}>
            <Trash2 className="h-4 w-4" />
            Pulisci
          </Button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-end gap-2 border-b bg-clinical-50 px-4 py-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            title="Annulla (Ctrl+Z)"
            disabled={!canUndo || !!draggingId}
            onClick={handleUndo}
          >
            <Undo2 className="h-4 w-4" />
            Annulla
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            title="Ripristina (Ctrl+Shift+Z)"
            disabled={!canRedo || !!draggingId}
            onClick={handleRedo}
          >
            <Redo2 className="h-4 w-4" />
            Ripristina
          </Button>
          <span className="hidden h-8 w-px bg-slate-300 sm:inline" />
          <Button
            type="button"
            size="sm"
            title={PAN_IMAGE_MODE.tooltip}
            variant={panImageMode ? 'default' : 'outline'}
            className={cn(
              panImageMode &&
                'ring-2 ring-offset-2 ring-sky-400 shadow-md bg-sky-600 hover:bg-sky-700',
            )}
            onClick={() => {
              setPanImageMode(true)
              setSelectedLmId(null)
              setDraggingId(null)
              setDragPreview(null)
              setPendingLineStart(null)
              setPendingAngle([])
            }}
          >
            <Hand className="h-4 w-4" />
            Pan immagine
          </Button>
          {TOOLS.map((t) => {
            const modeUx = TOOL_MODE_UX[t.id]
            const isToolActive = !panImageMode && tool === t.id
            return (
              <Button
                key={t.id}
                type="button"
                size="sm"
                title={modeUx.tooltip}
                variant={isToolActive ? 'default' : 'outline'}
                className={cn(
                  isToolActive &&
                    cn(
                      'ring-2 ring-offset-2 shadow-md text-white hover:opacity-90',
                      modeUx.toolRing,
                      modeUx.toolBg,
                    ),
                )}
                onClick={() => {
                  setPanImageMode(false)
                  setTool(t.id)
                  setDraggingId(null)
                  setDragPreview(null)
                  setPendingLineStart(null)
                  setPendingAngle([])
                }}
              >
                {t.icon}
                {t.label}
              </Button>
            )
          })}
          {selectedLmId && landmarkDragEnabled && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              title="Elimina landmark selezionato (Canc/Backspace)"
              onClick={deleteSelectedLandmark}
            >
              <Trash2 className="h-4 w-4" />
              Elimina selezionato
            </Button>
          )}
          {!panImageMode && tool === 'line' && (
            <Select
              value={lineReference}
              onValueChange={handleLineReferenceChange}
            >
              <SelectTrigger ref={lineReferenceSelectRef} className="h-8 max-w-[240px]">
                <SelectValue placeholder="Riferimento pendenza" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal">
                  {LINE_REFERENCE_LABELS.horizontal}
                </SelectItem>
                <SelectItem value="gravity_vertical">
                  {LINE_REFERENCE_LABELS.gravity_vertical}
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          {!panImageMode && tool === 'landmark' && catalogLandmarks.length > 0 && (
            <Select value={catalogId} onValueChange={handleCatalogIdChange}>
              <SelectTrigger ref={landmarkCatalogSelectRef} className="h-8 max-w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {catalogLandmarks.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: LANDMARK_CATEGORY_COLORS[l.category],
                      }}
                    />
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => panZoom.setZoom(imageView.zoom / 1.15)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <input
              type="range"
              min={panZoom.MIN_ZOOM * 100}
              max={panZoom.MAX_ZOOM * 100}
              value={imageView.zoom * 100}
              onChange={(e) =>
                panZoom.setZoom(Number(e.target.value) / 100)
              }
              className="w-28"
            />
            <span className="w-10 text-xs text-slate-600">
              {Math.round(imageView.zoom * 100)}%
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => panZoom.setZoom(imageView.zoom * 1.15)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (!baseMetrics) return
              updateImageView(centerImageInContainer(baseMetrics, imageView))
            }}
            disabled={!baseMetrics}
            title="Centra la foto nel riquadro di analisi (mantiene lo zoom attuale)"
          >
            <Focus className="h-4 w-4" />
            Centra nella card
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={panZoom.fitToFrame}
          >
            <Maximize2 className="h-4 w-4" />
            Adatta al riquadro
          </Button>
          <div className="flex items-center gap-2 border-l pl-2">
            <Label className="text-xs">X</Label>
            <Input
              type="number"
              className="h-8 w-16 text-xs"
              value={Math.round(imageView.panX)}
              onChange={(e) =>
                updateImageView({
                  ...imageView,
                  panX: Number(e.target.value) || 0,
                })
              }
            />
            <Label className="text-xs">Y</Label>
            <Input
              type="number"
              className="h-8 w-16 text-xs"
              value={Math.round(imageView.panY)}
              onChange={(e) =>
                updateImageView({
                  ...imageView,
                  panY: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <p
            className="text-[10px] text-slate-500"
            title="Frecce tastiera: sposta immagine · Shift: veloce · Alt: fine"
          >
            Frecce tastiera: sposta immagine · Shift: veloce · Alt: fine
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={overlay.showGrid}
              onChange={(e) => updateOverlay({ showGrid: e.target.checked })}
            />
            Griglia (fissa)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={overlay.showGravityLine}
              onChange={(e) =>
                updateOverlay({ showGravityLine: e.target.checked })
              }
            />
            <span className="text-red-600">Linea gravitazionale</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={overlay.showHorizontalRef}
              onChange={(e) =>
                updateOverlay({ showHorizontalRef: e.target.checked })
              }
            />
            <span className="text-cyan-600">Linea orizzontale</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={overlay.snapEnabled}
              onChange={(e) => updateOverlay({ snapEnabled: e.target.checked })}
            />
            <Magnet className="h-3 w-3" />
            Snapping
          </label>
          <Button
            type="button"
            size="sm"
            variant={clinicalPanelOpen ? 'default' : 'outline'}
            className="ml-auto"
            onClick={() => setClinicalPanelOpen((o) => !o)}
          >
            <ClipboardList className="h-4 w-4" />
            Alterazioni / Analisi
          </Button>
        </div>

        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs transition-colors',
            draggingId
              ? 'bg-violet-100 text-violet-900'
              : 'bg-amber-50 text-amber-900',
          )}
          title={activeMode.tooltip}
        >
          <span className="flex items-center gap-2 font-medium">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
              style={{ backgroundColor: activeMode.cursorAccent }}
            />
            {activeMode.label}
          </span>
          <span className="text-[11px] opacity-90">{instructionText}</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            ref={containerRef}
            tabIndex={-1}
            className={cn(
              'relative min-h-[300px] flex-1 overflow-hidden bg-slate-900 outline-none lg:min-h-0',
              canvasCursorClass,
            )}
            title={activeMode.tooltip}
            onWheel={(e) => {
              if (containerRef.current && baseMetrics) {
                panZoom.handleWheel(
                  e,
                  containerRef.current.getBoundingClientRect(),
                  baseMetrics,
                )
              }
            }}
            onPointerDown={handlePointerDownContainer}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e)}
            onPointerLeave={handleCanvasPointerLeave}
          >
            {mouseInCanvas && !draggingId && !isPanningImage && (
              <div
                className="pointer-events-none absolute z-40"
                style={{
                  left: mouseInCanvas.x,
                  top: mouseInCanvas.y,
                }}
              >
                <div
                  className="h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: activeMode.cursorAccent }}
                />
              </div>
            )}

            <div className="pointer-events-none absolute left-3 top-3 z-40 max-w-[min(100%,280px)]">
              <div
                className="rounded-lg border border-white/20 bg-slate-900/85 px-3 py-2 text-white shadow-lg backdrop-blur-sm"
                title={activeMode.tooltip}
              >
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Modalità attiva
                </p>
                <p className="text-sm font-semibold">{activeMode.shortLabel}</p>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  {instructionText}
                </p>
              </div>
            </div>

            {draggingId && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-50 -translate-x-1/2">
                <div className="flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg ring-2 ring-violet-300">
                  <Move className="h-4 w-4 animate-pulse" />
                  Drag landmark attivo
                  {draggingLandmark && (
                    <span className="font-normal opacity-90">
                      — {draggingLandmark.shortLabel}
                    </span>
                  )}
                </div>
              </div>
            )}

            {containerSize.w > 0 && (
              <FrameOverlaySvg
                containerWidth={containerSize.w}
                containerHeight={containerSize.h}
                overlay={overlay}
              />
            )}

            {overlay.showGravityLine && tool === 'select' && !panImageMode && (
              <div
                className="absolute z-30 w-4 -translate-x-1/2 cursor-ew-resize rounded bg-red-500/70"
                style={{
                  left: overlay.gravityLineX * containerSize.w,
                  top: 0,
                  height: containerSize.h,
                  pointerEvents: 'auto',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setDraggingRef('gravity')
                  ;(e.target as Element).setPointerCapture(e.pointerId)
                }}
              />
            )}
            {overlay.showHorizontalRef && tool === 'select' && !panImageMode && (
              <div
                className="absolute z-30 h-4 -translate-y-1/2 cursor-ns-resize rounded bg-cyan-500/70"
                style={{
                  top: overlay.horizontalRefY * containerSize.h,
                  left: 0,
                  width: containerSize.w,
                  pointerEvents: 'auto',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setDraggingRef('horizontal')
                  ;(e.target as Element).setPointerCapture(e.pointerId)
                }}
              />
            )}

            {imageRect && (
              <>
                <div
                  className="pointer-events-none absolute z-10 overflow-visible"
                  style={{
                    left: imageRect.left,
                    top: imageRect.top,
                    width: imageRect.width,
                    height: imageRect.height,
                  }}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={planeLabel}
                    className="pointer-events-none h-full w-full select-none object-contain"
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget
                      const w = img.naturalWidth
                      const h = img.naturalHeight
                      setImageSize((prev) =>
                        prev.w === w && prev.h === h ? prev : { w, h },
                      )
                      measure()
                      syncCoordImageRect()
                    }}
                  />
                  <BiomechanicalAxesLayer axes={biomechAxes} />
                </div>
                <div
                  className="pointer-events-none absolute z-[32] overflow-visible"
                  style={{
                    left: imageRect.left,
                    top: imageRect.top,
                    width: imageRect.width,
                    height: imageRect.height,
                  }}
                >
                  <ImageAnnotationsSvg
                    annotations={annotations}
                    getLandmark={(id) => findLandmarkById(annotations.landmarks, id)}
                  />
                  {!panImageMode &&
                    (tool === 'line' || tool === 'angle') &&
                    (pendingLineStart || pendingAngle.length > 0) && (
                      <AnnotationDrawingPreview
                        pendingLineStartId={pendingLineStart}
                        pendingAngleIds={pendingAngle}
                        previewEnd={previewEnd}
                        lineReference={lineReference}
                        getLandmark={(id) =>
                          displayLandmarks.find((l) => l.id === id)
                        }
                      />
                    )}
                </div>
              </>
            )}

            {!imageReady && (
              <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                <p className="text-sm">Caricamento immagine…</p>
              </div>
            )}

            {synthposeDebug && effectiveImageRect && <SynthPoseDebugOverlay result={synthposeDebug} rect={effectiveImageRect} />}
            {effectiveImageRect &&
              displayLandmarks.map((lm) => {
                const lid = normalizeLandmarkId(lm)
                const def = getLandmarkDefinition(lid)
                const categoryColor =
                  LANDMARK_CATEGORY_COLORS[lm.category] ?? def.color
                const color = landmarkSourceColor(
                  lm,
                  categoryColor,
                  isProposalLandmark(lm.id),
                )
                const px = imageNormToContainer(lm.position, effectiveImageRect)
                const isPending =
                  pendingLineStart === lm.id || pendingAngle.includes(lm.id)
                const isActive = selectedLmId === lm.id
                const isDragging = draggingId === lm.id
                const isHighlighted =
                  isActive || isDragging || hoveredId === lm.id || isPending
                const canInteract = !panImageMode
                const showGrab = landmarkDragEnabled && !isDragging
                const isEstimated = isProposalLandmark(lm.id)
                const showIndicator =
                  isEstimated || isActive || hoveredId === lm.id || isDragging
                return (
                  <div
                    key={lm.id}
                    className={cn(
                      'absolute z-[45] touch-none -translate-x-1/2 -translate-y-1/2',
                      canInteract ? 'pointer-events-auto' : 'pointer-events-none',
                      showGrab && 'cursor-grab',
                      isDragging && 'cursor-grabbing will-change-[left,top]',
                      tool === 'delete' && canInteract && 'cursor-not-allowed',
                    )}
                    style={{
                      left: px.x,
                      top: px.y,
                      width: LANDMARK_HITBOX_PX,
                      height: LANDMARK_HITBOX_PX,
                    }}
                    title={
                      landmarkDragEnabled
                        ? `${lm.label} — clic per selezionare, trascina per spostare`
                        : lm.label
                    }
                    onPointerDown={(e) => {
                      if (!canInteract) return
                      e.stopPropagation()
                      if (landmarkDragEnabled) {
                        startLandmarkDrag(e, lm)
                        return
                      }
                      if (tool === 'delete') {
                        e.preventDefault()
                        removeLandmarkCascade(lm.id)
                        return
                      }
                      setSelectedLmId(lm.id)
                    }}
                    onPointerEnter={() => setHoveredId(lm.id)}
                    onPointerLeave={() => setHoveredId(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (canInteract && (tool === 'line' || tool === 'angle')) {
                        handleLandmarkClick(lm)
                      }
                    }}
                  >
                    {showIndicator && (
                      <LandmarkVisualIndicator
                        landmark={lm}
                        expanded={isActive || isDragging}
                      />
                    )}
                    <div className="flex h-full w-full items-center justify-center">
                      <div
                        className={cn(
                          'flex items-center justify-center rounded-full font-bold text-white',
                          isDragging ? 'h-5 w-5' : 'h-3.5 w-3.5',
                          isHighlighted
                            ? cn(
                                'border-[3px] border-white shadow-lg',
                                'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-900/80',
                                'outline outline-2 outline-dashed outline-white/90',
                                isEstimated &&
                                  'ring-amber-400 outline-amber-200/80',
                              )
                            : cn(
                                'border-2 border-white shadow',
                                isEstimated &&
                                  landmarkSourceRingClass(lm, true),
                              ),
                          !isDragging &&
                            'transition-[transform,box-shadow] duration-75',
                        )}
                        style={{ backgroundColor: color }}
                      >
                          <span className="text-[7px] leading-none">
                            {(lm.shortLabel ?? 'LM').slice(0, 2)}
                          </span>
                      </div>
                    </div>
                    {isEstimated && isActive && landmarkDragEnabled && (
                      <button
                        type="button"
                        className="absolute left-1/2 top-full z-[37] mt-6 flex -translate-x-1/2 items-center gap-0.5 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-900 shadow hover:bg-emerald-100"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          confirmLandmark(lm.id)
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Conferma
                      </button>
                    )}
                  </div>
                )
              })}

            {!imageRect && (
              <img
                src={imageUrl}
                alt=""
                className="hidden"
                onLoad={(e) => {
                  const img = e.currentTarget
                  const w = img.naturalWidth
                  const h = img.naturalHeight
                  setImageSize((prev) =>
                    prev.w === w && prev.h === h ? prev : { w, h },
                  )
                  measure()
                }}
              />
            )}
          </div>

          {clinicalPanelOpen && (
            <aside className="flex w-full min-h-0 max-h-[min(100%,720px)] shrink-0 flex-col border-t border-slate-200 lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l xl:w-96">
              <SynthPosePanel image={imageUrl} plane={plane} collection={annotations.landmarks}
                visible={showAiProposals} onVisibleChange={setShowAiProposals} onDebug={setSynthposeDebug}
                onProposals={proposals => commitWithHistory({ ...annotationsRef.current, landmarks: mergeSynthposeProposals(annotationsRef.current.landmarks, proposals) })}
                onAccept={id => commitWithHistory({ ...annotationsRef.current, landmarks: acceptSynthposeProposal(annotationsRef.current.landmarks, id) })}
                onAcceptReliable={() => commitWithHistory({ ...annotationsRef.current, landmarks: acceptReliableSynthposeProposals(annotationsRef.current.landmarks) })}
                onReject={id => removeLandmarkCascade(id)}
                onMove={id => { setTool('select'); setPanImageMode(false); setSelectedLmId(id) }} />
              <AnnotationClinicalPanel
                plane={plane}
                assessment={planeAssessment}
                landmarkCollection={annotations.landmarks}
                onAssessmentChange={onPlaneAssessmentChange}
                calibration={calibration}
                subjectHeightCm={subjectHeightCm}
                gravityLineX={annotations.overlay.gravityLineX}
              />
              <div className="shrink-0 border-t border-slate-200">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-clinical-800 hover:bg-slate-50"
                  onClick={() => setLandmarkToolsOpen((v) => !v)}
                >
                  <span>Strumenti landmark</span>
                  {landmarkToolsOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                </button>
                {landmarkToolsOpen && (
                  <div className="max-h-64 overflow-y-auto border-t border-slate-100">
                    <LandmarkEditor
                      plane={plane}
                      collection={annotations.landmarks}
                      mode={landmarkEditorMode}
                      onModeChange={setLandmarkEditorMode}
                      onCollectionChange={(landmarks) =>
                        commitWithHistory({ ...annotations, landmarks })
                      }
                      calibration={calibration ?? createDefaultCalibration()}
                      subjectHeightCm={subjectHeightCm}
                      onCalibrationChange={(next) => onCalibrationChange?.(next)}
                      onSubjectHeightChange={onSubjectHeightChange}
                    />
                    <CollapsibleLandmarkPanel
                      landmarks={getAllLandmarks(annotations.landmarks)}
                      onRemove={removeLandmarkCascade}
                      defaultOpen={false}
                    />
                  </div>
                )}
              </div>
              <p className="shrink-0 border-t px-3 py-2 text-[10px] text-slate-500">
                Zoom {Math.round(imageView.zoom * 100)}% · Pan (
                {Math.round(imageView.panX)}, {Math.round(imageView.panY)}) · Frecce
                spostano immagine
              </p>
            </aside>
          )}
        </div>
      </div>
    </ResizableDraggableModal>
  )
}

export function PhotoAnnotationEditor(props: PhotoAnnotationEditorProps) {
  return (
    <EditorErrorBoundary onClose={props.onClose}>
      <PhotoAnnotationEditorInner {...props} />
    </EditorErrorBoundary>
  )
}
