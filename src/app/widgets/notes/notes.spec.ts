import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DashboardStore } from '../../dashboard/dashboard-store';
import { IndexedDbWorkspace } from '../../storage/indexed-db';
import { NotesWidget } from './notes';

describe('Notes', () => {
  it('keeps both notes when the next action happens before the view refreshes', async () => {
    TestBed.configureTestingModule({
      imports: [NotesWidget],
      providers: [
        { provide: IndexedDbWorkspace, useValue: { write: vi.fn().mockResolvedValue(1) } },
      ],
    });
    const store = TestBed.inject(DashboardStore);
    const fixture = TestBed.createComponent(NotesWidget);
    const widget = store.workspace().widgets.find((item) => item.type === 'notes')!;
    fixture.componentRef.setInput('widget', widget);
    await fixture.whenStable();
    const add = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    add.click();
    add.click();
    const current = store.workspace().widgets.find((item) => item.id === widget.id);
    expect(current?.type === 'notes' && current.data.notes.length).toBe(2);
  });
});
