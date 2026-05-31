import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private http = inject(HttpClient);
  private loaded$?: Observable<boolean>;

  load(): Observable<boolean> {
    if (this.loaded$) return this.loaded$;

    // Already loaded by a previous navigation
    if (typeof (window as any).google?.maps?.places !== 'undefined') {
      this.loaded$ = of(true);
      return this.loaded$;
    }

    this.loaded$ = this.http
      .jsonp(
        `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`,
        'callback'
      )
      .pipe(
        map(() => true),
        catchError(() => of(false)),
        shareReplay(1)
      );
    return this.loaded$;
  }
}
