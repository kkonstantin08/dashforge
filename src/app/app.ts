import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Dashboard } from './dashboard/dashboard';
import { DashboardStore } from './dashboard/dashboard-store';

@Component({
  selector: 'app-root',
  imports: [Dashboard],
  template: '<app-dashboard />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    const store = inject(DashboardStore);
    const document = inject(DOCUMENT);
    effect(() => (document.documentElement.dataset['theme'] = store.workspace().theme));
    void store.load();
  }
}
