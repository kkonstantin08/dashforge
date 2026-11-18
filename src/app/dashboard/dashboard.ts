import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { WIDGETS, WIDGET_TYPES } from '../widgets/widget-registry';
import { DashboardStore } from './dashboard-store';
import { GRID, projectMobile } from './layout';
import type { View, WidgetType } from './workspace';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'updateView()' },
})
export class Dashboard {
  protected readonly store = inject(DashboardStore);
  protected readonly widgets = WIDGETS;
  protected readonly types = WIDGET_TYPES;
  protected readonly editing = signal(false);
  protected readonly message = signal('');
  protected readonly view = signal<View>(window.innerWidth < 760 ? 'mobile' : 'desktop');
  protected readonly columns = computed(() => GRID[this.view()].columns);
  protected readonly positions = computed(() => {
    const workspace = this.store.workspace();
    return this.view() === 'desktop'
      ? workspace.desktop
      : (workspace.mobile ?? projectMobile(workspace));
  });

  protected updateView(): void {
    this.view.set(window.innerWidth < 760 ? 'mobile' : 'desktop');
  }

  protected add(type: WidgetType, catalog: HTMLDialogElement): void {
    if (this.store.add(type) === 'full') {
      this.message.set('There is no room for this widget. Free up space and try again.');
      return;
    }
    this.message.set('');
    if (catalog.open) catalog.close();
  }

  protected reset(): void {
    if (window.confirm('Reset widget positions and sizes? Your content and theme will be kept.')) {
      const result = this.store.resetLayout();
      this.message.set(
        result === 'ok' ? 'Layout reset.' : 'There is not enough space to reset this layout.',
      );
    }
  }
}
