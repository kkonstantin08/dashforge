import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { WidgetContent } from '../widgets/widget-content';
import { WIDGETS } from '../widgets/widget-registry';
import { PLACEMENT_ERRORS } from './grid-gesture';
import { validatePlacement, type Limits, type Placement } from './layout';
import type { View, Widget } from './workspace';

@Component({
  selector: 'app-widget-inspector',
  imports: [ReactiveFormsModule, WidgetContent],
  templateUrl: './widget-inspector.html',
  styleUrl: './widget-inspector.css',
  host: { '(keydown.escape)': 'dismiss($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetInspector {
  readonly widget = input.required<Widget>();
  readonly rect = input.required<Placement>();
  readonly view = input.required<View>();
  readonly limits = input.required<Limits>();
  readonly occupied = input.required<Placement[]>();
  readonly placement = output<Placement>();
  readonly removed = output<void>();
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('panel');
  protected readonly title = computed(() => WIDGETS[this.widget().type].title + ' settings');
  protected readonly error = signal('');
  protected readonly form = new FormGroup({
    col: new FormControl(1, { nonNullable: true }),
    row: new FormControl(1, { nonNullable: true }),
    width: new FormControl(1, { nonNullable: true }),
    height: new FormControl(1, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const { col, row, width, height } = this.rect();
      this.form.setValue({ col: col + 1, row: row + 1, width, height });
      this.error.set('');
    });
    afterRenderEffect(() => {
      const panel = this.dialog().nativeElement;
      if (panel.open) panel.close();
      if (this.view() === 'mobile') panel.showModal();
      else panel.show();
    });
  }

  protected submit(): void {
    const { col, row, width, height } = this.form.getRawValue();
    const rect: Placement = { col: col - 1, row: row - 1, width, height };
    const result = validatePlacement(rect, this.occupied(), this.limits());
    if (result !== 'ok') {
      this.error.set(PLACEMENT_ERRORS[result]);
      this.dialog()
        .nativeElement.querySelector<HTMLInputElement>(
          result === 'size' ? '[formControlName="width"]' : '[formControlName="col"]',
        )
        ?.focus();
      return;
    }
    this.error.set('');
    this.placement.emit(rect);
  }

  protected dismiss(event?: Event): void {
    event?.preventDefault();
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
    this.closed.emit();
  }
}
