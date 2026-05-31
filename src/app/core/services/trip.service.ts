import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, doc, docData,
  addDoc, updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Trip } from '../models/trip.model';
import { TripParticipant } from '../models/trip-participant.model';
import { AuthService } from './auth.service';
import { ParticipantService } from './participant.service';

@Injectable({ providedIn: 'root' })
export class TripService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private participantService = inject(ParticipantService);
  private injector = inject(Injector);

  private run<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  getTrips(): Observable<Trip[]> {
    const userId = this.auth.currentUser?.uid;

    const own$ = this.run(() =>
      collectionData(
        query(collection(this.firestore, 'trips'),
          where('userId', '==', userId),
          orderBy('startDate', 'desc')
        ),
        { idField: 'id' }
      ) as Observable<Trip[]>
    );

    const shared$ = this.participantService.getAcceptedParticipations(userId!).pipe(
      switchMap((participations: TripParticipant[]) => {
        if (!participations.length) return of([] as Trip[]);
        const tripIds = [...new Set(participations.map(p => p.tripId))];
        return combineLatest(
          tripIds.map(id =>
            this.run(() =>
              docData(doc(this.firestore, 'trips', id), { idField: 'id' }) as Observable<Trip>
            )
          )
        );
      })
    );

    return combineLatest([own$, shared$]).pipe(
      map(([own, shared]) => {
        const ownIds = new Set(own.map(t => t.id));
        const all = [...own, ...shared.filter(t => t && !ownIds.has(t.id))];
        return all.sort((a, b) => b.startDate.seconds - a.startDate.seconds);
      })
    );
  }

  getTrip(id: string): Observable<Trip> {
    return this.run(() =>
      docData(doc(this.firestore, 'trips', id), { idField: 'id' }) as Observable<Trip>
    );
  }

  createTrip(trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) {
    return this.run(() => {
      const userId = this.auth.currentUser!.uid;
      return addDoc(collection(this.firestore, 'trips'), {
        ...trip,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  updateTrip(id: string, changes: Partial<Trip>) {
    return this.run(() =>
      updateDoc(doc(this.firestore, 'trips', id), {
        ...changes,
        updatedAt: serverTimestamp(),
      })
    );
  }

  deleteTrip(id: string) {
    return this.run(() => deleteDoc(doc(this.firestore, 'trips', id)));
  }
}
