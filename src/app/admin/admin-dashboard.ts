import { UpperCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { AuthService, Role } from '../core/auth.service';
import { db } from '../core/firebase';

interface SystemUser {
  id: string;
  email: string;
  displayName?: string;
  role: Role;
  prcLicense?: string;
  contactNumber?: string;
  createdAt?: any;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [UpperCasePipe, RouterLink],
  template: `
    <header class="admin-bar">
      <div class="admin-bar__inner">
        <div class="admin-brand">
          <div class="admin-logo-box">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="M24 42S5 30.5 5 17.5A9.5 9.5 0 0 1 24 12.5 9.5 9.5 0 0 1 43 17.5C43 30.5 24 42 24 42z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
              <path d="M17 22c0-3.5 3-5.5 6-4.5 3 1 3.5 4.5 1.5 7s-5.5 3.5-7.5 1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              <circle cx="26.5" cy="26" r="2" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <strong>Lying-In Care</strong>
            <span class="admin-badge">Admin Portal</span>
          </div>
        </div>

        <div class="admin-user">
          <span class="admin-email">{{ auth.user()?.email }}</span>
          <button type="button" class="btn-logout" (click)="auth.logout()">Log out</button>
        </div>
      </div>
    </header>

    <main class="admin-container">
      <div class="admin-header">
        <div>
          <h1>System Administration</h1>
          <p class="admin-sub">Manage clinic accounts, role permissions, and view system registry.</p>
        </div>
        <div class="quick-navs">
          <a routerLink="/midwife" class="btn-nav">Midwife View</a>
          <a routerLink="/patient" class="btn-nav">Patient View</a>
        </div>
      </div>

      <!-- Overview Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon stat-icon--purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <span class="stat-label">Total Users</span>
            <strong class="stat-val">{{ users().length }}</strong>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <div>
            <span class="stat-label">Midwives</span>
            <strong class="stat-val">{{ midwifeCount() }}</strong>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--peach">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            </svg>
          </div>
          <div>
            <span class="stat-label">Patients</span>
            <strong class="stat-val">{{ patientCount() }}</strong>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <span class="stat-label">Administrators</span>
            <strong class="stat-val">{{ adminCount() }}</strong>
          </div>
        </div>
      </div>

      <!-- User Management Panel -->
      <section class="panel-card">
        <div class="panel-header">
          <div>
            <h2>User & Role Management</h2>
            <p class="panel-sub">Change account roles or verify registered clinic members.</p>
          </div>

          <div class="filters">
            <input
              type="text"
              class="search-input"
              placeholder="Filter by name or email…"
              [value]="filterQuery()"
              (input)="filterQuery.set($any($event.target).value)"
            />
            <div class="role-pills">
              <button
                type="button"
                class="pill"
                [class.pill--active]="roleFilter() === 'all'"
                (click)="roleFilter.set('all')"
              >
                All ({{ users().length }})
              </button>
              <button
                type="button"
                class="pill"
                [class.pill--active]="roleFilter() === 'midwife'"
                (click)="roleFilter.set('midwife')"
              >
                Midwives ({{ midwifeCount() }})
              </button>
              <button
                type="button"
                class="pill"
                [class.pill--active]="roleFilter() === 'patient'"
                (click)="roleFilter.set('patient')"
              >
                Patients ({{ patientCount() }})
              </button>
              <button
                type="button"
                class="pill"
                [class.pill--active]="roleFilter() === 'admin'"
                (click)="roleFilter.set('admin')"
              >
                Admins ({{ adminCount() }})
              </button>
            </div>
          </div>
        </div>

        @if (feedback()) {
          <div class="feedback-banner" [class.feedback-banner--error]="feedbackError()">
            {{ feedback() }}
          </div>
        }

        @if (loading()) {
          <p class="empty-state">Loading user accounts…</p>
        } @else if (!filteredUsers().length) {
          <p class="empty-state">No accounts match the current filter.</p>
        } @else {
          <div class="table-wrap">
            <table class="user-table">
              <thead>
                <tr>
                  <th>User / Name</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Additional Info</th>
                  <th>Change Role</th>
                </tr>
              </thead>
              <tbody>
                @for (u of filteredUsers(); track u.id) {
                  <tr>
                    <td>
                      <strong>{{ u.displayName || 'No Name Provided' }}</strong>
                      <span class="user-id">UID: {{ u.id.slice(0, 8) }}…</span>
                    </td>
                    <td>{{ u.email }}</td>
                    <td>
                      <span [class]="'badge badge--' + u.role">{{ u.role | uppercase }}</span>
                    </td>
                    <td class="extra-info">
                      @if (u.prcLicense) {
                        <span>PRC: {{ u.prcLicense }}</span>
                      }
                      @if (u.contactNumber) {
                        <span>Phone: {{ u.contactNumber }}</span>
                      }
                      @if (!u.prcLicense && !u.contactNumber) {
                        <span class="dim">—</span>
                      }
                    </td>
                    <td>
                      <select
                        class="role-select"
                        [value]="u.role"
                        (change)="changeRole(u, $any($event.target).value)"
                        [disabled]="updatingId() === u.id"
                      >
                        <option value="patient">Patient</option>
                        <option value="midwife">Midwife</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </main>
  `,
  styles: `
    :host {
      --brand-900: #271442;
      --brand-800: #361759;
      --brand-700: #5b3e94;
      --brand-600: #6b4fa3;
      --brand-500: #8d72c4;
      --tint-100: #ece5f6;
      --tint-50: #fbf9fe;
      --ink: #2a2438;
      --muted: #5f5570;
      --line: #ebe5f5;
      display: block;
      min-height: 100vh;
      background: #fbf9fe;
      color: var(--ink);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .admin-bar {
      position: sticky;
      top: 0;
      z-index: 40;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line);
      height: 68px;
      display: flex;
      align-items: center;
    }

    .admin-bar__inner {
      width: min(1200px, 100% - 48px);
      margin-inline: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .admin-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--brand-700);
    }

    .admin-logo-box {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: linear-gradient(135deg, #361759, #6a349c);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(54, 23, 89, 0.2);
    }

    .admin-logo-box svg {
      width: 21px;
      height: 21px;
    }

    .admin-brand strong {
      font-size: 17px;
      color: var(--brand-900);
      display: block;
      line-height: 1.2;
    }

    .admin-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6d28d9;
      background: var(--tint-100);
      padding: 1px 8px;
      border-radius: 999px;
      margin-top: 2px;
    }

    .admin-user {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .admin-email {
      font-size: 14px;
      color: var(--muted);
      font-weight: 500;
    }

    .btn-logout {
      background: var(--tint-50);
      border: 1px solid var(--line);
      color: var(--brand-900);
      padding: 7px 16px;
      border-radius: 999px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-logout:hover {
      background: var(--tint-100);
      color: var(--brand-700);
    }

    .admin-container {
      width: min(1200px, 100% - 48px);
      margin: 36px auto 60px;
    }

    .admin-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 28px;
    }

    .admin-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      color: var(--brand-900);
      letter-spacing: -0.02em;
    }

    .admin-sub {
      margin: 6px 0 0;
      font-size: 15px;
      color: var(--muted);
    }

    .quick-navs {
      display: flex;
      gap: 10px;
    }

    .btn-nav {
      padding: 8px 18px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      background: #fff;
      color: var(--brand-700);
      border: 1px solid var(--line);
      box-shadow: 0 2px 6px rgba(54, 38, 79, 0.04);
      transition: all 0.2s;
    }

    .btn-nav:hover {
      background: var(--tint-100);
      border-color: var(--brand-500);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 22px;
      display: flex;
      align-items: center;
      gap: 18px;
      box-shadow: 0 4px 14px rgba(54, 38, 79, 0.03);
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .stat-icon svg {
      width: 24px;
      height: 24px;
    }

    .stat-icon--purple { background: var(--tint-100); color: var(--brand-700); }
    .stat-icon--green { background: #dcf1e7; color: #2f7a5f; }
    .stat-icon--peach { background: #fde6dc; color: #c0654a; }
    .stat-icon--blue { background: #e3ebfc; color: #3b6bdc; }

    .stat-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--muted);
    }

    .stat-val {
      display: block;
      font-size: 26px;
      font-weight: 800;
      color: var(--brand-900);
      margin-top: 2px;
      line-height: 1;
    }

    .panel-card {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 6px 20px rgba(54, 38, 79, 0.04);
    }

    .panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 24px;
    }

    .panel-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: var(--brand-900);
    }

    .panel-sub {
      margin: 4px 0 0;
      font-size: 14px;
      color: var(--muted);
    }

    .filters {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
    }

    .search-input {
      padding: 9px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      font-size: 14px;
      width: 260px;
      background: var(--tint-50);
      outline: none;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: var(--brand-600);
      background: #fff;
    }

    .role-pills {
      display: flex;
      gap: 8px;
    }

    .pill {
      background: var(--tint-50);
      border: 1px solid var(--line);
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      transition: all 0.2s;
    }

    .pill:hover {
      background: var(--tint-100);
      color: var(--brand-800);
    }

    .pill--active {
      background: var(--brand-700);
      color: #fff;
      border-color: var(--brand-700);
    }

    .pill--active:hover {
      background: #4a2e80;
      color: #fff;
    }

    .table-wrap {
      overflow-x: auto;
    }

    .user-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .user-table th {
      padding: 12px 14px;
      font-size: 12.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      border-bottom: 1px solid var(--line);
    }

    .user-table td {
      padding: 14px;
      border-bottom: 1px solid var(--line);
      font-size: 14px;
      vertical-align: middle;
    }

    .user-id {
      display: block;
      font-size: 11.5px;
      color: var(--muted);
      font-weight: normal;
      margin-top: 2px;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }

    .badge--midwife { background: #dcf1e7; color: #236c53; }
    .badge--patient { background: var(--tint-100); color: var(--brand-700); }
    .badge--admin { background: #e3ebfc; color: #2d5ec9; }

    .role-select {
      padding: 6px 12px;
      border: 1.5px solid var(--line);
      border-radius: 8px;
      font-size: 13.5px;
      background: #fff;
      color: var(--brand-900);
      cursor: pointer;
      outline: none;
    }

    .role-select:focus {
      border-color: var(--brand-600);
    }

    .extra-info span {
      display: block;
      font-size: 13px;
      color: var(--muted);
    }

    .dim { color: #aaa; }

    .feedback-banner {
      background: #dcf1e7;
      color: #236c53;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      margin-bottom: 18px;
    }

    .feedback-banner--error {
      background: #fbe6ee;
      color: #8f2a52;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--muted);
      font-size: 15px;
    }

    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .filters { align-items: stretch; width: 100%; }
      .search-input { width: 100%; }
    }

    @media (max-width: 560px) {
      .stats-grid { grid-template-columns: 1fr; }
      .admin-user .admin-email { display: none; }
    }
  `,
})
export class AdminDashboard implements OnInit {
  auth = inject(AuthService);

