import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ClipboardPaste,
  Copy,
  Columns2,
  ImagePlus,
  MapPin,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import type { PhotoSlot, PhotoSnapshot, PlaneAssessment } from '@/types'
import { createEmptyAnnotations, PLANE_LABELS } from '@/types'
import { PhotoAnnotationEditor } from '@/components/PhotoAnnotationEditor'
import { PhotoAnnotationPreview } from '@/components/PhotoAnnotationPreview'
import { PhotoComparisonView } from '@/components/PhotoComparisonView'
import { acquirePlanePhoto, beginClipboardImageRead, canHandlePhotoClipboard, hasPhotoClipboardOverlay, copyPhotoToClipboard, PHOTO_ACCEPT, readClipboardPhoto, SELECT_PHOTO_PLANE, type ClipboardImageRequest } from '@/utils/photoClipboard'
import { countLandmarks } from '@/utils/landmarkCollection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PhotoUploadPanelProps {
  photos: PhotoSlot[]
  planeAssessments: PlaneAssessment[]
  defaultSubjectHeightCm?: number
  onChange: (photos: PhotoSlot[]) => void | Promise<void>
  onPlaneAssessmentsChange: (assessments: PlaneAssessment[]) => void | Promise<void>
  onDefaultSubjectHeightChange?: (heightCm: number | undefined) => void
  onPersistFlush?: () => void | Promise<void>
}

