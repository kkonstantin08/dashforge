import type { CdkDrag, CdkDragEnd } from '@angular/cdk/drag-drop';
import { validatePlacement, type Limits, type Placement, type PlacementResult } from './layout';

type Mode = 'move' | 'resize';
type Point = { x: number; y: number };

export function placementFromDelta(
  rect: Placement,
  mode: Mode,
  dx: number,
  dy: number,
  x: number,
  y: number,
): Placement {
  const columns = Math.round(dx / x);
  const rows = Math.round(dy / y);
  return mode === 'move'
    ? { ...rect, col: rect.col + columns, row: rect.row + rows }
    : { ...rect, width: rect.width + columns, height: rect.height + rows };
}

export const PLACEMENT_ERRORS: Record<Exclude<PlacementResult, 'ok'>, string> = {
  bounds: 'Outside the grid',
  size: 'Minimum widget size was not met',
  collision: 'Overlaps another widget',
};

type GestureTarget = {
  grid: HTMLElement;
  preview: HTMLElement;
  rect: Placement;
  limits: Limits;
  occupied: Placement[];
  commit: (rect: Placement) => void;
};

interface Gesture {
  target: GestureTarget;
  mode: Mode;
  stepX: number;
  stepY: number;
  gap: number;
  frame?: number;
  distance: Point;
  origin: Point;
  cleanup?: () => void;
  controller: AbortController;
}

export class GridGesture {
  private active?: Gesture;
  private drag?: CdkDrag;

  startDrag(source: CdkDrag, target: GestureTarget): void {
    if (this.active) this.cancel();
    this.drag = source;
    const session = this.begin(target, 'move', { x: window.scrollX, y: window.scrollY });
    const subscription = source.moved.subscribe(({ distance }) =>
      this.queue(session, {
        x: distance.x + window.scrollX - session.origin.x,
        y: distance.y + window.scrollY - session.origin.y,
      }),
    );
    session.cleanup = () => subscription.unsubscribe();
  }

  endDrag({ source, distance, event }: CdkDragEnd): void {
    if (source !== this.drag) return;
    const session = this.active;
    source.reset();
    source.getRootElement().classList.remove('drag-cancelled');
    this.drag = undefined;
    if (!session) return;
    if (event.type === 'touchcancel') {
      this.clear(session);
      return;
    }
    this.complete(session, {
      x: distance.x + window.scrollX - session.origin.x,
      y: distance.y + window.scrollY - session.origin.y,
    });
  }

  startResize(event: PointerEvent, target: GestureTarget): void {
    if (this.active || this.drag || !event.isPrimary || event.button !== 0) return;
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    const session = this.begin(target, 'resize', { x: event.pageX, y: event.pageY });
    const options = { signal: session.controller.signal };
    const delta = (pointer: PointerEvent): Point => ({
      x: pointer.pageX - session.origin.x,
      y: pointer.pageY - session.origin.y,
    });
    handle.addEventListener(
      'pointermove',
      (pointer) => {
        if (pointer.pointerId === event.pointerId) this.queue(session, delta(pointer));
      },
      options,
    );
    handle.addEventListener(
      'pointerup',
      (pointer) => {
        if (pointer.pointerId === event.pointerId) this.complete(session, delta(pointer));
      },
      options,
    );
    const cancel = (pointer: PointerEvent) => {
      if (pointer.pointerId === event.pointerId) this.cancel();
    };
    handle.addEventListener('pointercancel', cancel, options);
    handle.addEventListener('lostpointercapture', cancel, options);
    session.cleanup = () => {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
  }

  cancel(): void {
    if (!this.active) return;
    if (this.drag) {
      this.drag.getRootElement().classList.add('drag-cancelled');
      this.drag.reset();
    }
    this.clear(this.active);
  }

  dispose(): void {
    this.cancel();
    this.drag?.getRootElement().classList.remove('drag-cancelled');
    this.drag = undefined;
  }

  private begin(target: GestureTarget, mode: Mode, origin: Point): Gesture {
    const gap = Number.parseFloat(getComputedStyle(target.grid).columnGap);
    const session: Gesture = {
      target,
      mode,
      origin,
      gap,
      stepX: (target.grid.clientWidth + gap) / target.limits.columns,
      stepY: 48 + gap,
      distance: { x: 0, y: 0 },
      controller: new AbortController(),
    };
    this.active = session;
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.cancel();
        }
      },
      { capture: true, signal: session.controller.signal },
    );
    this.paint(session);
    return session;
  }

  private queue(session: Gesture, distance: Point): void {
    session.distance = distance;
    if (session.frame !== undefined) return;
    session.frame = requestAnimationFrame(() => {
      session.frame = undefined;
      this.paint(session);
    });
  }

  private paint(session: Gesture): void {
    const { target, stepX, stepY, gap, distance } = session;
    const candidate = placementFromDelta(
      target.rect,
      session.mode,
      distance.x,
      distance.y,
      stepX,
      stepY,
    );
    const status = validatePlacement(candidate, target.occupied, target.limits);
    const col = Math.max(0, Math.min(target.limits.columns - 1, candidate.col));
    const row = Math.max(0, Math.min(target.limits.rows - 1, candidate.row));
    const width = Math.max(1, Math.min(target.limits.columns - col, candidate.width));
    const height = Math.max(1, Math.min(target.limits.rows - row, candidate.height));
    const { preview } = target;
    preview.hidden = false;
    preview.dataset['state'] = status;
    preview.style.left = col * stepX + 'px';
    preview.style.top = row * stepY + 'px';
    preview.style.width = width * stepX - gap + 'px';
    preview.style.height = height * stepY - gap + 'px';
    preview.textContent = status === 'ok' ? '' : PLACEMENT_ERRORS[status];
  }

  private complete(session: Gesture, distance: Point): void {
    const { target, stepX, stepY, mode } = session;
    const candidate = placementFromDelta(target.rect, mode, distance.x, distance.y, stepX, stepY);
    this.clear(session);
    target.commit(candidate);
  }

  private clear(session: Gesture): void {
    session.target.preview.hidden = true;
    if (session.frame !== undefined) cancelAnimationFrame(session.frame);
    session.controller.abort();
    session.cleanup?.();
    this.active = undefined;
  }
}
