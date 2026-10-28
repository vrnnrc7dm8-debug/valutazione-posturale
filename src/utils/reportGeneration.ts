import type { Assessment } from '@/types'
import { runFullAnalysis } from '@/utils/analysisEngine'
import { anthropometricReport } from '@/utils/anthropometry'

export function isReportStale(assessment: Assessment): boolean {
  return Boolean(assessment.report && (assessment.report.sourceRevision ?? 0) !== (assessment.inputRevision ?? 0))
}

/** Calculate from one isolated snapshot; never mutate the patient, photos or annotations. */
export function generateAssessmentReport(source: Assessment): Assessment {
  const input = structuredClone(source)
  const { myofascialResults, report } = runFullAnalysis(input.planeAssessments, input.photos, input.defaultSubjectHeightCm)
  const generatedAt = new Date().toISOString()
  return {
    ...source,
    myofascialResults,
    report: { ...report, photographs: input.photos.filter(photo => photo.dataUrl).map(photo => ({ plane: photo.plane, dataUrl: photo.dataUrl, fileName: photo.fileName, note: photo.note, annotations: photo.annotations, calibration: photo.calibration })), antropometria: anthropometricReport(input), generatedAt, sourceRevision: source.inputRevision ?? 0 },
    updatedAt: generatedAt,
  }
}
