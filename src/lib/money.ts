/** ₹1,25,000 style; shows paise only when there are some (₹150.50). */
export function formatRupees(paise: number): string {
  const digits = paise % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(paise / 100)
}

/** "3:42 pm", India time. */
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
