import { useState } from 'react';
import { formatMoney } from '../lib/format';
import { cn } from '../lib/cn';
import { LogoMark } from '../components/Logo';
import { Ring } from '../components/ui/Ring';

/*
 * Product fragments for the landing page (root carries data-ui). They are built
 * like real app screens: real labels, numbers that add up, one data hue.
 *
 * SAMPLE DATA — replace with real screenshots or a live demo before launch
 * (all figures are computed from the rows below, nothing is typed in twice):
 *   accounts:      checking 241860 + savings 2190000  = net worth 2431860
 *   plan:          income 320000, planned 200000, spent = 54000+42000+29800 = 125800
 *                  safe to spend 200000 − 125800 = 74200; 28 days left → 2650/day
 *   ring ratio:    125800 / 200000 = 62.9% → 63%
 *   goal pot:      saved 1360000 of target 2200000 = 61.8% → 62%
 */

export type FragmentPart = 'networth' | 'plan' | 'safe' | 'recent' | 'categories' | 'goal';

const sample = {
  netWorthMinor: 2431860,
  plannedMinor: 200000,
  spentMinor: 125800,
  safeToSpendMinor: 74200,
  daysLeft: 28,
  perDayMinor: 2650,
  ringRatio: 0.629,
  recent: [
    { name: 'Blue Bottle Coffee', category: 'Eating out', amountMinor: -640, date: 'Oct 27' },
    { name: 'Metro Grocers', category: 'Groceries', amountMinor: -5412, date: 'Oct 26' },
    { name: 'Payroll · Meridian Studio', category: 'Income', amountMinor: 320000, date: 'Oct 24' },
  ],
  categories: [
    { name: 'Groceries', spentMinor: 54000, limitMinor: 60000 },
    { name: 'Eating out', spentMinor: 42000, limitMinor: 50000 },
    { name: 'Transport', spentMinor: 29800, limitMinor: 30000 },
  ],
  goal: { name: 'Emergency fund', savedMinor: 1360000, targetMinor: 2200000 },
};

const partRing = (active: FragmentPart | null, part: FragmentPart) =>
  active === part ? 'outline outline-2 outline-accent rounded-[12px]' : undefined;

