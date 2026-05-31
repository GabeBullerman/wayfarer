import { Timestamp } from '@angular/fire/firestore';

export interface Photo {
  id?: string;
  tripId: string;
  userId: string;
  uploaderName?: string;
  url: string;
  storagePath: string;
  caption?: string;
  dateTaken?: Timestamp;
  location?: string;
  uploadedAt: Timestamp;
}
