import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../services/admin.service';
import { SystemUser } from '../models/admin.models';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="overview-wrap">
      <!-- Welcome Hero Banner -->
      <section class="hero-banner">
        <div class="hero-content">
          <p class="hero-date">{{ todayFormatted() }}</p>
          <h1>{{ greeting() }}, {{ adminSvc.adminDisplayName() }}</h1>
          <p class="hero-sub">
            You have {{ adminSvc.pendingCount() }} pending account request(s) requiring credential review and {{ adminSvc.patientCount() }} registered patients under facility care.
          </p>
        </div>

        <div class="hero-actions">
          <button type="button" class="btn-hero-solid" (click)="openAddMidwifeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Midwife
          </button>
          <a routerLink="/admin/pending-approvals" class="btn-hero-glass">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Review Approvals ({{ adminSvc.pendingCount() }})
          </a>
        </div>
      </section>

      <!-- 4 KPI Stat Metric Cards -->
      <section class="kpi-grid">
        <!-- Card 1: Registered Patients -->
        <a routerLink="/admin/patients" class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span class="kpi-trend trend-green">&#8599; Active Care</span>
          </div>
          <div class="kpi-value">{{ adminSvc.patientCount() }}</div>
          <div class="kpi-label">Registered Patients</div>
        </a>

        <!-- Card 2: Total Midwives -->
        <a routerLink="/admin/midwives" class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span class="kpi-trend trend-green">&#9679; {{ adminSvc.midwifeCount() }} licensed staff</span>
          </div>
          <div class="kpi-value">{{ adminSvc.midwifeCount() }}</div>
          <div class="kpi-label">Total Midwives</div>
        </a>

        <!-- Card 3: Pending Approvals -->
        <a routerLink="/admin/pending-approvals" class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-purple" [class.tone-amber]="adminSvc.pendingCount() > 0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <span class="kpi-trend" [class.trend-amber]="adminSvc.pendingCount() > 0" [class.trend-green]="adminSvc.pendingCount() === 0">
              {{ adminSvc.pendingCount() > 0 ? 'Requires Review' : 'All Clear' }}
            </span>
          </div>
          <div class="kpi-value">{{ adminSvc.pendingCount() }}</div>
          <div class="kpi-label">Pending Approvals</div>
        </a>

        <!-- Card 4: System Audit Logs -->
        <a routerLink="/admin/activity-logs" class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <span class="kpi-trend trend-green">&#8599; Live Trail</span>
          </div>
          <div class="kpi-value">{{ adminSvc.activityLogs().length }}</div>
          <div class="kpi-label">Activity Log Events</div>
        </a>
      </section>

      <!-- Dashboard Two-Column Grid -->
      <div class="dashboard-grid">
        <!-- LEFT COLUMN -->
        <div class="col-main">
          <!-- Pending Account Requests -->
          <div class="panel-card">
            <div class="panel-head">
              <div>
                <h2>Pending Approvals</h2>
                <p class="panel-sub">New midwife & patient applications requiring credentials review</p>
              </div>
              <a routerLink="/admin/pending-approvals" class="panel-link">View all</a>
            </div>

            @if (pendingUsers().length > 0) {
              <div class="pending-list">
                @for (u of pendingUsers().slice(0, 3); track u.id) {
                  <div class="pending-row-item">
                    <div class="pending-avatar-circle">
                      {{ getInitials(u.displayName || u.email) }}
                    </div>
                    <div class="pending-meta">
                      <div class="pending-name-line">
                        <strong>{{ u.displayName || u.email }}</strong>
                        <span class="badge-role" [ngClass]="'role-' + u.role">{{ u.role }}</span>
                      </div>
                      <p class="pending-sub">
                        {{ u.email }} &bull; {{ u.prcLicense ? 'PRC #' + u.prcLicense : 'Maternal Patient' }}
                      </p>
                    </div>
                    <div class="pending-actions-btns">
                      <button type="button" class="btn-sm-approve" (click)="adminSvc.approveUser(u)">Approve</button>
                      <button type="button" class="btn-sm-reject" (click)="adminSvc.rejectUser(u)">Reject</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state-clean">
                <div class="empty-check-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3>All Applications Reviewed</h3>
                <p>No pending midwife or patient signups awaiting verification.</p>
              </div>
            }
          </div>

          <!-- Recent Patient Registrations -->
          <div class="panel-card">
            <div class="panel-head">
              <div>
                <h2>Recent Patient Registrations</h2>
                <p class="panel-sub">Newly enrolled mothers in the birthing care system</p>
              </div>
              <a routerLink="/admin/patients" class="panel-link">All patients</a>
            </div>

            <div class="recent-patients-list">
              @for (p of adminSvc.patients().slice(0, 5); track p.id) {
                <div class="patient-line-row">
                  <div class="patient-avatar" [style.background]="getAvatarColor(p.fullName)">
                    {{ getInitials(p.fullName) }}
                  </div>
                  <div class="patient-info">
                    <strong>{{ p.fullName }}</strong>
                    <span>{{ p.bloodType || 'O+' }} blood &bull; {{ p.gestationalAge || '18 weeks' }}</span>
                  </div>
                  <span class="patient-status-badge">{{ p.status || 'Active' }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="col-side">
          <!-- Staff Overview -->
          <div class="panel-card">
            <div class="panel-head">
              <div>
                <h2>Staff Overview</h2>
                <p class="panel-sub">Licensed birth attendants on active roster</p>
              </div>
              <a routerLink="/admin/midwives" class="panel-link">Manage</a>
            </div>

            <div class="staff-list">
              @for (mw of activeMidwives().slice(0, 4); track mw.id) {
                <div class="staff-item-row">
                  <div class="staff-avatar">
                    {{ getInitials(mw.displayName || mw.email) }}
                  </div>
                  <div class="staff-info">
                    <strong>{{ mw.displayName || mw.email }}</strong>
                    <span>PRC #{{ mw.prcLicense || '0045892' }} &bull; Active</span>
                  </div>
                  <span class="badge-duty">On Duty</span>
                </div>
              }
            </div>
          </div>

          <!-- Recent System Activities Snippet -->
          <div class="panel-card">
            <div class="panel-head">
              <div>
                <h2>Recent System Activities</h2>
                <p class="panel-sub">Administrative audit trail events</p>
              </div>
              <a routerLink="/admin/activity-logs" class="panel-link">All logs</a>
            </div>

            <div class="activity-mini-list">
              @for (log of adminSvc.activityLogs().slice(0, 4); track log.id) {
                <div class="activity-mini-item">
                  <span class="activity-dot"></span>
                  <div class="activity-mini-body">
                    <p class="activity-desc">{{ log.action }}</p>
                    <span class="activity-time">{{ log.timestamp }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Add Midwife Modal -->
      @if (showAddMidwifeModal()) {
        <div class="modal-backdrop" (click)="!submittingMidwife() && showAddMidwifeModal.set(false)">
          <div class="modal-card modal-sm" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>Register New Midwife</h3>
              <button type="button" class="btn-close-modal" [disabled]="submittingMidwife()" (click)="showAddMidwifeModal.set(false)">&times;</button>
            </div>
            <form (ngSubmit)="saveNewMidwife()" class="modal-body-form">
              @if (midwifeError()) {
                <div class="form-error-banner" style="background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:12px;">
                  {{ midwifeError() }}
                </div>
              }
              <div class="form-group">
                <label>Full Legal Name *</label>
                <input type="text" [(ngModel)]="midwifeName" name="midwifeName" placeholder="e.g. Maria Teresa Santos, RM" [disabled]="submittingMidwife()" required />
              </div>
              <div class="form-group">
                <label>Email Address *</label>
                <input type="email" [(ngModel)]="midwifeEmail" name="midwifeEmail" placeholder="midwife@lyingincare.ph" [disabled]="submittingMidwife()" required />
              </div>
              <div class="form-group">
                <label>PRC License Number *</label>
                <input type="text" [(ngModel)]="midwifePrc" name="midwifePrc" placeholder="e.g. 0048120" [disabled]="submittingMidwife()" required />
              </div>
              <div class="form-group">
                <label>Contact Phone</label>
                <input type="text" [(ngModel)]="midwifePhone" name="midwifePhone" placeholder="0917-555-0192" [disabled]="submittingMidwife()" />
              </div>
              <div class="form-group">
                <label>Initial Account Password *</label>
                <input type="text" [(ngModel)]="midwifePassword" name="midwifePassword" placeholder="Midwife@2026!" [disabled]="submittingMidwife()" required />
                <small style="color:#7a7189;font-size:11.5px;margin-top:3px;display:block;">Assigned login password for the midwife.</small>
              </div>
              <div class="modal-foot">
                <button type="button" class="btn-modal-close" [disabled]="submittingMidwife()" (click)="showAddMidwifeModal.set(false)">Cancel</button>
                <button type="submit" class="btn-modal-accept" [disabled]="submittingMidwife()">
                  {{ submittingMidwife() ? 'Saving to Database...' : 'Create Account' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .overview-wrap {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 1240px;
      margin: 0 auto;
    }

    /* ============ HERO BANNER ============ */
    .hero-banner {
      position: relative;
      background:
        linear-gradient(to right, rgba(63, 26, 110, 0.78) 0%, rgba(80, 40, 130, 0.42) 100%),
        url('/images/dashboard-banner-bg.png') center / cover no-repeat,
        #3f1a6e;
      border-radius: 14px;
      padding: 22px 28px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(50, 22, 80, 0.16);
    }

    .hero-content {
      position: relative;
      z-index: 2;
      max-width: 580px;
    }

    .hero-date {
      margin: 0 0 6px;
      font-size: 12.5px;
      color: #cdbfe3;
      font-weight: 500;
    }

    .hero-banner h1 {
      margin: 0;
      font-size: 23px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #ffffff;
    }

    .hero-sub {
      margin: 6px 0 0;
      font-size: 13.5px;
      color: #dfd4f2;
      line-height: 1.45;
    }

    .hero-actions {
      position: relative;
      z-index: 2;
      display: flex;
      gap: 10px;
      flex-shrink: 0;
      align-items: center;
    }

    .btn-hero-solid {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #ffffff;
      color: #3e1b64;
      padding: 8.5px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      border: none;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      line-height: 1;
    }

    .btn-hero-solid svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .btn-hero-solid:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
    }

    .btn-hero-glass {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      padding: 8.5px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      transition: background 0.15s, transform 0.15s;
      line-height: 1;
    }

    .btn-hero-glass svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .btn-hero-glass:hover {
      background: rgba(255, 255, 255, 0.24);
      transform: translateY(-2px);
    }

    /* ============ KPI STATS ============ */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 13px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 13px;
      padding: 15px 18px;
      box-shadow: 0 4px 14px rgba(50, 24, 78, 0.03);
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      display: block;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(50, 24, 78, 0.07);
    }

    .kpi-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .kpi-icon-circle {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: grid;
      place-items: center;
    }

    .kpi-icon-circle svg {
      width: 16px;
      height: 16px;
    }

    .tone-purple {
      background: #f0eaf8;
      color: #6b4fa3;
    }

    .tone-amber {
      background: #fef3c7;
      color: #b45309;
    }

    .kpi-trend {
      font-size: 11.5px;
      font-weight: 600;
      color: #16a34a;
    }

    .kpi-trend.trend-amber {
      color: #b45309;
    }

    .kpi-value {
      font-size: 26px;
      font-weight: 700;
      color: #271442;
      line-height: 1.1;
      margin-bottom: 4px;
    }

    .kpi-label {
      font-size: 12.5px;
      color: #6a617c;
      font-weight: 500;
    }

    /* Dashboard Grid */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 390px;
      gap: 16px;
    }

    .col-main, .col-side {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .panel-card {
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #ebe5f5;
      padding: 22px;
      box-shadow: 0 4px 16px rgba(50, 24, 78, 0.04);
    }

    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .panel-head h2 {
      font-size: 16.5px;
      font-weight: 700;
      color: #271442;
      margin: 0 0 3px;
    }

    .panel-sub {
      font-size: 12.5px;
      color: #7a7189;
      margin: 0;
    }

    .panel-link {
      font-size: 12.5px;
      font-weight: 600;
      color: #35164f;
      text-decoration: none;
    }

    .panel-link:hover {
      text-decoration: underline;
    }

    /* Pending list */
    .pending-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .pending-row-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      background: #faf8fd;
      border-radius: 12px;
      border: 1px solid #f0eaf8;
    }

    .pending-avatar-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #ede7f6;
      color: #35164f;
      font-weight: 700;
      font-size: 13px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .pending-meta {
      flex: 1;
      min-width: 0;
    }

    .pending-name-line {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pending-name-line strong {
      font-size: 13.5px;
      color: #271442;
    }

    .badge-role {
      font-size: 10.5px;
      padding: 2px 7px;
      border-radius: 999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .role-midwife { background: #dcfce7; color: #15803d; }
    .role-patient { background: #fce7f3; color: #be185d; }
    .role-admin { background: #f3e8ff; color: #6b21a8; }

    .pending-sub {
      font-size: 12px;
      color: #7a7189;
      margin: 2px 0 0;
    }

    .pending-actions-btns {
      display: flex;
      gap: 6px;
    }

    .btn-sm-approve {
      padding: 6px 14px;
      background: #16a34a;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-sm-reject {
      padding: 6px 12px;
      background: #ffffff;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    /* Empty state */
    .empty-state-clean {
      text-align: center;
      padding: 30px 20px;
    }

    .empty-check-circle {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #f3eefb;
      color: #35164f;
      display: grid;
      place-items: center;
      margin: 0 auto 12px;
    }

    .empty-check-circle svg {
      width: 24px;
      height: 24px;
    }

    .empty-state-clean h3 {
      font-size: 15px;
      font-weight: 700;
      color: #271442;
      margin: 0 0 4px;
    }

    .empty-state-clean p {
      font-size: 12.5px;
      color: #7a7189;
      margin: 0;
    }

    /* Recent Patients list */
    .recent-patients-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .patient-line-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #faf8fd;
    }

    .patient-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      color: #35164f;
      display: grid;
      place-items: center;
    }

    .patient-info {
      flex: 1;
    }

    .patient-info strong {
      display: block;
      font-size: 13px;
      color: #271442;
    }

    .patient-info span {
      font-size: 11.5px;
      color: #7a7189;
    }

    .patient-status-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
    }

    /* Staff list */
    .staff-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .staff-item-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: #faf8fd;
      border-radius: 10px;
    }

    .staff-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #e0e7ff;
      color: #3730a3;
      font-size: 12px;
      font-weight: 700;
      display: grid;
      place-items: center;
    }

    .staff-info {
      flex: 1;
    }

    .staff-info strong {
      display: block;
      font-size: 13px;
      color: #271442;
    }

    .staff-info span {
      font-size: 11.5px;
      color: #7a7189;
    }

    .badge-duty {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 999px;
      background: #dcfce7;
      color: #15803d;
    }

    /* Activities */
    .activity-mini-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .activity-mini-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 12.5px;
    }

    .activity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6b21a8;
      margin-top: 5px;
      flex-shrink: 0;
    }

    .activity-desc {
      margin: 0;
      color: #271442;
      line-height: 1.4;
    }

    .activity-time {
      font-size: 11px;
      color: #7a7189;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 7, 25, 0.55);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: grid;
      place-items: center;
      padding: 16px;
    }

    .modal-card {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 16px 40px rgba(20, 8, 35, 0.2);
      overflow: hidden;
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 22px;
      border-bottom: 1px solid #ebe5f5;
    }

    .modal-head h3 {
      font-size: 16px;
      font-weight: 700;
      color: #271442;
      margin: 0;
    }

    .btn-close-modal {
      background: none;
      border: none;
      font-size: 20px;
      color: #7a7189;
      cursor: pointer;
    }

    .modal-body-form {
      padding: 20px 22px;
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
    }

    .modal-foot {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 10px;
    }

    .btn-modal-close {
      padding: 8px 16px;
      border-radius: 8px;
      background: #f1ebfa;
      color: #35164f;
      border: none;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }

    .btn-modal-accept {
      padding: 8px 18px;
      border-radius: 8px;
      background: #35164f;
      color: #ffffff;
      border: none;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
  `],
})
export class AdminOverview {
  adminSvc = inject(AdminService);

  readonly showAddMidwifeModal = signal(false);
  readonly submittingMidwife = signal(false);
  readonly midwifeError = signal('');
  midwifeName = '';
  midwifeEmail = '';
  midwifePrc = '';
  midwifePhone = '';
  midwifePassword = 'Midwife@2026!';

  readonly todayFormatted = computed(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  });

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly pendingUsers = computed(() => {
    const fromApps = this.adminSvc
      .pendingApprovals()
      .filter((a) => a.status === 'pending')
      .map((a) => ({
        id: a.id,
        displayName: a.fullName,
        email: a.email,
        role: a.requestedRole,
        prcLicense: a.prcLicense,
        contactNumber: a.contactNumber,
        proofOfIdentity: a.proofOfIdentity,
        approvalStatus: a.status,
        status: 'active' as const,
      }));
    const seenEmails = new Set(fromApps.map((a) => a.email.toLowerCase()));
    const fromUsers = this.adminSvc
      .users()
      .filter((u) => u.approvalStatus === 'pending' && !seenEmails.has(u.email.toLowerCase()));
    return [...fromApps, ...fromUsers];
  });

  readonly activeMidwives = computed(() => {
    return this.adminSvc.users().filter((u) => u.role === 'midwife' && u.status !== 'inactive');
  });

  getInitials(name?: string): string {
    if (!name) return 'LC';
    const clean = name.replace(/,?\s*(RM|MD|RN)\.?/gi, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getAvatarColor(name?: string): string {
    const palette = ['#ede7f6', '#fed7aa', '#fce7f3', '#e0f2fe', '#dcfce7', '#fef3c7'];
    if (!name) return palette[0];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return palette[sum % palette.length];
  }

  openAddMidwifeModal(): void {
    this.midwifeName = '';
    this.midwifeEmail = '';
    this.midwifePrc = '';
    this.midwifePhone = '';
    this.midwifePassword = 'Midwife@2026!';
    this.midwifeError.set('');
    this.showAddMidwifeModal.set(true);
  }

  async saveNewMidwife(): Promise<void> {
    this.midwifeError.set('');
    if (!this.midwifeName.trim() || !this.midwifeEmail.trim() || !this.midwifePrc.trim()) {
      this.midwifeError.set('Please fill in legal name, professional email, and PRC license.');
      return;
    }
    this.submittingMidwife.set(true);
    try {
      await this.adminSvc.addMidwife({
        name: this.midwifeName.trim(),
        email: this.midwifeEmail.trim(),
        prc: this.midwifePrc.trim(),
        phone: this.midwifePhone.trim() || '0917-555-0192',
        password: this.midwifePassword.trim() || 'Midwife@2026!',
      });
      this.showAddMidwifeModal.set(false);
    } catch (err: any) {
      this.midwifeError.set(err?.message || 'Failed to create midwife account.');
    } finally {
      this.submittingMidwife.set(false);
    }
  }
}

