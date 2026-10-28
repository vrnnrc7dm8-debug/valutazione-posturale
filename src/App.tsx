import { exportReportHtml } from '@/utils/reportHtml'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Archive,
  FileJson,
  FileText,
  RefreshCw,
  Stethoscope,
} from 'lucide-react'
import type { Assessment } from '@/types'
import { generateAssessmentReport, isReportStale } from '@/utils/reportGeneration'
import { exportAssessmentJson, exportTextReport } from '@/utils/export'
import { formatExportWarningsSummary } from '@/utils/exportWarnings'
import { exportPatientZip } from '@/utils/patientExport'
import { commitPatientImport } from '@/storage/clinicalStorage'
import { PatientImport } from '@/components/PatientImport'
import {
  clearActiveAssessment,
  initializeClinicalStorage,
  saveAssessmentToStorage,
  StorageQuotaError,
} from '@/storage/clinicalStorage'
import { createEmptyAssessment } from '@/utils/storage'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { PatientArchive } from '@/components/PatientArchive'
import { PatientForm } from '@/components/PatientForm'
import { PhotoUploadPanel } from '@/components/PhotoUploadPanel'
import { PosturalPlaneAssessment } from '@/components/PosturalPlaneAssessment'
import { ClinicalReport } from '@/components/ClinicalReport'
import { SummarySidebar } from '@/components/SummarySidebar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const PERSIST_DEBOUNCE_MS = 650

