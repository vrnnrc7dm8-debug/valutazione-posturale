import { describe, expect, it } from 'vitest'
import { isArrowPanBlockedTarget } from '@/components/annotationEditorMode'

function mockEl(
  tagName: string,
  extras: { type?: string; role?: string; isContentEditable?: boolean } = {},
): EventTarget {
  return {
    tagName: tagName.toUpperCase(),
    type: extras.type,
    isContentEditable: extras.isContentEditable ?? false,
    ...(extras.role ? { getAttribute: () => extras.role } : {}),
  } as unknown as EventTarget
}

describe('isArrowPanBlockedTarget', () => {
  it('blocca pan per input testo e number (es. altezza/calibrazione)', () => {
    expect(isArrowPanBlockedTarget(mockEl('input', { type: 'text' }))).toBe(true)
    expect(isArrowPanBlockedTarget(mockEl('input', { type: 'number' }))).toBe(true)
    expect(isArrowPanBlockedTarget(mockEl('textarea'))).toBe(true)
  })

  it('non blocca pan per select/combobox landmark', () => {
    expect(isArrowPanBlockedTarget(mockEl('button', { role: 'combobox' }))).toBe(false)
    expect(isArrowPanBlockedTarget(mockEl('div', { role: 'listbox' }))).toBe(false)
    expect(isArrowPanBlockedTarget(mockEl('div', { role: 'option' }))).toBe(false)
  })

  it('non blocca pan per input range (slider zoom)', () => {
    expect(isArrowPanBlockedTarget(mockEl('input', { type: 'range' }))).toBe(false)
  })
})
