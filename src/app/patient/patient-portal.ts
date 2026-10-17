import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';
import { Appointment, AppointmentsService, formatTime, isPast, AppointmentStatus } from '../core/appointments.service';

@Component({
  selector: 'app-patient-portal',
  imports: [DatePipe],
  template: `
    <header class="mw-bar">
      <div class="mw-bar__in">
        <span class="mw-brand">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 42S5 30.5 5 17.5A9.5 9.5 0 0 1 24 12.5 9.5 9.5 0 0 1 43 17.5C43 30.5 24 42 24 42z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
            <path d="M17 22c0-3.5 3-5.5 6-4.5 3 1 3.5 4.5 1.5 7s-5.5 3.5-7.5 1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="26.5" cy="26" r="2" fill="currentColor"/>
          </svg>
          <span><strong>Lying-In Care</strong><small>Patient portal</small></span>
        </span>
        <div class="mw-user">
          <span>{{ auth.user()?.email }}</span>
          <button type="button" class="mw-btn" (click)="auth.logout()">Log out</button>
        </div>
      </div>
    </header>

    <main class="mw-page">
      <div class="mw-head">
        <div>
          <h1>My profile</h1>
          <p class="mw-sub">Your details and appointments.</p>
        </div>
      </div>

      @if (loading()) {
        <p class="mw-empty">Loading your profile…</p>
      } @else if (error()) {
        <p class="mw-msg mw-msg--error" role="alert">{{ error() }}</p>
      } @else if (profile(); as p) {
        <section class="mw-card">
          <h2>Upcoming appointments</h2>
          @if (upcoming().length) {
            <ul class="appts">
              @for (a of upcoming(); track a.id) {
                <li>
                  <div class="when"><strong>{{ a.date | date: 'EEE, MMM d, y' }}</strong><span>{{ fmt(a.time) }}</span></div>
                  <span class="what">{{ a.type }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="mw-sub">You have no upcoming appointments.</p>
          }
        </section>
        @if (past().length) {
          <section class="mw-card">
            <h2>Past appointments</h2>
            <ul class="appts">
              @for (a of past(); track a.id) {
                <li>
                  <div class="when"><strong>{{ a.date | date: 'EEE, MMM d, y' }}</strong><span>{{ fmt(a.time) }}</span></div>
                  <span class="what">{{ a.type }}</span>
                  <span [class]="'badge badge--' + a.status">{{ statusLabel[a.status] }}</span>
                </li>
              }
            </ul>
          </section>
        }
        <section class="mw-card">
          <h2>Personal details</h2>
          <dl class="mw-dl">
            <dt>Full name</dt><dd>{{ p.fullName }}</dd>
            <dt>Email</dt><dd>{{ p.email }}</dd>
            <dt>Date of birth</dt><dd>{{ p.birthDate ? (p.birthDate | date: 'longDate') : '—' }}</dd>
            <dt>Contact number</dt><dd>{{ p.contactNumber }}</dd>
            <dt>Address</dt><dd>{{ p.address }}</dd>
            <dt>Blood type</dt><dd>{{ p.bloodType || '—' }}</dd>
          </dl>
        </section>
        <section class="mw-card">
          <h2>Emergency contact</h2>
          <dl class="mw-dl">
            <dt>Name</dt><dd>{{ p.emergencyContactName }}</dd>
            <dt>Contact number</dt><dd>{{ p.emergencyContactNumber }}</dd>
          </dl>
        </section>
        <section class="mw-card">
          <h2>Pregnancy</h2>
          <dl class="mw-dl">
            <dt>Last menstrual period</dt><dd>{{ p.lmp ? (p.lmp | date: 'longDate') : '—' }}</dd>
            <dt>Expected due date</dt><dd>{{ p.edd ? (p.edd | date: 'longDate') : '—' }}</dd>
          </dl>
        </section>
        <p class="mw-sub" style="margin-top:16px">To change any of these details, ask your midwife.</p>
      } @else {
        <p class="mw-empty">Your profile has not been set up yet. Please contact the facility.</p>
      }
    </main>
  `,
  styles: `
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge--scheduled { background: var(--tint-100); color: var(--brand-700); }
    .badge--completed { background: #dcf1e7; color: #2f7a5f; }
    .badge--cancelled { background: #f1eef4; color: #6b6477; }
    .appts { list-style: none; margin: 0; padding: 0; }
    .appts li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; padding: 12px 0; border-bottom: 1px solid var(--line); }
    .appts li:last-child { border-bottom: 0; padding-bottom: 0; }
    .when { display: flex; flex-direction: column; min-width: 170px; }
    .when strong { color: var(--brand-900); }
    .when span { font-size: 13px; color: var(--muted); }
    .what { margin-right: auto; color: var(--muted); font-size: 14px; }
  `,
})
export class PatientPortal implements OnInit {
  auth = inject(AuthService);
  private patients = inject(PatientsService);
  private appointments = inject(AppointmentsService);

  readonly statusLabel: Record<AppointmentStatus, string> = {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    requested: 'Requested',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  readonly fmt = formatTime;
  readonly appts = signal<Appointment[]>([]);
  readonly upcoming = computed(() =>
    this.appts().filter((a) => a.status === 'scheduled' && !isPast(a.date, a.time)),
  );
  readonly past = computed(() =>
    this.appts()
      .filter((a) => a.status === 'completed' || (a.status === 'scheduled' && isPast(a.date, a.time)))
      .reverse()
      .slice(0, 5),
  );

  readonly profile = signal<Patient | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const uid = this.auth.user()?.uid;
      this.profile.set(uid ? await this.patients.get(uid) : null);
      if (uid) this.appts.set(await this.appointments.listForPatient(uid));
    } catch (e) {
      this.error.set(this.patients.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}