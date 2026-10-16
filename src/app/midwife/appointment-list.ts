import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Appointment, AppointmentsService, formatTime, isPast, todayIso, AppointmentStatus } from '../core/appointments.service';

type Tab = 'upcoming' | 'today' | 'past' | 'cancelled' | 'all';

@Component({
  selector: 'app-appointment-list',
  imports: [RouterLink, DatePipe],
  template: `
    <main class="mw-page">
      <div class="mw-head">
        <div>
          <h1>Appointments</h1>
          <p class="mw-sub">{{ filtered().length }} shown</p>
        </div>
        <a routerLink="/midwife/appointments/new" class="mw-btn mw-btn--solid">Schedule appointment</a>
      </div>

      <div class="tabs" role="tablist" aria-label="Filter appointments">
        @for (t of tabs; track t.id) {
          <button type="button" role="tab" [class.on]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
        }
      </div>

      <input class="mw-search" type="search" placeholder="Search by patient or type of visit"
             aria-label="Search appointments" (input)="query.set($any($event.target).value)">

      @if (loading()) {
        <p class="mw-empty">Loading appointments…</p>
      } @else if (error()) {
        <p class="mw-msg mw-msg--error" role="alert">{{ error() }}</p>
        <div class="mw-actions"><button type="button" class="mw-btn" (click)="load()">Try again</button></div>
      } @else if (!filtered().length) {
        <p class="mw-empty">No appointments here yet.</p>
      } @else {
        <div class="mw-table-wrap">
          <table class="mw-table">
            <thead><tr><th>Date and time</th><th>Patient</th><th>Visit</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (a of filtered(); track a.id) {
                <tr>
                  <td>{{ a.date | date: 'EEE, MMM d, y' }}<small>{{ fmt(a.time) }}</small></td>
                  <td><a [routerLink]="['/midwife/patients', a.patientId]">{{ a.patientName }}</a></td>
                  <td>{{ a.type }}</td>
                  <td><span [class]="'badge badge--' + a.status">{{ statusLabel[a.status] }}</span></td>
                  <td class="row-actions">
                    <a [routerLink]="['/midwife/appointments', a.id]">Open</a>
                    @if (a.status === 'scheduled') {
                      <button type="button" class="linkbtn" (click)="complete(a)">Complete</button>
                      <button type="button" class="linkbtn danger" (click)="cancel(a)">Cancel</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (actionError()) { <p class="mw-msg mw-msg--error" role="alert">{{ actionError() }}</p> }
      }
    </main>
  `,
  styles: `
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge--scheduled { background: var(--tint-100); color: var(--brand-700); }
    .badge--completed { background: #dcf1e7; color: #2f7a5f; }
    .badge--cancelled { background: #f1eef4; color: #6b6477; }
    .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .tabs button { padding: 8px 16px; border-radius: 999px; border: 1.5px solid var(--line); background: #fff; font: inherit; font-size: 13.5px; font-weight: 600; color: var(--muted); cursor: pointer; }
    .tabs button:hover { border-color: var(--brand-500); color: var(--brand-700); }
    .tabs button.on { background: var(--brand-700); border-color: var(--brand-700); color: #fff; }
    .tabs button:focus-visible, .linkbtn:focus-visible { outline: 3px solid var(--brand-600); outline-offset: 2px; }
    .row-actions { white-space: nowrap; text-align: right; }
    .row-actions > * { margin-left: 14px; }
    .linkbtn { background: none; border: 0; padding: 0; font: inherit; font-weight: 600; color: var(--brand-700); cursor: pointer; }
    .linkbtn:hover { text-decoration: underline; }
    .danger { color: #a8335c; }
  `,
})
export class AppointmentList implements OnInit {
  private svc = inject(AppointmentsService);

  readonly statusLabel: Record<AppointmentStatus, string> = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };
  readonly fmt = formatTime;
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'today', label: 'Today' },
    { id: 'past', label: 'Past' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'all', label: 'All' },
  ];

  readonly all = signal<Appointment[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly tab = signal<Tab>('upcoming');
  readonly query = signal('');

  readonly filtered = computed(() => {
    const tab = this.tab();
    const q = this.query().trim().toLowerCase();
    const today = todayIso();
    const rows = this.all().filter((a) => {
      const inTab =
        tab === 'all' ||
        (tab === 'upcoming' && a.status === 'scheduled' && !isPast(a.date, a.time)) ||
        (tab === 'today' && a.date === today && a.status !== 'cancelled') ||
        (tab === 'past' && (a.status === 'completed' || (a.status === 'scheduled' && isPast(a.date, a.time)))) ||
        (tab === 'cancelled' && a.status === 'cancelled');
      const matches = !q || a.patientName.toLowerCase().includes(q) || a.type.toLowerCase().includes(q);
      return inTab && matches;
    });
    // Newest first for history, soonest first for what is coming.
    return tab === 'upcoming' || tab === 'today' ? rows : [...rows].reverse();
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.all.set(await this.svc.list());
    } catch (e) {
      this.error.set(this.svc.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async complete(a: Appointment): Promise<void> {
    await this.act(() => this.svc.complete(a.id));
  }

  async cancel(a: Appointment): Promise<void> {
    if (!confirm(`Cancel ${a.patientName}'s appointment? The time will open up again.`)) return;
    await this.act(() => this.svc.cancel(a.id));
  }

  private async act(action: () => Promise<void>): Promise<void> {
    this.actionError.set('');
    try {
      await action();
      this.all.set(await this.svc.list());
    } catch (e) {
      this.actionError.set(this.svc.errorMessage(e));
    }
  }
}