  readonly users = signal<SystemUser[]>([]);
  readonly loading = signal(true);
  readonly filterQuery = signal('');
  readonly roleFilter = signal<'all' | 'midwife' | 'patient' | 'admin'>('all');
  readonly updatingId = signal<string | null>(null);
  readonly feedback = signal('');
  readonly feedbackError = signal(false);

  readonly midwifeCount = computed(() => this.users().filter((u) => u.role === 'midwife').length);
  readonly patientCount = computed(() => this.users().filter((u) => u.role === 'patient').length);
  readonly adminCount = computed(() => this.users().filter((u) => u.role === 'admin').length);

  readonly filteredUsers = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    const r = this.roleFilter();
    return this.users().filter((u) => {
      const matchRole = r === 'all' || u.role === r;
      const matchQuery =
        !q ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.prcLicense && u.prcLicense.toLowerCase().includes(q));
      return matchRole && matchQuery;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: SystemUser[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          email: data['email'] || '',
          displayName: data['displayName'] || '',
          role: data['role'] || 'patient',
          prcLicense: data['prcLicense'],
          contactNumber: data['contactNumber'],
          createdAt: data['createdAt'],
        });
      });

      // Also include users created under 'admin' collection
      try {
        const adminSnap = await getDocs(collection(db, 'admin'));
        adminSnap.forEach((d) => {
          if (!list.some((u) => u.id === d.id)) {
            const data = d.data();
            list.push({
              id: d.id,
              email: data['email'] || '',
              displayName: data['displayName'] || data['email'] || 'Administrator',
              role: (data['role'] as Role) || 'admin',
              prcLicense: data['prcLicense'],
              contactNumber: data['contactNumber'],
              createdAt: data['createdAt'],
            });
          }
        });
      } catch {
        // ignore
      }
      // Sort admins and midwives first, then alphabetically
      list.sort((a, b) => {
        const order: Record<Role, number> = { admin: 1, midwife: 2, patient: 3 };
        const diff = (order[a.role] || 9) - (order[b.role] || 9);
        if (diff !== 0) return diff;
        return (a.displayName || a.email).localeCompare(b.displayName || b.email);
      });
      this.users.set(list);
    } catch (e) {
      this.feedback.set('Failed to load user accounts.');
      this.feedbackError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async changeRole(u: SystemUser, newRole: string): Promise<void> {
    if (newRole !== 'admin' && newRole !== 'midwife' && newRole !== 'patient') return;
    this.updatingId.set(u.id);
    this.feedback.set('');
    this.feedbackError.set(false);

    try {
      await updateDoc(doc(db, 'users', u.id), { role: newRole });
      this.users.update((curr) =>
        curr.map((item) => (item.id === u.id ? { ...item, role: newRole as Role } : item)),
      );
      this.feedback.set(`Role for ${u.displayName || u.email} updated to ${newRole.toUpperCase()}.`);
    } catch (e) {
      this.feedback.set(`Failed to update role: ${(e as Error).message}`);
      this.feedbackError.set(true);
    } finally {
      this.updatingId.set(null);
    }
  }
}
