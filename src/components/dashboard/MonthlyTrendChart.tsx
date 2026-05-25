'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { getPreviousMonths, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

interface Props { currentMonth: string }

interface MonthData {
  month: string
  label: string
  spent: number
  income: number
}

export default function MonthlyTrendChart({ currentMonth }: Props) {
  const [data, setData] = useState<MonthData[]>([])
  const supabase = createClient()

  useEffect(() => { loadData() }, [currentMonth])

  async function loadData() {
    const months = getPreviousMonths(6)
    const results: MonthData[] = []

    for (const m of months) {
      const start = m + '-01'
      const end = new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]), 0)
        .toISOString().split('T')[0]

      const { data: txns } = await supabase
        .from('transactions')
        .select('amount, is_transfer')
        .gte('date', start)
        .lte('date', end)

      const all = txns || []
      results.push({
        month: m,
        label: format(parseISO(m + '-01'), 'MMM'),
        // Only count non-transfer transactions
        spent: all.filter((t: any) => t.amount < 0 && !t.is_transfer).reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
        income: all.filter((t: any) => t.amount > 0 && !t.is_transfer).reduce((s: number, t: any) => s + t.amount, 0),
      })
    }

    setData(results)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border rounded-xl p-3 text-xs shadow-lg">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-emerald-400">Income: {formatCurrency(payload[1]?.value || 0)}</p>
        <p className="text-rose-400">Spent: {formatCurrency(payload[0]?.value || 0)}</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border p-4">
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Bar dataKey="spent" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.85} />
          <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 opacity-85" />
          <span className="text-xs text-muted-foreground">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-500 opacity-85" />
          <span className="text-xs text-muted-foreground">Spent</span>
        </div>
      </div>
    </div>
  )
}
