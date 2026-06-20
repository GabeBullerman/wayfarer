import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, doc,
  addDoc, updateDoc, deleteDoc, query, where, serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Booking } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private run<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  getBookings(tripId: string): Observable<Booking[]> {
    return this.run(() => {
      const q = query(
        collection(this.firestore, 'bookings'),
        where('tripId', '==', tripId)
      );
      return collectionData(q, { idField: 'id' }) as Observable<Booking[]>;
    });
  }

  createBooking(booking: Omit<Booking, 'id' | 'createdAt'>) {
    return this.run(() =>
      addDoc(collection(this.firestore, 'bookings'), {
        ...stripUndefined(booking),
        createdAt: serverTimestamp(),
      })
    );
  }

  updateBooking(id: string, changes: Partial<Booking>) {
    return this.run(() =>
      updateDoc(doc(this.firestore, 'bookings', id), stripUndefined(changes))
    );
  }

  deleteBooking(id: string) {
    return this.run(() => deleteDoc(doc(this.firestore, 'bookings', id)));
  }
}

/**
 * Firestore rejects `undefined` field values (ignoreUndefinedProperties is not
 * enabled), so drop any top-level keys whose value is undefined before writing.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
