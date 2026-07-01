import { Injectable } from '@angular/core';
import { AIRPORT_TIMEZONES } from '../data/airport-timezones';

/**
 * Resolves airport timezones and produces short zone labels (e.g. "MST",
 * "CEST") so flight times can be annotated with the airport's local zone —
 * making it obvious when a flight crosses time zones.
 *
 * NOTE on the data model: bookings currently store flight times as wall-clock
 * Timestamps (the number the user typed), not as an instant tagged with the
 * airport's zone. This service therefore only LABELS the existing displayed
 * time with the airport's zone abbreviation; it does not re-convert the time.
 * A fully timezone-correct model (storing each time against its airport zone)
 * is tracked as a follow-up in SORTREK_BACKLOG.md.
 */
@Injectable({ providedIn: 'root' })
export class TimezoneService {
  /** Extract a 3-letter IATA code from a free-form airport string ("DEN", "Denver (DEN)"). */
  private extractIata(airport?: string | null): string | null {
    if (!airport) return null;
    const direct = airport.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(direct)) return direct;
    const m = airport.toUpperCase().match(/\b([A-Z]{3})\b/);
    return m ? m[1] : null;
  }

  /** IANA timezone for an airport string, or null if unknown. */
  ianaFor(airport?: string | null): string | null {
    const code = this.extractIata(airport);
    return code ? (AIRPORT_TIMEZONES[code] ?? null) : null;
  }

  /** Short zone label (e.g. "MST", "CEST") for an airport on a given date, or null. */
  zoneLabel(airport?: string | null, onDate: Date = new Date()): string | null {
    const iana = this.ianaFor(airport);
    if (!iana) return null;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: iana,
        timeZoneName: 'short',
        hour: 'numeric',
      }).formatToParts(onDate);
      return parts.find(p => p.type === 'timeZoneName')?.value ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Interpret a wall-clock (a picked date + "HH:MM") as local time AT THE
   * AIRPORT, and return the matching absolute UTC instant. Falls back to the
   * device's local zone when the airport zone is unknown. Store the result so
   * the time is anchored to the airport, independent of who views it.
   */
  wallToUtc(date: Date, timeStr?: string | null, airport?: string | null): Date {
    const d = new Date(date);
    let hh = d.getHours(), mm = d.getMinutes();
    if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr)) {
      const [h, m] = timeStr.split(':').map(Number);
      hh = h; mm = m;
    }
    const iana = this.ianaFor(airport);
    if (!iana) { d.setHours(hh, mm, 0, 0); return d; } // fallback: device local
    // The picked date's LOCAL parts are the calendar day; combine with the wall
    // time, treat as if UTC, then subtract the airport zone's offset.
    const guess = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
    const off = this.offsetMinutes(iana, new Date(guess)) ?? 0;
    return new Date(guess - off * 60000);
  }

  /** Format an instant's time in the airport's local zone (device zone if
   *  unknown), e.g. "2:35 PM". */
  formatTime(instant?: Date | null, airport?: string | null): string | null {
    if (!instant) return null;
    const iana = this.ianaFor(airport) ?? undefined;
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: iana, hour: 'numeric', minute: '2-digit' }).format(instant);
    } catch {
      return instant.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
  }

  /** The airport-zone wall-clock parts of an instant, for prefilling an edit
   *  form so the user sees/edits the airport-local date & time. */
  zoneWallParts(instant: Date, airport?: string | null): { date: Date; time: string } {
    const iana = this.ianaFor(airport);
    const hm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (!iana) {
      const d = new Date(instant);
      return { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), time: hm(d.getHours(), d.getMinutes()) };
    }
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: iana, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const p = dtf.formatToParts(instant);
    const get = (t: string) => Number(p.find(x => x.type === t)?.value);
    let hh = get('hour'); if (hh === 24) hh = 0;
    return { date: new Date(get('year'), get('month') - 1, get('day')), time: hm(hh, get('minute')) };
  }

  /** UTC offset in minutes for an IANA zone at a given instant. */
  private offsetMinutes(iana: string, date: Date): number | null {
    try {
      // Format the same instant in UTC and in the target zone, diff the wall times.
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: iana, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
      const parts = dtf.formatToParts(date);
      const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
      const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
      return Math.round((asUTC - date.getTime()) / 60000);
    } catch {
      return null;
    }
  }

  /**
   * True when both airports' zones are known AND their UTC offsets differ at the
   * given times — i.e. the flight crosses time zones and labels should be shown.
   */
  crossesZones(
    depAirport?: string | null, arrAirport?: string | null,
    depDate: Date = new Date(), arrDate: Date = new Date(),
  ): boolean {
    const depZone = this.ianaFor(depAirport);
    const arrZone = this.ianaFor(arrAirport);
    if (!depZone || !arrZone) return false;
    if (depZone === arrZone) return false;
    const depOff = this.offsetMinutes(depZone, depDate);
    const arrOff = this.offsetMinutes(arrZone, arrDate);
    if (depOff == null || arrOff == null) return false;
    return depOff !== arrOff;
  }
}
