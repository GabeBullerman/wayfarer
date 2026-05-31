import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, doc,
  addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { PackingItem } from '../models/packing-item.model';

@Injectable({ providedIn: 'root' })
export class PackingService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private run<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  getItems(tripId: string): Observable<PackingItem[]> {
    return this.run(() => {
      const q = query(
        collection(this.firestore, 'packingItems'),
        where('tripId', '==', tripId),
        orderBy('createdAt', 'asc')
      );
      return collectionData(q, { idField: 'id' }) as Observable<PackingItem[]>;
    });
  }

  createItem(item: Omit<PackingItem, 'id' | 'createdAt'>) {
    return this.run(() =>
      addDoc(collection(this.firestore, 'packingItems'), {
        ...item,
        createdAt: serverTimestamp(),
      })
    );
  }

  togglePacked(id: string, isPacked: boolean) {
    return this.run(() =>
      updateDoc(doc(this.firestore, 'packingItems', id), { isPacked })
    );
  }

  updateItem(id: string, changes: Partial<PackingItem>) {
    return this.run(() =>
      updateDoc(doc(this.firestore, 'packingItems', id), changes)
    );
  }

  deleteItem(id: string) {
    return this.run(() => deleteDoc(doc(this.firestore, 'packingItems', id)));
  }
}
