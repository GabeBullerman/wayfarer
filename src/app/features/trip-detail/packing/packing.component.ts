import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { from } from 'rxjs';
import { PackingService } from '../../../core/services/packing.service';
import { ParticipantService } from '../../../core/services/participant.service';
import { AiAdvisorService, PackingSuggestion } from '../../../core/services/ai-advisor.service';
import { PackingItem, PackingCategory } from '../../../core/models/packing-item.model';
import { TripParticipant } from '../../../core/models/trip-participant.model';
import { Trip } from '../../../core/models/trip.model';

interface CategoryMeta {
  value: PackingCategory;
  label: string;
  icon: string;
  color: string;
}

interface CategoryGroup {
  meta: CategoryMeta;
  items: PackingItem[];
  packed: number;
}

@Component({
  selector: 'app-packing',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCheckboxModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressBarModule, MatTooltipModule, MatChipsModule, MatProgressSpinnerModule,
  ],
  templateUrl: './packing.component.html',
  styleUrl: './packing.component.scss',
})
export class PackingComponent implements OnInit {
  @Input() tripId!: string;
  @Input() trip!: Trip;

  private packingService = inject(PackingService);
  private participantService = inject(ParticipantService);
  private aiService = inject(AiAdvisorService);
  private fb = inject(FormBuilder);

  items = signal<PackingItem[]>([]);
  participants = signal<TripParticipant[]>([]);
  showAddForm = signal(false);
  saving = signal(false);
  filterPersonId = signal<string>('');
  aiSuggestions = signal<PackingSuggestion[]>([]);
  loadingAi = signal(false);
  showAiPanel = signal(false);

  readonly categories: CategoryMeta[] = [
    { value: 'documents',   label: 'Documents',   icon: 'description',     color: '#1565c0' },
    { value: 'clothing',    label: 'Clothing',     icon: 'checkroom',       color: '#6a1b9a' },
    { value: 'electronics', label: 'Electronics',  icon: 'devices',         color: '#0277bd' },
    { value: 'toiletries',  label: 'Toiletries',   icon: 'soap',            color: '#00695c' },
    { value: 'medicine',    label: 'Medicine',     icon: 'medication',      color: '#c62828' },
    { value: 'gear',        label: 'Gear',         icon: 'backpack',        color: '#2e7d32' },
    { value: 'food',        label: 'Food & Snacks',icon: 'lunch_dining',    color: '#e65100' },
    { value: 'other',       label: 'Other',        icon: 'more_horiz',      color: '#455a64' },
  ];

  addForm = this.fb.group({
    name:       ['', [Validators.required]],
    category:   ['other' as PackingCategory, [Validators.required]],
    quantity:   [1, [Validators.required, Validators.min(1)]],
    assignedTo: [null as string | null],
  });

  readonly filteredItems = computed(() => {
    const id = this.filterPersonId();
    if (!id) return this.items();
    return this.items().filter(i => !i.assignedTo || i.assignedTo === id);
  });

  readonly groups = computed((): CategoryGroup[] => {
    const items = this.filteredItems();
    return this.categories
      .map(meta => {
        const catItems = items.filter(i => i.category === meta.value);
        return { meta, items: catItems, packed: catItems.filter(i => i.isPacked).length };
      })
      .filter(g => g.items.length > 0);
  });

  readonly totalItems = computed(() => this.filteredItems().length);
  readonly totalPacked = computed(() => this.filteredItems().filter(i => i.isPacked).length);
  readonly progressPct = computed(() =>
    this.totalItems() > 0 ? Math.round((this.totalPacked() / this.totalItems()) * 100) : 0
  );

  ngOnInit() {
    this.packingService.getItems(this.tripId).subscribe(items => this.items.set(items));
    this.participantService.getParticipants(this.tripId).subscribe(p => this.participants.set(p));
  }

  togglePacked(item: PackingItem) {
    from(this.packingService.togglePacked(item.id!, !item.isPacked)).subscribe();
  }

  deleteItem(item: PackingItem) {
    from(this.packingService.deleteItem(item.id!)).subscribe();
  }

  saveAdd() {
    if (this.addForm.invalid) return;
    this.saving.set(true);
    const v = this.addForm.getRawValue();
    from(this.packingService.createItem({
      tripId: this.tripId,
      name: v.name!,
      category: v.category! as PackingCategory,
      quantity: v.quantity!,
      assignedTo: v.assignedTo ?? null,
      isPacked: false,
    })).subscribe(() => {
      this.saving.set(false);
      this.addForm.reset({ name: '', category: 'other', quantity: 1, assignedTo: null });
      this.showAddForm.set(false);
    });
  }

  cancelAdd() {
    this.addForm.reset({ name: '', category: 'other', quantity: 1, assignedTo: null });
    this.showAddForm.set(false);
  }

  get selectedSuggestionsCount(): number {
    return this.aiSuggestions().filter(s => s.selected).length;
  }

  fetchAiSuggestions() {
    if (this.loadingAi()) return;
    this.loadingAi.set(true);
    this.showAiPanel.set(true);
    const existing = this.items().map(i => i.name);
    this.aiService.getPackingSuggestions(this.trip, existing).subscribe(suggestions => {
      this.aiSuggestions.set(suggestions);
      this.loadingAi.set(false);
    });
  }

  toggleSuggestion(index: number) {
    this.aiSuggestions.update(list =>
      list.map((s, i) => i === index ? { ...s, selected: !s.selected } : s)
    );
  }

  addSelectedSuggestions() {
    const selected = this.aiSuggestions().filter(s => s.selected);
    const adds = selected.map(s =>
      from(this.packingService.createItem({
        tripId: this.tripId,
        name: s.name,
        category: s.category,
        quantity: s.quantity,
        assignedTo: null,
        isPacked: false,
      }))
    );
    adds.forEach(a => a.subscribe());
    this.showAiPanel.set(false);
    this.aiSuggestions.set([]);
  }

  participantName(id: string | null | undefined): string {
    if (!id) return 'Everyone';
    return this.participants().find(p => p.id === id)?.name ?? 'Unknown';
  }

  categoryMeta(value: PackingCategory): CategoryMeta {
    return this.categories.find(c => c.value === value)!;
  }
}
