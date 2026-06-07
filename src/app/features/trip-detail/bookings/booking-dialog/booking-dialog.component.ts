import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BookingService } from '../../../../core/services/booking.service';
import { Booking, BookingType, BookingStatus } from '../../../../core/models/booking.model';
import { ParticipantService } from '../../../../core/services/participant.service';
import { TripParticipant } from '../../../../core/models/trip-participant.model';
import { Timestamp } from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface BookingDialogData {
  tripId: string;
  booking?: Booking;
}

@Component({
  selector: 'app-booking-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './booking-dialog.component.html',
  styleUrl: './booking-dialog.component.scss',
})
export class BookingDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private bookingService = inject(BookingService);
  private participantService = inject(ParticipantService);
  private dialogRef = inject(MatDialogRef<BookingDialogComponent>);
  data = inject<BookingDialogData>(MAT_DIALOG_DATA);

  loading = signal(false);
  isEdit = !!this.data.booking;
  participants = signal<TripParticipant[]>([]);

  bookingTypes: { value: BookingType; label: string; icon: string }[] = [
    { value: 'flight', label: 'Flight', icon: 'flight' },
    { value: 'hotel', label: 'Hotel', icon: 'hotel' },
    { value: 'airbnb', label: 'Airbnb / Vacation Rental', icon: 'home' },
    { value: 'car-rental', label: 'Car Rental', icon: 'directions_car' },
    { value: 'other', label: 'Other', icon: 'bookmark' },
  ];

  statuses: { value: BookingStatus; label: string }[] = [
    { value: 'confirmed',  label: 'Confirmed' },
    { value: 'pending',    label: 'Pending' },
    { value: 'cancelled',  label: 'Cancelled' },
    { value: 'suggested',  label: 'Suggestion (not yet booked)' },
  ];

  form = this.fb.group({
    type: [this.data.booking?.type ?? 'flight' as BookingType, Validators.required],
    title: [this.data.booking?.title ?? '', Validators.required],
    provider: [this.data.booking?.provider ?? ''],
    confirmationNumber: [this.data.booking?.confirmationNumber ?? ''],
    bookingUrl: [this.data.booking?.bookingUrl ?? ''],
    checkIn: [this.data.booking?.checkIn?.toDate() ?? null],
    checkOut: [this.data.booking?.checkOut?.toDate() ?? null],
    cost: [this.data.booking?.cost ?? null],
    currency: [this.data.booking?.currency ?? 'USD'],
    status: [this.data.booking?.status ?? 'confirmed' as BookingStatus, Validators.required],
    notes: [this.data.booking?.notes ?? ''],
    passengerIds: [this.data.booking?.passengerIds ?? [] as string[]],
    paidById: [this.data.booking?.paidById ?? null as string | null],
  });

  ngOnInit() {
    this.participantService.getParticipants(this.data.tripId).subscribe(p => {
      this.participants.set(p);
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const v = this.form.value;
    const payload: Omit<Booking, 'id' | 'createdAt'> = {
      tripId: this.data.tripId,
      type: v.type!,
      title: v.title!,
      provider: v.provider ?? undefined,
      confirmationNumber: v.confirmationNumber ?? undefined,
      bookingUrl: v.bookingUrl ?? undefined,
      checkIn: v.checkIn ? Timestamp.fromDate(v.checkIn) : undefined,
      checkOut: v.checkOut ? Timestamp.fromDate(v.checkOut) : undefined,
      cost: v.cost ? Number(v.cost) : undefined,
      currency: v.currency ?? undefined,
      status: v.status!,
      notes: v.notes ?? undefined,
      passengerIds: (v.passengerIds as string[])?.length ? (v.passengerIds as string[]) : undefined,
      paidById: v.paidById ?? null,
    };

    const op: Observable<void> = this.isEdit
      ? from(this.bookingService.updateBooking(this.data.booking!.id!, payload))
      : from(this.bookingService.createBooking(payload)).pipe(map(() => undefined));

    op.subscribe({
      next: () => this.dialogRef.close(true),
      error: () => this.loading.set(false),
    });
  }
}
