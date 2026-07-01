import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { PwaUpdateService } from './core/services/pwa-update.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App implements OnInit {
  // Initialize theming app-wide (incl. auth pages outside the shell).
  private theme = inject(ThemeService);
  private pwaUpdate = inject(PwaUpdateService);

  ngOnInit() {
    // Keep the installed PWA fresh so new deploys show up promptly.
    this.pwaUpdate.init();
  }
}
