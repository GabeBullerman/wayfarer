import { Timestamp } from '@angular/fire/firestore';

export type InviteStatus = 'pending' | 'accepted';

export interface TripParticipant {
  id?: string;
  tripId: string;
  name: string;
  homeCity?: string;
  isOrganizer: boolean;
  userId?: string;
  inviteEmail?: string;
  inviteStatus?: InviteStatus;
  createdAt: Timestamp;
}
