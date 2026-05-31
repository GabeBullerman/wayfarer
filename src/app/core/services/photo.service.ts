import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, doc,
  addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp,
} from '@angular/fire/firestore';
import {
  Storage, ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from '@angular/fire/storage';
import { Observable } from 'rxjs';
import imageCompression from 'browser-image-compression';
import { Photo } from '../models/photo.model';
import { AuthService } from './auth.service';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private auth = inject(AuthService);
  private injector = inject(Injector);

  private run<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  getPhotos(tripId: string): Observable<Photo[]> {
    return this.run(() => {
      const q = query(
        collection(this.firestore, 'photos'),
        where('tripId', '==', tripId),
        orderBy('uploadedAt', 'desc')
      );
      return collectionData(q, { idField: 'id' }) as Observable<Photo[]>;
    });
  }

  uploadPhoto(tripId: string, file: File, caption?: string): Observable<number> {
    const userId = this.auth.currentUser!.uid;

    return new Observable(observer => {
      observer.next(0);

      imageCompression(file, COMPRESSION_OPTIONS)
        .then(compressed => {
          const storagePath = `photos/${userId}/${tripId}/${Date.now()}_${file.name}`;
          const storageRef = ref(this.storage, storagePath);
          const uploadTask = uploadBytesResumable(storageRef, compressed);

          uploadTask.on(
            'state_changed',
            snapshot => observer.next((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            err => observer.error(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              const uploaderName = this.auth.currentUser?.displayName ?? 'Unknown';
              await this.run(() =>
                addDoc(collection(this.firestore, 'photos'), {
                  tripId, userId, uploaderName, url, storagePath,
                  caption: caption ?? '',
                  uploadedAt: serverTimestamp(),
                })
              );
              observer.next(100);
              observer.complete();
            }
          );
        })
        .catch(err => observer.error(err));
    });
  }

  updateCaption(id: string, caption: string) {
    return this.run(() =>
      updateDoc(doc(this.firestore, 'photos', id), { caption })
    );
  }

  async deletePhoto(photo: Photo) {
    await deleteObject(ref(this.storage, photo.storagePath));
    return this.run(() => deleteDoc(doc(this.firestore, 'photos', photo.id!)));
  }
}
