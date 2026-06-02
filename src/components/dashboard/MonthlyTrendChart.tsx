'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { getPreviousMonths, formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

interface Props { currentMonth: string }

export default function MonthlyTrendChart({ currentMonth }: Props) {
  const [data, setData] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => { loadData() }, [currentMonth])

  async function loadData() {
    const months = getPreviousMonths(6)
    const results = await Promise.all(months.map(async m => {
      const start = m + '-01'
      const end = new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]), 0).toISOString().split('T')[0]
      const { data } = await supabase.from('transactions').select('amount, is_transfer').gte('date', start).lte('date', end)
      const all = data || []
      return {
        label: format(parseISO(m + '-01'), 'MMM').toUpperCase(),
        spent: all.filter((t: any) => t.amount < 0 && !t.is_transfer).reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
        income: all.filter((t: any) => t.amount > 0 && !t.is_transfer).reduce((s: number, t: any) => s + t.amount, 0),
      }
    }))
    setData(results)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', padding: '8px 12px', borderRadius: '2px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--cyan)', marginBottom: '4px' }}>{label}</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--orange)' }}>SPENT: {formatCurrency(payload[0]?.value || 0)}</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--green)' }}>INCOME: {formatCurrency(payload[1]?.value || 0)}</p>
      </div>
    )
  }

  return (
    <div className="opt-card p-4">
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barGap={3} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,245,255,0.06)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false}
            tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,245,255,0.04)' }} />
          <Bar dataKey="spent" fill="var(--orange)" radius={[2, 2, 0, 0]} opacity={0.9} />
          <Bar dataKey="income" fill="var(--green)" radius={[2, 2, 0, 0]} opacity={0.9} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-6 justify-center mt-2">
        <div className="flex items-center gap-1.5">
          <div style={{ width: '8px', height: '8px', background: 'var(--orange)', boxShadow: '0 0 4px var(--orange)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '8px', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>SPENT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: '8px', height: '8px', background: 'var(--green)', boxShadow: '0 0 4px var(--green)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '8px', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>INCOME</span>
        </div>
      </div>
    </div>
  )
}
