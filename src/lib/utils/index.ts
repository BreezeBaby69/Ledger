import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
}

export function formatCurrencySigned(amount: number, currency = 'CAD'): string {
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  return amount < 0 ? `-${formatted}` : `+${formatted}`
}

export function formatDate(date: string, fmt = 'MMM d'): string {
  return format(parseISO(date), fmt)
}

export function formatMonth(date: string): string {
  return format(parseISO(date + '-01'), 'MMMM yyyy')
}

export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

export function getMonthRange(month: string) {
  const date = parseISO(month + '-01')
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  }
}

export function getPreviousMonths(count: number): string[] {
  const months: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    months.push(format(subMonths(new Date(), i), 'yyyy-MM'))
  }
  return months
}

export function getSpendingPercent(spent: number, budget: number): number {
  if (budget === 0) return 0
  return Math.min(Math.round((spent / budget) * 100), 999)
}

export function isOverBudget(spent: number, budget: number): boolean {
  return spent > budget
}

export const CATEGORY_COLORS: Record<string, string> = {
  groceries: '#10b981',
  restaurants: '#f59e0b',
  gas: '#3b82f6',
  shopping: '#8b5cf6',
  entertainment: '#f43f5e',
  travel: '#06b6d4',
  utilities: '#64748b',
  insurance: '#475569',
  housing: '#7c3aed',
  fun: '#ec4899',
  subscriptions: '#6366f1',
  transfers: '#94a3b8',
  'credit-card-payments': '#64748b',
  refunds: '#10b981',
  miscellaneous: '#94a3b8',
}

export const CATEGORY_ICONS: Record<string, string> = {
  groceries: '🛒',
  restaurants: '🍽️',
  gas: '⛽',
  shopping: '🛍️',
  entertainment: '🎬',
  travel: '✈️',
  utilities: '💡',
  insurance: '🛡️',
  housing: '🏠',
  fun: '🎉',
  subscriptions: '📱',
  transfers: '↔️',
  'credit-card-payments': '💳',
  refunds: '↩️',
  miscellaneous: '📦',
}

export function isTransferLike(merchant: string): boolean {
  const patterns = [
    /payment thank you/i,
    /autopay/i,
    /transfer (to|from)/i,
    /e-transfer/i,
    /interac/i,
    /bill payment/i,
    /credit card payment/i,
    /online payment/i,
  ]
  return patterns.some(p => p.test(merchant))
}

export function isRefundLike(amount: number, merchant: string): boolean {
  return amount > 0 && !isTransferLike(merchant)
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function groupTransactionsByDate(transactions: Array<{ id: string; date: string; merchant: string; amount: number; [key: string]: unknown }>) {
  const groups: Record<string, typeof transactions> = {}
  for (const t of transactions) {
    const key = t.date
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

export function sumTransactions(transactions: Array<{ amount: number }>): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0)
}

export function getAccountColor(type: string): string {
  switch (type) {
    case 'checking': return '#10b981'
    case 'savings': return '#3b82f6'
    case 'credit_card': return '#8b5cf6'
    default: return '#94a3b8'
  }
}
