import { Timestamp } from '@angular/fire/firestore';

export type ItemCategory = 'transport' | 'accommodation' | 'activity' | 'food' | 'other';

export interface ItineraryItem {
  id?: string;
  tripId: string;
  date: Timestamp;
  startTime?: string;
  endTime?: string;
  title: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  category: ItemCategory;
  cost?: number;
  currency?: string;
  /** Whether `cost` is the total or a per-person amount. */
  costType?: 'total' | 'per-person';
  notes?: string;
  order: number;
}
