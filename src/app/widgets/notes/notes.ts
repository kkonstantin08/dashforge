import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  viewChild,
} from '@angular/core';
import { DashboardStore } from '../../dashboard/dashboard-store';
import type { Note, Widget } from '../../dashboard/workspace';

@Component({
  selector: 'app-notes-widget',
  host: { '[class.in-panel]': 'settings()' },
  template: `
    <div class="note-actions">
      <button type="button" (click)="add()">New note</button>
      @if (selected(); as note) {
        <select aria-label="Notes" [value]="note.id" (change)="select($event)">
          @for (item of widget().data.notes; track item.id) {
            <option [value]="item.id" [selected]="item.id === note.id">{{ label(item) }}</option>
          }
        </select>
        <button type="button" (click)="remove(note.id)">Delete note</button>
      }
    </div>
    @if (selected(); as note) {
      <textarea
        #editor
        aria-label="Note text"
        placeholder="Write a note…"
        [value]="note.text"
        (input)="edit(note.id, $event)"
        (blur)="flush()"
        spellcheck="true"
      ></textarea>
    }
  `,
  styles: `
    .note-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .note-actions select {
      max-width: 100%;
      min-width: 0;
    }
    textarea {
      display: block;
      width: 100%;
      min-height: 62px;
      margin-top: 8px;
      resize: vertical;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotesWidget {
  readonly widget = input.required<Widget<'notes'>>();
  readonly settings = input(false);
  private readonly store = inject(DashboardStore);
  private readonly injector = inject(Injector);
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

  protected readonly selected = computed(() => {
    const { notes, activeId } = this.widget().data;
    return notes.find((note) => note.id === activeId) ?? notes[0];
  });

  protected label(note: Note): string {
    return note.text.trim().split('\n', 1)[0].slice(0, 48) || 'Untitled note';
  }

  protected add(): void {
    const widget = this.store.getWidget(this.widget().id, 'notes');
    if (!widget) return;
    const note = { id: crypto.randomUUID(), text: '' };
    this.store.updateWidget({
      ...widget,
      data: { notes: [...widget.data.notes, note], activeId: note.id },
    });
    afterNextRender(() => this.editor()?.nativeElement.focus(), { injector: this.injector });
  }

  protected edit(id: string, event: Event): void {
    if (!(event.target instanceof HTMLTextAreaElement)) return;
    const text = event.target.value;
    const widget = this.store.getWidget(this.widget().id, 'notes');
    if (!widget) return;
    const notes = widget.data.notes.map((note) => (note.id === id ? { ...note, text } : note));
    this.store.updateWidget({ ...widget, data: { ...widget.data, notes } }, true);
  }

  protected select(event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const widget = this.store.getWidget(this.widget().id, 'notes');
    if (!widget) return;
    this.store.updateWidget({ ...widget, data: { ...widget.data, activeId: event.target.value } });
  }

  protected remove(id: string): void {
    const widget = this.store.getWidget(this.widget().id, 'notes');
    if (!widget) return;
    const notes = widget.data.notes.filter((note) => note.id !== id);
    this.store.updateWidget({ ...widget, data: { notes, activeId: notes[0]?.id } });
  }

  protected flush(): void {
    void this.store.flush();
  }
}
