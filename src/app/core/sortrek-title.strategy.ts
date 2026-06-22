import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';

export const APP_NAME = 'SorTrek';

@Injectable({ providedIn: 'root' })
export class SortrekTitleStrategy extends TitleStrategy {
  private title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${APP_NAME} | ${page}` : APP_NAME);
  }
}
