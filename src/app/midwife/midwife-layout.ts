import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
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
          <a routerLink="/midwife/settings" routerLinkActive="active" class="nav-item settings-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Settings</span>
          </a>
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

            <!-- User Menu Container & Dropdown Popover (Matches Screenshot) -->
            <div class="user-menu-wrapper" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="user-pill-btn"
                [class.active]="userMenuOpen()"
                (click)="toggleUserMenu()"
                title="Account & preferences"
                aria-label="Toggle user menu"
                [attr.aria-expanded]="userMenuOpen()"
              >
                <span>{{ userInitials() }}</span>
              </button>

              @if (userMenuOpen()) {
                <div class="user-dropdown-card">
                  <!-- 1. Account -->
                  <a routerLink="/midwife/settings" class="dropdown-item" (click)="closeUserMenu()">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="dropdown-icon" aria-hidden="true">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <span class="dropdown-label">Account</span>
                  </a>

                  <!-- 2. Settings -->
                  <a routerLink="/midwife/settings" class="dropdown-item" (click)="closeUserMenu()">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="dropdown-icon" aria-hidden="true">
                      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                    </svg>
                    <span class="dropdown-label">Settings</span>
                  </a>

                  <!-- 3. Dark Mode -->
                  <div class="dropdown-item dark-mode-row" (click)="toggleDarkMode()">
                    <div class="dark-mode-left">
                      <svg viewBox="0 0 24 24" fill="currentColor" class="dropdown-icon" aria-hidden="true">
                        <path d="M12.3 2a10 10 0 0 0-1.9 19.8 10 10 0 0 0 11.6-11.6A10.02 10.02 0 0 1 12.3 2z"/>
                      </svg>
                      <span class="dropdown-label">Dark Mode</span>
                    </div>
                    <span class="dropdown-switch" [class.on]="isDarkMode()">
                      <span class="switch-thumb"></span>
                    </span>
                  </div>

                  <!-- 4. Sign out -->
                  <button type="button" class="dropdown-item signout-item" (click)="onSignOutClicked()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="dropdown-icon signout-icon" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span class="dropdown-label signout-label">Sign out</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <!-- Routed Content -->
        <main class="mw-content-body">
          <router-outlet />
        </main>
      </div>

      <!-- ============ SIGN OUT CONFIRMATION MODAL (Matches Image 3) ============ -->
      @if (showSignOutModal()) {
        <div class="signout-modal-backdrop" (click)="closeSignOutModal()">
          <div class="signout-modal-card" (click)="$event.stopPropagation()">
            <!-- Brand Badge -->
            <div class="modal-brand-header">
              <svg viewBox="0 0 48 48" class="modal-brand-icon" aria-hidden="true">
                <path d="M24 42S5 30.5 5 17.5A9.5 9.5 0 0 1 24 12.5 9.5 9.5 0 0 1 43 17.5C43 30.5 24 42 24 42z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                <path d="M17 22c0-3.5 3-5.5 6-4.5 3 1 3.5 4.5 1.5 7s-5.5 3.5-7.5 1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                <circle cx="26.5" cy="26" r="2" fill="currentColor"/>
              </svg>
              <span>Lying-In Care</span>
            </div>

            <!-- Red Logout Icon Box -->
            <div class="signout-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>

            <!-- Title & Notice -->
            <h2 class="signout-title">Sign out?</h2>
            <p class="signout-desc">
              You are about to leave your midwife session. Unsaved changes on open pages may be lost.
            </p>

            <!-- Midwife Account Profile Card -->
            <div class="signout-user-card">
              <div class="signout-user-avatar">{{ userInitials() }}</div>
              <div class="signout-user-meta">
                <strong class="user-card-name">{{ userName() }}</strong>
                <span class="user-card-email">{{ userEmail() }}</span>
              </div>
            </div>

            <!-- Bullet Points -->
            <ul class="signout-bullet-list">
              <li>You will need your password to sign in again.</li>
              <li>Approval and attendance notifications still go to your clinic account when you return.</li>
            </ul>

            <!-- Action Buttons -->
            <div class="signout-btn-group">
              <button type="button" class="btn-stay-signed-in" (click)="closeSignOutModal()">
                Stay signed in
              </button>
              <button type="button" class="btn-confirm-signout" (click)="confirmSignOut()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      }
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

    :host-context(body.dark-mode) {
      background: #120e1b;
      color: #ede7f6;
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
      padding: 10px 14px;
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

    /* ============ USER DROPDOWN MENU ============ */
    .user-menu-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .user-pill-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #2e1850;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      border: 2px solid transparent;
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(46, 24, 80, 0.2);
      transition: all 0.15s ease;
      outline: none;
    }

    .user-pill-btn:hover,
    .user-pill-btn.active {
      transform: scale(1.05);
      border-color: #8c68c4;
      box-shadow: 0 0 0 3px rgba(107, 79, 163, 0.25);
    }

    .user-dropdown-card {
      position: absolute;
      top: calc(100% + 12px);
      right: 0;
      width: 196px;
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #ede7f6;
      box-shadow: 0 12px 32px rgba(35, 18, 60, 0.14), 0 4px 12px rgba(0, 0, 0, 0.05);
      padding: 8px 6px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      z-index: 1000;
      animation: dropdownPop 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes dropdownPop {
      from {
        opacity: 0;
        transform: translateY(-6px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      padding: 9px 12px;
      border-radius: 9px;
      text-decoration: none;
      background: transparent;
      border: none;
      width: 100%;
      box-sizing: border-box;
      font-size: 14px;
      font-weight: 500;
      color: #2e263d;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      font-family: inherit;
      text-align: left;
    }

    .dropdown-item:hover {
      background: #f7f3fd;
      color: #361759;
    }

    .dropdown-item .dropdown-icon {
      width: 18px;
      height: 18px;
      color: #4b415a;
      flex-shrink: 0;
      transition: color 0.15s ease;
    }

    .dropdown-item:hover .dropdown-icon {
      color: #361759;
    }

    .dropdown-label {
      flex: 1;
      line-height: 1;
    }

    /* Dark mode row */
    .dark-mode-row {
      justify-content: space-between;
      user-select: none;
    }

    .dark-mode-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dropdown-switch {
      width: 32px;
      height: 18px;
      border-radius: 999px;
      background: #e5def0;
      position: relative;
      flex-shrink: 0;
      transition: background 0.2s ease;
    }

    .dropdown-switch.on {
      background: #361759;
    }

    .switch-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .dropdown-switch.on .switch-thumb {
      transform: translateX(14px);
    }

    /* Sign out row (Red text & icon) */
    .signout-item {
      color: #ef4444 !important;
      font-weight: 600;
    }

    .signout-item .signout-icon {
      color: #ef4444 !important;
    }

    .signout-label {
      color: #ef4444;
    }

    .signout-item:hover {
      background: #fef2f2 !important;
      color: #dc2626 !important;
    }

    .signout-item:hover .signout-icon {
      color: #dc2626 !important;
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

    /* ============ SIGN OUT MODAL (Matches Image 3) ============ */
    .signout-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 18px;
    }

    .signout-modal-card {
      background: #ffffff;
      border-radius: 24px;
      width: 100%;
      max-width: 420px;
      padding: 28px 28px 24px;
      box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.8);
      display: flex;
      flex-direction: column;
      animation: modalPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }

    @keyframes modalPopIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .modal-brand-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #361759;
      margin-bottom: 20px;
    }

    .modal-brand-icon {
      width: 22px;
      height: 22px;
      color: #361759;
    }

    .signout-icon-box {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: #ede6f8;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .signout-icon-box svg {
      width: 24px;
      height: 24px;
      stroke: #361759;
      stroke-width: 2.2;
    }

    .signout-title {
      font-size: 26px;
      font-weight: 800;
      color: #261938;
      margin: 0 0 8px;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .signout-desc {
      font-size: 13.5px;
      color: #6a617c;
      line-height: 1.5;
      margin: 0 0 18px;
    }

    .signout-user-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      border: 1.5px solid #d4c8e8;
      border-radius: 14px;
      background: #fbf9fd;
      margin-bottom: 18px;
    }

    .signout-user-avatar {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: #361759;
      color: #ffffff;
      font-weight: 800;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .signout-user-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.3;
    }

    .user-card-name {
      font-size: 14.5px;
      font-weight: 700;
      color: #261938;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-card-email {
      font-size: 12.5px;
      color: #6a617c;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .signout-bullet-list {
      list-style: none;
      padding: 0;
      margin: 0 0 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .signout-bullet-list li {
      font-size: 13px;
      color: #6a617c;
      line-height: 1.45;
      position: relative;
      padding-left: 16px;
    }

    .signout-bullet-list li::before {
      content: '•';
      position: absolute;
      left: 2px;
      top: -1px;
      font-size: 16px;
      color: #8e7ea6;
    }

    .signout-btn-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .btn-stay-signed-in {
      width: 100%;
      height: 46px;
      background: #ffffff;
      border: 1.5px solid #d4c8e8;
      border-radius: 12px;
      color: #361759;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-stay-signed-in:hover {
      background: #fbf9fd;
      border-color: #361759;
    }

    .btn-confirm-signout {
      width: 100%;
      height: 46px;
      background: #361759;
      border: none;
      border-radius: 12px;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.15s ease;
      box-shadow: 0 4px 14px rgba(54, 23, 89, 0.28);
    }

    .btn-confirm-signout svg {
      width: 17px;
      height: 17px;
    }

    .btn-confirm-signout:hover {
      background: #4a2179;
      transform: translateY(-1px);
    }
  `,
})
export class MidwifeLayout implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);

  readonly showSignOutModal = signal(false);
  readonly userMenuOpen = signal(false);
  readonly isDarkMode = signal(false);

  readonly userInitials = computed(() => {
    return this.auth.userInitials() || 'MW';
  });

  readonly userEmail = computed(() => {
    return this.auth.user()?.email || 'midwife@lyingincare.ph';
  });

  readonly userName = computed(() => {
    const name = this.auth.userFullName();
    if (!name || name === 'Midwife') return 'Licensed Midwife';
    if (name.toLowerCase().startsWith('midwife')) return name;
    return `Midwife ${name}`;
  });

  private navEnd = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
  );

  readonly currentUrl = signal(this.router.url);

  constructor() {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.currentUrl.set(e.urlAfterRedirects || e.url);
    });
  }

  ngOnInit(): void {
    if (typeof localStorage !== 'undefined') {
      const savedDark = localStorage.getItem('lcms_dark_mode') === 'true';
      this.isDarkMode.set(savedDark);
      this.applyTheme(savedDark);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  toggleDarkMode(): void {
    const next = !this.isDarkMode();
    this.isDarkMode.set(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lcms_dark_mode', String(next));
    }
    this.applyTheme(next);
  }

  private applyTheme(dark: boolean): void {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    }
  }

  onSignOutClicked(): void {
    this.closeUserMenu();
    this.openSignOutModal();
  }

  readonly pageTitle = computed(() => {
    this.navEnd(); // triggers reactive recomputation on route changes
    const url = this.router.url || this.currentUrl();
    if (url.includes('/settings')) return 'Settings';
    if (url.includes('/register-patient') || url.includes('/patients/new')) return 'Register Patient';
    if (url.includes('/patients')) return 'Patients';
    if (url.includes('/appointments')) return 'Appointments';
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

  openSignOutModal(): void {
    this.showSignOutModal.set(true);
  }

  closeSignOutModal(): void {
    this.showSignOutModal.set(false);
  }

  async confirmSignOut(): Promise<void> {
    this.closeSignOutModal();
    await this.auth.logout();
  }
}