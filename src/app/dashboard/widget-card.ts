import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { WidgetContent } from '../widgets/widget-content';
import { WIDGETS } from '../widgets/widget-registry';
import type { Widget } from './workspace';

@Component({
  selector: 'article[app-widget-card]',
  imports: [CdkDragHandle, WidgetContent],
  template: `
    <header>
      @if (editing()) {
        <button
          type="button"
          cdkDragHandle
          class="handle move"
          [attr.aria-label]="'Move ' + title()"
          title="Drag or press Enter for position settings"
          (click)="openByKeyboard($event)"
        >
          ↕
        </button>
      }
      <h2>{{ title() }}</h2>
      <button
        type="button"
        class="handle settings"
        [attr.aria-label]="title() + ' settings'"
        title="Widget settings"
        (click)="inspect($event)"
      >
        ⋯
      </button>
    </header>
    <div class="content"><app-widget-content [widget]="widget()" /></div>
    @if (editing()) {
      <button
        type="button"
        class="handle resize"
        [attr.aria-label]="'Resize ' + title()"
        title="Drag or press Enter for size settings"
        (pointerdown)="resized.emit($event)"
        (click)="openByKeyboard($event)"
      >
        ↘
      </button>
    }
  `,
  styleUrl: './widget-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCard {
  readonly widget = input.required<Widget>();
  readonly editing = input(false);
  readonly inspected = output<HTMLElement>();
  readonly resized = output<PointerEvent>();

  protected readonly title = computed(() => WIDGETS[this.widget().type].title);

  protected openByKeyboard(event: MouseEvent): void {
    if (event.detail === 0) this.inspect(event);
  }

  protected inspect(event: MouseEvent): void {
    if (event.currentTarget instanceof HTMLElement) this.inspected.emit(event.currentTarget);
  }
}
