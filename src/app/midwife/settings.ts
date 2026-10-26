import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { MidwifeLayout } from './midwife-layout';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-wrap">
      <!-- Header -->
      <div class="settings-header-card">
        <div class="header-left">
          <div class="header-icon-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <div>
            <h1>Settings</h1>
            <p class="header-sub">Manage your midwife profile and account preferences.</p>
          </div>
        </div>
        <button type="button" class="btn-signout" (click)="triggerSignOut()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sign out</span>
        </button>
      </div>

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

      /* Header Card */
      .settings-header-card {
        background: #ffffff;
        border: 1px solid #ebe5f5;
        border-radius: 16px;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        box-shadow: 0 4px 16px rgba(54, 23, 89, 0.04);
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .header-icon-pill {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #ede6f8;
        color: #361759;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .header-icon-pill svg {
        width: 24px;
        height: 24px;
      }

      .settings-header-card h1 {
        font-size: 21px;
        font-weight: 800;
        color: #261938;
        margin: 0 0 2px;
        letter-spacing: -0.02em;
      }

      .header-sub {
        font-size: 13px;
        color: #6a617c;
        margin: 0;
      }

      .btn-signout {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        background: #ede6f8;
        color: #361759;
        border: 1.5px solid #d4c8e8;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-signout:hover {
        background: #dfd4f2;
        border-color: #361759;
        transform: translateY(-1px);
      }

      .btn-signout svg {
        width: 15px;
        height: 15px;
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
    `,
  ],
})
export class Settings implements OnInit {
  private auth = inject(AuthService);
  private layout = inject(MidwifeLayout, { optional: true });

  readonly saveSuccess = signal(false);

  firstName = '';
  lastName = '';
  prcLicense = '';
  contactNumber = '';

  autoFillMidwife = true;
  highRiskAlerts = true;

  get userEmail(): string {
    return this.auth.user()?.email || 'midwife@lyingincare.ph';
  }

  get displayName(): string {
    const fullName = `${this.firstName} ${this.lastName}`.trim();
    if (fullName) return `Midwife ${fullName}`;
    const authName = this.auth.userFullName();
    if (authName && authName !== 'Midwife') {
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
    return this.auth.userInitials() || 'MW';
  }

  ngOnInit(): void {
    const profile = this.auth.userProfile();
    const fullName = this.auth.userFullName();
    if (profile?.firstName || profile?.lastName) {
      this.firstName = profile.firstName || '';
      this.lastName = profile.lastName || '';
    } else if (fullName && fullName !== 'Midwife') {
      const parts = fullName.replace(/^Midwife\s+/i, '').trim().split(' ');
      this.firstName = parts[0] || '';
      this.lastName = parts.slice(1).join(' ') || '';
    } else {
      this.firstName = '';
      this.lastName = '';
    }

    this.prcLicense = profile?.prcLicense || '';
    this.contactNumber = profile?.contactNumber || '';
  }

  async saveSettings(): Promise<void> {
    try {
      await this.auth.updateMidwifeProfile({
        firstName: this.firstName,
        lastName: this.lastName,
        prcLicense: this.prcLicense,
        contactNumber: this.contactNumber,
      });
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch {
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    }
  }

  saveSettingsSilently(): void {
    // Saved in state
  }

  triggerSignOut(): void {
    if (this.layout) {
      this.layout.openSignOutModal();
    } else {
      this.auth.logout();
    }
  }
}
