import { useMemo, useState } from 'react';
import { useMe } from '../auth/hooks';
import { useAccounts } from '../accounts/hooks';
import { formatDate, formatMoney } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { Transaction } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Pagination, Segmented } from '../../components/ui/Controls';
import { Input, Select } from '../../components/ui/Field';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toaster';
import { PlusIcon } from '../../components/icons';
import { exportUrl, type TransactionFilters } from './api';
import { useCategories, useDeleteTransaction, useTransactions } from './hooks';
import { TransactionFormModal } from './TransactionFormModal';
import { RecurringSection } from '../recurring/RecurringSection';



const PAGE_SIZE = 15;

type TypeFilter = 'all' | 'INCOME' | 'EXPENSE';

export function TransactionsPage() {
  const [pageTab, setPageTab] = useState<'transactions' | 'recurring'>('transactions');
  const me = useMe();
  const { data: accountsData } = useAccounts();
  const accounts = accountsData ?? [];
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState(''); // applied on submit, not per keystroke
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [category, setCategory] = useState(''); // categoryId
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<NonNullable<TransactionFilters['sort']>>('date_desc');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const filters: TransactionFilters = useMemo(
    () => ({
      q: query || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      categoryId: category || undefined,
      accountId: accountId || undefined,
      from: from || undefined,
      to: to || undefined,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    [query, typeFilter, category, accountId, from, to, page],
  );

  const { data: paged, isLoading, isError, refetch } = useTransactions(filters);
  const { data: categories } = useCategories();
  const deleteTxn = useDeleteTransaction();
  const currency = me.data?.user.currency ?? 'USD';

  const applySearch = () => {
    setPage(1);
    setQuery(search.trim());
  };

  const resetFilters = () => {
    setSearch('');
    setQuery('');
    setTypeFilter('all');
    setCategory('');
    setAccountId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteTxn.mutate(deleting.id, {
      onSuccess: () => {
        showToast('Transaction deleted.', 'success');
        setDeleting(null);
      },
      onError: () => showToast('Could not delete. Please try again.', 'error'),
    });
  };

  const rows = paged?.items ?? [];
  const hasFilters = Boolean(query || category || accountId || from || to) || typeFilter !== 'all';

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Transactions</h1>
          <p className="mt-0.5 text-sm text-muted">
            {paged ? `${new Intl.NumberFormat().format(paged.total)} transactions` : 'Loading…'} · {currency}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={exportUrl(filters)}
            className="inline-flex h-8 items-center rounded-[10px] border border-control bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-muted"
          >
            Export CSV
          </a>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon width={16} height={16} />
            Add transaction
          </Button>
        </div>
      </div>

      <Segmented
        label="Transactions view"
        options={[
          { id: 'transactions', label: 'Transactions' },
          { id: 'recurring', label: 'Recurring rules' },
        ]}
        value={pageTab}
        onChange={setPageTab}
        className="mt-5"
      />

      {pageTab === 'recurring' ? (
        <div className="mt-2">
          <RecurringSection />
        </div>
      ) : (
      <>
      <Card className="mt-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="txn-search" className="mb-1.5 block text-[13px] text-muted">
              Search
            </label>
            <Input
              id="txn-search"
              placeholder="Description, category, notes…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch();
              }}
            />
          </div>
          <div>
            <label htmlFor="txn-f-from" className="mb-1.5 block text-[13px] text-muted">
              From
            </label>
            <Input id="txn-f-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[150px]" />
          </div>
          <div>
            <label htmlFor="txn-f-to" className="mb-1.5 block text-[13px] text-muted">
              To
            </label>
            <Input id="txn-f-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[150px]" />
          </div>
          <div>
            <label htmlFor="txn-f-account" className="mb-1.5 block text-[13px] text-muted">
              Account
            </label>
            <Select id="txn-f-account" value={accountId} onChange={(e) => { setAccountId(e.target.value); setPage(1); }} className="w-[150px]">
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="txn-f-category" className="mb-1.5 block text-[13px] text-muted">
              Category
            </label>
            <Select id="txn-f-category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="w-[170px]">
              <option value="">All categories</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="txn-sort" className="mb-1.5 block text-[13px] text-muted">
              Sort
            </label>
            <Select
              id="txn-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as NonNullable<TransactionFilters['sort']>);
                setPage(1);
              }}
              className="w-[160px]"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="amount_desc">Largest amount</option>
              <option value="amount_asc">Smallest amount</option>
            </Select>
          </div>
          <Button variant="secondary" size="sm" onClick={applySearch}>
            Search
          </Button>
          {hasFilters ? (
            <button type="button" onClick={resetFilters} className="px-1 text-sm font-medium text-accent-ink hover:underline">
              Clear
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          <Segmented
            label="Type"
            options={[
              { id: 'all', label: 'All' },
              { id: 'INCOME', label: 'Income' },
              { id: 'EXPENSE', label: 'Expenses' },
            ]}
            value={typeFilter}
            onChange={(next) => {
              setTypeFilter(next);
              setPage(1);
            }}
          />
        </div>
      </Card>

      <div className="mt-4 overflow-hidden rounded-[20px] border border-line bg-surface">
        {isLoading ? (
          <div className="p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="mb-4 flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-5">
            <div role="alert" className="flex items-center justify-between rounded-[8px] border border-dashed border-control px-4 py-4">
              <p className="text-sm text-muted">Couldn&apos;t load transactions.</p>
              <button type="button" onClick={() => refetch()} className="text-sm font-medium text-accent-ink hover:underline">
                Retry
              </button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                hasFilters
                  ? 'No transactions match these filters.'
                  : 'No transactions yet. Record your first one — income or an expense.'
              }
              action={
                hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setFormOpen(true)}>
                    <PlusIcon width={16} height={16} />
                    Add transaction
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop table: rules and alignment, no zebra */}
            <table className="hidden w-full border-collapse text-[15px] md:table">
              <thead>
                <tr className="text-left text-xs font-normal text-muted">
                  <th scope="col" className="px-5 py-3 font-normal">Date</th>
                  <th scope="col" className="px-5 py-3 font-normal">Description</th>
                  <th scope="col" className="px-5 py-3 font-normal">Category</th>
                  <th scope="col" className="px-5 py-3 font-normal">Account</th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">Amount</th>
                  <th scope="col" className="px-5 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-rule">
                    <td className="tnum px-5 py-3 text-muted">{formatDate(row.transactionDate)}</td>
                    <td className="max-w-[260px] truncate px-5 py-3 text-ink">{row.description || row.categoryName}</td>
                    <td className="px-5 py-3 text-muted">{row.categoryName}</td>
                    <td className="px-5 py-3 text-muted">{row.accountName}</td>
                    <td className={cn('tnum px-5 py-3 text-right', row.type === 'INCOME' ? 'text-positive' : 'text-ink')}>
                      {formatMoney(row.type === 'INCOME' ? Number(row.amountPaise) : -Number(row.amountPaise), currency)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(row);
                          setFormOpen(true);
                        }}
                        className="px-1 text-sm font-medium text-accent-ink hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(row)}
                        className="ml-2 px-1 text-sm font-medium text-muted hover:text-negative"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phone: two-line rows */}
            <ul className="md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="border-t border-rule px-4 py-3 first:border-t-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] text-ink">{row.description || row.categoryName}</span>
                    <span className={cn('tnum text-[15px]', row.type === 'INCOME' ? 'text-positive' : 'text-ink')}>
                      {formatMoney(row.type === 'INCOME' ? Number(row.amountPaise) : -Number(row.amountPaise), currency)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px] text-muted">
                    <span>
                      {row.categoryName} · {row.accountName}
                    </span>
                    <span className="tnum">{formatDate(row.transactionDate)}</span>
                  </div>
                  <div className="mt-1.5 flex gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(row);
                        setFormOpen(true);
                      }}
                      className="font-medium text-accent-ink"
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleting(row)} className="font-medium text-muted">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="px-5 pb-3">
              <Pagination page={paged!.page} pageSize={paged!.pageSize} total={paged!.total} onPage={setPage} />
            </div>
          </>
        )}
      </div>

      </>
      )}

      <TransactionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        accounts={accounts}
        transaction={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete transaction"
        body={
          deleting
            ? `Delete "${deleting.description || deleting.categoryName}" of ${formatMoney(Number(deleting.amountPaise), currency)}? This cannot be undone.`
            : ''
        }
        busy={deleteTxn.isPending}
      />
    </div>
  );
}
