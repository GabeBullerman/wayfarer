import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

export interface WeatherDay {
  date: Date;
  maxTemp: number;
  minTemp: number;
  precipitation: number;
  code: number;
  emoji: string;
  description: string;
}

function weatherInfo(code: number): { emoji: string; description: string } {
  if (code === 0)               return { emoji: '☀️',  description: 'Clear' };
  if (code <= 3)                return { emoji: '⛅',  description: 'Partly cloudy' };
  if (code <= 48)               return { emoji: '🌫️', description: 'Fog' };
  if (code <= 57)               return { emoji: '🌦️', description: 'Drizzle' };
  if (code <= 67)               return { emoji: '🌧️', description: 'Rain' };
  if (code <= 77)               return { emoji: '🌨️', description: 'Snow' };
  if (code <= 82)               return { emoji: '🌦️', description: 'Showers' };
  if (code <= 86)               return { emoji: '🌨️', description: 'Snow showers' };
  return                               { emoji: '⛈️',  description: 'Thunderstorm' };
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);

  getForecast(destination: string): Observable<WeatherDay[]> {
    return this.http.get<any>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`
    ).pipe(
      switchMap(geo => {
        const loc = geo.results?.[0];
        if (!loc) return of([] as WeatherDay[]);
        return this.http.get<any>(
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${loc.latitude}&longitude=${loc.longitude}` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
          `&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`
        ).pipe(
          map(forecast => {
            if (!forecast?.daily) return [] as WeatherDay[];
            const d = forecast.daily;
            return (d.time as string[]).map((date: string, i: number): WeatherDay => ({
              date: new Date(date),
              maxTemp: Math.round(d.temperature_2m_max[i] ?? 0),
              minTemp: Math.round(d.temperature_2m_min[i] ?? 0),
              precipitation: Math.round((d.precipitation_sum[i] ?? 0) * 10) / 10,
              code: d.weather_code[i] ?? 0,
              ...weatherInfo(d.weather_code[i] ?? 0),
            }));
          })
        );
      }),
      catchError(() => of([] as WeatherDay[]))
    );
  }
}
