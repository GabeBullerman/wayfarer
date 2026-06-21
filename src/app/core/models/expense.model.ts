import { Timestamp } from '@angular/fire/firestore';

export type ExpenseCategory = 'food' | 'transport' | 'activity' | 'accommodation' | 'shopping' | 'other';

export interface Expense {
  id?: string;
  tripId: string;
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidById?: string | null;
  participantIds?: string[];
  date?: Timestamp;
  notes?: string;
  /** Loyalty/credit-card points redeemed toward this expense. */
  pointsUsed?: number;
  /** Where the points came from, e.g. "Chase Ultimate Rewards", "Amex MR". */
  pointsProgram?: string;
  createdAt: Timestamp;
}
