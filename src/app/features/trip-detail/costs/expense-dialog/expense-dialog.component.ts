import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ParticipantService } from '../../../../core/services/participant.service';
import { TripParticipant } from '../../../../core/models/trip-participant.model';
import { Expense, ExpenseCategory } from '../../../../core/models/expense.model';
import { Timestamp } from '@angular/fire/firestore';

export interface ExpenseDialogData {
  tripId: string;
  tripCurrency: string;
  expense?: Expense;
}

@Component({
  selector: 'app-expense-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatCheckboxModule, MatDatepickerModule, MatNativeDateModule,
  ],
  templateUrl: './expense-dialog.component.html',
  styleUrl: './expense-dialog.component.scss',
})
export class ExpenseDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private participantService = inject(ParticipantService);
  private dialogRef = inject(MatDialogRef<ExpenseDialogComponent>);
  readonly data: ExpenseDialogData = inject(MAT_DIALOG_DATA);

  participants = signal<TripParticipant[]>([]);
  saving = signal(false);

  readonly categories: { value: ExpenseCategory; label: string; icon: string }[] = [
    { value: 'food',          label: 'Food & Drink',      icon: 'restaurant' },
    { value: 'transport',     label: 'Transport',          icon: 'directions_car' },
    { value: 'activity',      label: 'Activity',           icon: 'local_activity' },
    { value: 'accommodation', label: 'Accommodation',      icon: 'hotel' },
    { value: 'shopping',      label: 'Shopping',           icon: 'shopping_bag' },
    { value: 'other',         label: 'Other',              icon: 'more_horiz' },
  ];

  readonly commonCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'MXN', 'CHF'];

  form = this.fb.group({
    title:          [this.data.expense?.title ?? '',       [Validators.required]],
    amount:         [this.data.expense?.amount ?? null,    [Validators.required, Validators.min(0.01)]],
    currency:       [this.data.expense?.currency ?? this.data.tripCurrency, [Validators.required]],
    category:       [this.data.expense?.category ?? 'other' as ExpenseCategory, [Validators.required]],
    paidById:       [this.data.expense?.paidById ?? null as string | null],
    participantIds: [this.data.expense?.participantIds ?? [] as string[]],
    date:           [this.data.expense?.date ? this.data.expense.date.toDate() : null as Date | null],
    notes:          [this.data.expense?.notes ?? ''],
    pointsUsed:     [this.data.expense?.pointsUsed ?? null as number | null],
    pointsProgram:  [this.data.expense?.pointsProgram ?? ''],
  });

  ngOnInit() {
    this.participantService.getParticipants(this.data.tripId).subscribe(p => {
      this.participants.set(p);
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const result: Omit<Expense, 'id' | 'createdAt'> = {
      tripId:         this.data.tripId,
      title:          v.title!,
      amount:         v.amount!,
      currency:       v.currency!,
      category:       v.category! as ExpenseCategory,
      paidById:       v.paidById ?? null,
      participantIds: v.participantIds?.length ? v.participantIds : undefined,
      notes:          v.notes ?? undefined,
      date:           v.date ? Timestamp.fromDate(v.date) : undefined,
      pointsUsed:     v.pointsUsed ? Number(v.pointsUsed) : undefined,
      pointsProgram:  v.pointsProgram?.trim() || undefined,
    };
    this.dialogRef.close(result);
  }

  clearParticipants() {
    this.form.get('participantIds')!.setValue([]);
  }

  selectAllParticipants() {
    this.form.get('participantIds')!.setValue(this.participants().map(p => p.id!));
  }

  cancel() {
    this.dialogRef.close();
  }
}
