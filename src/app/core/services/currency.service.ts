import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

export interface RateResult {
  rate: number;
  from: string;
  to: string;
  fetchedAt: Date;
}

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private http = inject(HttpClient);
  private cache = new Map<string, Observable<RateResult | null>>();

  getRate(from: string, to: string): Observable<RateResult | null> {
    if (from === to) {
      return of({ rate: 1, from, to, fetchedAt: new Date() });
    }

    const key = `${from}-${to}`;
    if (!this.cache.has(key)) {
      const req$ = this.http
        .get<{ rates: Record<string, number> }>(
          `https://api.frankfurter.app/latest?from=${from}&to=${to}`
        )
        .pipe(
          map(res => ({ rate: res.rates[to], from, to, fetchedAt: new Date() })),
          catchError(() => of(null)),
          shareReplay(1)
        );
      this.cache.set(key, req$);
    }
    return this.cache.get(key)!;
  }
}
