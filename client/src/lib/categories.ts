// Categories are server entities (system + user-created). Names always come
// from the API payload; filters go by id.

import type { Category, TransactionType } from '../types';

export const categoriesFor = (categories: Category[], type: TransactionType): Category[] =>
  categories.filter((c) => c.type === (type === 'INCOME' ? 'INCOME' : 'EXPENSE'));

export const categoryDisplayName = (name: string): string => name;
