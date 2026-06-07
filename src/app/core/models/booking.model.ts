import { Timestamp } from '@angular/fire/firestore';

export type BookingType = 'flight' | 'hotel' | 'airbnb' | 'car-rental' | 'other';
export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'suggested';

export interface Booking {
  id?: string;
  tripId: string;
  type: BookingType;
  title: string;
  provider?: string;
  confirmationNumber?: string;
  bookingUrl?: string;
  cost?: number;
  currency?: string;
  checkIn?: Timestamp;
  checkOut?: Timestamp;
  status: BookingStatus;
  notes?: string;
  passengerIds?: string[];
  paidById?: string | null;
  createdAt: Timestamp;
}
