import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Observable, from } from 'rxjs';
import { Router } from '@angular/router';
import { ParticipantService } from '../../../core/services/participant.service';
import { AuthService } from '../../../core/services/auth.service';
import { TripParticipant } from '../../../core/models/trip-participant.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [
    AsyncPipe, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './people.component.html',
  styleUrl: './people.component.scss',
})
export class PeopleComponent implements OnInit {
  @Input() tripId!: string;
  @Input() isOwner = false;

  private participantService = inject(ParticipantService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly currentUserId = this.auth.currentUser?.uid ?? '';

  participants$!: Observable<TripParticipant[]>;
  showAddForm = signal(false);
  saving = signal(false);
  editingId = signal<string | null>(null);

  addForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', Validators.email],
    homeCity: [''],
  });

  editForm = this.fb.group({
    name: ['', Validators.required],
    homeCity: [''],
  });

  ngOnInit() {
    this.participants$ = this.participantService.getParticipants(this.tripId);
  }

  openAdd() {
    this.addForm.reset({ name: '', email: '', homeCity: '' });
    this.showAddForm.set(true);
  }

  cancelAdd() {
    this.showAddForm.set(false);
  }

  saveAdd() {
    if (this.addForm.invalid) return;
    this.saving.set(true);
    const v = this.addForm.value;
    const email = v.email?.trim().toLowerCase() || undefined;

    from(this.participantService.addParticipant({
      tripId: this.tripId,
      name: v.name!.trim(),
      homeCity: v.homeCity?.trim() || undefined,
      isOrganizer: false,
      inviteEmail: email,
      inviteStatus: email ? 'pending' : undefined,
    })).subscribe({
      next: () => {
        this.saving.set(false);
        this.showAddForm.set(false);
        const msg = email
          ? `${v.name!.trim()} added — they'll see this trip when they log in with ${email}`
          : 'Participant added';
        this.snackBar.open(msg, undefined, { duration: 4000 });
      },
      error: () => this.saving.set(false),
    });
  }

  startEdit(p: TripParticipant) {
    this.editingId.set(p.id!);
    this.editForm.setValue({ name: p.name, homeCity: p.homeCity ?? '' });
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  saveEdit(p: TripParticipant) {
    if (this.editForm.invalid) return;
    const v = this.editForm.value;
    from(this.participantService.updateParticipant(p.id!, {
      name: v.name!.trim(),
      homeCity: v.homeCity?.trim() || undefined,
    })).subscribe({
      next: () => {
        this.editingId.set(null);
        this.snackBar.open('Updated', undefined, { duration: 2000 });
      },
    });
  }

  remove(p: TripParticipant) {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Remove Participant', message: `Remove ${p.name} from this trip?` },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        from(this.participantService.deleteParticipant(p.id!)).subscribe(() =>
          this.snackBar.open('Participant removed', undefined, { duration: 2000 })
        );
      }
    });
  }

  leaveTrip(p: TripParticipant) {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Leave Trip',
        message: 'Leave this trip? It will be removed from your trips list.',
      },
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        from(this.participantService.deleteParticipant(p.id!)).subscribe(() => {
          this.snackBar.open('You have left the trip', undefined, { duration: 2500 });
          this.router.navigate(['/trips']);
        });
      }
    });
  }

  isMe(p: TripParticipant): boolean {
    return !!p.userId && p.userId === this.currentUserId;
  }

  initial(name: string): string {
    return name.charAt(0).toUpperCase();
  }
}
