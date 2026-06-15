import { Injectable } from '@angular/core';
import { Trip } from '../models/trip.model';
import { PushNotificationService } from './push-notification.service';

@Injectable({ providedIn: 'root' })
export class CardReminderService {
  private readonly STORAGE_KEY = 'wayfarer_card_reminders_dismissed';

  getDismissed(): Set<string> {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  }

  dismiss(tripId: string): void {
    const set = this.getDismissed();
    set.add(tripId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...set]));
  }

  isDismissed(tripId: string): boolean {
    return this.getDismissed().has(tripId);
  }

  /** Returns true if trip starts within 14 days and hasn't started yet. */
  shouldRemind(trip: Trip): boolean {
    const msUntil = trip.startDate.toDate().getTime() - Date.now();
    const daysUntil = msUntil / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= 14;
  }

  /**
   * Schedules a browser notification 48 h before departure,
   * but only if that window is within the next 7 days (so the tab
   * is realistically still open).
   */
  scheduleNotification(trip: Trip, pushService: PushNotificationService): void {
    const msUntilDeparture = trip.startDate.toDate().getTime() - Date.now();
    const msUntil48hBefore = msUntilDeparture - 48 * 60 * 60 * 1000;
    if (msUntil48hBefore > 0 && msUntil48hBefore < 7 * 24 * 60 * 60 * 1000) {
      pushService.schedule(
        msUntil48hBefore,
        `Heading to ${trip.destination} soon!`,
        `Don't forget to notify your bank before you travel.`
      );
    }
  }
}
