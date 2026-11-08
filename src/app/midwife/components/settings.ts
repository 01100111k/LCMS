import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AuthService } from '../../core/auth.service';
import { auth } from '../../core/firebase';
import { MidwifeLayout } from './midwife-layout';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-wrap">

      <!-- Success Notification -->
      @if (saveSuccess()) {
        <div class="toast-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Settings saved successfully!</span>
        </div>
      }

      <!-- 1. Profile Section -->
      <div class="settings-card">
        <div class="card-header">
          <div class="user-avatar-circle">{{ initials }}</div>
          <div class="user-meta">
            <h2>{{ displayName }}</h2>
            <span class="user-role-badge">Licensed Midwife</span>
            <span class="user-email-sub">{{ userEmail }}</span>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>First Name</label>
            <input type="text" [(ngModel)]="firstName" placeholder="First Name" />
          </div>

          <div class="form-group">
            <label>Last Name</label>
            <input type="text" [(ngModel)]="lastName" placeholder="Last Name" />
          </div>

          <div class="form-group">
            <label>PRC License Number</label>
            <input type="text" [(ngModel)]="prcLicense" placeholder="e.g. 0087412" />
          </div>

          <div class="form-group">
            <label>Contact Number</label>
            <input type="text" [(ngModel)]="contactNumber" placeholder="e.g. 0917-123-4567" />
          </div>
        </div>

        <div class="card-action-row">
          <button type="button" class="btn-save" (click)="saveSettings()">
            Save Changes
          </button>
        </div>
      </div>

      <!-- 2. Quick Preferences Section -->
      <div class="settings-card">
        <h3 class="section-title">Preferences</h3>

        <div class="pref-list">
          <div class="pref-row">
            <div>
              <strong>Auto-fill Attending Midwife</strong>
              <p>Automatically populate your name on prenatal, delivery, and postpartum records.</p>
            </div>
            <label class="switch">
              <input type="checkbox" [(ngModel)]="autoFillMidwife" (change)="saveSettingsSilently()" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="pref-row">
            <div>
              <strong>High-Risk Patient Alerts</strong>
              <p>Show visual alert badges for maternal patients flagged as medium or high risk.</p>
            </div>
            <label class="switch">
              <input type="checkbox" [(ngModel)]="highRiskAlerts" (change)="saveSettingsSilently()" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 3. Account & Security Section -->
      <div class="settings-card">
        <h3 class="section-title">Account & Security</h3>
        <div class="account-sec-row">
          <div>
            <strong>Password</strong>
            <p class="account-sub">Send a reset link to your email address ({{ userEmail }}).</p>
          </div>
          <button type="button" class="btn-reset-pw" (click)="resetPassword()" [disabled]="resetEmailSent()">
            {{ resetEmailSent() ? 'Reset Link Sent ✓' : 'Reset Password' }}
          </button>
        </div>
        @if (resetMessage()) {
          <p class="reset-feedback-msg" [class.text-error]="resetError()">{{ resetMessage() }}</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .settings-wrap {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding-bottom: 40px;
        color: #261938;
      }

      /* Success Toast */
      .toast-success {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #e6f7ec;
        border: 1px solid #b8e6c7;
        color: #1e7e34;
        padding: 12px 18px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 700;
      }

      .toast-success svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      /* Cards */
      .settings-card {
        background: #ffffff;
        border: 1px solid #ebe5f5;
        border-radius: 16px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        box-shadow: 0 2px 8px rgba(54, 23, 89, 0.03);
      }

      /* Profile Header */
      .card-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f0ecf6;
      }

      .user-avatar-circle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #361759;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 800;
        flex-shrink: 0;
      }

      .user-meta h2 {
        font-size: 17px;
        font-weight: 800;
        color: #261938;
        margin: 0 0 3px;
      }

      .user-role-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        background: #ede6f8;
        color: #361759;
        padding: 2px 8px;
        border-radius: 6px;
        margin-right: 8px;
      }

      .user-email-sub {
        font-size: 12px;
        color: #7a7189;
      }

      /* Form Grid */
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      @media (max-width: 600px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .form-group label {
        font-size: 12px;
        font-weight: 700;
        color: #361759;
      }

      .form-group input {
        border: 1.5px solid #d4c8e8;
        border-radius: 10px;
        padding: 9px 13px;
        font-size: 13px;
        color: #261938;
        outline: none;
        transition: border-color 0.15s ease;
      }

      .form-group input:focus {
        border-color: #361759;
      }

      .card-action-row {
        display: flex;
        justify-content: flex-end;
        padding-top: 6px;
      }

      .btn-save {
        padding: 9px 20px;
        border-radius: 10px;
        background: #361759;
        color: #ffffff;
        border: none;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 3px 10px rgba(54, 23, 89, 0.2);
        transition: all 0.15s ease;
      }

      .btn-save:hover {
        background: #4a2179;
        transform: translateY(-1px);
      }

      /* Section Titles */
      .section-title {
        font-size: 15px;
        font-weight: 800;
        color: #261938;
        margin: 0;
      }

      /* Preference Rows */
      .pref-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .pref-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 14px;
        background: #fbf9fd;
        border: 1px solid #ebe5f5;
        border-radius: 12px;
      }

      .pref-row strong {
        font-size: 13px;
        color: #261938;
      }

      .pref-row p {
        font-size: 11.5px;
        color: #7a7189;
        margin: 2px 0 0;
      }

      /* Switch */
      .switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 22px;
        flex-shrink: 0;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #d1c8e0;
        transition: 0.25s;
        border-radius: 22px;
      }

      .slider:before {
        position: absolute;
        content: '';
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.25s;
        border-radius: 50%;
      }

      input:checked + .slider {
        background-color: #361759;
      }

      input:checked + .slider:before {
        transform: translateX(18px);
      }

      /* Account & Security */
      .account-sec-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        padding-top: 4px;
      }

      .account-sec-row strong {
        font-size: 13.5px;
        color: #261938;
      }

      .account-sub {
        font-size: 12.5px;
        color: #7a7189;
        margin: 4px 0 0;
      }

      .btn-reset-pw {
        padding: 8px 16px;
        border: 1.5px solid #d4c8e8;
        border-radius: 9px;
        background: #ffffff;
        color: #361759;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-reset-pw:hover:not(:disabled) {
        background: #f7f2fc;
        border-color: #361759;
      }

      .btn-reset-pw:disabled {
        opacity: 0.7;
        cursor: default;
      }

      .reset-feedback-msg {
        margin: 10px 0 0;
        font-size: 12.5px;
        color: #16a34a;
        font-weight: 600;
      }

      .reset-feedback-msg.text-error {
        color: #dc2626;
      }
    `,
  ],
})
export class Settings implements OnInit {
  private auth = inject(AuthService);
  private layout = inject(MidwifeLayout, { optional: true });

  readonly saveSuccess = signal(false);
  readonly resetEmailSent = signal(false);
  readonly resetMessage = signal('');
  readonly resetError = signal(false);

  firstName = '';
  lastName = '';
  prcLicense = '';
  contactNumber = '';

  autoFillMidwife = true;
  highRiskAlerts = true;

  async resetPassword(): Promise<void> {
    const email = this.auth.user()?.email;
    if (!email) {
      this.resetError.set(true);
      this.resetMessage.set('No email found for the current account.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      this.resetEmailSent.set(true);
      this.resetError.set(false);
      this.resetMessage.set(`Password reset link has been sent to ${email}. Please check your inbox.`);
    } catch (e) {
      this.resetError.set(true);
      this.resetMessage.set(`Failed to send reset link: ${(e as Error).message}`);
    }
  }

  get userEmail(): string {
    return this.auth.user()?.email || 'midwife@lyingincare.ph';
  }

  get displayName(): string {
    const fullName = `${this.firstName} ${this.lastName}`.trim();
    if (fullName) return `Midwife ${fullName}`;
    const authName = this.auth.userFullName();
    if (authName && authName !== 'Midwife' && authName.toLowerCase() !== 'admin') {
      return authName.toLowerCase().startsWith('midwife') ? authName : `Midwife ${authName}`;
    }
    return 'Licensed Midwife';
  }

  get initials(): string {
    if (this.firstName || this.lastName) {
      const first = (this.firstName || '')[0] || '';
      const last = (this.lastName || '')[0] || '';
      if (first || last) return (first + last).toUpperCase();
    }
    const init = this.auth.userInitials();
    return (init && init !== 'A' && init !== 'AD') ? init : 'M';
  }

  ngOnInit(): void {
    const profile = this.auth.userProfile();
    const fullName = this.auth.userFullName();
    if (profile?.firstName || profile?.lastName) {
      this.firstName = profile.firstName || '';
      this.lastName = profile.lastName || '';
    } else if (fullName && fullName !== 'Midwife' && fullName.toLowerCase() !== 'admin') {
      const parts = fullName.replace(/^Midwife\s+/i, '').trim().split(' ');
      this.firstName = parts[0] || '';
      this.lastName = parts.slice(1).join(' ') || '';
    } else {
      this.firstName = '';
      this.lastName = '';
    }

    this.prcLicense = profile?.prcLicense || '';
    this.contactNumber = profile?.contactNumber || '';

    const prefs = (profile as any)?.preferences;
    if (prefs) {
      if (typeof prefs.autoFillMidwife === 'boolean') this.autoFillMidwife = prefs.autoFillMidwife;
      if (typeof prefs.highRiskAlerts === 'boolean') this.highRiskAlerts = prefs.highRiskAlerts;
    }
  }

  async saveSettings(): Promise<void> {
    try {
      await this.auth.updateMidwifeProfile({
        firstName: this.firstName,
        lastName: this.lastName,
        prcLicense: this.prcLicense,
        contactNumber: this.contactNumber,
        preferences: {
          autoFillMidwife: this.autoFillMidwife,
          highRiskAlerts: this.highRiskAlerts,
        },
      });
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch (e: any) {
      alert(e?.message || 'Failed to save settings. Please try again.');
    }
  }

  async saveSettingsSilently(): Promise<void> {
    try {
      await this.auth.updateMidwifeProfile({
        firstName: this.firstName,
        lastName: this.lastName,
        prcLicense: this.prcLicense,
        contactNumber: this.contactNumber,
        preferences: {
          autoFillMidwife: this.autoFillMidwife,
          highRiskAlerts: this.highRiskAlerts,
        },
      });
    } catch {}
  }

  triggerSignOut(): void {
    if (this.layout) {
      this.layout.openSignOutModal();
    } else {
      this.auth.logout();
    }
  }
}
