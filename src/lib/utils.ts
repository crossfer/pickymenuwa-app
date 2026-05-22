import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString))
}

/** Date + time, e.g. "May 20, 2026, 3:42 PM" — used for chat message timestamps. */
export function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month:  'short',
    day:    'numeric',
    year:   'numeric',
    hour:   'numeric',
    minute: '2-digit',
  }).format(new Date(dateString))
}

/**
 * Relative timestamp for conversation list rows:
 * - Same day   → "3:42 PM"
 * - This year  → "May 20"
 * - Older      → "May 20, 2025"
 */
export function formatRelativeDate(dateString: string): string {
  const d   = new Date(dateString)
  const now = new Date()
  const sameDay  = d.toDateString() === now.toDateString()
  const sameYear = d.getFullYear() === now.getFullYear()

  if (sameDay) {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d)
  }
  if (sameYear) {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}
