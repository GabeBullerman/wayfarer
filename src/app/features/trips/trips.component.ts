import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncPipe, DatePipe, TitleCasePipe, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TripService } from '../../core/services/trip.service';
import { ParticipantService } from '../../core/services/participant.service';
import { AuthService } from '../../core/services/auth.service';
import { Trip } from '../../core/models/trip.model';
import { TripFormDialogComponent } from './trip-form-dialog/trip-form-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { DaysUntilPipe } from '../../shared/pipes/days-until.pipe';
import { from, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [
    AsyncPipe, DatePipe, TitleCasePipe, CurrencyPipe,
    MatCardModule, MatButtonModule, MatIconModule,
    MatMenuModule, MatProgressSpinnerModule, MatTooltipModule,
    DaysUntilPipe,
  ],
  templateUrl: './trips.component.html',
  styleUrl: './trips.component.scss',
})
export class TripsComponent implements OnInit {
  private tripService = inject(TripService);
  private participantService = inject(ParticipantService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  readonly currentUserId = this.auth.currentUser?.uid ?? '';
  readonly currentUserEmail = this.auth.currentUser?.email ?? '';

  trips$ = this.tripService.getTrips().pipe(catchError(() => of([])));

  ngOnInit() {
    // Auto-accept any pending invites for this user's email
    if (this.currentUserEmail) {
      this.participantService
        .getPendingInvitesByEmail(this.currentUserEmail)
        .pipe(take(1))
        .subscribe(pending => {
          pending.forEach(p => {
            from(this.participantService.acceptInvite(p.id!, this.currentUserId))
              .subscribe();
          });
          if (pending.length > 0) {
            this.snackBar.open(
              `You've been added to ${pending.length} trip${pending.length > 1 ? 's' : ''}!`,
              undefined,
              { duration: 4000 }
            );
          }
        });
    }
  }

  isOwned(trip: Trip): boolean {
    return trip.userId === this.currentUserId;
  }

  openNewTrip() {
    this.dialog.open(TripFormDialogComponent, { data: {}, width: '560px' });
  }

  openEditTrip(trip: Trip, event: Event) {
    event.stopPropagation();
    this.dialog.open(TripFormDialogComponent, { data: { trip }, width: '560px' });
  }

  deleteTrip(trip: Trip, event: Event) {
    event.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Trip',
        message: `Are you sure you want to delete "${trip.name}"? All data will be lost.`,
      },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        from(this.tripService.deleteTrip(trip.id!)).subscribe(() =>
          this.snackBar.open('Trip deleted', undefined, { duration: 2500 })
        );
      }
    });
  }

  leaveTrip(trip: Trip, event: Event) {
    event.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Leave Trip',
        message: `Leave "${trip.name}"? It will be removed from your trips list.`,
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      // Find and delete this user's participant record for the trip
      this.participantService.getParticipants(trip.id!)
        .pipe(take(1))
        .subscribe(participants => {
          const mine = participants.find(p => p.userId === this.currentUserId);
          if (mine) {
            from(this.participantService.deleteParticipant(mine.id!)).subscribe(() =>
              this.snackBar.open('You have left the trip', undefined, { duration: 2500 })
            );
          }
        });
    });
  }

  openTrip(id: string) {
    this.router.navigate(['/trips', id]);
  }

  tripDuration(trip: Trip): number {
    const ms = trip.endDate.toDate().getTime() - trip.startDate.toDate().getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
  }

  tripStatus(trip: Trip): 'upcoming' | 'ongoing' | 'past' {
    const now = Date.now();
    const start = trip.startDate.toDate().getTime();
    const end = trip.endDate.toDate().getTime();
    if (now < start) return 'upcoming';
    if (now > end) return 'past';
    return 'ongoing';
  }
}
