import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, doc,
  addDoc, updateDoc, deleteDoc, query, where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ItineraryItem } from '../models/itinerary-item.model';

@Injectable({ providedIn: 'root' })
export class ItineraryService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private run<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  getItems(tripId: string): Observable<ItineraryItem[]> {
    return this.run(() => {
      const q = query(
        collection(this.firestore, 'itinerary'),
        where('tripId', '==', tripId)
      );
      return collectionData(q, { idField: 'id' }) as Observable<ItineraryItem[]>;
    });
  }

  createItem(item: Omit<ItineraryItem, 'id'>) {
    return this.run(() => addDoc(collection(this.firestore, 'itinerary'), item));
  }

  updateItem(id: string, changes: Partial<ItineraryItem>) {
    return this.run(() =>
      updateDoc(doc(this.firestore, 'itinerary', id), changes as Record<string, unknown>)
    );
  }

  deleteItem(id: string) {
    return this.run(() => deleteDoc(doc(this.firestore, 'itinerary', id)));
  }
}
