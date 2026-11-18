import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  type Type,
} from '@angular/core';
import type { Widget } from '../dashboard/workspace';
import { WIDGET_LOADERS } from './widget-registry';

@Component({
  selector: 'app-widget-content',
  imports: [NgComponentOutlet],
  template: `
    @if (failed()) {
      <p role="alert">This widget could not load. Reload the page to try again.</p>
    } @else {
      <ng-container *ngComponentOutlet="component(); inputs: properties()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetContent {
  readonly widget = input.required<Widget>();
  readonly settings = input(false);
  protected readonly component = signal<Type<unknown> | null>(null);
  protected readonly failed = signal(false);
  protected readonly properties = computed(() => ({
    widget: this.widget(),
    settings: this.settings(),
  }));
  private readonly type = computed(() => this.widget().type);

  constructor() {
    effect((onCleanup) => {
      const load = WIDGET_LOADERS[this.type()];
      this.component.set(null);
      this.failed.set(false);
      if (!load) return;
      let active = true;
      onCleanup(() => {
        active = false;
      });
      void load().then(
        (component) => {
          if (active) this.component.set(component);
        },
        () => {
          if (active) this.failed.set(true);
        },
      );
    });
  }
}
