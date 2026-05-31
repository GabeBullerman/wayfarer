import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, doc,
  addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Expense } from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private run<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  getExpenses(tripId: string): Observable<Expense[]> {
    return this.run(() => {
      const q = query(
        collection(this.firestore, 'expenses'),
        where('tripId', '==', tripId),
        orderBy('createdAt', 'desc')
      );
      return collectionData(q, { idField: 'id' }) as Observable<Expense[]>;
    });
  }

  createExpense(expense: Omit<Expense, 'id' | 'createdAt'>) {
    return this.run(() =>
      addDoc(collection(this.firestore, 'expenses'), {
        ...expense,
        createdAt: serverTimestamp(),
      })
    );
  }

  updateExpense(id: string, changes: Partial<Expense>) {
    return this.run(() =>
      updateDoc(doc(this.firestore, 'expenses', id), changes)
    );
  }

  deleteExpense(id: string) {
    return this.run(() => deleteDoc(doc(this.firestore, 'expenses', id)));
  }
}
