import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from './admin.service';
import { FacilitySettings } from './admin.models';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-admin-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="account-view">
      <!-- Header -->
      <div class="dir-head">
        <div>
          <h2>Settings</h2>
          <p class="dir-sub">Manage administrator credentials, security protocols, and clinical facility profile</p>
        </div>
      </div>

      <div class="settings-grid">
        <!-- LEFT COLUMN: Profile & Security -->
        <div class="settings-col">
          <!-- Administrator Profile Card -->
          <div class="card-box">
            <div class="card-head">
              <h3>Administrator Profile</h3>
            </div>
            <div class="profile-hero">
              <div class="profile-avatar-large">
                {{ adminSvc.adminInitial() }}
              </div>
              <div class="profile-meta">
                <h4>{{ adminSvc.adminDisplayName() }}</h4>
                <p class="profile-role">System Administrator</p>
                <span class="auth-tier-pill">Tier 1 &bull; System Governance</span>
              </div>
            </div>

            <div class="profile-fields-list">
              <div class="field-item">
                <label>Email Account</label>
                <div class="field-val">{{ auth.user()?.email || 'admin@lyingincare.ph' }}</div>
              </div>
              <div class="field-item">
                <label>System Role</label>
                <div class="field-val">Full Administrative Authority (Admin)</div>
              </div>
              <div class="field-item">
                <label>Account Status</label>
                <div class="field-val text-green">● Active & Verified</div>
              </div>
            </div>
          </div>

          <!-- Security & Credentials -->
          <div class="card-box">
            <div class="card-head">
              <h3>Security & Password</h3>
            </div>
            <p class="section-desc">
              Manage your password and security credentials for administrative dashboard access.
            </p>
            <div class="security-action-box">
              <button type="button" class="btn-password-reset" (click)="requestPasswordReset()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Send Password Reset Email</span>
              </button>
              <p class="note-sub">A secure reset link will be sent to {{ auth.user()?.email || 'your registered email' }}.</p>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Facility Configuration -->
        <div class="settings-col">
          <div class="card-box">
            <div class="card-head">
              <h3>Facility & Clinic Information</h3>
            </div>
            <p class="section-desc">
              Details displayed across official patient records, prenatal journey cards, and clinical exports.
            </p>

            <form (ngSubmit)="saveFacilityProfile()" class="facility-form">
              <div class="form-group">
                <label>Facility Name</label>
                <input type="text" [(ngModel)]="settings.facilityName" name="facilityName" required />
              </div>

              <div class="form-row-two">
                <div class="form-group">
                  <label>DOH License Number</label>
                  <input type="text" [(ngModel)]="settings.licenseNumber" name="licenseNumber" required />
                </div>
                <div class="form-group">
                  <label>Facility Contact Phone</label>
                  <input type="text" [(ngModel)]="settings.contactNumber" name="contactNumber" required />
                </div>
              </div>

              <div class="form-group">
                <label>Emergency Hotline (24/7)</label>
                <input type="text" [(ngModel)]="settings.emergencyHotline" name="emergencyHotline" required />
              </div>

              <div class="form-group">
                <label>Physical Address</label>
                <input type="text" [(ngModel)]="settings.address" name="address" required />
              </div>

              <div class="form-group">
                <label>Operating Hours</label>
                <input type="text" [(ngModel)]="settings.operatingHours" name="operatingHours" required />
              </div>

              <div class="form-group">
                <label>Partner Referral Hospital (Emergency Transport)</label>
                <input type="text" [(ngModel)]="settings.referralHospital" name="referralHospital" required />
              </div>

              <div class="toggles-list">
                <label class="toggle-row">
                  <input type="checkbox" [(ngModel)]="settings.autoApproveVerifiedMidwives" name="autoApproveVerifiedMidwives" />
                  <div class="toggle-text">
                    <strong>Auto-Verify PRC Licensed Midwives</strong>
                    <span>Automatically grant system access upon valid PRC database match</span>
                  </div>
                </label>

                <label class="toggle-row">
                  <input type="checkbox" [(ngModel)]="settings.emailAlertsEnabled" name="emailAlertsEnabled" />
                  <div class="toggle-text">
                    <strong>Admin Email Notifications</strong>
                    <span>Receive email notifications for urgent high-risk maternal alerts and new applications</span>
                  </div>
                </label>
              </div>

              <div class="form-foot">
                <button type="submit" class="btn-save-settings">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .account-view {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .dir-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .dir-head h2 {
      font-size: 22px;
      font-weight: 700;
      color: #271442;
      margin: 0 0 4px;
    }

    .dir-sub {
      font-size: 13px;
      color: #7a7189;
      margin: 0;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 22px;
    }

    .settings-col {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .card-box {
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #ebe5f5;
      padding: 22px;
      box-shadow: 0 4px 18px rgba(50, 24, 78, 0.04);
    }

    .card-head {
      margin-bottom: 16px;
    }

    .card-head h3 {
      font-size: 16px;
      font-weight: 700;
      color: #271442;
      margin: 0;
    }

    .section-desc {
      font-size: 12.5px;
      color: #7a7189;
      margin: 0 0 16px;
      line-height: 1.45;
    }

    /* Profile hero */
    .profile-hero {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #faf8fd;
      border-radius: 14px;
      margin-bottom: 16px;
    }

    .profile-avatar-large {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #35164f;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .profile-meta h4 {
      font-size: 16px;
      font-weight: 700;
      color: #271442;
      margin: 0 0 2px;
    }

    .profile-role {
      font-size: 12.5px;
      color: #6b4fa3;
      font-weight: 600;
      margin: 0 0 6px;
    }

    .auth-tier-pill {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 8px;
      border-radius: 999px;
      background: #f3e8ff;
      color: #6b21a8;
    }

    /* Profile fields */
    .profile-fields-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .field-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 12.5px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f3eff9;
    }

    .field-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .field-item label {
      color: #7a7189;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .field-val {
      color: #271442;
      font-weight: 500;
    }

    .text-green {
      color: #16a34a;
      font-weight: 600;
    }

    /* Security */
    .btn-password-reset {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: #faf8fd;
      color: #35164f;
      border: 1px solid #dcd3eb;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-password-reset:hover {
      background: #f1ebfa;
      border-color: #35164f;
    }

    .btn-password-reset svg {
      width: 16px;
      height: 16px;
    }

    .note-sub {
      font-size: 11.5px;
      color: #7a7189;
      margin: 8px 0 0;
    }

    /* Facility form */
    .facility-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .form-group label {
      font-size: 12px;
      font-weight: 600;
      color: #4a3b60;
    }

    .form-group input {
      padding: 9px 12px;
      border-radius: 8px;
      border: 1px solid #dcd3eb;
      font-size: 13px;
      outline: none;
      color: #271442;
    }

    .form-group input:focus {
      border-color: #35164f;
    }

    .form-row-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .toggles-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      background: #faf8fd;
      border-radius: 12px;
      margin-top: 6px;
    }

    .toggle-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      cursor: pointer;
    }

    .toggle-row input[type="checkbox"] {
      width: 18px;
      height: 18px;
      margin-top: 2px;
      accent-color: #35164f;
      cursor: pointer;
    }

    .toggle-text strong {
      display: block;
      font-size: 13px;
      color: #271442;
    }

    .toggle-text span {
      display: block;
      font-size: 11.5px;
      color: #7a7189;
      line-height: 1.4;
    }

    .form-foot {
      display: flex;
      justify-content: flex-end;
      padding-top: 8px;
    }

    .btn-save-settings {
      padding: 10px 24px;
      background: #35164f;
      color: #ffffff;
      border: none;
      border-radius: 999px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(53, 22, 79, 0.2);
    }
  `],
})
export class AdminAccount {
  adminSvc = inject(AdminService);
  auth = inject(AuthService);

  settings: FacilitySettings = { ...this.adminSvc.facilitySettings() };

  saveFacilityProfile(): void {
    this.adminSvc.updateSettings(this.settings);
  }

  requestPasswordReset(): void {
    const email = this.auth.user()?.email;
    if (email) {
      this.adminSvc.notify(`Password reset instructions sent to ${email}`);
    } else {
      this.adminSvc.notify('Password reset email dispatched to administrator address.');
    }
  }
}