export function PhotoUploadPanel({
  photos,
  planeAssessments,
  defaultSubjectHeightCm,
  onChange,
  onPlaneAssessmentsChange,
  onDefaultSubjectHeightChange,
  onPersistFlush,
}: PhotoUploadPanelProps) {
  const [annotatingPlane, setAnnotatingPlane] = useState<PhotoSlot['plane'] | null>(
    null,
  )
  const [comparingPlane, setComparingPlane] = useState<PhotoSlot['plane'] | null>(
    null,
  )

  const updatePhoto = (plane: PhotoSlot['plane'], patch: Partial<PhotoSlot>) => {
    onChange(
      photos.map((p) => (p.plane === plane ? { ...p, ...patch } : p)),
    )
  }

  const updatePlaneAssessment = (assessment: PlaneAssessment) => {
    onPlaneAssessmentsChange(
      planeAssessments.map((p) =>
        p.plane === assessment.plane ? assessment : p,
      ),
    )
  }

  const [selectedPlane, setSelectedPlane] = useState<PhotoSlot['plane'] | null>(null)
  const [message, setMessage] = useState('')
  const [clipboardError, setClipboardError] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mountedRef = useRef(false)
  const photosRef = useRef(photos)
  const panelRef = useRef<HTMLDivElement>(null)
  const pendingPasteRef = useRef<{ plane: PhotoSlot['plane']; request: ClipboardImageRequest } | null>(null)
  const pasteTargetRef = useRef<HTMLDivElement>(null)
  const [nativePasteNeeded, setNativePasteNeeded] = useState(false)
  useEffect(() => {
    if (nativePasteNeeded) pasteTargetRef.current?.focus()
  }, [nativePasteNeeded])
  useEffect(() => { photosRef.current = photos }, [photos])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; pendingPasteRef.current?.request.cancel(); pendingPasteRef.current = null }
  }, [])

  const runPhotoOperation = useCallback(async (work: () => Promise<string>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('Operazione immagine in corso… Se Safari mostra il menu Incolla, conferma lì.')
    setClipboardError(false)
    try {
      const result = await work()
      if (mountedRef.current) setMessage(result)
    } catch (error) {
      if (mountedRef.current) {
        setClipboardError(true)
        setMessage(error instanceof Error ? error.message : 'Operazione immagine non riuscita.')
      }
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }, [])

  const acquirePhoto = useCallback(async (plane: PhotoSlot['plane'], blob: Blob, name?: string) => {
    const changed = await acquirePlanePhoto({
      blob, name, plane, getPhotos: () => photosRef.current,
      confirmReplace: () => mountedRef.current && confirm(`Sostituire la foto di ${PLANE_LABELS[plane]}? Landmark, calibrazione e snapshot prima del piano verranno azzerati. Le revisioni già salvate sul Lexar restano conservate.`),
      commit: async next => { if (mountedRef.current) await onChange(next) },
    })
    return changed ? `Foto acquisita per ${PLANE_LABELS[plane]}.` : 'Sostituzione annullata: foto conservata.'
  }, [onChange])

  const handleFile = (plane: PhotoSlot['plane'], file: File) => {
    setSelectedPlane(plane)
    void runPhotoOperation(() => acquirePhoto(plane, file, file.name))
  }
  const importClipboardPhoto = useCallback(async (plane: PhotoSlot['plane'], source: Promise<Blob>) => {
    let blob: Blob
    try { blob = await source } catch (error) {
      if (mountedRef.current) setNativePasteNeeded(true)
      throw error
    }
    if (mountedRef.current) setNativePasteNeeded(false)
    return acquirePhoto(plane, blob, 'name' in blob && typeof blob.name === 'string' ? blob.name : undefined)
  }, [acquirePhoto])

  const pastePhoto = useCallback((plane: PhotoSlot['plane']) => {
    setSelectedPlane(plane)
    void runPhotoOperation(async () => {
      // Start inside the original gesture; a timeout must never initiate read() in Safari.
      const request = beginClipboardImageRead()
      pendingPasteRef.current = { plane, request }
      try { return await importClipboardPhoto(plane, request.result) }
      finally { if (pendingPasteRef.current?.request === request) pendingPasteRef.current = null }
    })
  }, [importClipboardPhoto, runPhotoOperation])

  const consumePaste = useCallback((data: DataTransfer | null) => {
    if (pendingPasteRef.current) {
      pendingPasteRef.current.request.offerNative(data)
      return
    }
    if (!selectedPlane || !photosRef.current.some(p => p.plane === selectedPlane)) {
      setClipboardError(true)
      setMessage(SELECT_PHOTO_PLANE)
      return
    }
    const plane = selectedPlane
    void runPhotoOperation(() => importClipboardPhoto(plane, readClipboardPhoto(data)))
  }, [selectedPlane, importClipboardPhoto, runPhotoOperation])
  const copyPhoto = useCallback((photo: PhotoSlot) => {
    setSelectedPlane(photo.plane)
    void runPhotoOperation(async () => {
      if (!photo.dataUrl) throw new Error('Il piano selezionato non contiene una foto.')
      await copyPhotoToClipboard(photo.dataUrl)
      return 'Foto copiata negli Appunti come immagine PNG. Puoi incollarla in un’altra applicazione.'
    })
  }, [runPhotoOperation])

  useEffect(() => {
    const allowed = (event: Event) => canHandlePhotoClipboard(event, Boolean(annotatingPlane || comparingPlane))
    const paste = (event: ClipboardEvent) => {
      if (!allowed(event)) return
      event.preventDefault()
      consumePaste(event.clipboardData)
    }
    const keydown = (event: KeyboardEvent) => {
      if (!allowed(event) || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.repeat) return
      const key = event.key.toLowerCase()
      if (key === 'v') {
        if (!selectedPlane || !photosRef.current.some(p => p.plane === selectedPlane)) {
          setClipboardError(true)
          setMessage(SELECT_PHOTO_PLANE)
          return
        }
        // Keep the browser's native paste action. Its image wins over the async read.
        pastePhoto(selectedPlane)
        return
      }
      if (key !== 'c' || !window.getSelection()?.isCollapsed) return
      const photo = photosRef.current.find(p => p.plane === selectedPlane)
      if (!photo?.dataUrl) return
      event.preventDefault()
      copyPhoto(photo)
    }
    document.addEventListener('paste', paste)
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('paste', paste)
      document.removeEventListener('keydown', keydown)
    }
  }, [selectedPlane, annotatingPlane, comparingPlane, consumePaste, pastePhoto, copyPhoto])

  const removePhoto = (plane: PhotoSlot['plane']) => {
    updatePhoto(plane, {
      dataUrl: undefined,
      imageUrl: undefined,
      photoUrl: undefined,
      src: undefined,
      originalPath: undefined,
      calibration: undefined,
      fileName: undefined,
      annotations: createEmptyAnnotations(),
      baseline: undefined,
    })
  }

  const saveBaseline = (photo: PhotoSlot) => {
    if (!photo.dataUrl) return
    const snapshot: PhotoSnapshot = {
      id: crypto.randomUUID(),
      dataUrl: photo.dataUrl,
      fileName: photo.fileName,
      annotations: structuredClone(photo.annotations),
      capturedAt: new Date().toISOString(),
      label: 'Prima trattamento',
    }
    updatePhoto(photo.plane, { baseline: snapshot })
  }

  const clearBaseline = (plane: PhotoSlot['plane']) => {
    if (confirm('Rimuovere lo snapshot prima trattamento?')) {
      updatePhoto(plane, { baseline: undefined })
    }
  }

  const annotatingPhoto = annotatingPlane
    ? photos.find((p) => p.plane === annotatingPlane)
    : null

  const comparingPhoto = comparingPlane
    ? photos.find((p) => p.plane === comparingPlane)
    : null

  return (
    <>
      <div ref={panelRef} aria-busy={busy}>
      <Card>
        <CardHeader>
          <CardTitle>Upload fotografie</CardTitle>
          <CardDescription>
            Carica le immagini, annota landmark con griglia e riferimenti
            biomeccanici. Salva uno snapshot &quot;prima&quot; per il confronto
            post-trattamento.
          </CardDescription>
          <p className="text-xs text-slate-600">Seleziona un piano, poi usa Command+V / Ctrl+V per incollare e Command+C / Ctrl+C per copiare la foto. PNG, JPEG, WebP, GIF; BMP/TIFF se supportati. Massimo 20 MB e 40 megapixel.</p>
          <p className="text-sm font-medium" aria-live="polite">{selectedPlane ? `Piano selezionato: ${PLANE_LABELS[selectedPlane]}` : 'Nessun piano selezionato: scegli il piano di destinazione.'}</p>
          {message && <p role={clipboardError ? 'alert' : 'status'} className={clipboardError ? 'text-sm text-red-700' : 'text-sm text-clinical-700'}>{message}</p>}
          {nativePasteNeeded && <div className="rounded border border-clinical-300 p-3 text-sm">
            <p>Incolla qui con Command+V oppure con il comando Modifica → Incolla di Safari.</p>
            <div ref={pasteTargetRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Area incolla foto" tabIndex={0} className="mt-2 min-h-10 rounded border border-dashed p-2 focus:ring-2 focus:ring-clinical-500" onBeforeInput={event => event.preventDefault()} onDrop={event => event.preventDefault()} onPaste={event => {
              if (annotatingPlane || comparingPlane || hasPhotoClipboardOverlay() || event.defaultPrevented) return
              event.preventDefault()
              event.stopPropagation()
              consumePaste(event.clipboardData)
            }} />
          </div>}
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => {
            const { lines, angles } = photo.annotations
            const landmarkCount = countLandmarks(photo.annotations.landmarks)
            const annotationCount =
              landmarkCount + lines.length + angles.length

            return (
              <div
                key={photo.plane}
                role="group"
                aria-label={PLANE_LABELS[photo.plane]}
                onClick={() => setSelectedPlane(photo.plane)}
                className={`flex flex-col gap-3 rounded-lg border p-4 ${selectedPlane === photo.plane ? 'border-clinical-600 ring-2 ring-clinical-500 bg-clinical-50/50' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button type="button" aria-pressed={selectedPlane === photo.plane} className="text-left text-sm font-semibold text-clinical-800 underline focus-visible:ring-2" onClick={() => setSelectedPlane(photo.plane)}>
                      {PLANE_LABELS[photo.plane]}{selectedPlane === photo.plane ? ' · Selezionato' : ' · Seleziona'}
                    </button>
                    {photo.fileName && (
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">
                        {photo.fileName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {annotationCount > 0 && (
                      <Badge variant="default" className="text-[10px]">
                        {landmarkCount} LM
                      </Badge>
                    )}
                    {photo.baseline && (
                      <Badge variant="outline" className="text-[10px]">
                        Prima salvata
                      </Badge>
                    )}
                    {photo.dataUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={() => removePhoto(photo.plane)}
                        aria-label="Rimuovi immagine"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50">
                  {photo.dataUrl ? (
                    <>
                      <img
                        src={photo.dataUrl}
                        alt={PLANE_LABELS[photo.plane]}
                        className="h-full w-full object-contain"
                      />
                      <PhotoAnnotationPreview
                        imageUrl={photo.dataUrl}
                        annotations={photo.annotations}
                        className="absolute inset-0"
                        useCenteredView
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <ImagePlus className="h-10 w-10" />
                      <span className="text-xs">Nessuna immagine</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[100px]"
                    asChild
                  >
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4" />
                      {photo.dataUrl ? 'Sostituisci' : 'Carica'}
                      <input
                        type="file"
                        accept={PHOTO_ACCEPT}
                        aria-label={`Carica foto ${PLANE_LABELS[photo.plane]}`}
                        disabled={busy}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFile(photo.plane, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => pastePhoto(photo.plane)} aria-label={`Incolla foto ${PLANE_LABELS[photo.plane]}`}>
                    <ClipboardPaste className="h-4 w-4" /> Incolla foto
                  </Button>
                  {photo.dataUrl && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => copyPhoto(photo)} aria-label={`Copia foto ${PLANE_LABELS[photo.plane]}`}>
                    <Copy className="h-4 w-4" /> Copia foto
                  </Button>}
                  {photo.dataUrl && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="flex-1 min-w-[100px]"
                      disabled={busy}
                      onClick={() => setAnnotatingPlane(photo.plane)}
                    >
                      <MapPin className="h-4 w-4" />
                      Annota
                    </Button>
                  )}
                </div>

                {photo.dataUrl && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => saveBaseline(photo)}
                    >
                      <Save className="h-3 w-3" />
                      Salva prima
                    </Button>
                    {photo.baseline && (
                      <>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setComparingPlane(photo.plane)}
                        >
                          <Columns2 className="h-3 w-3" />
                          Confronta
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-600"
                          onClick={() => clearBaseline(photo.plane)}
                        >
                          × Prima
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Note piano</Label>
                  <Textarea
                    value={photo.note}
                    onChange={(e) =>
                      updatePhoto(photo.plane, { note: e.target.value })
                    }
                    placeholder="Osservazioni fotografiche..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
      </div>

      {annotatingPhoto?.dataUrl && (
        <PhotoAnnotationEditor
          imageUrl={annotatingPhoto.dataUrl}
          plane={annotatingPhoto.plane}
          planeLabel={PLANE_LABELS[annotatingPhoto.plane]}
          annotations={annotatingPhoto.annotations}
          onChange={(annotations) =>
            updatePhoto(annotatingPhoto.plane, { annotations })
          }
          planeAssessment={
            planeAssessments.find((p) => p.plane === annotatingPhoto.plane) ?? {
              plane: annotatingPhoto.plane,
              alterations: [],
            }
          }
          onPlaneAssessmentChange={updatePlaneAssessment}
          calibration={annotatingPhoto.calibration}
          onCalibrationChange={(calibration) =>
            updatePhoto(annotatingPhoto.plane, { calibration })
          }
          subjectHeightCm={
            annotatingPhoto.calibration?.subjectHeightCm ?? defaultSubjectHeightCm
          }
          onSubjectHeightChange={(heightCm) => {
            onDefaultSubjectHeightChange?.(heightCm)
            updatePhoto(annotatingPhoto.plane, {
              calibration: {
                ...(annotatingPhoto.calibration ?? { mode: 'subject_height', status: 'unavailable' }),
                mode: 'subject_height',
                subjectHeightCm: heightCm,
                cmPerNormalizedUnit: heightCm,
                status: heightCm ? 'estimated' : 'unavailable',
              },
            })
          }}
          onClose={() => {
            void onPersistFlush?.()
            setAnnotatingPlane(null)
          }}
        />
      )}

      {comparingPhoto?.baseline && comparingPhoto.dataUrl && (
        <PhotoComparisonView
          photo={comparingPhoto}
          onClose={() => setComparingPlane(null)}
        />
      )}
    </>
  )
}
