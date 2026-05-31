import { Timestamp } from '@angular/fire/firestore';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  country: string;
  homeCurrency: string;
  createdAt: Timestamp;
}
