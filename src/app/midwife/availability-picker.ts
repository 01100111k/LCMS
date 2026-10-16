import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { AppointmentsService, formatTime, isPast, parseIso, slotsFor, toIso, todayIso } from '../core/appointments.service';

interface Cell {
  iso: string;
  day: number;
  state: 'past' | 'closed' | 'full' | 'open';
  label: string;
}

/** A month calendar showing open days, and the open times for the chosen day. */
@Component({
  selector: 'app-availability-picker',
  template: `
    <div class="cal">
      <div class="cal__head">
        <button type="button" class="cal__nav" (click)="shift(-1)" [disabled]="!canPrev()" aria-label="Previous month">‹</button>
        <strong aria-live="polite">{{ monthLabel() }}</strong>
        <button type="button" class="cal__nav" (click)="shift(1)" aria-label="Next month">›</button>
      </div>

      <div class="cal__week" aria-hidden="true">
        @for (w of weekdays; track w) { <span>{{ w }}</span> }
      </div>
      <div class="cal__grid">
        @for (c of cells(); track $index) {
          @if (c) {
            <button type="button" class="day" [class.open]="c.state === 'open'" [class.full]="c.state === 'full'"
                    [class.sel]="c.iso === date()" [disabled]="c.state !== 'open'"
                    [attr.aria-pressed]="c.iso === date()" [attr.aria-label]="c.label" (click)="pickDay(c.iso)">{{ c.day }}</button>
          } @else {
            <span></span>
          }
        }
      </div>

      <p class="legend">
        <span><i class="key key--open"></i>Available</span>
        <span><i class="key key--full"></i>Fully booked</span>
        <span><i class="key key--off"></i>Closed or past</span>
      </p>

      @if (loadError()) { <p class="msg" role="alert">{{ loadError() }}</p> }

      @if (date()) {
        <h3 class="times__title">{{ dateLabel() }}</h3>
        @if (slots().length) {
          <div class="times" role="group" aria-label="Times">
            @for (s of slots(); track s.time) {
              <button type="button" class="time" [class.sel]="s.time === time()" [disabled]="s.taken || s.past"
                      [attr.aria-pressed]="s.time === time()" (click)="pickTime(s.time)">
                {{ fmt(s.time) }}@if (s.taken) { <small>Booked</small> }
              </button>
            }
          </div>
        } @else {
          <p class="hint">The clinic is closed on this day.</p>
        }
      } @else {
        <p class="hint">Select a date to see the available times.</p>
      }
    </div>
  `,
  styles: `
    .cal { max-width: 460px; }
    .cal__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; color: var(--brand-900); }
    .cal__nav { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--line); background: #fff; font-size: 20px; line-height: 1; color: var(--brand-700); cursor: pointer; }
    .cal__nav:hover:not(:disabled) { background: var(--tint-100); }
    .cal__nav:disabled { opacity: .4; cursor: default; }
    .cal__week, .cal__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .cal__week span { text-align: center; font-size: 12px; font-weight: 600; color: var(--muted); padding-bottom: 4px; }
    .day { aspect-ratio: 1; border: 1.5px solid transparent; border-radius: 10px; background: transparent; font: inherit; font-size: 14px; color: #a7a0b4; cursor: default; }
    .day.open { background: var(--tint-100); color: var(--brand-900); font-weight: 600; cursor: pointer; }
    .day.open:hover { border-color: var(--brand-600); }
    .day.full { background: #f6eef2; color: #b06a85; text-decoration: line-through; }
    .day.sel, .day.sel:hover { background: var(--brand-700); border-color: var(--brand-700); color: #fff; }
    .day:focus-visible, .time:focus-visible, .cal__nav:focus-visible { outline: 3px solid var(--brand-600); outline-offset: 2px; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 12px 0 0; font-size: 12.5px; color: var(--muted); }
    .key { display: inline-block; width: 12px; height: 12px; border-radius: 4px; margin-right: 6px; vertical-align: -1px; }
    .key--open { background: var(--tint-100); border: 1px solid var(--brand-500); }
    .key--full { background: #f6eef2; }
    .key--off { background: #ece9f1; }
    .times__title { margin: 20px 0 10px; font-size: 14.5px; font-weight: 600; color: var(--brand-900); }
    .times { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
    .time { padding: 10px 8px; border: 1.5px solid var(--line); border-radius: 10px; background: #fff; font: inherit; font-size: 14px; font-weight: 600; color: var(--brand-900); cursor: pointer; }
    .time small { display: block; font-size: 11px; font-weight: 500; color: var(--muted); }
    .time:hover:not(:disabled) { border-color: var(--brand-600); background: var(--tint-50); }
    .time:disabled { background: #f3f1f6; color: #a7a0b4; cursor: not-allowed; }
    .time.sel, .time.sel:hover { background: var(--brand-700); border-color: var(--brand-700); color: #fff; }
    .hint { margin: 16px 0 0; font-size: 13.5px; color: var(--muted); }
    .msg { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; background: #fbe6ee; color: #8f2a52; font-size: 13.5px; }
  `,
})
export class AvailabilityPicker {
  private svc = inject(AppointmentsService);

