import { expect, test } from 'vitest'
import { formatRupees } from './money'

test('formatRupees uses Indian digit grouping', () => {
  expect(formatRupees(12_500_000)).toBe('₹1,25,000')
  expect(formatRupees(850_000)).toBe('₹8,500')
  expect(formatRupees(0)).toBe('₹0')
})

test('formatRupees shows paise only when present, and losses', () => {
  expect(formatRupees(15_050)).toBe('₹150.50')
  expect(formatRupees(-120_000)).toBe('-₹1,200')
})
