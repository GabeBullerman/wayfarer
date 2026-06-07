import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';
import { Trip } from '../../core/models/trip.model';
import { TripFormDialogComponent } from '../trips/trip-form-dialog/trip-form-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ScheduleComponent } from './schedule/schedule.component';
import { BookingsComponent } from './bookings/bookings.component';
import { PhotosComponent } from './photos/photos.component';
import { CostsComponent } from './costs/costs.component';
import { OverviewComponent } from './overview/overview.component';
import { PeopleComponent } from './people/people.component';
import { PackingComponent } from './packing/packing.component';
import { AiAssistantComponent } from './ai-assistant/ai-assistant.component';
import { TransportComponent } from './transport/transport.component';
import { from } from 'rxjs';

export interface TabDef {
  label: string;
  icon: string;
}

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    AsyncPipe, DatePipe, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
    ScheduleComponent, BookingsComponent, PhotosComponent, CostsComponent,
    OverviewComponent, PeopleComponent, PackingComponent, AiAssistantComponent,
    TransportComponent,
  ],
  templateUrl: './trip-detail.component.html',
  styleUrl: './trip-detail.component.scss',
})
export class TripDetailComponent implements OnInit {
  @Input() id!: string;

  private tripService = inject(TripService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  readonly currentUserId = this.auth.currentUser?.uid ?? '';
  isOwner(trip: Trip): boolean { return trip.userId === this.currentUserId; }

  trip$!: ReturnType<TripService['getTrip']>;

  readonly selectedTab = signal(0);

  readonly tabs: TabDef[] = [
    { label: 'Overview',  icon: 'map' },
    { label: 'Schedule',  icon: 'event_note' },
    { label: 'Bookings',  icon: 'confirmation_number' },
    { label: 'People',    icon: 'group' },
    { label: 'Photos',    icon: 'photo_library' },
    { label: 'Costs',     icon: 'payments' },
    { label: 'Packing',   icon: 'luggage' },
    { label: 'AI',        icon: 'auto_awesome' },
    { label: 'Transport', icon: 'directions_transit' },
  ];

  ngOnInit() {
    this.trip$ = this.tripService.getTrip(this.id);
  }

  get tripId() { return this.id; }

  editTrip(trip: Trip) {
    this.dialog.open(TripFormDialogComponent, { data: { trip }, width: '560px' });
  }

  deleteTrip(trip: Trip) {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Trip', message: `Delete "${trip.name}"? This cannot be undone.` },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        from(this.tripService.deleteTrip(trip.id!)).subscribe(() => {
          this.snackBar.open('Trip deleted', undefined, { duration: 2500 });
          this.router.navigate(['/trips']);
        });
      }
    });
  }

  back() {
    this.router.navigate(['/trips']);
  }

  tripDuration(trip: Trip): number {
    const ms = trip.endDate.toDate().getTime() - trip.startDate.toDate().getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
  }
}