  /** The chosen date (YYYY-MM-DD) and time (HH:mm). The parent binds both with [(date)] and [(time)]. */
  readonly date = model('');
  readonly time = model('');
  /** When rescheduling, the appointment's own time still counts as free. */
  readonly ignoreId = input<string | null>(null);

  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly fmt = formatTime;
  readonly month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly booked = signal<Record<string, Record<string, string>>>({});
  readonly loadError = signal('');
  private jumped = false;

  constructor() {
    // If a date is already chosen (editing), show its month first.
    effect(() => {
      const d = this.date();
      if (d && !this.jumped) {
        this.jumped = true;
        const dt = parseIso(d);
        untracked(() => this.month.set(new Date(dt.getFullYear(), dt.getMonth(), 1)));
      }
    });
    // Load the booked times whenever the month changes.
    effect(() => {
      const m = this.month();
      untracked(() => void this.load(m));
    });
  }

  readonly monthLabel = computed(() =>
    this.month().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  );

  readonly canPrev = computed(() => {
    const m = this.month();
    const n = new Date();
    return m.getFullYear() * 12 + m.getMonth() > n.getFullYear() * 12 + n.getMonth();
  });

  readonly cells = computed<(Cell | null)[]>(() => {
    const m = this.month();
    const booked = this.booked();
    const ignore = this.ignoreId();
    const today = todayIso();
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const out: (Cell | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= count; d++) {
      const iso = toIso(new Date(m.getFullYear(), m.getMonth(), d));
      const slots = slotsFor(iso);
      let state: Cell['state'];
      if (iso < today) state = 'past';
      else if (!slots.length) state = 'closed';
      else {
        const free = slots.filter((t) => !isPast(iso, t) && !this.isTaken(booked, iso, t, ignore)).length;
        state = free > 0 ? 'open' : 'full';
      }
      const words = state === 'open' ? 'available' : state === 'full' ? 'fully booked' : 'not available';
      out.push({ iso, day: d, state, label: `${this.longDate(iso)}, ${words}` });
    }
    return out;
  });

  readonly slots = computed(() => {
    const d = this.date();
    if (!d) return [];
    const booked = this.booked();
    const ignore = this.ignoreId();
    return slotsFor(d).map((t) => ({ time: t, taken: this.isTaken(booked, d, t, ignore), past: isPast(d, t) }));
  });

  readonly dateLabel = computed(() => (this.date() ? this.longDate(this.date()) : ''));

  shift(by: number): void {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + by, 1));
  }

  pickDay(iso: string): void {
    if (iso !== this.date()) this.time.set('');
    this.date.set(iso);
  }

  pickTime(t: string): void {
    this.time.set(t);
  }

  /** Re-checks which times are booked (used after a booking conflict). */
  reload(): Promise<void> {
    return this.load(this.month());
  }

  private async load(m: Date): Promise<void> {
    const from = toIso(new Date(m.getFullYear(), m.getMonth(), 1));
    const to = toIso(new Date(m.getFullYear(), m.getMonth() + 1, 0));
    try {
      this.booked.set(await this.svc.bookedBetween(from, to));
      this.loadError.set('');
    } catch (e) {
      this.loadError.set(this.svc.errorMessage(e));
    }
  }

  private isTaken(booked: Record<string, Record<string, string>>, date: string, time: string, ignore: string | null): boolean {
    const id = booked[date]?.[time];
    return !!id && id !== ignore;
  }

  private longDate(iso: string): string {
    return parseIso(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
}