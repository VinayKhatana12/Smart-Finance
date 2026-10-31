import { useState } from 'react';
import { formatDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Pill } from '../../components/ui/Pill';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, Skeleton } from '../../components/ui/States';
import { Segmented } from '../../components/ui/Controls';
import { useClearNotification, useMarkAllRead, useMarkRead, useNotifications } from './hooks';

const severityPill = (severity: string) => (severity === 'danger' ? 'negative' : severity === 'warning' ? 'warning' : 'accent');

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading } = useNotifications(unreadOnly);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const clear = useClearNotification();
  const items = data?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Notifications</h1>
          <p className="mt-0.5 text-sm text-muted">Budget thresholds and system messages. {data ? `${data.unread} unread` : ''}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => markAll.mutate()} disabled={markAll.isPending || (data?.unread ?? 0) === 0}>
          Mark all read
        </Button>
      </div>

      <div className="mt-5">
        <Segmented
          label="Show"
          options={[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
          ]}
          value={unreadOnly ? 'unread' : 'all'}
          onChange={(next) => setUnreadOnly(next === 'unread')}
        />
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-16 rounded-[20px]" />
          <Skeleton className="h-16 rounded-[20px]" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <Card>
            <EmptyState message={unreadOnly ? 'Nothing unread — you are all caught up.' : 'No notifications yet. Budget warnings land here as you spend.'} />
          </Card>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn('rounded-[20px] border border-line bg-surface p-4', !item.read && 'border-l-4 border-l-accent')}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold text-ink">{item.title}</span>
                <span className="flex items-center gap-2">
                  <Pill tone={severityPill(item.severity)}>{item.type.replace('BUDGET_', '').replace('_', ' ').toLowerCase()}</Pill>
                  <span className="text-[13px] text-muted">{formatDate(item.createdAt)}</span>
                </span>
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{item.body}</p>
              <div className="mt-2 flex gap-3 text-sm">
                {!item.read ? (
                  <button type="button" onClick={() => markRead.mutate(item.id)} className="font-medium text-accent-ink hover:underline">
                    Mark read
                  </button>
                ) : (
                  <span className="text-muted">Read</span>
                )}
                <button type="button" onClick={() => clear.mutate(item.id)} className="font-medium text-muted hover:text-negative">
                  Clear
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
