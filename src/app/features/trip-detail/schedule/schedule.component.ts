import { Component, Input, OnInit, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AsyncPipe, TitleCasePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { ItineraryItem } from '../../../core/models/itinerary-item.model';
import { Trip } from '../../../core/models/trip.model';
import { ItineraryItemDialogComponent } from './itinerary-item-dialog/itinerary-item-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { map } from 'rxjs/operators';
import { from } from 'rxjs';

interface DayGroup {
  date: Date;
  label: string;
  dayNumber: number;
  items: ItineraryItem[];
}

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    AsyncPipe, TitleCasePipe, DecimalPipe, MatButtonModule, MatIconModule,
    MatChipsModule, MatMenuModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class ScheduleComponent implements OnInit {
  @Input() tripId!: string;
  @Input() trip!: Trip;

  private itineraryService = inject(ItineraryService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  items$!: Observable<DayGroup[]>;

  ngOnInit() {
    this.items$ = this.itineraryService.getItems(this.tripId).pipe(
      map(items => this.groupByDay(items)),
      catchError(() => of(this.groupByDay([])))
    );
  }

  hasTransport(day: DayGroup): boolean {
    return day.items.some(i => i.category === 'transport');
  }

  categoryIcon(cat: string): string {
    const icons: Record<string, string> = {
      transport: 'directions_car',
      accommodation: 'hotel',
      activity: 'local_activity',
      food: 'restaurant',
      other: 'more_horiz',
    };
    return icons[cat] ?? 'circle';
  }

  private groupByDay(items: ItineraryItem[]): DayGroup[] {
    const start = this.trip.startDate.toDate();
    const end = this.trip.endDate.toDate();
    const days: DayGroup[] = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    let dayNum = 1;

    while (cur <= end) {
      const dayStr = cur.toDateString();
      days.push({
        date: new Date(cur),
        label: cur.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        dayNumber: dayNum,
        items: items.filter(i => i.date.toDate().toDateString() === dayStr)
          .sort((a, b) => {
            if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
            return a.order - b.order;
          }),
      });
      cur.setDate(cur.getDate() + 1);
      dayNum++;
    }
    return days;
  }

  openAddItem(date: Date, existingCount: number) {
    this.dialog.open(ItineraryItemDialogComponent, {
      data: { tripId: this.tripId, defaultDate: date, existingCount },
      width: '600px',
      maxHeight: '90vh',
    });
  }

  openEditItem(item: ItineraryItem, allItems: ItineraryItem[]) {
    this.dialog.open(ItineraryItemDialogComponent, {
      data: { tripId: this.tripId, item, existingCount: allItems.length },
      width: '600px',
      maxHeight: '90vh',
    });
  }

  deleteItem(item: ItineraryItem) {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Remove Activity', message: `Remove "${item.title}"?` },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        from(this.itineraryService.deleteItem(item.id!)).subscribe(() =>
          this.snackBar.open('Activity removed', undefined, { duration: 2000 })
        );
      }
    });
  }
}
