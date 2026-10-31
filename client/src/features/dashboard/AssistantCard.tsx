import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../reports/api';
import { Card, CardHeader } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toaster';
import { Button } from '../../components/ui/Button';

const SUGGESTIONS = [
  'Where did I spend the most money?',
  'How much did I save this month?',
  'Which categories exceeded my budgets?',
  'How much can I save if I reduce food spending by 10%?',
];

export function AssistantCard() {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: ['assistant', asked],
    queryFn: () => api.askAssistant(asked!),
    enabled: Boolean(asked) && enabled,
    retry: false,
  });

  const ask = (q: string) => {
    if (!enabled) {
      setEnabled(true);
      setAsked(q);
      return;
    }
    setAsked(q);
  };

  return (
    <Card>
      <CardHeader title="Ask about your money" caption="Answers come from your own ledger" />
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => ask(suggestion)}
            className="rounded-full border border-control bg-surface px-3 py-1 text-[13px] text-ink transition-colors hover:border-muted"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim().length >= 3) ask(question.trim());
          else showToast('Ask a question first.', 'info');
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask anything about this month…"
          aria-label="Ask about your money"
          className="h-10 w-full rounded-[10px] border border-[#e8e8e8] bg-surface px-3 text-[15px] text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-accent"
        />
        <Button type="submit" size="sm" disabled={query.isFetching}>
          {query.isFetching ? 'Thinking…' : 'Ask'}
        </Button>
      </form>

      {query.isLoading ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : query.data ? (
        <div className="mt-3 rounded-[10px] border border-line bg-raised p-3">
          <p className="text-[15px] leading-relaxed text-ink">{query.data.answer}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">{query.data.disclaimer}</p>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-muted">
          Answers are computed from your own recorded transactions — never from anyone else&apos;s data.
        </p>
      )}
    </Card>
  );
}
