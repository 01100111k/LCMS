import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityLogService, ActivityLogEntry } from '../core/activity-log.service';

@Component({
  selector: 'app-admin-activity-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="activity-logs-container">
      <!-- Header -->
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

      <!-- Controls: Search & Role Filters -->
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
            <button class="clear-btn" (click)="searchQuery.set('')">✕</button>
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

      <!-- Activity Logs Table Card -->
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
                  <th style="width: 25%;">User Name</th>
                  <th style="width: 18%;">User Role</th>
                  <th style="width: 35%;">Activity</th>
                  <th style="width: 22%;">Date and Time</th>
                </tr>
              </thead>
              <tbody>
                @for (log of filteredLogs(); track log.id) {
                  <tr class="log-row">
                    <!-- User Name -->
                    <td>
                      <div class="user-cell">
                        <div class="user-avatar" [ngClass]="'avatar-' + getRoleKey(log.userRole)">
                          {{ getInitials(log.userName) }}
                        </div>
                        <div class="user-details">
                          <span class="user-name">{{ log.userName || 'System' }}</span>
                          @if (log.userEmail) {
                            <span class="user-email">{{ log.userEmail }}</span>
                          }
                        </div>
                      </div>
                    </td>

                    <!-- User Role -->
                    <td>
                      <span class="role-badge" [ngClass]="'badge-' + getRoleKey(log.userRole)">
                        {{ log.userRole | uppercase }}
                      </span>
                    </td>

                    <!-- Activity -->
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
      gap: 1.5rem;
    }

    /* Header */
    .header-card {
      background: #ffffff;
      border: 1px solid #e9d5ff;
      border-radius: 16px;
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px -3px rgba(107, 79, 163, 0.07);
    }

    .header-info h2 {
      font-size: 1.6rem;
      font-weight: 700;
      color: #271442;
      margin: 0 0 0.25rem 0;
    }

    .sub-text {
      color: #6b4fa3;
      margin: 0;
      font-size: 0.95rem;
    }

    .header-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.9rem;
      background: #f7f4fb;
      border: 1px solid #e2d9f0;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #58338e;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }

    /* Controls */
    .controls-card {
      background: #ffffff;
      border: 1px solid #e9d5ff;
      border-radius: 14px;
      padding: 1rem 1.5rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 2px 10px rgba(107, 79, 163, 0.04);
    }

    .search-box {
      position: relative;
      flex: 1;
      min-width: 260px;
      max-width: 450px;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      width: 18px;
      height: 18px;
      color: #9333ea;
      pointer-events: none;
    }

    .search-box input {
      width: 100%;
      padding: 0.65rem 2.2rem 0.65rem 2.5rem;
      border: 1px solid #e2d9f0;
      border-radius: 10px;
      background: #fbf9fd;
      font-size: 0.9rem;
      color: #271442;
      outline: none;
      transition: all 0.2s;
    }

    .search-box input:focus {
      border-color: #7e22ce;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(126, 34, 206, 0.12);
    }

    .clear-btn {
      position: absolute;
      right: 10px;
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 0.85rem;
    }

    .role-filter-group {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .filter-pill {
      padding: 0.45rem 1rem;
      border-radius: 9999px;
      border: 1px solid #e2d9f0;
      background: #fbf9fd;
      color: #6b4fa3;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-pill:hover {
      background: #ede9fe;
      color: #58338e;
    }

    .filter-pill.active {
      background: #58338e;
      color: #ffffff;
      border-color: #58338e;
      box-shadow: 0 2px 6px rgba(88, 51, 142, 0.25);
    }

    /* Table Card */
    .table-card {
      background: #ffffff;
      border: 1px solid #e9d5ff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 15px -3px rgba(107, 79, 163, 0.07);
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
      padding: 0.9rem 1.25rem;
      font-size: 0.78rem;
      font-weight: 700;
      color: #58338e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #e9d5ff;
    }

    .activity-table td {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #f3e8ff;
      vertical-align: middle;
      font-size: 0.9rem;
    }

    .log-row:hover {
      background: #faf7fd;
    }

    /* User Cell */
    .user-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .user-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
      flex-shrink: 0;
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
      line-height: 1.2;
    }

    .user-name {
      font-weight: 600;
      color: #271442;
    }

    .user-email {
      font-size: 0.78rem;
      color: #7c6f93;
      margin-top: 2px;
    }

    /* Role Badges */
    .role-badge {
      display: inline-block;
      padding: 0.25rem 0.7rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.03em;
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

    /* Activity Cell */
    .activity-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .activity-icon {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .icon-login { background: #10b981; }
    .icon-register { background: #3b82f6; }
    .icon-approve { background: #8b5cf6; }
    .icon-reject { background: #ef4444; }
    .icon-appointment { background: #f59e0b; }
    .icon-record { background: #ec4899; }
    .icon-default { background: #6b7280; }

    .activity-text {
      color: #1f2937;
      font-weight: 500;
    }

    /* Timestamp Cell */
    .timestamp-cell {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: #6b4fa3;
      font-size: 0.85rem;
    }

    .time-icon {
      width: 15px;
      height: 15px;
      color: #a855f7;
      flex-shrink: 0;
    }

    /* Loading and Empty States */
    .state-container {
      padding: 4rem 2rem;
      text-align: center;
      color: #6b4fa3;
    }

    .state-container.empty h3 {
      color: #271442;
      font-size: 1.2rem;
      margin: 1rem 0 0.5rem 0;
    }

    .state-container.empty p {
      color: #7c6f93;
      max-width: 400px;
      margin: 0 auto;
      font-size: 0.9rem;
    }

    .empty-icon {
      width: 50px;
      height: 50px;
      margin: 0 auto;
      color: #c084fc;
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

  getRoleKey(role?: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return 'admin';
    if (r.includes('midwife')) return 'midwife';
    if (r.includes('patient')) return 'patient';
    return 'system';
  }

  getInitials(name?: string): string {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getActivityIconClass(activity?: string): string {
    const act = (activity || '').toLowerCase();
    if (act.includes('logged in')) return 'icon-login';
    if (act.includes('registered')) return 'icon-register';
    if (act.includes('approved')) return 'icon-approve';
    if (act.includes('rejected')) return 'icon-reject';
    if (act.includes('appointment')) return 'icon-appointment';
    if (act.includes('record') || act.includes('prenatal') || act.includes('postpartum') || act.includes('delivery')) {
      return 'icon-record';
    }
    return 'icon-default';
  }
}
