import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMe } from '../auth/hooks';
import { api } from '../reports/api';
import { useGoals } from '../planning/hooks';
import * as api2 from '../planning/api';
import { currentMonthKey, formatDate, formatMoney, monthLabel, monthShort } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { Currency, FinancialAlert, MonthPoint } from '../../types';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Pill } from '../../components/ui/Pill';
import { PlusIcon } from '../../components/icons';
import { AssistantCard } from './AssistantCard';

const severityPill = (severity: FinancialAlert['severity']) =>
  severity === 'danger' ? 'negative' : severity === 'warning' ? 'warning' : 'accent';

export function DashboardPage() {
  const me = useMe();
  const currency = me.data?.user.currency ?? 'INR';
  const [year, month] = currentMonthKey().split('-').map(Number);

  const summaryQuery = useQuery({ queryKey: ['dashboard-summary', month, year], queryFn: () => api.fetchDashboardSummary(month!, year!) });
  const trendsQuery = useQuery({ queryKey: ['dashboard-trends', month, year], queryFn: () => api.fetchDashboardTrends(6) });
  const categoriesQuery = useQuery({ queryKey: ['dashboard-categories', month, year], queryFn: () => api.fetchDashboardCategories(month!, year!) });
  const recentQuery = useQuery({ queryKey: ['dashboard-recent', month, year], queryFn: () => api.fetchDashboardRecent() });
  const insightsQuery = useQuery({ queryKey: ['insights', month, year], queryFn: () => api.fetchInsights(`${year}-${String(month).padStart(2, '0')}`) });

  const loading = summaryQuery.isLoading || trendsQuery.isLoading || categoriesQuery.isLoading || recentQuery.isLoading;
  const error = summaryQuery.isError;

  const d = summaryQuery.data;
  const trendData: MonthPoint[] = trendsQuery.data?.series ?? [];
  const categoryRows = (categoriesQuery.data?.categories ?? []).slice(0, 5);
  const maxCategory = Math.max(1, ...categoryRows.map((c) => Number(c.expensePaise)));

  const kpis = d
    ? [
        { label: 'Total balance', value: formatMoney(Number(d.totalBalancePaise), currency), lead: true, positive: false },
        { label: 'Income this month', value: formatMoney(Number(d.incomePaise), currency, { signed: true }), lead: false, positive: true },
        { label: 'Expenses this month', value: formatMoney(Number(d.expensePaise), currency), lead: false, positive: false },
        { label: 'Net cash flow', value: formatMoney(Number(d.netPaise), currency, { signed: true }), lead: false, positive: Number(d.netPaise) >= 0 },
        { label: 'Savings rate', value: d.savingsRate === null ? '—' : `${d.savingsRate}%`, lead: false, positive: false },
      ]
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-ink">Overview</h1>
          <p className="text-[13px] text-muted">{monthLabel(currentMonthKey())} · your month at a glance</p>
        </div>
        <Link
          to="/transactions"
          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-ink px-3 text-sm font-medium text-white transition-colors hover:bg-[#33373b]"
        >
          <PlusIcon width={16} height={16} />
          Add transaction
        </Link>
      </div>

      {error ? (
        <div role="alert" className="mt-6 flex items-center justify-between rounded-[8px] border border-dashed border-control px-4 py-4">
          <p className="text-sm text-muted">Couldn&apos;t load your numbers.</p>
          <button
            type="button"
            onClick={() => {
              void summaryQuery.refetch();
              void trendsQuery.refetch();
              void categoriesQuery.refetch();
              void recentQuery.refetch();
            }}
            className="text-sm font-medium text-accent-ink hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* One container split by hairlines; the lead figure is the balance */}
          <div className="mt-6 grid grid-cols-2 divide-rule overflow-hidden rounded-[20px] border border-line bg-surface sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="border-rule p-5 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="mt-3 h-6 w-24" />
                  </div>
                ))
              : kpis.map((kpi) => (
                  <div key={kpi.label} className="border-rule p-5 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b">
                    <p className="text-sm text-muted">{kpi.label}</p>
                    <p
                      className={cn(
                        'tnum mt-1 font-semibold tracking-tight',
                        kpi.lead ? 'text-[28px] text-ink' : 'text-[20px]',
                        kpi.positive && kpi.label !== 'Total balance' ? 'text-positive' : 'text-ink',
                      )}
                    >
                      {kpi.value}
                    </p>
                  </div>
                ))}
          </div>

          {d && d.alerts.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {d.alerts.map((alert, index) => (
                <div key={index} className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink">
                  <Pill tone={severityPill(alert.severity)}>
                    {alert.severity === 'danger' ? 'Over' : alert.severity === 'warning' ? 'Near' : 'Due'}
                  </Pill>
                  {alert.message}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Income vs expenses" caption="Last 6 months" />
              {trendsQuery.isLoading ? (
                <Skeleton className="h-[190px] w-full" />
              ) : trendData.length === 0 ? (
                <EmptyState message="No activity in this range yet." />
              ) : (
                <div className="h-[190px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={4}>
                      <CartesianGrid vertical={false} stroke="#e5e5e5" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5c6064', fontSize: 12 }} tickFormatter={(v) => monthShort(String(v))} tickMargin={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5c6064', fontSize: 12 }} tickCount={4} width={52} tickFormatter={(v) => String(Math.round(Number(v) / 100))} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        contentStyle={{ border: '1px solid #e6e6e6', borderRadius: 8, fontSize: 12, padding: '4px 8px' }}
                        formatter={(value, name) => [formatMoney(Number(value ?? 0), currency), String(name)]}
                      />
                      <Bar dataKey="incomePaise" name="Income" fill="#2f7a45" radius={[2, 2, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="expensePaise" name="Expenses" fill="#1b1d1f" radius={[2, 2, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Where it went" caption={`${monthLabel(currentMonthKey())} · top categories`} />
              {categoriesQuery.isLoading ? (
                <Skeleton className="h-[190px] w-full" />
              ) : categoryRows.length === 0 ? (
                <EmptyState message="No expenses recorded this month." />
              ) : (
                <ul className="space-y-3.5 pt-1">
                  {categoryRows.map((row, index) => (
                    <li key={row.categoryId}>
                      <div className="flex items-baseline justify-between text-[14px]">
                        <span className={index === 0 ? 'text-ink' : 'text-muted'}>{row.category}</span>
                        <span className="tnum text-ink">{formatMoney(Number(row.expensePaise), currency)}</span>
                      </div>
                      <ProgressBar className="mt-1.5" ratio={Number(row.expensePaise) / maxCategory} tone="ink" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <InsightsCard query={insightsQuery} />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <AssistantCard />
            <Card>
              <CardHeader title="Notifications" caption="Budget warnings land here" action={<Link to="/notifications" className="text-sm font-medium text-accent-ink hover:underline">Open</Link>} />
              <NotificationsMini />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_306px] lg:items-start">
            <div className="grid gap-6">
              <Card>
                <CardHeader
                  title="Recent transactions"
                  action={<Link to="/transactions" className="text-sm font-medium text-accent-ink hover:underline">View all</Link>}
                />
                {recentQuery.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : !recentQuery.data || recentQuery.data.transactions.length === 0 ? (
                  <EmptyState
                    message="No transactions yet. Record your first one and it will show here."
                    action={
                      <Link
                        to="/transactions"
                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-control bg-surface px-3 text-sm font-medium text-ink hover:border-muted"
                      >
                        <PlusIcon width={14} height={14} />
                        Add transaction
                      </Link>
                    }
                  />
                ) : (
                  <ul>
                    {recentQuery.data.transactions.map((row) => (
                      <li key={row.id} className="flex items-baseline justify-between gap-3 border-t border-rule py-2.5 first:border-t-0">
                        <span className="min-w-0 truncate text-[15px] text-ink">
                          {row.description || row.categoryName}
                          <span className="block text-[13px] text-muted">
                            {row.categoryName} · {row.accountName}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className={cn('tnum block text-[15px]', row.type === 'INCOME' ? 'text-positive' : 'text-ink')}>
                            {formatMoney(row.type === 'INCOME' ? Number(row.amountPaise) : -Number(row.amountPaise), currency)}
                          </span>
                          <span className="block text-[13px] text-muted">{formatDate(row.transactionDate)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <BudgetProgressMini currency={currency} month={month!} year={year!} />
                <GoalsProgressMini currency={currency} />
              </div>
            </div>

            <AccountsMini accounts={d?.accounts ?? []} currency={currency} loading={loading} />
          </div>
        </>
      )}
    </div>
  );
}

type InsightsQuery = ReturnType<typeof useQuery<{ insights: Array<{ kind: string; severity: string; title: string; detail: string }> }>>;

function InsightsCard({ query }: { query: InsightsQuery }) {
  const insights = query.data?.insights ?? [];
  const severityPill = (severity: string) => (severity === 'warning' ? 'warning' : severity === 'positive' ? 'positive' : 'accent');
  return (
    <Card className="mt-6">
      <CardHeader title="Insights" caption="Rule-based observations from your ledger" />
      {query.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : insights.length === 0 ? (
        <EmptyState message="Record a few transactions and observations about your spending will appear here." />
      ) : (
        <ul className="space-y-4">
          {insights.map((insight) => (
            <li key={insight.kind + insight.title}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[15px] font-semibold text-ink">{insight.title}</span>
                <Pill tone={severityPill(insight.severity)}>{insight.severity === 'positive' ? 'good' : insight.severity}</Pill>
              </div>
              <p className="mt-1 max-w-[72ch] text-[14px] leading-relaxed text-muted">{insight.detail}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[13px] text-muted">Observations describe recorded history only — no forecasts, no advice.</p>
    </Card>
  );
}

function NotificationsMini() {
  const { data, isLoading } = useQuery({ queryKey: ['notifications', false], queryFn: () => import('../notifications/api').then((m) => m.fetchNotifications(false)) });
  const items = (data?.items ?? []).slice(0, 3);
  return isLoading ? (
    <Skeleton className="h-16 w-full" />
  ) : items.length === 0 ? (
    <EmptyState message="No notifications yet." />
  ) : (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-baseline justify-between gap-3 border-t border-rule pt-2.5 first:border-t-0 first:pt-0">
          <span className="min-w-0 truncate text-[14px] text-ink">{item.title}</span>
          <span className="text-[13px] text-muted">{item.read ? 'read' : 'new'}</span>
        </li>
      ))}
    </ul>
  );
}

function BudgetProgressMini({ currency, month, year }: { currency: Currency; month: number; year: number }) {
  const { data: budgets, isLoading } = useQuery({ queryKey: ['budgets', month, year], queryFn: () => api2.fetchBudgets(month, year), select: (d) => d.budgets });
  return (
    <Card>
      <CardHeader title="Budget progress" caption={monthLabel(currentMonthKey())} action={<Link to="/budgets" className="text-sm font-medium text-accent-ink hover:underline">View all</Link>} />
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !budgets || budgets.length === 0 ? (
        <EmptyState message="No budgets set for this month." />
      ) : (
        <ul className="space-y-3">
          {budgets.slice(0, 4).map((budget) => {
            const limit = Number(budget.limitPaise);
            const spent = Number(budget.spentPaise);
            return (
              <li key={budget.id}>
                <div className="flex items-baseline justify-between text-[14px]">
                  <span className="text-ink">{budget.categoryName}</span>
                  <span className="tnum text-muted">
                    {formatMoney(spent, currency)} / {formatMoney(limit, currency)}
                  </span>
                </div>
                <ProgressBar
                  className="mt-1.5"
                  ratio={limit > 0 ? spent / limit : 0}
                  tone={budget.percent >= 100 ? 'negative' : budget.percent >= 90 ? 'warning' : 'ink'}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function GoalsProgressMini(_: { currency: Currency }) {
  const { data: goals, isLoading } = useGoals();
  return (
    <Card>
      <CardHeader title="Goals" action={<Link to="/goals" className="text-sm font-medium text-accent-ink hover:underline">View all</Link>} />
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !goals || goals.length === 0 ? (
        <EmptyState message="No goals yet." />
      ) : (
        <ul className="space-y-3">
          {goals.slice(0, 4).map((goal) => (
            <li key={goal.id}>
              <div className="flex items-baseline justify-between text-[14px]">
                <span className="text-ink">{goal.title}</span>
                <span className="tnum text-muted">{goal.percent}%</span>
              </div>
              <ProgressBar
                className="mt-1.5"
                ratio={Number(goal.targetPaise) > 0 ? Number(goal.savedPaise) / Number(goal.targetPaise) : 0}
                tone={goal.status === 'ACHIEVED' ? 'positive' : 'ink'}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AccountsMini({
  accounts,
  currency,
  loading,
}: {
  accounts: Array<{ id: string; name: string; accountType: string; balancePaise: string }>;
  currency: Currency;
  loading: boolean;
}) {
  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader title="Accounts" caption="Computed balances" />
      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : accounts.length === 0 ? (
        <EmptyState
          message="No accounts yet."
          action={
            <Link to="/accounts" className="text-sm font-medium text-accent-ink hover:underline">
              Add an account
            </Link>
          }
        />
      ) : (
        <ul>
          {accounts.map((account) => (
            <li key={account.id} className="flex items-baseline justify-between gap-3 border-t border-rule py-2.5 first:border-t-0">
              <span className="text-[15px] text-ink">{account.name}</span>
              <span className="tnum text-[15px] text-ink">{formatMoney(Number(account.balancePaise), currency)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13px] text-muted">
        Balance = starting balance + everything recorded. Budgets and goals update from the same ledger.
      </p>
    </Card>
  );
}

