import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-midwife-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="mw-app-layout">
      <!-- ============ LEFT SIDEBAR ============ -->
      <aside class="mw-sidebar">
        <!-- Brand Header with Landing Page Logo and "Lying-In Care" -->
        <a routerLink="/midwife" class="sidebar-brand">
          <div class="brand-logo-box">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="M24 42S5 30.5 5 17.5A9.5 9.5 0 0 1 24 12.5 9.5 9.5 0 0 1 43 17.5C43 30.5 24 42 24 42z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
              <path d="M17 22c0-3.5 3-5.5 6-4.5 3 1 3.5 4.5 1.5 7s-5.5 3.5-7.5 1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              <circle cx="26.5" cy="26" r="2" fill="currentColor"/>
            </svg>
          </div>
          <span class="brand-text"><strong>Lying-In Care</strong></span>
        </a>

        <!-- Navigation Menu -->
        <nav class="sidebar-nav" aria-label="Midwife Main Navigation">
          <!-- 1. Dashboard -->
          <a routerLink="/midwife" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            <span>Dashboard</span>
          </a>

          <!-- 2. Patients (Patient Directory) -->
          <a routerLink="/midwife/patients" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Patients</span>
          </a>

          <a routerLink="/midwife/appointments" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Appointments</span>
          </a>

          <a routerLink="/midwife/queue" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/>
            </svg>
            <span>Patient Queue</span>
          </a>

          <a routerLink="/midwife/prenatal" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>Prenatal Records</span>
          </a>

          <a routerLink="/midwife/delivery" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><circle cx="12" cy="12" r="2"/>
            </svg>
            <span>Delivery Records</span>
          </a>

          <a routerLink="/midwife/postpartum" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>Postpartum Records</span>
          </a>

          <a routerLink="/midwife/journey" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>Pregnancy Journey</span>
          </a>

          <a routerLink="/midwife/library" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span>Health Library</span>
          </a>

          <a routerLink="/midwife/reports" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            <span>Reports</span>
          </a>

          <a routerLink="/midwife/statistics" routerLinkActive="active" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <span>Statistics</span>
          </a>
        </nav>

        <!-- Sidebar Footer -->
        <div class="sidebar-footer">
          <a routerLink="/midwife/settings" class="nav-item settings-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Settings</span>
          </a>

          <div class="user-profile-badge">
            <div class="user-avatar">{{ userInitials() }}</div>
            <div class="user-details">
              <strong>{{ userName() }}</strong>
              <small>Licensed Midwife</small>
            </div>
            <button type="button" class="logout-icon-btn" (click)="auth.logout()" title="Log out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- ============ RIGHT MAIN CONTENT ============ -->
      <div class="mw-main-area">
        <!-- Top App Bar -->
        <header class="mw-top-bar">
          <div class="top-bar-title">{{ pageTitle() }}</div>

          <div class="top-bar-actions">
            <!-- Global Search -->
            <div class="top-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="search" placeholder="Search patients, appointments..." aria-label="Search">
            </div>

            <!-- Notifications -->
            <button type="button" class="icon-round-btn" aria-label="Notifications" title="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span class="bell-dot"></span>
            </button>

            <!-- User Initials Circle -->
            <div class="user-pill-btn" (click)="auth.logout()" title="Click to log out">
              <span>{{ userInitials() }}</span>
            </div>
          </div>
        </header>

        <!-- Routed Content -->
        <main class="mw-content-body">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
      background: #fbf9fe;
      color: #2a2438;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .mw-app-layout {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }

    /* ============ SIDEBAR ============ */
    .mw-sidebar {
      width: 224px;
      min-width: 224px;
      height: 100vh;
      background: #2b1446;
      display: flex;
      flex-direction: column;
      color: #e4dbf1;
      user-select: none;
      z-index: 10;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 16px 14px;
      text-decoration: none;
    }

    .brand-logo-box {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: linear-gradient(135deg, #361759, #6a349c);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
    }

    .brand-logo-box svg {
      width: 21px;
      height: 21px;
    }

    .brand-logo-box svg {
      width: 20px;
      height: 20px;
    }

    .brand-text strong {
      font-size: 15.5px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    /* Nav items */
    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sidebar-nav::-webkit-scrollbar {
      width: 4px;
    }
    .sidebar-nav::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 7.5px 11px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #cdbfe3;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .nav-item svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      opacity: 0.85;
    }

    .nav-item:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    .nav-item.active {
      background: #6e4fa8;
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(110, 79, 168, 0.4);
    }

    .nav-item.active svg {
      opacity: 1;
    }

    /* Footer */
    .sidebar-footer {
      padding: 12px 14px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .settings-link {
      padding: 8px 14px;
    }

    .user-profile-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
    }

    .user-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #503185;
      color: #ffffff;
      font-weight: 700;
      font-size: 12.5px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      border: 1.5px solid rgba(255, 255, 255, 0.2);
    }

    .user-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.2;
    }

    .user-details strong {
      font-size: 13px;
      color: #ffffff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-details small {
      font-size: 11px;
      color: #b5a2d4;
    }

    .logout-icon-btn {
      background: transparent;
      border: 0;
      color: #cdbfe3;
      padding: 6px;
      border-radius: 6px;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background 0.2s, color 0.2s;
    }

    .logout-icon-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .logout-icon-btn svg {
      width: 16px;
      height: 16px;
    }

    /* ============ MAIN AREA ============ */
    .mw-main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      min-width: 0;
      overflow: hidden;
      background: #faf8fc;
    }

    /* Top Bar */
    .mw-top-bar {
      height: 54px;
      min-height: 54px;
      background: #ffffff;
      border-bottom: 1px solid #ebe5f5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 5;
    }

    .top-bar-title {
      font-size: 17px;
      font-weight: 700;
      color: #2a1647;
      letter-spacing: -0.01em;
    }

    .top-bar-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .top-search {
      position: relative;
      display: flex;
      align-items: center;
    }

    .top-search svg {
      position: absolute;
      left: 12px;
      width: 15px;
      height: 15px;
      color: #8c829e;
      pointer-events: none;
    }

    .top-search input {
      width: 230px;
      padding: 6.5px 12px 6.5px 34px;
      border-radius: 999px;
      border: 1.5px solid #e5dff0;
      background: #fbf9fe;
      font-size: 13px;
      color: #2a2438;
      outline: none;
      transition: all 0.2s;
    }

    .top-search input:focus {
      background: #ffffff;
      border-color: #6b4fa3;
      box-shadow: 0 0 0 3px rgba(107, 79, 163, 0.12);
      width: 300px;
    }

    .icon-round-btn {
      position: relative;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 1px solid #e5dff0;
      background: #ffffff;
      color: #5a5468;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .icon-round-btn:hover {
      background: #f7f3fc;
      color: #6b4fa3;
      border-color: #d7cceb;
    }

    .icon-round-btn svg {
      width: 17px;
      height: 17px;
    }

    .bell-dot {
      position: absolute;
      top: 9px;
      right: 9px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #c2527a;
      border: 1.5px solid #ffffff;
    }

    .user-pill-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #2e1850;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(46, 24, 80, 0.2);
      transition: transform 0.15s;
    }

    .user-pill-btn:hover {
      transform: scale(1.05);
    }

    /* Content Body */
    .mw-content-body {
      flex: 1;
      overflow-y: auto;
      padding: 18px 24px 36px;
    }

    .mw-content-body::-webkit-scrollbar {
      width: 6px;
    }
    .mw-content-body::-webkit-scrollbar-thumb {
      background: #d8cde9;
      border-radius: 6px;
    }
  `,
})
export class MidwifeLayout {
  auth = inject(AuthService);
  private router = inject(Router);

  readonly userInitials = computed(() => {
    const email = this.auth.user()?.email ?? '';
    if (!email) return 'MR';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  });

  readonly userName = computed(() => {
    const email = this.auth.user()?.email ?? '';
    if (!email) return 'Midwife Maria';
    const prefix = email.split('@')[0];
    const clean = prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[._-].*$/, '');
    return `Midwife ${clean}`;
  });

  readonly pageTitle = computed(() => {
    const url = this.router.url;
    if (url.includes('/register-patient') || url.includes('/patients/new')) return 'Register Patient';
    if (url.includes('/patients')) return 'Patients';
    if (url.includes('/appointments')) return 'Appointments';
    if (url.includes('/availability')) return 'Availability';
    if (url.includes('/queue')) return 'Patient Queue';
    if (url.includes('/prenatal')) return 'Prenatal Records';
    if (url.includes('/delivery')) return 'Delivery Records';
    if (url.includes('/postpartum')) return 'Postpartum Records';
    if (url.includes('/journey')) return 'Pregnancy Journey';
    if (url.includes('/library')) return 'Health Library';
    if (url.includes('/reports')) return 'Reports';
    if (url.includes('/statistics')) return 'Statistics';
    return 'Dashboard';
  });
}