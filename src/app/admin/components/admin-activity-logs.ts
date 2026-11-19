import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityLogService, ActivityLogEntry } from '../../core/activity-log.service';

@Component({
  selector: 'app-admin-activity-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="activity-logs-container">
      <!-- Header Card (Exactly matches screenshot) -->
      <div class="header-card">
        <div class="header-info">
          <h2>Activity Logs</h2>
          <p class="sub-text">Real-time log of administrative, midwife, and patient actions across the system</p>
        </div>
        <div class="header-badge">
          <span class="live-dot"></span>
          <span>{{ filteredLogs().length }} logged events</span>
        </div>
      </div>

      <!-- Controls: Search & Role Filters (Exactly matches screenshot) -->
      <div class="controls-card">
        <!-- Search bar -->
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by user name, role, or activity..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
          @if (searchQuery()) {
            <button type="button" class="clear-btn" (click)="searchQuery.set('')" title="Clear search">✕</button>
          }
        </div>

        <!-- Role Filter Tabs -->
        <div class="role-filter-group">
          <button
            type="button"
            class="filter-pill"
            [class.active]="selectedRole() === 'all'"
            (click)="selectedRole.set('all')"
          >
            All Roles
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="selectedRole() === 'admin'"
            (click)="selectedRole.set('admin')"
          >
            Admin
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="selectedRole() === 'midwife'"
            (click)="selectedRole.set('midwife')"
          >
            Midwife
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="selectedRole() === 'patient'"
            (click)="selectedRole.set('patient')"
          >
            Patient
          </button>
        </div>
      </div>

      <!-- Activity Logs Table Card (Exactly matches screenshot) -->
      <div class="table-card">
        @if (logSvc.loading()) {
          <div class="state-container">
            <div class="spinner"></div>
            <p>Loading activity logs from Firestore...</p>
          </div>
        } @else if (filteredLogs().length === 0) {
          <div class="state-container empty">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3>No activities found</h3>
            <p>
              @if (searchQuery() || selectedRole() !== 'all') {
                No activity logs match your current filter criteria.
              } @else {
                Activity records will automatically appear here as actions are performed in the system.
              }
            </p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="activity-table">
              <thead>
                <tr>
                  <th style="width: 28%;">USER NAME</th>
                  <th style="width: 18%;">USER ROLE</th>
                  <th style="width: 32%;">ACTIVITY</th>
                  <th style="width: 22%;">DATE AND TIME</th>
                </tr>
              </thead>
              <tbody>
                @for (log of filteredLogs(); track log.id || $index) {
                  @let userDisplay = formatUserDisplay(log);
                  <tr class="log-row">
                    <!-- User Name & Avatar Cell (Enhanced to fix duplicate email/name bug) -->
                    <td>
                      <div class="user-cell">
                        <div class="user-avatar" [ngClass]="'avatar-' + getRoleKey(log.userRole)">
                          {{ getInitials(userDisplay.name, log.userEmail) }}
                        </div>
                        <div class="user-details">
                          <span class="user-name">{{ userDisplay.name }}</span>
                          @if (userDisplay.email) {
                            <span class="user-email">{{ userDisplay.email }}</span>
                          }
                        </div>
                      </div>
                    </td>

                    <!-- User Role Badge -->
                    <td>
                      <span class="role-badge" [ngClass]="'badge-' + getRoleKey(log.userRole)">
                        {{ (log.userRole || 'PATIENT') | uppercase }}
                      </span>
                    </td>

                    <!-- Activity Description -->
                    <td>
                      <div class="activity-cell">
                        <span class="activity-icon" [ngClass]="getActivityIconClass(log.activity)"></span>
                        <span class="activity-text">{{ log.activity }}</span>
                      </div>
                    </td>

                    <!-- Date and Time -->
                    <td>
                      <div class="timestamp-cell">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="time-icon">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>{{ logSvc.formatTimestamp(log.timestamp) }}</span>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .activity-logs-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ---------------- HEADER CARD ---------------- */
    .header-card {
      background: #ffffff;
      border: 1px solid #e9d5ff;
      border-radius: 16px;
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 18px -2px rgba(107, 79, 163, 0.06);
      transition: all 0.2s ease;
    }

    .header-info h2 {
      font-size: 1.65rem;
      font-weight: 700;
      color: #271442;
      margin: 0 0 0.3rem 0;
      letter-spacing: -0.01em;
    }

    .sub-text {
      color: #6b4fa3;
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.4;
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.45rem 1rem;
      background: #f7f4fb;
      border: 1px solid #e2d9f0;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #58338e;
      box-shadow: 0 1px 3px rgba(107, 79, 163, 0.04);
      flex-shrink: 0;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
      animation: pulseGlow 2.5s infinite ease-in-out;
    }

    @keyframes pulseGlow {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
      }
      50% {
        transform: scale(1.15);
        box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.15);
      }
    }

    /* ---------------- CONTROLS CARD ---------------- */
    .controls-card {
      background: #ffffff;
      border: 1px solid #e9d5ff;
      border-radius: 16px;
      padding: 1.1rem 1.6rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 2px 12px rgba(107, 79, 163, 0.04);
    }

    .search-box {
      position: relative;
      flex: 1;
      min-width: 280px;
      max-width: 480px;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 14px;
      width: 17px;
      height: 17px;
      color: #9333ea;
      pointer-events: none;
    }

    .search-box input {
      width: 100%;
      padding: 0.65rem 2.2rem 0.65rem 2.6rem;
      border: 1px solid #e2d9f0;
      border-radius: 10px;
      background: #fbf9fd;
      font-size: 0.92rem;
      color: #271442;
      outline: none;
      transition: all 0.2s ease;
    }

    .search-box input:focus {
      border-color: #7e22ce;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(126, 34, 206, 0.12);
    }

    .clear-btn {
      position: absolute;
      right: 12px;
      background: #f3e8ff;
      border: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      color: #6b21a8;
      cursor: pointer;
      font-size: 0.75rem;
      display: grid;
      place-items: center;
      transition: all 0.15s;
    }

    .clear-btn:hover {
      background: #e9d5ff;
      color: #4c1d95;
    }

    .role-filter-group {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .filter-pill {
      padding: 0.5rem 1.15rem;
      border-radius: 9999px;
      border: 1px solid #e2d9f0;
      background: #fbf9fd;
      color: #6b4fa3;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .filter-pill:hover {
      background: #ede9fe;
      color: #58338e;
      border-color: #c4b5fd;
    }

    .filter-pill.active {
      background: #58338e;
      color: #ffffff;
      border-color: #58338e;
      box-shadow: 0 2px 8px rgba(88, 51, 142, 0.28);
    }

    /* ---------------- TABLE CARD ---------------- */
    .table-card {
      background: #ffffff;
      border: 1px solid #e9d5ff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 18px -2px rgba(107, 79, 163, 0.06);
    }

    .table-responsive {
      overflow-x: auto;
    }

    .activity-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .activity-table th {
      background: #f7f4fb;
      padding: 1.05rem 1.4rem;
      font-size: 0.78rem;
      font-weight: 700;
      color: #58338e;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 2px solid #e9d5ff;
      white-space: nowrap;
    }

    .activity-table td {
      padding: 1.05rem 1.4rem;
      border-bottom: 1px solid #f3e8ff;
      vertical-align: middle;
      font-size: 0.9rem;
    }

    .log-row {
      transition: background 0.15s ease;
    }

    .log-row:hover {
      background: #faf7fd;
    }

    .log-row:last-child td {
      border-bottom: none;
    }

    /* ---------------- USER CELL ---------------- */
    .user-cell {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .user-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: 0.88rem;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .avatar-admin {
      background: #ede9fe;
      color: #6d28d9;
      border: 1px solid #ddd6fe;
    }

    .avatar-midwife {
      background: #e0e7ff;
      color: #4338ca;
      border: 1px solid #c7d2fe;
    }

    .avatar-patient {
      background: #fce7f3;
      color: #be185d;
      border: 1px solid #fbcfe8;
    }

    .avatar-system {
      background: #f3f4f6;
      color: #4b5563;
      border: 1px solid #e5e7eb;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }

    .user-name {
      font-weight: 700;
      color: #271442;
      font-size: 0.92rem;
    }

    .user-email {
      font-size: 0.78rem;
      color: #7c6f93;
      margin-top: 1px;
    }

    /* ---------------- ROLE BADGES ---------------- */
    .role-badge {
      display: inline-block;
      padding: 0.28rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .badge-admin {
      background: #f3e8ff;
      color: #6b21a8;
      border: 1px solid #d8b4fe;
    }

    .badge-midwife {
      background: #e0e7ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
    }

    .badge-patient {
      background: #fce7f3;
      color: #9d174d;
      border: 1px solid #fbcfe8;
    }

    .badge-system {
      background: #f3f4f6;
      color: #4b5563;
      border: 1px solid #e5e7eb;
    }

    /* ---------------- ACTIVITY CELL ---------------- */
    .activity-cell {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .activity-icon {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .icon-login {
      background: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
    }

    .icon-register {
      background: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
    }

    .icon-approve {
      background: #8b5cf6;
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
    }

    .icon-reject {
      background: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
    }

    .icon-appointment {
      background: #f59e0b;
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
    }

    .icon-record {
      background: #ec4899;
      box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.25);
    }

    .icon-default {
      background: #6b7280;
      box-shadow: 0 0 0 2px rgba(107, 114, 128, 0.25);
    }

    .activity-text {
      color: #1f2937;
      font-weight: 500;
      font-size: 0.92rem;
    }

    /* ---------------- TIMESTAMP CELL ---------------- */
    .timestamp-cell {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      color: #6b4fa3;
      font-size: 0.88rem;
      white-space: nowrap;
    }

    .time-icon {
      width: 15px;
      height: 15px;
      color: #a855f7;
      flex-shrink: 0;
    }

    /* ---------------- EMPTY / LOADING STATES ---------------- */
    .state-container {
      padding: 4.5rem 2rem;
      text-align: center;
      color: #6b4fa3;
    }

    .state-container.empty h3 {
      color: #271442;
      font-size: 1.25rem;
      margin: 1rem 0 0.5rem 0;
      font-weight: 700;
    }

    .state-container.empty p {
      color: #7c6f93;
      max-width: 420px;
      margin: 0 auto;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .empty-icon {
      width: 52px;
      height: 52px;
      margin: 0 auto;
      color: #c084fc;
    }

    .empty-icon svg {
      width: 100%;
      height: 100%;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #f3e8ff;
      border-top: 3px solid #6b21a8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem auto;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* ---------------- DARK MODE SUPPORT ---------------- */
    :host-context(body.dark-mode) .header-card,
    :host-context(body.dark-mode) .controls-card,
    :host-context(body.dark-mode) .table-card {
      background: #1e172c !important;
      border-color: #332549 !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
    }

    :host-context(body.dark-mode) .header-info h2,
    :host-context(body.dark-mode) .user-name,
    :host-context(body.dark-mode) .activity-text,
    :host-context(body.dark-mode) .state-container.empty h3 {
      color: #ede7f6 !important;
    }

    :host-context(body.dark-mode) .sub-text,
    :host-context(body.dark-mode) .user-email,
    :host-context(body.dark-mode) .timestamp-cell,
    :host-context(body.dark-mode) .state-container.empty p {
      color: #b7a8cf !important;
    }

    :host-context(body.dark-mode) .header-badge {
      background: #251c37 !important;
      border-color: #3d2c5a !important;
      color: #c4b5fd !important;
    }

    :host-context(body.dark-mode) .search-box input {
      background: #251c37 !important;
      border-color: #3d2c5a !important;
      color: #ede7f6 !important;
    }

    :host-context(body.dark-mode) .search-box input:focus {
      border-color: #a881e6 !important;
      background: #2b1f3f !important;
    }

    :host-context(body.dark-mode) .filter-pill {
      background: #251c37 !important;
      border-color: #3d2c5a !important;
      color: #c4b5fd !important;
    }

    :host-context(body.dark-mode) .filter-pill:hover {
      background: #361f52 !important;
      color: #ffffff !important;
    }

    :host-context(body.dark-mode) .filter-pill.active {
      background: #58338e !important;
      color: #ffffff !important;
      border-color: #7a5ba8 !important;
    }

    :host-context(body.dark-mode) .activity-table th {
      background: #251c37 !important;
      color: #c4b5fd !important;
      border-bottom-color: #3d2c5a !important;
    }

    :host-context(body.dark-mode) .activity-table td {
      border-bottom-color: #2d2042 !important;
    }

    :host-context(body.dark-mode) .log-row:hover {
      background: #251a38 !important;
    }
  `]
})
export class AdminActivityLogs {
  readonly logSvc = inject(ActivityLogService);

  readonly searchQuery = signal<string>('');
  readonly selectedRole = signal<'all' | 'admin' | 'midwife' | 'patient'>('all');

  readonly filteredLogs = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const roleFilter = this.selectedRole();
    const all = this.logSvc.logs();

    return all.filter((item) => {
      // Role filter
      if (roleFilter !== 'all') {
        const itemRole = (item.userRole || '').toLowerCase();
        if (!itemRole.includes(roleFilter)) return false;
      }

      // Query filter
      if (query) {
        const nameMatch = (item.userName || '').toLowerCase().includes(query);
        const emailMatch = (item.userEmail || '').toLowerCase().includes(query);
        const roleMatch = (item.userRole || '').toLowerCase().includes(query);
        const actMatch = (item.activity || '').toLowerCase().includes(query);
        return nameMatch || emailMatch || roleMatch || actMatch;
      }

      return true;
    });
  });

  // User display helper: Cleans up duplicated name/email when name === email or name is absent
  formatUserDisplay(log: ActivityLogEntry): { name: string; email: string } {
    const rawEmail = (log.userEmail || '').trim();
    let rawName = (log.userName || '').trim();

    if (!rawName && rawEmail) {
      rawName = rawEmail;
    }

    // If rawName is identical to rawEmail or looks like an email address
    if (rawName.toLowerCase() === rawEmail.toLowerCase() || rawName.includes('@')) {
      const role = (log.userRole || '').toLowerCase();
      if (role.includes('admin')) {
        return { name: 'admin@gmail.com', email: rawEmail !== 'admin@gmail.com' ? rawEmail : '' };
      } else if (role.includes('midwife')) {
        return { name: 'midwife@gmail.com', email: rawEmail !== 'midwife@gmail.com' ? rawEmail : '' };
      } else {
        return { name: 'Patient', email: rawEmail };
      }
    }

    return {
      name: rawName || 'User',
      email: rawEmail
    };
  }

  getRoleKey(role?: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return 'admin';
    if (r.includes('midwife')) return 'midwife';
    if (r.includes('patient')) return 'patient';
    return 'system';
  }

  getInitials(name?: string, email?: string): string {
    const target = (name || email || 'S').trim();
    if (target.includes('@')) {
      return target.charAt(0).toUpperCase();
    }
    const parts = target.split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getActivityIconClass(activity?: string): string {
    const act = (activity || '').toLowerCase();
    if (act.includes('logged in') || act.includes('log in')) return 'icon-login';
    if (act.includes('registered') || act.includes('register')) return 'icon-register';
    if (act.includes('approved') || act.includes('approve')) return 'icon-approve';
    if (act.includes('rejected') || act.includes('reject')) return 'icon-reject';
    if (act.includes('appointment')) return 'icon-appointment';
    if (act.includes('record') || act.includes('prenatal') || act.includes('postpartum') || act.includes('delivery')) {
      return 'icon-record';
    }
    return 'icon-default';
  }
}
