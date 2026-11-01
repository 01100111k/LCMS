import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminService } from './admin.service';
import { AuthService } from '../core/auth.service';
import { NotificationsService } from '../core/notifications.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-app-layout" [class.dark-mode]="isDarkMode()">
      <!-- ==================== SIDEBAR ==================== -->
      <aside class="admin-sidebar" [class.mobile-open]="mobileMenuOpen()">
        <!-- Brand Header with Landing Logo & "Lying-In Care" -->
        <div class="sidebar-brand">
          <div class="brand-logo-box">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="M24 42S5 30.5 5 17.5A9.5 9.5 0 0 1 24 12.5 9.5 9.5 0 0 1 43 17.5C43 30.5 24 42 24 42z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
              <path d="M17 22c0-3.5 3-5.5 6-4.5 3 1 3.5 4.5 1.5 7s-5.5 3.5-7.5 1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              <circle cx="26.5" cy="26" r="2" fill="currentColor"/>
            </svg>
          </div>
          <span class="brand-text"><strong>Lying-In Care</strong></span>
        </div>

        <!-- 7 REQUIRED ADMIN NAVIGATION ITEMS -->
        <nav class="sidebar-nav">
          <!-- 1. DASHBOARD -->
          <a
            routerLink="/admin"
            [routerLinkActiveOptions]="{ exact: true }"
            routerLinkActive="active"
            class="nav-btn"
            (click)="closeMobileMenu()"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            <span>Dashboard</span>
          </a>

          <!-- 2. MIDWIVES -->
          <a
            routerLink="/admin/midwives"
            routerLinkActive="active"
            class="nav-btn"
            (click)="closeMobileMenu()"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Midwives</span>
          </a>

          <!-- 3. PATIENTS -->
          <a
            routerLink="/admin/patients"
            routerLinkActive="active"
            class="nav-btn"
            (click)="closeMobileMenu()"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15" r="2"/>
            </svg>
            <span>Patients</span>
          </a>

          <!-- 4. PENDING APPROVALS (USER MANAGEMENT) -->
          <a
            routerLink="/admin/pending-approvals"
            routerLinkActive="active"
            class="nav-btn"
            (click)="closeMobileMenu()"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
            </svg>
            <span>Pending Approvals</span>
            @if (adminSvc.pendingCount() > 0) {
              <span class="nav-counter-pill">{{ adminSvc.pendingCount() }}</span>
            }
          </a>

          <!-- 5. ACTIVITY LOGS -->
          <a
            routerLink="/admin/activity-logs"
            routerLinkActive="active"
            class="nav-btn"
            (click)="closeMobileMenu()"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Activity Logs</span>
          </a>

          <!-- 6. ARCHIVES -->
          <a
            routerLink="/admin/archives"
            routerLinkActive="active"
            class="nav-btn"
            (click)="closeMobileMenu()"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            <span>Archives</span>
          </a>
        </nav>

        <!-- Sidebar Footer -->
        <div class="sidebar-footer">
          <a
            routerLink="/admin/settings"
            routerLinkActive="active"
            class="nav-btn settings-link"
            (click)="closeMobileMenu()"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Settings</span>
          </a>
        </div>
      </aside>

      <!-- ==================== MAIN CONTENT AREA ==================== -->
      <div class="admin-main-wrap">
        <!-- Top App Bar -->
        <header class="admin-topbar">
          <div class="topbar-left">
            <button type="button" class="btn-hamburger" (click)="mobileMenuOpen.set(!mobileMenuOpen())" aria-label="Toggle Navigation Menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="page-title-crumbs">
              <h1>Administrator Portal</h1>
            </div>
          </div>

          <div class="topbar-right">
            <!-- Global search input -->
            <div class="topbar-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search across facility..." />
            </div>

            <!-- Bell notifications icon with popover (Matches Image 4) -->
            <div class="notifications-wrapper" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="topbar-icon-btn notifications-btn"
                [class.active]="notificationsOpen()"
                title="Notifications"
                aria-label="Notifications"
                (click)="toggleNotifications()"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                @if (unreadCount() > 0) {
                  <span class="badge-dot"></span>
                }
              </button>

              @if (notificationsOpen()) {
                <div class="notifications-dropdown-card">
                  <div class="notif-header">
                    <h3 class="notif-title">Notifications</h3>
                    <button type="button" class="btn-mark-all-read" (click)="markAllRead()">Mark all read</button>
                  </div>

                  <div class="notif-content">
                    @if (notifications().length === 0) {
                      <!-- Caught Up Empty State (Matches Image 4) -->
                      <div class="notif-caught-up">
                        <div class="caught-up-icon-wrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                          </svg>
                        </div>
                        <h4>You're all caught up</h4>
                        <p>Activity from clinical approvals, staff verifications, and facility updates will appear here.</p>
                      </div>
                    } @else {
                      <div class="notif-list">
                        @for (n of notifications(); track n.id) {
                          <div class="notif-item" [class.unread]="!n.read" (click)="onNotificationClick(n)">
                            <div class="notif-icon-circle">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                            </div>
                            <div class="notif-item-body">
                              <strong class="notif-item-title">{{ n.title }}</strong>
                              <p class="notif-item-message">{{ n.message }}</p>
                              <span class="notif-item-time">{{ n.time }}</span>
                            </div>
                            @if (!n.read) {
                              <span class="notif-unread-dot"></span>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- User Menu Trigger -->
            <div class="user-menu-rel" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="user-pill"
                [class.active]="userDropdownOpen()"
                (click)="toggleUserDropdown()"
                title="Account & preferences"
                aria-label="Toggle user menu"
                [attr.aria-expanded]="userDropdownOpen()"
              >
                <div class="user-avatar-circle">
                  {{ adminSvc.adminInitial() }}
                </div>
              </button>

              @if (userDropdownOpen()) {
                <div class="user-dropdown-card">
                  <a routerLink="/admin/settings" class="dropdown-item" (click)="userDropdownOpen.set(false)">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="dropdown-icon"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    <span>Settings</span>
                  </a>

                  <div class="dropdown-item dark-mode-row" (click)="toggleDarkMode()">
                    <div class="dark-mode-left">
                      <svg viewBox="0 0 24 24" fill="currentColor" class="dropdown-icon"><path d="M12.3 2a10 10 0 0 0-1.9 19.8 10 10 0 0 0 11.6-11.6A10.02 10.02 0 0 1 12.3 2z"/></svg>
                      <span>Dark Mode</span>
                    </div>
                    <span class="dropdown-switch" [class.on]="isDarkMode()">
                      <span class="switch-thumb"></span>
                    </span>
                  </div>

                  <button type="button" class="dropdown-item signout-item" (click)="openSignOutModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="dropdown-icon signout-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span>Sign out</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <!-- Feedback Messages -->
        @if (adminSvc.feedback()) {
          <div class="admin-toast-banner" [class.is-error]="adminSvc.feedbackError()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>{{ adminSvc.feedback() }}</span>
            <button type="button" class="btn-toast-dismiss" (click)="adminSvc.feedback.set('')">&times;</button>
          </div>
        }

        <!-- Active View Output via Router Outlet -->
        <main class="admin-content-viewport">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Sign Out Confirmation Modal (Matches Picture) -->
      @if (showSignOutModal()) {
        <div class="signout-modal-backdrop" (click)="closeSignOutModal()">
          <div class="signout-modal-card" (click)="$event.stopPropagation()">
            <!-- Brand Header -->
            <div class="modal-brand-header">
              <svg viewBox="0 0 48 48" class="modal-brand-icon" aria-hidden="true">
                <path d="M24 42S5 30.5 5 17.5A9.5 9.5 0 0 1 24 12.5 9.5 9.5 0 0 1 43 17.5C43 30.5 24 42 24 42z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                <path d="M17 22c0-3.5 3-5.5 6-4.5 3 1 3.5 4.5 1.5 7s-5.5 3.5-7.5 1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                <circle cx="26.5" cy="26" r="2" fill="currentColor"/>
              </svg>
              <span>Lying-In Care</span>
            </div>

            <!-- Logout Icon Badge -->
            <div class="modal-logout-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>

            <!-- Title & Subtitle -->
            <h2 class="signout-title">Sign out?</h2>
            <p class="signout-desc">
              You are about to leave your admin session. Unsaved changes on open pages may be lost.
            </p>

            <!-- User Profile Box -->
            <div class="modal-user-box">
              <div class="modal-user-avatar">
                {{ adminInitials() }}
              </div>
              <div class="modal-user-info">
                <span class="modal-user-name">{{ adminDisplayName() || 'Clinic Administrator' }}</span>
                <span class="modal-user-email">{{ adminEmail() }}</span>
              </div>
            </div>

            <!-- Bullet Points -->
            <ul class="modal-bullet-list">
              <li>You will need your password to sign in again.</li>
              <li>Approval and attendance notifications still go to your clinic account when you return.</li>
            </ul>

            <!-- Action Buttons (Vertical Stack) -->
            <div class="signout-btn-stack">
              <button type="button" class="btn-stay-signed-in" (click)="closeSignOutModal()">
                Stay signed in
              </button>
              <button type="button" class="btn-confirm-signout" (click)="confirmSignOut()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
  styles: [`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #271442;
      background: #f7f4fb;
      min-height: 100vh;
    }

    .admin-app-layout {
      display: flex;
      min-height: 100vh;
      background: #f7f4fb;
    }

    /* ==================== SIDEBAR ==================== */
    .admin-sidebar {
      width: 224px;
      min-width: 224px;
      height: 100vh;
      background: #2b1446;
      color: #e4dbf1;
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 100;
      box-shadow: 2px 0 16px rgba(39, 20, 66, 0.15);
      transition: transform 0.25s ease;
      user-select: none;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 16px 14px;
      text-decoration: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
      width: 20px;
      height: 20px;
      color: #ffffff;
    }

    .brand-text strong {
      font-size: 15.5px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    /* Navigation */
    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 10px 14px;
      border-radius: 10px;
      color: #d1c5e2;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .nav-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    .nav-btn.active {
      background: #3f2266;
      color: #ffffff;
      font-weight: 600;
    }

    .nav-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .nav-counter-pill {
      margin-left: auto;
      background: #ef4444;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
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

    /* ==================== MAIN CONTENT ==================== */
    .admin-main-wrap {
      flex: 1;
      margin-left: 224px;
      display: flex;
      flex-direction: column;
      height: 100vh;
      min-width: 0;
      overflow: hidden;
      background: #faf8fc;
    }

    /* Top App Bar */
    .admin-topbar {
      height: 54px;
      min-height: 54px;
      background: #ffffff;
      border-bottom: 1px solid #ebe5f5;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 90;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .btn-hamburger {
      display: none;
      background: none;
      border: none;
      color: #35164f;
      cursor: pointer;
    }

    .btn-hamburger svg {
      width: 22px;
      height: 22px;
    }

    .page-title-crumbs h1 {
      font-size: 17px;
      font-weight: 700;
      color: #271442;
      margin: 0;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .topbar-search {
      position: relative;
      display: flex;
      align-items: center;
    }

    .topbar-search svg {
      position: absolute;
      left: 12px;
      width: 15px;
      height: 15px;
      color: #8c829e;
      pointer-events: none;
    }

    .topbar-search input {
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

    .topbar-search input:focus {
      background: #ffffff;
      border-color: #6b4fa3;
      box-shadow: 0 0 0 3px rgba(107, 79, 163, 0.12);
      width: 280px;
    }

    .topbar-icon-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 1px solid #e5dff0;
      background: #ffffff;
      color: #5a5468;
      display: grid;
      place-items: center;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
    }

    .topbar-icon-btn svg {
      width: 17px;
      height: 17px;
    }

    .badge-dot {
      position: absolute;
      top: 9px;
      right: 9px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #c2527a;
      border: 1.5px solid #ffffff;
    }

    /* Notifications Dropdown (Matches Image 4) */
    .notifications-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .topbar-icon-btn.notifications-btn.active {
      background: #ede6f8;
      color: #361759;
      border-color: #6b4fa3;
    }

    .notifications-dropdown-card {
      position: absolute;
      top: 48px;
      right: 0;
      width: 340px;
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(45, 20, 75, 0.14);
      z-index: 1000;
      overflow: hidden;
      animation: notifDropIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes notifDropIn {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .notif-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px 12px;
      border-bottom: 1px solid #f0ecf6;
    }

    .notif-title {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #271442;
    }

    .btn-mark-all-read {
      background: transparent;
      border: none;
      font-size: 12px;
      font-weight: 600;
      color: #7b5cb8;
      cursor: pointer;
      padding: 3px 8px;
      border-radius: 6px;
      transition: all 0.15s;
    }

    .btn-mark-all-read:hover {
      background: #f4eefa;
      color: #361759;
    }

    .notif-caught-up {
      padding: 36px 20px 38px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .caught-up-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #f7f3fb;
      color: #8c7ba8;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }

    .caught-up-icon-wrap svg {
      width: 24px;
      height: 24px;
    }

    .notif-caught-up h4 {
      margin: 0 0 5px;
      font-size: 15px;
      font-weight: 700;
      color: #271442;
    }

    .notif-caught-up p {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.5;
      color: #7a7189;
      max-width: 260px;
    }

    .notif-list {
      max-height: 320px;
      overflow-y: auto;
    }

    .notif-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 18px;
      border-bottom: 1px solid #f4effa;
      cursor: pointer;
      transition: background 0.15s;
      text-align: left;
    }

    .notif-item:hover {
      background: #faf7fd;
    }

    .notif-item.unread {
      background: #fcfaff;
    }

    .notif-icon-circle {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #ede6f7;
      color: #361759;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .notif-icon-circle svg {
      width: 16px;
      height: 16px;
    }

    .notif-item-body {
      flex: 1;
      min-width: 0;
    }

    .notif-item-title {
      font-size: 13px;
      font-weight: 700;
      color: #271442;
      display: block;
      margin-bottom: 2px;
    }

    .notif-item-message {
      margin: 0;
      font-size: 12px;
      color: #655877;
      line-height: 1.4;
    }

    .notif-item-time {
      font-size: 11px;
      color: #9a8fa8;
      margin-top: 4px;
      display: inline-block;
    }

    .notif-unread-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #7b42bc;
      flex-shrink: 0;
      margin-top: 6px;
    }

    /* User menu */
    .user-menu-rel {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .user-pill {
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      outline: none;
    }

    .user-avatar-circle {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #2e1850;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      display: grid;
      place-items: center;
      box-shadow: 0 2px 6px rgba(46, 24, 80, 0.2);
      transition: all 0.15s ease;
    }

    .user-avatar-circle:hover {
      transform: scale(1.05);
      box-shadow: 0 0 0 3px rgba(107, 79, 163, 0.25);
    }

    .user-dropdown-card {
      position: absolute;
      top: 46px;
      right: 0;
      width: 210px;
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      box-shadow: 0 10px 30px rgba(50, 24, 78, 0.12);
      padding: 6px;
      z-index: 100;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 12px;
      border-radius: 8px;
      border: none;
      background: none;
      color: #271442;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      box-sizing: border-box;
    }

    .dropdown-item:hover {
      background: #f7f4fb;
    }

    .dropdown-icon {
      width: 16px;
      height: 16px;
      color: #6b4fa3;
    }

    .dark-mode-row {
      justify-content: space-between;
    }

    .dark-mode-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dropdown-switch {
      width: 32px;
      height: 18px;
      border-radius: 999px;
      background: #dcd3eb;
      position: relative;
      transition: background 0.2s;
    }

    .dropdown-switch.on {
      background: #6b21a8;
    }

    .switch-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #ffffff;
      position: absolute;
      top: 2px;
      left: 2px;
      transition: transform 0.2s;
    }

    .dropdown-switch.on .switch-thumb {
      transform: translateX(14px);
    }

    .signout-item {
      color: #dc2626;
      border-top: 1px solid #f3eff9;
      margin-top: 4px;
    }

    .signout-icon {
      color: #dc2626;
    }

    /* Feedback Banner */
    .admin-toast-banner {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 600;
    }

    .admin-toast-banner.is-error {
      background: #fee2e2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .admin-toast-banner svg {
      width: 16px;
      height: 16px;
    }

    .btn-toast-dismiss {
      margin-left: auto;
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: inherit;
    }

    /* Content Viewport */
    .admin-content-viewport {
      flex: 1;
      overflow-y: auto;
      padding: 18px 24px 36px;
      background: #faf8fc;
    }

    .admin-content-viewport::-webkit-scrollbar {
      width: 6px;
    }

    .admin-content-viewport::-webkit-scrollbar-thumb {
      background: #d8cde9;
      border-radius: 6px;
    }

    /* ============ SIGN OUT MODAL (Matches Image 3) ============ */
    .signout-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 16px;
    }

    .signout-modal-card {
      background: #ffffff;
      border-radius: 28px;
      width: 100%;
      max-width: 375px;
      padding: 24px 24px 26px;
      box-shadow: 0 25px 50px -12px rgba(39, 20, 66, 0.28);
      display: flex;
      flex-direction: column;
      animation: modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }

    @keyframes modalPopIn {
      from { opacity: 0; transform: scale(0.96) translateY(6px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .modal-brand-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #271442;
      margin-bottom: 16px;
    }

    .modal-brand-icon {
      width: 20px;
      height: 20px;
      color: #271442;
    }

    .modal-logout-badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #f1e9f9;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #271442;
      margin-bottom: 16px;
    }

    .modal-logout-badge svg {
      width: 22px;
      height: 22px;
    }

    .signout-title {
      font-size: 26px;
      font-weight: 700;
      color: #1a0f2e;
      margin: 0 0 8px;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }

    .signout-desc {
      font-size: 13.5px;
      color: #6b637b;
      line-height: 1.45;
      margin: 0 0 16px;
    }

    .modal-user-box {
      border: 1.5px solid #ece4f7;
      border-radius: 16px;
      padding: 11px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: #faf7fd;
      margin-bottom: 16px;
    }

    .modal-user-avatar {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: #271442;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      letter-spacing: 0.5px;
    }

    .modal-user-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
      min-width: 0;
    }

    .modal-user-name {
      font-size: 14.5px;
      font-weight: 700;
      color: #1a0f2e;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .modal-user-email {
      font-size: 12.5px;
      color: #766d86;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .modal-bullet-list {
      margin: 0 0 22px 0;
      padding-left: 18px;
      color: #6b637b;
      font-size: 13px;
      line-height: 1.45;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .modal-bullet-list li {
      margin: 0;
    }

    .signout-btn-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }

    .btn-stay-signed-in {
      width: 100%;
      height: 46px;
      border-radius: 14px;
      background: #ffffff;
      border: 1.5px solid #dfd5ed;
      color: #271442;
      font-size: 14.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-stay-signed-in:hover {
      background: #f7f3fb;
      border-color: #cfbfdf;
    }

    .btn-confirm-signout {
      width: 100%;
      height: 46px;
      border-radius: 14px;
      background: #271442;
      border: none;
      color: #ffffff;
      font-size: 14.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-confirm-signout svg {
      width: 18px;
      height: 18px;
    }

    .btn-confirm-signout:hover {
      background: #3b1e63;
      transform: translateY(-1px);
    }

    /* Dark mode toggle styles */
    .dark-mode {
      background: #130a1c;
      color: #f3e8ff;
    }
    .dark-mode .admin-topbar {
      background: #1b0e26;
      border-color: #2c163e;
    }
    .dark-mode .page-title-crumbs h1 {
      color: #ffffff;
    }
    .dark-mode .topbar-search {
      background: #251336;
      border-color: #3b1d55;
    }
    .dark-mode .topbar-search input {
      color: #ffffff;
    }
    .dark-mode .topbar-icon-btn {
      background: #251336;
      border-color: #3b1d55;
      color: #e9d5ff;
    }
    .dark-mode .user-dropdown-card {
      background: #1b0e26;
      border-color: #3b1d55;
    }
    .dark-mode .dropdown-item {
      color: #f3e8ff;
    }
    .dark-mode .dropdown-item:hover {
      background: #251336;
    }

    @media (max-width: 900px) {
      .admin-sidebar {
        transform: translateX(-100%);
      }
      .admin-sidebar.mobile-open {
        transform: translateX(0);
      }
      .admin-main-wrap {
        margin-left: 0;
      }
      .btn-hamburger {
        display: block;
      }
    }
  `],
})
export class AdminLayout {
  adminSvc = inject(AdminService);
  auth = inject(AuthService);
  private router = inject(Router);
  private notifSvc = inject(NotificationsService);

  readonly mobileMenuOpen = signal(false);
  readonly userDropdownOpen = signal(false);
  readonly isDarkMode = signal(false);
  readonly showSignOutModal = signal(false);
  readonly notificationsOpen = signal(false);

  readonly adminDisplayName = computed(() => this.adminSvc.adminDisplayName());
  readonly adminEmail = computed(() => this.auth.user()?.email || 'admin@lyingincare.ph');
  readonly adminInitials = computed(() => {
    const name = this.adminDisplayName();
    if (!name || name === 'Administrator' || name === 'Admin') return 'AD';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  readonly notifications = this.notifSvc.adminNotifications;
  readonly unreadCount = this.notifSvc.adminUnreadCount;

  toggleNotifications(): void {
    const next = !this.notificationsOpen();
    this.notificationsOpen.set(next);
    if (next) {
      this.userDropdownOpen.set(false);
    }
  }

  toggleUserDropdown(): void {
    this.userDropdownOpen.update((v) => !v);
  }

  markAllRead(): void {
    this.notifSvc.markAllAdminRead();
  }

  onNotificationClick(n: { id: string; route?: string }): void {
    this.notifSvc.markAdminItemRead(n.id);
    this.notificationsOpen.set(false);
    if (n.route) {
      this.router.navigateByUrl(n.route);
    }
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.notificationsOpen.set(false);
    this.userDropdownOpen.set(false);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleDarkMode(): void {
    const next = !this.isDarkMode();
    this.isDarkMode.set(next);
  }

  openSignOutModal(): void {
    this.userDropdownOpen.set(false);
    this.showSignOutModal.set(true);
  }

  closeSignOutModal(): void {
    this.showSignOutModal.set(false);
  }

  confirmSignOut(): void {
    this.showSignOutModal.set(false);
    this.auth.logout();
  }
}

