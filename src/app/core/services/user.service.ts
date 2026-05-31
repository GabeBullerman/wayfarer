import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UserProfile } from '../models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  private run<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  getProfile(uid: string): Observable<UserProfile | undefined> {
    return this.run(() =>
      docData(doc(this.firestore, 'users', uid)) as Observable<UserProfile | undefined>
    );
  }

  createProfile(profile: UserProfile): Promise<void> {
    return this.run(() => setDoc(doc(this.firestore, 'users', profile.uid), profile));
  }

  updateProfile(uid: string, changes: Partial<UserProfile>): Promise<void> {
    return this.run(() => updateDoc(doc(this.firestore, 'users', uid), changes as Record<string, unknown>));
  }
}
