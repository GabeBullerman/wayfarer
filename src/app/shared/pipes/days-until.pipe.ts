import { Pipe, PipeTransform } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';

@Pipe({ name: 'daysUntil', standalone: true })
export class DaysUntilPipe implements PipeTransform {
  transform(date: Timestamp | undefined): string {
    if (!date) return '';
    const ms = date.toDate().getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Past';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days away`;
  }
}