/** The dashboard as a plate in a manual: 380px wide, every figure from the sample ledger. */
export function DashboardFragment({ activePart }: { activePart: FragmentPart | null }) {
  return (
    <div data-ui className="w-[380px] max-w-full rounded-[20px] border border-line bg-surface p-4">
      <div className="flex items-center gap-2 pb-3">
        <LogoMark size={20} />
        <span className="text-[13px] font-semibold text-ink">Smart Finance</span>
        <span className="ml-auto text-[12px] text-muted">October</span>
      </div>

      <div className={cn('flex items-baseline justify-between px-2 py-1', partRing(activePart, 'networth'))}>
        <span className="text-[13px] text-muted">Net worth</span>
        <span className="tnum text-[22px] font-semibold tracking-tight text-ink">
          {formatMoney(sample.netWorthMinor, 'USD')}
        </span>
      </div>

      <div className={cn('mt-3 rounded-2xl border border-line p-3', partRing(activePart, 'plan'))}>
        <div className="flex items-center gap-4">
          <Ring ratio={sample.ringRatio} size={76} strokeWidth={5} label="63%" />
          <div className={cn('min-w-0', partRing(activePart, 'safe'))}>
            <p className="text-[13px] text-muted">Safe to spend</p>
            <p className="tnum text-[20px] font-semibold tracking-tight text-ink">
              {formatMoney(sample.safeToSpendMinor, 'USD')}
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              ≈ {formatMoney(sample.perDayMinor, 'USD')} a day for {sample.daysLeft} more days
            </p>
          </div>
        </div>
      </div>

      <div className={cn('mt-3 px-1', partRing(activePart, 'recent'))}>
        <p className="text-[12px] text-muted">Recent spending</p>
        <ul className="mt-1">
          {sample.recent.map((row) => (
            <li key={row.name} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate text-[14px] text-ink">
                {row.name}
                <span className="block text-[12px] text-muted">{row.category}</span>
              </span>
              <span className="text-right">
                <span className={cn('tnum block text-[14px]', row.amountMinor > 0 ? 'text-positive' : 'text-ink')}>
                  {formatMoney(row.amountMinor, 'USD', { signed: true })}
                </span>
                <span className="block text-[12px] text-muted">{row.date}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn('mt-3 px-1', partRing(activePart, 'categories'))}>
        <p className="text-[12px] text-muted">Category limits</p>
        <ul className="mt-1 space-y-1.5">
          {sample.categories.map((category) => (
            <li key={category.name}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink">{category.name}</span>
                <span className="tnum text-muted">
                  {formatMoney(category.spentMinor, 'USD')} of {formatMoney(category.limitMinor, 'USD')}
                </span>
              </div>
              <div className="mt-1 h-0.5 w-full rounded-full bg-rule">
                <div
                  className="h-0.5 rounded-full bg-ink/70"
                  style={{ width: `${Math.round((category.spentMinor / category.limitMinor) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn('mt-3 rounded-2xl bg-accent-soft p-3', partRing(activePart, 'goal'))}>
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-medium text-accent-ink">{sample.goal.name}</span>
          <span className="tnum text-accent-ink">
            {formatMoney(sample.goal.savedMinor, 'USD')} of {formatMoney(sample.goal.targetMinor, 'USD')}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/70">
          <div
            className="h-1.5 rounded-full bg-accent"
            style={{ width: `${Math.round((sample.goal.savedMinor / sample.goal.targetMinor) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Evidence 1: the entry form, filled the way a real evening's entry looks. */
export function AddTransactionFragment() {
  return (
    <div data-ui className="w-full rounded-[16px] border border-line bg-surface p-4">
      <div className="flex gap-1" role="group" aria-label="Transaction type">
        <span className="h-7 rounded-full bg-active px-3 text-[13px] font-medium leading-7 text-ink">Expense</span>
        <span className="h-7 rounded-full px-3 text-[13px] leading-7 text-muted">Income</span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_112px] gap-2">
        <div className="flex h-9 items-center rounded-[8px] border border-[#e8e8e8] px-2.5 text-[14px] text-ink">
          Metro Grocers
        </div>
        <div className="tnum flex h-9 items-center justify-end rounded-[8px] border border-[#e8e8e8] px-2.5 text-[14px] text-ink">
          −$54.12
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="h-9 w-[132px] rounded-[8px] border border-[#e8e8e8] px-2.5 text-[14px] leading-9 text-ink">
          Groceries
        </span>
        <span className="flex h-9 items-center rounded-[10px] bg-ink px-4 text-[14px] font-medium text-white">
          Record
        </span>
      </div>
    </div>
  );
}

/**
 * The page's one live thing: type your take-home, read your real 50/30/20 split.
 * Falls back to the filled example when there is no input; plain numbers, tabular.
 */
export function BudgetCalculatorFragment() {
  const [income, setIncome] = useState(3000);
  const clamped = Number.isFinite(income) && income > 0 ? income : 0;
  const rows = [
    { name: 'Needs: rent, food, transport', share: 0.5 },
    { name: 'Wants: the rest of life', share: 0.3 },
    { name: 'Savings: pots and debts', share: 0.2 },
  ];

  return (
    <div data-ui className="w-full rounded-[16px] border border-line bg-surface p-4">
      <label htmlFor="landing-income" className="text-[13px] text-muted">
        Your monthly take-home, in dollars
      </label>
      <input
        id="landing-income"
        type="number"
        min={0}
        step={50}
        value={Number.isFinite(income) ? income : ''}
        onChange={(event) => setIncome(event.target.valueAsNumber)}
        className="tnum mt-2 h-11 w-full rounded-[10px] border border-[#e8e8e8] bg-white px-3 text-[16px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-accent"
      />
      <ul className="mt-3 space-y-1">
        {rows.map((row) => (
          <li key={row.name} className="flex items-baseline justify-between gap-3 py-1 text-[14px]">
            <span className="text-muted">{row.name}</span>
            <span className="tnum font-semibold text-ink">{formatMoney(Math.round(clamped * row.share) * 100, 'USD')}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-muted">A starting split, not advice. Your plan is yours to bend.</p>
    </div>
  );
}

/** Evidence 3: the month's report, read as a quiet ranked list. */
export function ReportFragment() {
  const ranked = [...sample.categories].sort((a, b) => b.spentMinor - a.spentMinor);
  return (
    <div data-ui className="w-full rounded-[16px] border border-line bg-surface p-4">
      <p className="text-[12px] text-muted">October · spending against limits</p>
      <ul className="mt-2 space-y-2.5">
        {ranked.map((category, index) => (
          <li key={category.name}>
            <div className="flex items-baseline justify-between text-[14px]">
              <span className={index === 0 ? 'text-ink' : 'text-muted'}>{category.name}</span>
              <span className="tnum text-ink">{formatMoney(category.spentMinor, 'USD')}</span>
            </div>
            <div className="mt-1 h-0.5 w-full rounded-full bg-rule">
              <div
                className={cn('h-0.5 rounded-full', index === 0 ? 'bg-ink' : 'bg-ink/40')}
                style={{ width: `${Math.min(100, Math.round((category.spentMinor / category.limitMinor) * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
