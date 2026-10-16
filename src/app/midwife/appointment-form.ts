import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  APPOINTMENT_TYPES, AppointmentsService, AppointmentStatus, formatTime,
} from '../core/appointments.service';
import { Patient, PatientsService } from '../core/patients.service';
import { AvailabilityPicker } from './availability-picker';

@Component({
  selector: 'app-appointment-form',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, AvailabilityPicker],
  template: `
    <main class="mw-page">
      <a routerLink="/midwife/appointments" class="mw-back">← Back to appointments</a>

      <div class="mw-head" style="margin-top:12px">
        <div>
          <h1>{{ editing ? 'Appointment' : 'Schedule an appointment' }}</h1>
          <p class="mw-sub">
            {{ editing ? 'Reschedule, update, or cancel this appointment.' : 'Pick a patient, then choose an open date and time.' }}
          </p>
        </div>
        @if (editing && status()) { <span [class]="'badge badge--' + status()">{{ statusLabel[status()!] }}</span> }
      </div>

      @if (created(); as c) {
        <section class="mw-card" aria-live="polite">
          <h2>Appointment scheduled</h2>
          <p><strong>{{ c.patient }}</strong></p>
          <p class="mw-sub">{{ c.date | date: 'fullDate' }} at {{ fmt(c.time) }} · {{ c.type }}</p>
          <div class="mw-actions">
            <button type="button" class="mw-btn mw-btn--solid" (click)="another()">Schedule another</button>
            <a routerLink="/midwife/appointments" class="mw-btn">View appointments</a>
          </div>
        </section>
      } @else if (loading()) {
        <p class="mw-empty">Loading…</p>
      } @else {
        @if (editing && status() && status() !== 'scheduled') {
          <p class="mw-msg mw-msg--ok">This appointment is {{ statusLabel[status()!].toLowerCase() }}, so it can't be changed.</p>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <section class="mw-card">
            <h2>Details</h2>
            <div class="mw-grid">
              <div class="mw-field mw-field--wide">
                <label for="patient">Patient</label>
                <select id="patient" formControlName="patientId" [class.bad]="form.controls.patientId.touched && form.controls.patientId.invalid">
                  <option value="">Select a patient</option>
                  @for (p of patients(); track p.id) { <option [value]="p.id">{{ p.fullName }}</option> }
                </select>
              </div>
              <div class="mw-field mw-field--wide">
                <label for="type">Type of visit</label>
                <select id="type" formControlName="type">
                  @for (t of types; track t) { <option [value]="t">{{ t }}</option> }
                </select>
              </div>
              <div class="mw-field mw-field--wide">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" rows="3" formControlName="notes" placeholder="Anything the midwife should remember for this visit"></textarea>
              </div>
            </div>
          </section>

          @if (!editing || status() === 'scheduled') {
            <section class="mw-card">
              <h2>Date and time</h2>
              <app-availability-picker [(date)]="date" [(time)]="time" [ignoreId]="id" />
              @if (date() && time()) {
                <p class="mw-msg mw-msg--ok" role="status">Selected: {{ date() | date: 'fullDate' }} at {{ fmt(time()) }}</p>
              }
            </section>
          }

          @if (error()) { <p class="mw-msg mw-msg--error" role="alert">{{ error() }}</p> }
          @if (saved()) { <p class="mw-msg mw-msg--ok" role="status">Changes saved.</p> }

          <div class="mw-actions">
            @if (!editing || status() === 'scheduled') {
              <button type="submit" class="mw-btn mw-btn--solid" [disabled]="saving()">
                {{ saving() ? 'Saving…' : editing ? 'Save changes' : 'Schedule appointment' }}
              </button>
            }
            @if (editing && status() === 'scheduled') {
              <button type="button" class="mw-btn" (click)="complete()" [disabled]="saving()">Mark as completed</button>
              <button type="button" class="mw-btn danger" (click)="cancel()" [disabled]="saving()">Cancel appointment</button>
            }
            <a routerLink="/midwife/appointments" class="mw-btn">Back</a>
          </div>
        </form>
      }
    </main>
  `,
  styles: `
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge--scheduled { background: var(--tint-100); color: var(--brand-700); }
    .badge--completed { background: #dcf1e7; color: #2f7a5f; }
    .badge--cancelled { background: #f1eef4; color: #6b6477; }
    textarea { width: 100%; padding: 11px 13px; font: inherit; font-size: 14.5px; border: 1.5px solid var(--line); border-radius: 8px; background: #fff; resize: vertical; }
    textarea:focus { outline: 3px solid var(--brand-500); border-color: var(--brand-600); }
    .danger { color: #a8335c; border-color: #e2b6c6; }
    .danger:hover { background: #fbe6ee; }
  `,
})
export class AppointmentForm implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private svc = inject(AppointmentsService);
  private patientsSvc = inject(PatientsService);
  private route = inject(ActivatedRoute);
  private picker = viewChild(AvailabilityPicker);

  readonly id = this.route.snapshot.paramMap.get('id'); // null when scheduling a new one
  readonly editing = this.id !== null;
  readonly types = APPOINTMENT_TYPES;
  readonly statusLabel: Record<AppointmentStatus, string> = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };
  readonly fmt = formatTime;

  readonly patients = signal<Patient[]>([]);
  readonly date = signal('');
  readonly time = signal('');
  readonly status = signal<AppointmentStatus | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly created = signal<{ patient: string; date: string; time: string; type: string } | null>(null);

  readonly form = this.fb.group({
    patientId: ['', Validators.required],
    type: [APPOINTMENT_TYPES[0], Validators.required],
    notes: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.patients.set(await this.patientsSvc.list());
      if (this.id) {
        const a = await this.svc.get(this.id);
        if (!a) {
          this.error.set('This appointment was not found.');
        } else {
          this.form.patchValue({ patientId: a.patientId, type: a.type || APPOINTMENT_TYPES[0], notes: a.notes });
          this.form.controls.patientId.disable();
          if (a.status !== 'scheduled') this.form.disable();
          this.date.set(a.date);
          this.time.set(a.time);
          this.status.set(a.status);
        }
      } else {
        const preset = this.route.snapshot.queryParamMap.get('patient');
        if (preset) this.form.controls.patientId.setValue(preset);
      }
    } catch (e) {
      this.error.set(this.svc.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.saved.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Choose a patient.');
      return;
    }
    if (!this.date() || !this.time()) {
      this.error.set('Pick a date and a time.');
      return;
    }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      if (this.id) {
        await this.svc.update(this.id, { date: this.date(), time: this.time(), type: v.type, notes: v.notes.trim() });
        this.saved.set(true);
      } else {
        const patient = this.patients().find((p) => p.id === v.patientId);
        await this.svc.book({
          patientId: v.patientId,
          patientName: patient?.fullName ?? '',
          date: this.date(),
          time: this.time(),
          type: v.type,
          notes: v.notes.trim(),
        });
        this.created.set({ patient: patient?.fullName ?? '', date: this.date(), time: this.time(), type: v.type });
      }
    } catch (e) {
      this.error.set(this.svc.errorMessage(e));
      if ((e as Error).message === 'slot-taken') {
        this.time.set('');
        void this.picker()?.reload();
      }
    } finally {
      this.saving.set(false);
    }
  }

  async cancel(): Promise<void> {
    if (!this.id || !confirm('Cancel this appointment? The time will open up again.')) return;
    await this.run(async () => {
      await this.svc.cancel(this.id!);
      this.status.set('cancelled');
      this.form.disable();
    });
  }

  async complete(): Promise<void> {
    if (!this.id) return;
    await this.run(async () => {
      await this.svc.complete(this.id!);
      this.status.set('completed');
      this.form.disable();
    });
  }

  another(): void {
    this.created.set(null);
    this.date.set('');
    this.time.set('');
    this.form.reset();
    void this.picker()?.reload();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.error.set('');
    this.saving.set(true);
    try {
      await action();
    } catch (e) {
      this.error.set(this.svc.errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}