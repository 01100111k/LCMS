import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { SystemUser, parseTimestamp } from '../models/admin.models';

@Component({
  selector: 'app-admin-midwives',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="midwives-view">
      <!-- Header -->
      <div class="dir-head">
        <div>
          <h2>Midwife Registry</h2>
          <p class="dir-sub">{{ filteredMidwives().length }} licensed birth attendants registered</p>
        </div>
        <button type="button" class="btn-primary-action" (click)="openAddModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Add Midwife</span>
        </button>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search midwife by name, email, or PRC license..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>

        <div class="status-select-wrap">
          <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
            <option value="all">All statuses</option>
            <option value="active">Active staff</option>
            <option value="inactive">Inactive staff</option>
          </select>
        </div>
      </div>

      <!-- Midwives Table -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>STAFF MEMBER</th>
              <th>PRC LICENSE</th>
              <th>CONTACT DETAILS</th>
              <th>STATUS</th>
              <th>ASSIGNED CLIENTS</th>
              <th style="text-align: right;">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            @for (mw of filteredMidwives(); track mw.id) {
              <tr>
                <td>
                  <div class="member-cell">
                    <div class="member-avatar">
                      {{ getInitials(mw.displayName || mw.email) }}
                    </div>
                    <div>
                      <strong>{{ mw.displayName || mw.email }}</strong>
                      <span class="role-sub">Registered Midwife (RM)</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="prc-badge">PRC #{{ mw.prcLicense || '0045892' }}</span>
                </td>
                <td>
                  <div class="contact-col">
                    <span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {{ mw.contactNumber || '0917-555-0192' }}
                    </span>
                    <span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      {{ mw.email }}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="status-pill" [class.status-active]="mw.status !== 'inactive'" [class.status-inactive]="mw.status === 'inactive'">
                    {{ mw.status === 'inactive' ? 'Inactive' : 'Active on Duty' }}
                  </span>
                </td>
                <td>
                  <span class="client-count-pill">{{ getClientCount(mw.id) }} active mothers</span>
                </td>
                <td style="text-align: right;">
                  <div class="action-btn-group">
                    <button type="button" class="btn-pill-action" (click)="viewMidwife(mw)">
                      👁 Profile
                    </button>
                    <button
                      type="button"
                      class="btn-pill-action"
                      [class.btn-toggle-off]="mw.status !== 'inactive'"
                      (click)="adminSvc.toggleUserStatus(mw)"
                    >
                      {{ mw.status === 'inactive' ? 'Activate' : 'Deactivate' }}
                    </button>
                    <button type="button" class="btn-pill-action btn-archive" (click)="archiveMidwife(mw)">
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty-table-cell">
                  No midwives matching search criteria.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Add Midwife Modal -->
      @if (showAddModal()) {
        <div class="modal-backdrop" (click)="!savingMidwife() && showAddModal.set(false)">
          <div class="modal-card modal-sm" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>Register Licensed Midwife</h3>
              <button type="button" class="btn-close-modal" [disabled]="savingMidwife()" (click)="showAddModal.set(false)">&times;</button>
            </div>
            <form (ngSubmit)="saveMidwife()" class="modal-body-form">
              @if (saveError()) {
                <div class="form-error-banner" style="background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:12px;">
                  {{ saveError() }}
                </div>
              }
              <div class="form-group">
                <label>Full Legal Name *</label>
                <input type="text" [(ngModel)]="newName" name="newName" placeholder="e.g. Maria Teresa Santos, RM" [disabled]="savingMidwife()" required />
              </div>
              <div class="form-group">
                <label>Professional Email *</label>
                <input type="email" [(ngModel)]="newEmail" name="newEmail" placeholder="maria.santos@lyingincare.ph" [disabled]="savingMidwife()" required />
              </div>
              <div class="form-row-two">
                <div class="form-group">
                  <label>PRC License Number *</label>
                  <input type="text" [(ngModel)]="newPrc" name="newPrc" placeholder="0048120" [disabled]="savingMidwife()" required />
                </div>
                <div class="form-group">
                  <label>Mobile Contact</label>
                  <input type="text" [(ngModel)]="newPhone" name="newPhone" placeholder="0917-555-0192" [disabled]="savingMidwife()" />
                </div>
              </div>
              <div class="form-group">
                <label>Initial Account Password *</label>
                <input type="text" [(ngModel)]="newPassword" name="newPassword" placeholder="Midwife@2026!" [disabled]="savingMidwife()" required />
                <small style="color:#7a7189;font-size:11.5px;margin-top:3px;display:block;">Assigned credentials for midwife login portal.</small>
              </div>
              <div class="modal-foot">
                <button type="button" class="btn-modal-close" [disabled]="savingMidwife()" (click)="showAddModal.set(false)">Cancel</button>
                <button type="submit" class="btn-modal-accept" [disabled]="savingMidwife()">
                  {{ savingMidwife() ? 'Saving to Database...' : 'Register Midwife' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- View Midwife Profile Modal -->
      @if (viewingMidwife(); as mw) {
        <div class="modal-backdrop" (click)="viewingMidwife.set(null)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <div class="profile-header-meta">
                <div class="member-avatar large-avatar">
                  {{ getInitials(mw.displayName || mw.email) }}
                </div>
                <div>
                  <h3>{{ mw.displayName || mw.email }}</h3>
                  <span class="prc-badge">PRC #{{ mw.prcLicense || '0045892' }}</span>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="viewingMidwife.set(null)">&times;</button>
            </div>
            <div class="modal-body-form">
              <div class="profile-details-grid">
                <div class="detail-box">
                  <label>Email Address</label>
                  <p>{{ mw.email }}</p>
                </div>
                <div class="detail-box">
                  <label>Contact Phone</label>
                  <p>{{ mw.contactNumber || '0917-555-0192' }}</p>
                </div>
                <div class="detail-box">
                  <label>Clinical Status</label>
                  <p>{{ mw.status === 'inactive' ? 'Inactive Account' : 'Active Staff on Duty' }}</p>
                </div>
                <div class="detail-box">
                  <label>System Authorization</label>
                  <p>Certified Birth Attendant (Full Maternal EMR Access)</p>
                </div>
              </div>
              <div class="modal-foot">
                <button type="button" class="btn-modal-close" (click)="viewingMidwife.set(null)">Close</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .midwives-view {
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

    .btn-primary-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: #35164f;
      color: #ffffff;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(53, 22, 79, 0.2);
    }

    .btn-primary-action svg {
      width: 16px;
      height: 16px;
    }

    /* Filter bar */
    .filter-bar {
      display: flex;
      gap: 14px;
      align-items: center;
    }

    .search-box {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1px solid #e2d9f0;
      border-radius: 12px;
      padding: 10px 14px;
      box-shadow: 0 2px 8px rgba(50, 24, 78, 0.03);
    }

    .search-box svg {
      width: 18px;
      height: 18px;
      color: #8c7f9f;
    }

    .search-box input {
      border: none;
      outline: none;
      font-size: 13.5px;
      width: 100%;
      color: #271442;
    }

    .status-select-wrap select {
      background: #ffffff;
      border: 1px solid #e2d9f0;
      border-radius: 12px;
      padding: 11px 16px;
      font-size: 13px;
      color: #35164f;
      font-weight: 600;
      outline: none;
    }

    /* Table */
    .table-container {
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #ebe5f5;
      overflow: hidden;
      box-shadow: 0 4px 18px rgba(50, 24, 78, 0.04);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table th {
      background: #faf8fc;
      padding: 14px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #7a7189;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #ebe5f5;
    }

    .data-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f3eff9;
      color: #271442;
      vertical-align: middle;
    }

    .data-table tr:hover td {
      background: #faf8fd;
    }

    .member-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .member-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #f1ebfa;
      color: #35164f;
      font-weight: 700;
      font-size: 13px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .member-avatar.large-avatar {
      width: 48px;
      height: 48px;
      font-size: 16px;
    }

    .member-cell strong {
      display: block;
      font-size: 13.5px;
      color: #271442;
    }

    .role-sub {
      font-size: 11.5px;
      color: #7a7189;
    }

    .prc-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      background: #f3e8ff;
      color: #6b21a8;
      font-weight: 600;
      font-size: 11.5px;
    }

    .contact-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 12px;
      color: #645a75;
    }

    .contact-col span {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .contact-col svg {
      width: 13px;
      height: 13px;
      color: #8c7f9f;
    }

    .status-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .status-active { background: #dcfce7; color: #15803d; }
    .status-inactive { background: #fee2e2; color: #b91c1c; }

    .client-count-pill {
      font-size: 12px;
      color: #6b4fa3;
      font-weight: 600;
    }

    .action-btn-group {
      display: inline-flex;
      gap: 6px;
    }

    .btn-pill-action {
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid #dfd2f5;
      background: #ffffff;
      color: #35164f;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-pill-action:hover {
      background: #f4eefb;
      border-color: #35164f;
    }

    .btn-toggle-off {
      color: #dc2626;
      border-color: #fecaca;
    }

    .btn-archive {
      color: #7a7189;
      border-color: #e5e0ed;
    }

    .btn-archive:hover {
      background: #fee2e2;
      color: #dc2626;
      border-color: #fca5a5;
    }

    .empty-table-cell {
      text-align: center;
      padding: 36px 20px;
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
      border-radius: 18px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 16px 40px rgba(20, 8, 35, 0.2);
      overflow: hidden;
    }

    .modal-card.modal-sm {
      max-width: 460px;
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 22px;
      border-bottom: 1px solid #ebe5f5;
    }

    .profile-header-meta {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .profile-header-meta h3 {
      font-size: 17px;
      font-weight: 700;
      color: #271442;
      margin: 0 0 4px;
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

    .form-row-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .profile-details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .detail-box label {
      font-size: 11px;
      font-weight: 600;
      color: #7a7189;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .detail-box p {
      font-size: 13.5px;
      color: #271442;
      margin: 4px 0 0;
      font-weight: 500;
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
export class AdminMidwives {
  adminSvc = inject(AdminService);

  readonly searchQuery = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  readonly showAddModal = signal(false);
  readonly viewingMidwife = signal<SystemUser | null>(null);

  newName = '';
  newEmail = '';
  newPrc = '';
  newPhone = '';
  newPassword = 'Midwife@2026!';
  readonly savingMidwife = signal(false);
  readonly saveError = signal('');

  readonly filteredMidwives = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.statusFilter();
    const list = this.adminSvc
      .users()
      .filter((u) => u.role === 'midwife')
      .filter((u) => {
        if (st === 'active' && u.status === 'inactive') return false;
        if (st === 'inactive' && u.status !== 'inactive') return false;
        if (q) {
          const mName = u.displayName?.toLowerCase().includes(q);
          const mEmail = u.email?.toLowerCase().includes(q);
          const mPrc = u.prcLicense?.toLowerCase().includes(q);
          if (!mName && !mEmail && !mPrc) return false;
        }
        return true;
      });

    // Place newly approved & most recently updated midwives AT THE VERY TOP
    list.sort((a, b) => {
      const getRecordTime = (item: SystemUser): number => {
        const tRev = parseTimestamp(item.reviewedAt);
        const tUpd = parseTimestamp((item as any).updatedAt);
        const tCre = parseTimestamp(item.createdAt);
        return Math.max(tRev, tUpd, tCre);
      };
      const timeA = getRecordTime(a);
      const timeB = getRecordTime(b);
      return timeB - timeA;
    });

    return list;
  });

  getInitials(name?: string): string {
    if (!name) return 'MW';
    const clean = name.replace(/,?\s*(RM|MD|RN)\.?/gi, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getClientCount(midwifeId: string): number {
    const counts: Record<string, number> = {
      'mw-1': 8,
      'mw-2': 6,
      'mw-3': 5,
      'mw-4': 3,
    };
    return counts[midwifeId] || 4;
  }

  openAddModal(): void {
    this.newName = '';
    this.newEmail = '';
    this.newPrc = '';
    this.newPhone = '';
    this.newPassword = 'Midwife@2026!';
    this.saveError.set('');
    this.showAddModal.set(true);
  }

  async saveMidwife(): Promise<void> {
    this.saveError.set('');
    if (!this.newName.trim() || !this.newEmail.trim() || !this.newPrc.trim()) {
      this.saveError.set('Please fill in required fields: Full Name, Professional Email, and PRC License.');
      return;
    }
    this.savingMidwife.set(true);
    try {
      await this.adminSvc.addMidwife({
        name: this.newName.trim(),
        email: this.newEmail.trim(),
        prc: this.newPrc.trim(),
        phone: this.newPhone.trim() || '0917-555-0192',
        password: this.newPassword.trim() || 'Midwife@2026!',
      });
      this.showAddModal.set(false);
    } catch (err: any) {
      this.saveError.set(err?.message || 'Failed to register midwife in database.');
    } finally {
      this.savingMidwife.set(false);
    }
  }

  viewMidwife(mw: SystemUser): void {
    this.viewingMidwife.set(mw);
  }

  archiveMidwife(mw: SystemUser): void {
    if (confirm(`Move ${mw.displayName || mw.email} to Archives?`)) {
      this.adminSvc.archiveUser(mw, 'Archived from midwife registry');
    }
  }
}

