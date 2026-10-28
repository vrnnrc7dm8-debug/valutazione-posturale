import { expect, it } from 'vitest'
import { pdfText } from '@/utils/reportPdf'
it('mantiene accenti italiani, gradi e operatori clinici nel testo PDF', () => {
  expect(pdfText('Età: 40 · Δ 3° ≥ 2° → BMI 22,9 kg/m²')).toBe('Età: 40 · Delta 3° >= 2° -> BMI 22,9 kg/m²')
})
