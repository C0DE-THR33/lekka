import { expect, test } from 'vitest'
import en from '../i18n/en.json'
import kn from '../i18n/kn.json'
import { translate } from './i18n'
import { formatRupees } from './money'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()

test('every English key has a Kannada translation with the same placeholders', () => {
  const kannada: Record<string, string> = kn
  for (const [key, text] of Object.entries(en)) {
    expect(kannada[key], key).toBeTruthy()
    expect(placeholders(kannada[key]), key).toEqual(placeholders(text))
  }
})

test('translate fills placeholders and keeps Indian rupee grouping in Kannada', () => {
  expect(translate('kn', 'cashSaleSaved', { amount: formatRupees(12_500_000) })).toBe('₹1,25,000 ನಗದು ಮಾರಾಟ ಉಳಿಸಲಾಗಿದೆ')
  expect(translate('en', 'seeAllEntries', { n: 10 })).toBe('See all 10 entries')
})
