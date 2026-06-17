import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, user, updateProfile, signInWithPopup, GoogleAuthProvider, getAdditionalUserInfo } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Timestamp } from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  readonly currentUser$ = user(this.auth);

  login(email: string, password: string) {
    return from(signInWithEmailAndPassword(this.auth, email, password));
  }

  register(email: string, password: string, displayName: string) {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password).then(cred =>
        updateProfile(cred.user, { displayName }).then(() => cred)
      )
    );
  }

  loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return from(
      signInWithPopup(this.auth, provider).then(async cred => {
        const info = getAdditionalUserInfo(cred);
        if (info?.isNewUser) {
          const profileRef = doc(this.firestore, 'users', cred.user.uid);
          const existing = await getDoc(profileRef);
          if (!existing.exists()) {
            await setDoc(profileRef, {
              uid: cred.user.uid,
              displayName: cred.user.displayName ?? 'Traveller',
              email: cred.user.email ?? '',
              photoURL: cred.user.photoURL ?? null,
              country: 'United States',
              homeCurrency: 'USD',
              createdAt: Timestamp.now(),
            });
          }
        }
        return cred;
      })
    );
  }

  logout() {
    return from(signOut(this.auth));
  }

  get currentUser() {
    return this.auth.currentUser;
  }
}
