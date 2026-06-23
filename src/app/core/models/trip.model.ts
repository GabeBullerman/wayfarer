import { Timestamp } from '@angular/fire/firestore';

export interface Trip {
  id?: string;
  userId: string;
  name: string;
  destination: string;
  description?: string;
  startDate: Timestamp;
  endDate: Timestamp;
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
}
