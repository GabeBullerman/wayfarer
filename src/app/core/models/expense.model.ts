import { Timestamp } from '@angular/fire/firestore';

export type ExpenseCategory = 'food' | 'transport' | 'activity' | 'accommodation' | 'shopping' | 'other';

export interface Expense {
  id?: string;
  tripId: string;
  title: string;
  amount: number;
  currency: string;
  /** The native `amount` converted to the trip's home currency. Equals `amount` when `currency` is already the trip currency. */
  amountInTripCurrency?: number;
  /** FX rate used for the conversion (1 when same currency). Undefined if conversion failed. */
  conversionRate?: number;
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
