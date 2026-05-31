import { Timestamp } from '@angular/fire/firestore';

export type PackingCategory =
  | 'documents' | 'clothing' | 'electronics' | 'toiletries'
  | 'medicine' | 'gear' | 'food' | 'other';

export interface PackingItem {
  id?: string;
  tripId: string;
  name: string;
  category: PackingCategory;
  quantity: number;
  assignedTo?: string | null;
  isPacked: boolean;
  createdAt: Timestamp;
}
