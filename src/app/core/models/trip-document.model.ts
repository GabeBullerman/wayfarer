export type DocumentCategory =
  | 'passport'
  | 'visa'
  | 'insurance'
  | 'vaccination'
  | 'hotel-confirmation'
  | 'flight-confirmation'
  | 'other';

export interface TripDocument {
  id?: string;
  tripId: string;
  userId: string;
  uploaderName: string;
  name: string;        // user-provided label
  fileName: string;    // original file name
  fileType: string;    // MIME type
  fileSize: number;    // bytes
  url: string;
  storagePath: string;
  category: DocumentCategory;
  notes?: string;
  expiryDate?: string; // ISO date string (for passports, visas, insurance)
  uploadedAt: any;     // Firestore Timestamp / serverTimestamp
}
