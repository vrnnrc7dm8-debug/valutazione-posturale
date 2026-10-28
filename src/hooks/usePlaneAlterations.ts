import { applyClinicalEdit } from '@/utils/clinicalPipeline'
import { useCallback } from 'react'
import { buildAlterationUpdatePatch } from '@/data/directionalDescriptors'
import { getAlterationsForPlane } from '@/data/planes'
import type {
  AlterationSelection,
  AnatomicalPlane,
  ClinicalDirection,
  Descriptor,
  PlaneAssessment,
  QuantitativeValue,
  Severity,
  Side,
} from '@/types'

export function usePlaneAlterations(
  plane: AnatomicalPlane,
  assessment: PlaneAssessment,
  onAssessmentChange: (next: PlaneAssessment) => void,
) {
  const updateAlterations = useCallback(
    (alterations: AlterationSelection[]) => {
      onAssessmentChange({ plane, alterations })
    },
    [plane, onAssessmentChange],
  )

  const addAlteration = useCallback(
    (
      alterationId: string,
      opts?: {
        descriptor?: Descriptor
        severity?: Severity
        source?: AlterationSelection['source']
        status?: AlterationSelection['status']
        quantitative?: QuantitativeValue
        direction?: ClinicalDirection
        side?: Side
      },
    ) => {
      const def = getAlterationsForPlane(plane).find((a) => a.id === alterationId)
      const descriptor = opts?.descriptor ?? def?.suggestedDescriptors[0] ?? 'compenso'
      updateAlterations([
        ...assessment.alterations,
        {
          instanceId: crypto.randomUUID(),
          alterationId,
          descriptor,
          severity: opts?.severity ?? 'moderato',
          quantitative: opts?.quantitative,
          direction: opts?.direction,
          side: opts?.side,
          source: opts?.source ?? 'manual',
          status: opts?.status ?? (opts?.source === 'suggested' ? 'suggested' : 'confirmed'),
          suggestionKey: opts?.source && opts.source !== 'manual' ? `${alterationId}:${opts?.side ?? 'none'}` : undefined,
        },
      ])
    },
    [assessment.alterations, plane, updateAlterations],
  )

  const removeAlteration = useCallback(
    (instanceId: string) => {
      updateAlterations(
        assessment.alterations.filter((a) => a.instanceId !== instanceId),
      )
    },
    [assessment.alterations, updateAlterations],
  )

  const updateAlteration = useCallback(
    (instanceId: string, patch: Partial<AlterationSelection>) => {
      updateAlterations(
        assessment.alterations.map((a) => {
          if (a.instanceId !== instanceId) return a
          const merged = buildAlterationUpdatePatch(plane, a.alterationId, a, patch)
          return applyClinicalEdit(a, { ...merged, source: merged.source ?? a.source ?? 'manual', status: patch.status ?? (patch.source === 'confirmed' ? 'confirmed' : 'modified') })
        }),
      )
    },
    [assessment.alterations, plane, updateAlterations],
  )

  const removeSuggestedAlteration = useCallback(
    (alterationId: string, side?: Side) => {
      const target = assessment.alterations.find(
        (a) =>
          a.alterationId === alterationId &&
          a.source === 'suggested' &&
          (side === undefined || a.side === side),
      )
      if (target) {
        updateAlteration(target.instanceId, { status: 'excluded' })
      } else {
        addAlteration(alterationId, { side, source: 'suggested', status: 'excluded' })
      }
    },
    [assessment.alterations, updateAlteration, addAlteration],
  )

  const confirmSuggestion = useCallback(
    (
      alterationId: string,
      opts?: {
        severity?: Severity
        quantitative?: QuantitativeValue
        direction?: ClinicalDirection
        descriptor?: Descriptor
        side?: Side
      },
    ) => {
      if (assessment.alterations.some(a =>
        a.suggestionKey === `${alterationId}:${opts?.side ?? 'none'}` ||
        (a.alterationId === alterationId && a.source !== 'suggested' && (opts?.side === undefined || a.side === opts.side)))) return
      const existingSuggested = assessment.alterations.find(
        (a) =>
          a.alterationId === alterationId &&
          a.source === 'suggested' &&
          (opts?.side === undefined || a.side === opts.side),
      )
      if (existingSuggested) {
        updateAlteration(existingSuggested.instanceId, {
          source: 'confirmed',
          severity: opts?.severity ?? existingSuggested.severity,
          quantitative: opts?.quantitative ?? existingSuggested.quantitative,
          direction: opts?.direction ?? existingSuggested.direction,
          descriptor: opts?.descriptor ?? existingSuggested.descriptor,
          side: opts?.side ?? existingSuggested.side,
        })
      } else {
        addAlteration(alterationId, {
          source: 'confirmed',
          severity: opts?.severity ?? 'moderato',
          quantitative: opts?.quantitative,
          direction: opts?.direction,
          descriptor: opts?.descriptor,
          side: opts?.side,
        })
      }
    },
    [addAlteration, assessment.alterations, updateAlteration],
  )

  return {
    addAlteration,
    removeAlteration,
    updateAlteration,
    removeSuggestedAlteration,
    confirmSuggestion,
  }
}
