import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMe } from '../auth/hooks';
import { api, reportsExportUrl } from './api';
import { currentMonthKey, formatMoney, monthLabel, monthRange, shiftMonth, toDayIso } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { Input } from '../../components/ui/Field';

type RangePreset = 'this-month' | 'last-month' | 'this-year' | 'custom';

function rangeFor(preset: RangePreset, custom: { from: string; to: string }): { from: string; to: string; label: string } {
  const today = toDayIso(new Date());
  switch (preset) {
    case 'this-month': {
      const r = monthRange(currentMonthKey());
      return { ...r, label: monthLabel(currentMonthKey()) };
    }
    case 'last-month': {
      const m = shiftMonth(currentMonthKey(), -1);
      const r = monthRange(m);
      return { ...r, label: monthLabel(m) };
    }
    case 'this-year':
      return { from: `${new Date().getFullYear()}-01-01`, to: today, label: `${new Date().getFullYear()}` };
    case 'custom':
      return { ...custom, label: `${custom.from} → ${custom.to}` };
  }
}

export function ReportsPage() {
  const me = useMe();
  const currency = me.data?.user.currency ?? 'USD';
  const [preset, setPreset] = useState<RangePreset>('this-month');
  const [custom, setCustom] = useState({ from: toDayIso(new Date()), to: toDayIso(new Date()) });
  const range = rangeFor(preset, custom);

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', range.from, range.to],
    queryFn: () => api.fetchSummary({ from: range.from, to: range.to }),
  });

  const categories = (summary?.byCategory ?? []).filter((c) => Number(c.expensePaise) > 0);
  const maxCategory = Math.max(1, ...categories.map((c) => Number(c.expensePaise)));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Reports</h1>
          <p className="mt-0.5 text-sm text-muted">{range.label} · where the money went, in plain numbers.</p>
        </div>
        <div className="flex gap-2">
          <a
            href={reportsExportUrl(range)}
            className="inline-flex h-8 items-center rounded-[10px] border border-control bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-muted"
          >
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-8 items-center rounded-[10px] border border-control bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-muted"
          >
            Save as PDF
          </button>
        </div>
      </div>

      <Card className="mt-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-1.5 block text-[13px] text-muted">Range</span>
            <div className="inline-flex h-9 items-center gap-1 rounded-[10px] bg-active p-1">
              {(
                [
                  { id: 'this-month', label: 'This month' },
                  { id: 'last-month', label: 'Last month' },
                  { id: 'this-year', label: 'This year' },
                  { id: 'custom', label: 'Custom' },
                ] as Array<{ id: RangePreset; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={preset === option.id}
                  onClick={() => setPreset(option.id)}
                  className={cn(
                    'h-7 rounded-[7px] px-3 text-sm font-medium transition-colors',
                    preset === option.id ? 'bg-surface text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {preset === 'custom' ? (
            <>
              <div>
                <label htmlFor="rep-from" className="mb-1.5 block text-[13px] text-muted">From</label>
                <Input type="date" id="rep-from" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-[150px]" />
              </div>
              <div>
                <label htmlFor="rep-to" className="mb-1.5 block text-[13px] text-muted">To</label>
                <Input type="date" id="rep-to" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-[150px]" />
              </div>
            </>
          ) : null}
        </div>
      </Card>

      {isError ? (
        <div role="alert" className="mt-4 flex items-center justify-between rounded-[8px] border border-dashed border-control px-4 py-4">
          <p className="text-sm text-muted">Couldn&apos;t load the report.</p>
          <button type="button" onClick={() => refetch()} className="text-sm font-medium text-accent-ink hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 divide-rule overflow-hidden rounded-[20px] border border-line bg-surface lg:grid-cols-4 lg:divide-x">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border-rule p-5 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="mt-3 h-6 w-24" />
                  </div>
                ))
              : (
                [
                  { label: 'Money in', value: formatMoney(Number(summary?.incomePaise ?? '0'), currency, { signed: true }), tone: 'text-positive' },
                  { label: 'Money out', value: formatMoney(Number(summary?.expensePaise ?? '0'), currency), tone: 'text-ink' },
                  { label: 'Net', value: formatMoney(Number(summary?.netPaise ?? '0'), currency, { signed: true }), tone: 'text-ink' },
                  { label: 'Savings rate', value: summary?.savingsRate === null || summary === undefined ? '—' : `${summary.savingsRate}%`, tone: 'text-ink' },
                ]
              ).map((item) => (
                <div key={item.label} className="border-rule p-5 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b">
                  <p className="text-sm text-muted">{item.label}</p>
                  <p className={cn('tnum mt-1 text-[24px] font-semibold tracking-tight', item.tone)}>{item.value}</p>
                </div>
              ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
            <Card>
              <CardHeader title="Income and expenses" caption="By month" />
              {isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (summary?.byMonth.length ?? 0) === 0 ? (
                <EmptyState message="No activity in this range yet." />
              ) : (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary!.byMonth.map((m) => ({ month: m.month, income: Number(m.incomePaise), expense: Number(m.expensePaise) }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={4}>
                      <CartesianGrid vertical={false} stroke="#e5e5e5" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5c6064', fontSize: 12 }} tickMargin={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5c6064', fontSize: 12 }} tickCount={4} width={52} tickFormatter={(v: number) => String(Math.round(v / 100))} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        contentStyle={{ border: '1px solid #e6e6e6', borderRadius: 8, fontSize: 12, padding: '4px 8px' }}
                        formatter={(value, name) => [formatMoney(Number(value ?? 0), currency), String(name)]}
                      />
                      <Bar dataKey="income" name="Income" fill="#2f7a45" radius={[2, 2, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="expense" name="Expenses" fill="#1b1d1f" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Category breakdown" caption="Spending" />
              {isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : categories.length === 0 ? (
                <EmptyState message="No expenses in this range." />
              ) : (
                <ul className="space-y-3.5 pt-1">
                  {categories.slice(0, 8).map((row, index) => (
                    <li key={row.category}>
                      <div className="flex items-baseline justify-between text-[14px]">
                        <span className={index === 0 ? 'text-ink' : 'text-muted'}>{row.category}</span>
                        <span className="tnum text-ink">{formatMoney(Number(row.expensePaise), currency)}</span>
                      </div>
                      <div className="mt-1.5 h-0.5 w-full rounded-full bg-rule">
                        <div className={cn('h-0.5 rounded-full', index === 0 ? 'bg-ink' : 'bg-ink/40')} style={{ width: `${(Number(row.expensePaise) / maxCategory) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {!isLoading && categories.length > 0 ? (
            <Card className="mt-6 print:hidden">
              <CardHeader title="All categories" caption={`${categories.length} with spending`} />
              <div className="overflow-hidden rounded-[8px]">
                <table className="w-full border-collapse text-[15px]">
                  <thead>
                    <tr className="text-left text-xs font-normal text-muted">
                      <th scope="col" className="py-2 font-normal">Category</th>
                      <th scope="col" className="py-2 text-right font-normal">Expenses</th>
                      <th scope="col" className="py-2 text-right font-normal">Income</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((row) => (
                      <tr key={row.category} className="border-t border-rule">
                        <td className="py-2 text-ink">{row.category}</td>
                        <td className="tnum py-2 text-right text-ink">{formatMoney(Number(row.expensePaise), currency)}</td>
                        <td className="tnum py-2 text-right text-muted">{Number(row.incomePaise) > 0 ? formatMoney(Number(row.incomePaise), currency) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
