import { Timestamp } from '@angular/fire/firestore';

/** How the trip is taken — drives tailored recommendations and which fields
 *  are collected (e.g. a road trip needs a start/end and a vehicle). */
export type TripType =
  | 'road-trip'
  | 'flight-domestic'
  | 'flight-international'
  | 'train'
  | 'cruise'
  | 'other';

export type VehicleKind = 'own' | 'rented';

export interface Trip {
  id?: string;
  userId: string;
  name: string;
  destination: string;
  description?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  /** Trip style (defaults to 'other' for pre-existing trips). */
  tripType?: TripType;
  /** Road trips: where the drive begins and ends, and whose vehicle. */
  startLocation?: string;
  endLocation?: string;
  vehicle?: VehicleKind;
  coverPhotoUrl?: string;
  totalCost?: number;
  currency: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  collaboratorIds?: string[];
  /** Lowercased emails granted access — covers invitees who haven't signed up yet. */
  collaboratorEmails?: string[];
  /** Co-owners: full owner privileges alongside the primary `userId` owner.
   *  Co-owners are also kept in collaboratorIds so the trip shows in their list. */
  ownerIds?: string[];
  /** Collaborators (non-owners) the owner has allowed to add schedule items
   *  directly. Everyone else can only propose items for an owner to approve. */
  scheduleEditorIds?: string[];
  inviteToken?: string;
  /** Read-only public sharing: a random token + on/off flag. When enabled,
   *  anyone with /s/<shareToken> can view a sanitized itinerary (no costs,
   *  confirmations, passengers, or unapproved items). Served by api/public-itinerary. */
  shareToken?: string;
  shareEnabled?: boolean;
}
