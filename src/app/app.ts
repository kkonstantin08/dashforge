import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppearancePreview } from './appearance/appearance-preview';
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
    inject(AppearancePreview);
    void inject(DashboardStore).load();
  }
}
