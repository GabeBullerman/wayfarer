import { Component, Input, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { AsyncPipe, TitleCasePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, map } from 'rxjs/operators';
import { from, of } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { ItineraryItem } from '../../../core/models/itinerary-item.model';
import { Trip } from '../../../core/models/trip.model';
import { ItineraryItemDialogComponent } from './itinerary-item-dialog/itinerary-item-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

interface DayGroup {
  date: Date;
  label: string;
  shortLabel: string;
  dayNumber: number;
  items: ItineraryItem[];
}

export interface PlanSuggestion {
  title: string;
  category: string;
  time?: string | null;
  description: string;
  location?: string | null;
  estimatedCost?: string | null;
  selected: boolean;
  adding?: boolean;
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
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  allDays = signal<DayGroup[]>([]);
  selectedDayIndex = signal(0);
  findingPlans = signal(false);
  showPlanPanel = signal(false);
  planSuggestions = signal<PlanSuggestion[]>([]);

  readonly selectedDay = computed(() => this.allDays()[this.selectedDayIndex()] ?? null);

  ngOnInit() {
    this.itineraryService.getItems(this.tripId).pipe(
      map(items => this.groupByDay(items)),
      catchError(() => of(this.groupByDay([]))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(days => this.allDays.set(days));
  }

  hasTransport(day: DayGroup): boolean {
    return day.items.some(i => i.category === 'transport');
  }

  isFirstDay(day: DayGroup): boolean {
    return day.dayNumber === 1;
  }

  isLastDay(day: DayGroup): boolean {
    return day.dayNumber === this.allDays().length;
  }

  categoryIcon(cat: string): string {
    const icons: Record<string, string> = {
      transport: 'directions_car', accommodation: 'hotel',
      activity: 'local_activity', food: 'restaurant', other: 'more_horiz',
    };
    return icons[cat] ?? 'circle';
  }

  private groupByDay(items: ItineraryItem[]): DayGroup[] {
    const start = this.trip.startDate.toDate();
    const end   = this.trip.endDate.toDate();
    const days: DayGroup[] = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    let dayNum = 1;

    while (cur <= end) {
      const dayStr = cur.toDateString();
      days.push({
        date: new Date(cur),
        label:      cur.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        shortLabel: cur.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayNumber: dayNum,
        items: items
          .filter(i => i.date.toDate().toDateString() === dayStr)
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

  selectDay(index: number) {
    this.selectedDayIndex.set(index);
    this.showPlanPanel.set(false);
    this.planSuggestions.set([]);
  }

  findPlans() {
    const day = this.selectedDay();
    if (!day || this.findingPlans()) return;
    this.findingPlans.set(true);
    this.showPlanPanel.set(true);
    this.planSuggestions.set([]);

    this.http.post<{ suggestions: PlanSuggestion[] }>('/api/find-plans', {
      destination: this.trip.destination,
      date: day.date.toISOString(),
      dayNumber: day.dayNumber,
      totalDays: this.allDays().length,
    }).pipe(catchError(() => of({ suggestions: [] })))
      .subscribe(res => {
        this.planSuggestions.set((res.suggestions ?? []).map(s => ({ ...s, selected: false })));
        this.findingPlans.set(false);
      });
  }

  closePlanPanel() {
    this.showPlanPanel.set(false);
    this.planSuggestions.set([]);
  }

  addSuggestion(index: number) {
    const day = this.selectedDay();
    if (!day) return;
    const s = this.planSuggestions()[index];

    // Mark as adding
    this.planSuggestions.update(list =>
      list.map((item, i) => i === index ? { ...item, adding: true } : item)
    );

    const newItem: Omit<ItineraryItem, 'id'> = {
      tripId: this.tripId,
      title: s.title,
      category: (['transport','accommodation','activity','food','other'].includes(s.category)
        ? s.category : 'activity') as ItineraryItem['category'],
      date: Timestamp.fromDate(day.date),
      order: day.items.length,
      ...(s.time       ? { startTime: s.time }         : {}),
      ...(s.location   ? { location: s.location }       : {}),
      ...(s.description ? { description: s.description } : {}),
    };

    from(this.itineraryService.createItem(newItem)).subscribe(() => {
      this.planSuggestions.update(list =>
        list.map((item, i) => i === index ? { ...item, adding: false, selected: true } : item)
      );
      this.snackBar.open(`"${s.title}" added to Day ${day.dayNumber}`, undefined, { duration: 2000 });
    });
  }

  openAddItem(date: Date, existingCount: number) {
    this.dialog.open(ItineraryItemDialogComponent, {
      data: { tripId: this.tripId, defaultDate: date, existingCount },
      width: '600px', maxHeight: '90vh',
    });
  }

  openEditItem(item: ItineraryItem, allItems: ItineraryItem[]) {
    this.dialog.open(ItineraryItemDialogComponent, {
      data: { tripId: this.tripId, item, existingCount: allItems.length },
      width: '600px', maxHeight: '90vh',
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