function App() {
  const [assessment, setAssessment] = useState<Assessment>(createEmptyAssessment)
  const assessmentRef = useRef(assessment)
  const saveWaitersRef = useRef<Array<() => void>>([])
  const persistChainRef = useRef(Promise.resolve())
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [password, setPassword] = useState('')
  const [activeSection, setActiveSection] = useState('archivio')
  const [exportingPatient, setExportingPatient] = useState(false)
  const [importingPatient, setImportingPatient] = useState(false)
  const [hasOpenAssessment, setHasOpenAssessment] = useState(false)
  const [opening, setOpening] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const [archiveRevision, setArchiveRevision] = useState(0)
  const savedAssessmentRef = useRef<Assessment | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const generatingReportRef = useRef(false)
  const [reportError, setReportError] = useState('')
  const reportStale = isReportStale(assessment)

  useEffect(() => {
    let cancelled = false

    void initializeClinicalStorage()
      .then((loaded) => {
        if (!cancelled) {
          assessmentRef.current = loaded
          savedAssessmentRef.current = loaded
          setAssessment(loaded)
          setHasOpenAssessment(Boolean(loaded.patient.nome || loaded.patient.cognome))
          setStorageReady(true)
        }
      })
      .catch((error) => {
        if (!cancelled) setStorageError(error instanceof Error ? error.message : 'Archivio non disponibile.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const resolveSaveWaiters = useCallback(() => {
    const waiters = saveWaitersRef.current.splice(0)
    for (const resolve of waiters) {
      resolve()
    }
  }, [])

  const persistNow = useCallback(
    async (next: Assessment): Promise<void> => {
      const task = persistChainRef.current.then(async () => {
        setSaveStatus('saving')
        try { await saveAssessmentToStorage(next) } finally { setSaveStatus('unsaved') }
        savedAssessmentRef.current = next
        setSaveStatus('saved')
        setArchiveRevision(current => current + 1)
        setStorageError('')
        setReportError(current => current.startsWith('Report generato e visibile') ? '' : current)
        resolveSaveWaiters()
      })

      persistChainRef.current = task.catch((error) => {
        resolveSaveWaiters()
        setStorageError(error instanceof Error ? error.message : 'Salvataggio non riuscito.')
        if (error instanceof StorageQuotaError) {
          alert(`Salvataggio non riuscito.\n\n${error.message}`)
          return
        }
        alert(error instanceof Error ? error.message : 'Salvataggio non riuscito.')
      })

      await task
    },
    [resolveSaveWaiters],
  )

  const { debounced: schedulePersist, cancel: cancelScheduledPersist } =
    useDebouncedCallback(() => {
      void persistNow(assessmentRef.current).catch(() => undefined)
    }, PERSIST_DEBOUNCE_MS)

  const queuePersist = useCallback(
    (next: Assessment): Promise<void> => {
      if (assessmentRef.current.patient.archived) { setStorageError('Paziente archiviato: ripristinalo dall’Archivio prima di modificarlo.'); return Promise.resolve() }
      if (assessmentRef.current.recoveredRevision) { setStorageError('Revisione storica in sola lettura. Crea una copia esplicita per modificarla.'); return Promise.resolve() }
      setHasOpenAssessment(true)
      setSaveStatus('unsaved')
      const updated = { ...next, inputRevision: (assessmentRef.current.inputRevision ?? 0) + 1, updatedAt: new Date().toISOString() }
      assessmentRef.current = updated
      setAssessment(updated)
      if (!updated.evaluationId && (!updated.patient.nome.trim() || !updated.patient.cognome.trim())) { cancelScheduledPersist(); return Promise.resolve() }
      return new Promise((resolve) => {
        saveWaitersRef.current.push(resolve)
        schedulePersist()
      })
    },
    [schedulePersist, cancelScheduledPersist],
  )

  const flushPersist = useCallback((): Promise<void> => {
    cancelScheduledPersist()
    if (!assessmentRef.current.evaluationId && (!assessmentRef.current.patient.nome.trim() || !assessmentRef.current.patient.cognome.trim())) return Promise.resolve()
    if (savedAssessmentRef.current === assessmentRef.current) return persistChainRef.current
    return persistNow(assessmentRef.current)
  }, [cancelScheduledPersist, persistNow])

  useEffect(() => () => cancelScheduledPersist(), [cancelScheduledPersist])
  useEffect(() => {
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (assessmentRef.current !== savedAssessmentRef.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', warnUnsaved)
    return () => window.removeEventListener('beforeunload', warnUnsaved)
  }, [])

  const handleGenerateReport = async () => {
    if (generatingReportRef.current) return
    generatingReportRef.current = true
    setGeneratingReport(true)
    setReportError('')
    setActiveSection('report')
    const source = assessmentRef.current
    try {
      // Yield once so React can display progress before the synchronous clinical engine runs.
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      const next = generateAssessmentReport(source)
      if (assessmentRef.current !== source) throw new Error('La valutazione è cambiata durante il calcolo. Premi di nuovo Genera report.')
      cancelScheduledPersist()
      // Publish to BOTH state and ref before persistence. A failed save must not hide the result.
      assessmentRef.current = next
      setAssessment(next)
      try {
        await persistNow(next)
      } catch {
        setReportError('Report generato e visibile, ma non salvato sul Lexar. Verifica il messaggio di archiviazione e usa Riprova salvataggio.')
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Errore nel motore di calcolo.'
      setReportError(`Impossibile generare il report: ${detail} I dati acquisiti e l’eventuale report precedente sono conservati.`)
    } finally {
      generatingReportRef.current = false
      setGeneratingReport(false)
    }
  }

  const handleReset = () => {
    if (
      confirm(
        'Salvare la valutazione corrente e iniziare con un nuovo paziente? I dati archiviati saranno conservati.',
      )
    ) {
      cancelScheduledPersist()
      saveWaitersRef.current.splice(0)
      void persistChainRef.current.then(() => flushPersist()).then(() => clearActiveAssessment())
        .then(() => {
          const empty = createEmptyAssessment()
          assessmentRef.current = empty
          savedAssessmentRef.current = empty
          setAssessment(empty)
          setHasOpenAssessment(true)
          setReportError('')
          setActiveSection('paziente')
        })
        .catch((error) => {
          alert(error instanceof Error ? error.message : 'Nuova valutazione non avviata.')
        })
    }
  }

  const handleExportPatientZip = async () => {
    if (!assessment.report) {
      const proceed = confirm(
        'Report clinico non generato.\n\nL\'export ZIP procederà senza report/report.json. Per continuità clinica completa, genera prima il report.\n\nContinuare con l\'export?',
      )
      if (!proceed) return
    }

    setExportingPatient(true)
    try {
      await flushPersist()
      const warnings = await exportPatientZip(assessmentRef.current)
      if (warnings.length > 0) {
        alert(
          `Export completato con ${warnings.length} avviso/i clinico/i:\n\n${formatExportWarningsSummary(warnings)}`,
        )
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? `Export non riuscito: ${error.message}`
          : 'Export non riuscito.',
      )
    } finally {
      setExportingPatient(false)
    }
  }


  if (!storageReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <form className="space-y-3 p-6" onSubmit={e => { e.preventDefault(); void initializeClinicalStorage(password).then(loaded => { assessmentRef.current = loaded; savedAssessmentRef.current = loaded; setAssessment(loaded); setHasOpenAssessment(Boolean(loaded.patient.nome || loaded.patient.cognome)); setStorageReady(true); setStorageError(''); setPassword('') }).catch(e => setStorageError(e.message)) }}>
          <p role="alert">{storageError || 'Caricamento archivio clinico…'}</p>
          <input aria-label="Password archivio" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (se configurata)" />
          <Button type="submit">Accedi / Riprova</Button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-clinical-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-clinical-600 text-white">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-clinical-900">
                Valutazione Posturale
              </h1>
              <p className="text-xs text-slate-500">
                Analisi statica fotografica · Ipotesi miofasciale Myers
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={generatingReport} onClick={handleReset}>
              <RefreshCw className="h-4 w-4" />
              Nuova valutazione
            </Button>
            <Button size="sm" disabled={generatingReport || importingPatient || !hasOpenAssessment || Boolean(assessment.recoveredRevision || assessment.patient.archived)} onClick={() => void handleGenerateReport()}>
              {generatingReport ? 'Generazione…' : assessment.report ? 'Rigenera report' : 'Genera report'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={exportingPatient || generatingReport || reportStale}
              onClick={() => void handleExportPatientZip()}
            >
              <Archive className="h-4 w-4" />
              {exportingPatient ? 'Esportazione…' : 'Esporta paziente (ZIP)'}
            </Button>
            <PatientImport disabled={generatingReport || importingPatient || Boolean(assessment.recoveredRevision || assessment.patient.archived)} onImport={async (assessment, preview) => {
              setImportingPatient(true)
              try {
                await flushPersist()
                const loaded = await commitPatientImport(assessment, preview)
                assessmentRef.current = loaded
                savedAssessmentRef.current = loaded
                setAssessment(loaded)
                setHasOpenAssessment(true)
                setArchiveRevision(current => current + 1)
                setReportError('')
                setActiveSection('paziente')
              } finally { setImportingPatient(false) }
            }} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void flushPersist().then(() =>
                  exportAssessmentJson(assessmentRef.current),
                ).catch(() => undefined)
              }}
            >
              <FileJson className="h-4 w-4" />
              Esporta JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!assessment.report || generatingReport || reportStale}
              onClick={() => {
                void flushPersist().then(() =>
                  exportTextReport(assessmentRef.current),
                ).catch(() => undefined)
              }}
            >
              <FileText className="h-4 w-4" />
              Esporta report testuale
            </Button>
            <Button variant="secondary" size="sm" disabled={!assessment.report || generatingReport || reportStale || exportingPatient} onClick={() => {
              setExportingPatient(true)
              void flushPersist().then(() => exportReportHtml(assessmentRef.current)).catch(error => setReportError(error instanceof Error ? error.message : 'Esportazione del report non riuscita.')).finally(() => setExportingPatient(false))
            }}>Esporta report con foto (HTML)</Button>
            <Button variant="secondary" size="sm" disabled={!assessment.report || generatingReport || reportStale || exportingPatient} onClick={() => {
              setExportingPatient(true)
              void flushPersist().then(async () => { const { exportReportPdf } = await import('@/utils/reportPdf'); await exportReportPdf(assessmentRef.current) }).catch(error => setReportError(error instanceof Error ? error.message : 'Esportazione PDF non riuscita.')).finally(() => setExportingPatient(false))
            }}>{exportingPatient ? 'Esportazione…' : 'Scarica report PDF'}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {storageError && <p role="alert" className="mb-4 rounded border border-red-300 p-3 text-red-700">{storageError} Le modifiche non salvate restano solo in memoria. <button className="underline" onClick={() => void flushPersist().catch(() => undefined)}>Riprova salvataggio</button></p>}
        <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-sm">
          <span>{hasOpenAssessment ? `${assessment.patient.cognome} ${assessment.patient.nome} · ${assessment.patient.codiceClinico || assessment.patient.id} · Valutazione ${assessment.evaluationId ?? 'nuova, non ancora salvata'} · ${assessment.patient.dataValutazione}` : 'Nessuna valutazione aperta: scegli un paziente e una valutazione dall’Archivio.'}</span>
          <span>{opening ? 'Caricamento valutazione…' : generatingReport ? 'Elaborazione del report clinico in corso…' : assessment.patient.archived ? 'Paziente archiviato · sola lettura' : assessment.recoveredRevision ? 'Revisione storica · sola lettura' : storageError ? 'Salvataggio non riuscito' : saveStatus === 'saving' ? 'Salvataggio in corso…' : saveStatus === 'unsaved' ? (!assessment.evaluationId && (!assessment.patient.nome || !assessment.patient.cognome) ? 'Completa nome e cognome per salvare il nuovo paziente' : 'Modifiche da salvare') : 'Salvato'}</span>
          {hasOpenAssessment && <Button size="sm" variant="outline" onClick={() => { void flushPersist().then(() => { setHasOpenAssessment(false); setActiveSection('archivio') }).catch(() => undefined) }}>Chiudi valutazione</Button>}
        </div>
        {storageError.includes('Omonimo') && <Button variant="outline" onClick={() => { if (confirm('Hai confrontato codice clinico e storico in Archivio e confermi che si tratta di un paziente distinto?')) { const next = { ...assessmentRef.current, allowHomonym: true }; assessmentRef.current = next; setAssessment(next); void persistNow(next).catch(() => undefined) } }}>Conferma nuovo paziente omonimo dopo confronto</Button>}
        {assessment.recoveredRevision && !assessment.patient.archived && hasOpenAssessment && <Button variant="outline" onClick={() => { if (confirm('Creare una nuova valutazione copiando questa revisione? L’originale resterà intatto.')) { const next = { ...structuredClone(assessmentRef.current), archiveKey: crypto.randomUUID().replaceAll('-', ''), evaluationId: undefined, recoveredRevision: undefined, loadedRevision: undefined }; assessmentRef.current = next; setAssessment(next); void persistNow(next).catch(() => undefined) } }}>Crea copia modificabile della revisione</Button>}
        <div className={activeSection === 'archivio' ? 'grid gap-6' : 'grid gap-6 lg:grid-cols-[1fr_280px]'}>
          <div>
            <Tabs
              value={activeSection}
              onValueChange={(value) => {
                void flushPersist().catch(() => undefined)
                setActiveSection(value)
              }}
            >
              <TabsList className="mb-6 flex h-auto flex-wrap">
                <TabsTrigger value="archivio">Archivio</TabsTrigger>
                <TabsTrigger value="paziente" disabled={!hasOpenAssessment}>Paziente</TabsTrigger>
                <TabsTrigger value="foto" disabled={!hasOpenAssessment}>Fotografie</TabsTrigger>
                <TabsTrigger value="analisi" disabled={!hasOpenAssessment}>Analisi</TabsTrigger>
                <TabsTrigger value="report" disabled={!hasOpenAssessment}>Report</TabsTrigger>
              </TabsList>

              <TabsContent value="archivio"><PatientArchive revision={archiveRevision} activeCode={hasOpenAssessment ? assessment.patient.id : undefined} onOpen={async load => {
          if (generatingReportRef.current) throw new Error('Attendi il completamento del report prima di cambiare valutazione.')
          setOpening(true)
          try {
          await flushPersist()
          const loaded = await load()
          assessmentRef.current = loaded
          savedAssessmentRef.current = loaded
          setAssessment(loaded)
          setHasOpenAssessment(true)
          setSaveStatus('saved')
          setReportError('')
          setActiveSection('paziente')
          } finally { setOpening(false) }
        }} /></TabsContent>
              <TabsContent value="paziente" className="space-y-6"><fieldset disabled={Boolean(assessment.recoveredRevision || assessment.patient.archived)} className="min-w-0 space-y-6">
                <PatientForm
                  key={assessment.patient.id}
                  patient={assessment.patient}
                  onChange={(patient) =>
                    void queuePersist({ ...assessmentRef.current, patient })
                  }
                />
              </fieldset></TabsContent>

              <TabsContent value="foto"><fieldset disabled={Boolean(assessment.recoveredRevision || assessment.patient.archived)} className="min-w-0 space-y-6">
                <PhotoUploadPanel
                  photos={assessment.photos}
                  planeAssessments={assessment.planeAssessments}
                  defaultSubjectHeightCm={assessment.defaultSubjectHeightCm}
                  onChange={(photos) =>
                    queuePersist({ ...assessmentRef.current, photos })
                  }
                  onPlaneAssessmentsChange={(planeAssessments) =>
                    queuePersist({ ...assessmentRef.current, planeAssessments })
                  }
                  onDefaultSubjectHeightChange={(defaultSubjectHeightCm) =>
                    queuePersist({ ...assessmentRef.current, defaultSubjectHeightCm })
                  }
                  onPersistFlush={flushPersist}
                />
              </fieldset></TabsContent>

              <TabsContent value="analisi" className="space-y-6"><fieldset disabled={Boolean(assessment.recoveredRevision || assessment.patient.archived)} className="min-w-0 space-y-6">
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  La decisione clinica sulle alterazioni avviene in{' '}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => setActiveSection('foto')}
                  >
                    Fotografie → Annota
                  </button>
                  . Questa scheda è un riepilogo per Myers, tessuti e report.
                </p>
                <PosturalPlaneAssessment
                  planeAssessments={assessment.planeAssessments}
                  photos={assessment.photos}
                  onChange={(planeAssessments) =>
                    void queuePersist({ ...assessmentRef.current, planeAssessments })
                  }
                />
                {assessment.myofascialResults.length > 0 && (
                  <div className="rounded-lg border border-dashed border-clinical-300 bg-clinical-50/50 p-4 text-sm text-clinical-700">
                    {assessment.myofascialResults.length} meridiani con ipotesi
                    di coinvolgimento. Vai al tab Report per la scheda completa.
                  </div>
                )}
              </fieldset></TabsContent>

              <TabsContent value="report">
                <ClinicalReport assessment={assessment} generating={generatingReport} error={reportError} stale={reportStale} />
              </TabsContent>
            </Tabs>
          </div>

          {activeSection !== 'archivio' && <aside className="hidden lg:block">
            <SummarySidebar assessment={assessment} />
          </aside>}
        </div>
      </main>

      <footer className="mt-8 border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Output a scopo di ipotesi funzionale posturale e miofasciale — non
        diagnosi medica. Dati salvati sul Lexar tramite backend locale. Le modifiche non salvate si perdono chiudendo la pagina.
      </footer>
    </div>
  )
}

export default App
