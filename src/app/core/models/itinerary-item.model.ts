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
  notes?: string;
  order: number;
}
