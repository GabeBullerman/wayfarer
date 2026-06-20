import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

/** Raw flight status as returned by /api/flight-status (times are ISO strings). */
export interface FlightStatusResult {
  flightStatus: string | null;
  airline: string | null;
  flightNumber: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  scheduledDeparture: string | null;
  estimatedDeparture: string | null;
  actualDeparture: string | null;
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  departureTerminal: string | null;
  departureGate: string | null;
  arrivalTerminal: string | null;
  arrivalGate: string | null;
  departureDelayMinutes: number | null;
  arrivalDelayMinutes: number | null;
  source: string;
}

export interface FlightStatusResponse {
  configured?: boolean;
  found?: boolean;
  status?: FlightStatusResult;
  message?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class FlightService {
  private http = inject(HttpClient);

  /**
   * Look up live status for a flight by IATA number (e.g. "DL123").
   * `date` is an optional YYYY-MM-DD to disambiguate recurring flight numbers.
   */
  getStatus(flightNumber: string, date?: string): Observable<FlightStatusResponse> {
    return this.http
      .post<FlightStatusResponse>('/api/flight-status', { flightNumber, date })
      .pipe(catchError(() => of({ error: 'Could not reach the flight status service.' })));
  }
}
