import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PatientsService } from '../core/patients.service';

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIso(new Date(y, m - 1, d + days));
}

@Component({
  selector: 'app-patient-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="mw-page">
      <a routerLink="/midwife/patients" class="mw-back">← Back to Patient Directory</a>

      <div class="mw-head" style="margin-top:12px">
        <div>
          <h1>{{ editing ? 'Patient profile' : 'Register a patient' }}</h1>
          <p class="mw-sub">
            {{ editing ? 'View and update the patient information.' : 'This saves the profile and emails the patient an invitation to set up their account.' }}
          </p>
        </div>
        @if (editing && !loading() && !error()) {
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <a [routerLink]="['/midwife/appointments']" [queryParams]="{ new: 'true', patient: id }" class="mw-btn mw-btn--solid">Schedule appointment</a>
            <button type="button" class="mw-btn" (click)="invite(form.getRawValue().email)" [disabled]="inviting()">
              {{ inviting() ? 'Sending…' : 'Resend invitation' }}
            </button>
          </div>
        }
      </div>
      @if (editing && inviteMsg()) {
        <p class="mw-msg" [class.mw-msg--ok]="inviteOk()" [class.mw-msg--error]="!inviteOk()" role="status" style="margin:0 0 16px">{{ inviteMsg() }}</p>
      }

      @if (created(); as c) {
        <section class="mw-card" aria-live="polite">
          <h2>Patient registered successfully</h2>
          @if (c.invited) {
            <p>An invitation was sent to <strong>{{ c.email }}</strong>.</p>
            <p class="mw-sub">{{ c.name }} will receive a secure link to set their own password. After that, they can log in to see their profile and appointments.</p>
          } @else {
            <p class="mw-msg mw-msg--error" role="alert">
              {{ c.name }} was registered, but the invitation email could not be sent. Select "Resend invitation" to try again.
            </p>
          }
          @if (inviteMsg()) {
            <p class="mw-msg" [class.mw-msg--ok]="inviteOk()" [class.mw-msg--error]="!inviteOk()" role="status">{{ inviteMsg() }}</p>
          }
          <div class="mw-actions">
            <a routerLink="/midwife/patients" class="mw-btn mw-btn--solid">View in Patient Directory</a>
            <button type="button" class="mw-btn" (click)="another()">Register another</button>
            <button type="button" class="mw-btn" (click)="invite(c.email)" [disabled]="inviting()">
              {{ inviting() ? 'Sending…' : 'Resend invitation' }}
            </button>
          </div>
        </section>
      } @else if (loading()) {
        <p class="mw-empty">Loading profile…</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <section class="mw-card">
            <h2>Personal details</h2>
            <div class="mw-grid">
              <div class="mw-field mw-field--wide">
                <label for="fullName">Full name</label>
                <input id="fullName" formControlName="fullName" autocomplete="off" [class.bad]="bad(form.controls.fullName)">
              </div>
              <div class="mw-field">
                <label for="email">Email (used to log in)</label>
                <input id="email" type="email" formControlName="email" autocomplete="off" [class.bad]="bad(form.controls.email)">
                @if (editing) { <span class="mw-hint">The login email cannot be changed here.</span> }
              </div>
              <div class="mw-field">
                <label for="birthDate">Date of birth</label>
                <input id="birthDate" type="date" formControlName="birthDate" [max]="today" [class.bad]="bad(form.controls.birthDate)">
              </div>
              <div class="mw-field">
                <label for="contactNumber">Contact number</label>
                <input id="contactNumber" type="tel" formControlName="contactNumber" autocomplete="off" [class.bad]="bad(form.controls.contactNumber)">
              </div>
              <div class="mw-field">
                <label for="bloodType">Blood type (optional)</label>
                <select id="bloodType" formControlName="bloodType">
                  <option value="">Not recorded</option>
                  @for (b of bloodTypes; track b) { <option [value]="b">{{ b }}</option> }
                </select>
              </div>
              <div class="mw-field mw-field--wide">
                <label for="address">Address</label>
                <input id="address" formControlName="address" autocomplete="off" [class.bad]="bad(form.controls.address)">
              </div>
            </div>
          </section>

          <section class="mw-card">
            <h2>Emergency contact</h2>
            <div class="mw-grid">
              <div class="mw-field">
                <label for="ecName">Name</label>
                <input id="ecName" formControlName="emergencyContactName" autocomplete="off" [class.bad]="bad(form.controls.emergencyContactName)">
              </div>
              <div class="mw-field">
                <label for="ecNumber">Contact number</label>
                <input id="ecNumber" type="tel" formControlName="emergencyContactNumber" autocomplete="off" [class.bad]="bad(form.controls.emergencyContactNumber)">
              </div>
            </div>
          </section>

          <section class="mw-card">
            <h2>Pregnancy (optional)</h2>
            <div class="mw-grid">
              <div class="mw-field">
                <label for="lmp">Last menstrual period</label>
                <input id="lmp" type="date" formControlName="lmp" [max]="today">
              </div>
              <div class="mw-field">
                <label for="edd">Expected due date</label>
                <input id="edd" type="date" formControlName="edd">
                <span class="mw-hint">Filled in 280 days after the LMP. You can change it.</span>
              </div>
            </div>
          </section>

          @if (error()) { <p class="mw-msg mw-msg--error" role="alert">{{ error() }}</p> }
          @if (saved()) { <p class="mw-msg mw-msg--ok" role="status">Changes saved.</p> }

          <div class="mw-actions">
            <button type="submit" class="mw-btn mw-btn--solid" [disabled]="saving()">
              {{ saving() ? 'Saving…' : editing ? 'Save changes' : 'Register patient' }}
            </button>
            <a routerLink="/midwife/patients" class="mw-btn">Cancel</a>
          </div>
        </form>
      }
    </main>
  `,
})
export class PatientForm implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private patients = inject(PatientsService);
  private route = inject(ActivatedRoute);

  readonly id = this.route.snapshot.paramMap.get('id'); // null when registering
  readonly editing = this.id !== null;
  readonly today = toIso(new Date());
  readonly bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly inviting = signal(false);
  readonly inviteMsg = signal('');
  readonly inviteOk = signal(true);
  readonly created = signal<{ name: string; email: string; invited: boolean } | null>(null);

  readonly form = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    birthDate: ['', Validators.required],
    contactNumber: ['', Validators.required],
    address: ['', Validators.required],
    emergencyContactName: ['', Validators.required],
    emergencyContactNumber: ['', Validators.required],
    bloodType: [''],
    lmp: [''],
    edd: [''],
  });

  constructor() {
    // Suggest a due date (LMP + 280 days) until the midwife edits it herself.
    this.form.controls.lmp.valueChanges.pipe(takeUntilDestroyed()).subscribe((lmp) => {
      const edd = this.form.controls.edd;
      if (lmp && edd.pristine) edd.setValue(addDays(lmp, 280));
    });
  }

  async ngOnInit(): Promise<void> {
    if (!this.id) return;
    this.loading.set(true);
    try {
      const p = await this.patients.get(this.id);
      if (!p) {
        this.error.set('This patient was not found.');
      } else {
        const { id: _id, ...profile } = p;
        this.form.patchValue(profile);
        this.form.controls.email.disable();
        this.form.markAsPristine();
      }
    } catch (e) {
      this.error.set(this.patients.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  bad(c: AbstractControl): boolean {
    return c.touched && c.invalid;
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.saved.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Fill in the highlighted fields.');
      return;
    }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue(); // includes the disabled email when editing
      const profile = {
        ...v,
        fullName: v.fullName.trim(),
        email: v.email.trim().toLowerCase(),
      };
      if (this.id) {
        await this.patients.update(this.id, profile);
        this.saved.set(true);
      } else {
        const r = await this.patients.register(profile);
        this.created.set({ name: profile.fullName, email: profile.email, invited: r.invited });
      }
    } catch (e) {
      this.error.set(this.patients.errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async invite(email: string): Promise<void> {
    this.inviting.set(true);
    this.inviteMsg.set('');
    try {
      await this.patients.sendInvite(email);
      this.inviteOk.set(true);
      this.inviteMsg.set(`Invitation sent to ${email}.`);
    } catch (e) {
      this.inviteOk.set(false);
      this.inviteMsg.set(this.patients.errorMessage(e));
    } finally {
      this.inviting.set(false);
    }
  }

  another(): void {
    this.created.set(null);
    this.inviteMsg.set('');
    this.form.reset();
  }
}