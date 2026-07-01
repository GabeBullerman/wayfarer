import { Injectable, inject, ApplicationRef } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { concat, interval } from 'rxjs';
import { first, filter } from 'rxjs/operators';

/**
 * Keeps the installed PWA fresh. Angular's service worker caches the app, so a
 * new deploy isn't shown until the SW downloads it AND the page is reloaded.
 * Without this, an installed home-screen app can serve a stale version for a
 * long time (until every tab closes). This service:
 *   - checks for updates on startup, on a timer, and whenever the app returns
 *     to the foreground (reopening the home-screen shortcut),
 *   - prompts the user to refresh the moment a new version is downloaded,
 *   - recovers from a broken/unrecoverable SW cache by hard-reloading.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private swUpdate = inject(SwUpdate);
  private appRef = inject(ApplicationRef);
  private snackBar = inject(MatSnackBar);

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    // A new version finished downloading in the background → offer to apply it.
    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        const ref = this.snackBar.open('A new version is available.', 'Refresh', { duration: 0 });
        ref.onAction().subscribe(async () => {
          try { await this.swUpdate.activateUpdate(); } catch { /* ignore */ }
          document.location.reload();
        });
      });

    // If the cache becomes unrecoverable, reload to fetch a clean copy.
    this.swUpdate.unrecoverable.subscribe(() => document.location.reload());

    // Check: once the app is stable, then every 60s.
    const stable$ = this.appRef.isStable.pipe(first(stable => stable === true));
    concat(stable$, interval(60_000)).subscribe(() => this.check());

    // Check whenever the app regains focus — the key path for a reopened
    // home-screen shortcut, which otherwise wouldn't look for a new version.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.check();
      });
    }
  }

  private check(): void {
    this.swUpdate.checkForUpdate().catch(() => { /* offline / transient */ });
  }
}
