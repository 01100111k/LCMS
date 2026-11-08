import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { ArchiveRecord } from '../models/admin.models';

@Component({
  selector: 'app-admin-archives',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="archives-view">
      <!-- Header -->
      <div class="dir-head">
        <div>
          <h2>Archives & Inactive Records</h2>
          <p class="dir-sub">Manage deactivated accounts, completed maternal cases, and archived logs</p>
        </div>
        <div class="archive-count-pill">
          <span>{{ adminSvc.archiveCount() }} Archived Records</span>
        </div>
      </div>

      <!-- Filter Subtabs -->
      <div class="subtabs-bar">
        <button
          type="button"
          class="subtab-btn"
          [class.active]="categoryFilter() === 'all'"
          (click)="categoryFilter.set('all')"
        >
          All Records ({{ adminSvc.archiveCount() }})
        </button>
        <button
          type="button"
          class="subtab-btn"
          [class.active]="categoryFilter() === 'patient'"
          (click)="categoryFilter.set('patient')"
        >
          Archived Patients
        </button>
        <button
          type="button"
          class="subtab-btn"
          [class.active]="categoryFilter() === 'midwife'"
          (click)="categoryFilter.set('midwife')"
        >
          Archived Midwives
        </button>
        <button
          type="button"
          class="subtab-btn"
          [class.active]="categoryFilter() === 'user'"
          (click)="categoryFilter.set('user')"
        >
          Other Accounts
        </button>
      </div>

      <!-- Search Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search archives by name, email, PRC, or reason..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>
      </div>

      <!-- Archives Table -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>RECORD NAME</th>
              <th>CATEGORY</th>
              <th>IDENTIFIER</th>
              <th>ARCHIVED DATE</th>
              <th>REASON</th>
              <th style="text-align: right;">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            @for (rec of filteredArchives(); track rec.id) {
              <tr>
                <td>
                  <div class="archive-name-cell">
                    <div class="archive-icon-circle">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                    </div>
                    <strong>{{ rec.name }}</strong>
                  </div>
                </td>
                <td>
                  <span class="cat-pill" [ngClass]="'pill-' + rec.category">
                    {{ rec.category | uppercase }}
                  </span>
                </td>
                <td>
                  <span class="id-text">{{ rec.identifier }}</span>
                </td>
                <td>
                  <span class="date-text">{{ rec.archivedAt }}</span>
                </td>
                <td>
                  <span class="reason-text">{{ rec.reason }}</span>
                </td>
                <td style="text-align: right;">
                  <div class="action-btn-group">
                    <button type="button" class="btn-restore" (click)="restoreRecord(rec)">
                      Restore
                    </button>
                    <button type="button" class="btn-purge" (click)="confirmPurge(rec)">
                      Purge
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty-table-cell">
                  <div class="empty-archive-box">
                    <div class="empty-icon-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                    </div>
                    <h3>No Archived Records</h3>
                    <p>There are currently no archived patient or staff records in the facility archive.</p>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .archives-view {
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

    .archive-count-pill {
      padding: 8px 16px;
      border-radius: 999px;
      background: #ede8f8;
      color: #6b21a8;
      font-size: 12.5px;
      font-weight: 600;
    }

    /* Subtabs */
    .subtabs-bar {
      display: flex;
      gap: 8px;
      border-bottom: 2px solid #ede8f5;
      padding-bottom: 2px;
    }

    .subtab-btn {
      padding: 9px 16px;
      border: none;
      background: transparent;
      color: #7a7189;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      position: relative;
    }

    .subtab-btn.active {
      color: #35164f;
    }

    .subtab-btn.active::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 3px;
      background: #35164f;
      border-radius: 999px;
    }

    /* Search */
    .filter-bar {
      display: flex;
      gap: 14px;
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

    .archive-name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .archive-icon-circle {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #ede8f8;
      color: #6b21a8;
      display: grid;
      place-items: center;
    }

    .archive-icon-circle svg {
      width: 16px;
      height: 16px;
    }

    .cat-pill {
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
    }

    .pill-patient { background: #fce7f3; color: #be185d; }
    .pill-midwife { background: #dcfce7; color: #15803d; }
    .pill-user { background: #ede8f8; color: #6b21a8; }

    .id-text, .date-text {
      font-size: 12.5px;
      color: #574c6d;
    }

    .reason-text {
      font-size: 12.5px;
      color: #7a7189;
    }

    .action-btn-group {
      display: inline-flex;
      gap: 8px;
    }

    .btn-restore {
      padding: 6px 14px;
      border-radius: 8px;
      background: #16a34a;
      color: #ffffff;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-purge {
      padding: 6px 12px;
      border-radius: 8px;
      background: #ffffff;
      color: #dc2626;
      border: 1px solid #fecaca;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-purge:hover {
      background: #fee2e2;
    }

    .empty-table-cell {
      padding: 50px 20px;
      text-align: center;
    }

    .empty-archive-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-icon-box {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: #f1ebfa;
      color: #6b21a8;
      display: grid;
      place-items: center;
      margin-bottom: 4px;
    }

    .empty-icon-box svg {
      width: 26px;
      height: 26px;
    }

    .empty-archive-box h3 {
      font-size: 16px;
      font-weight: 700;
      color: #271442;
      margin: 0;
    }

    .empty-archive-box p {
      font-size: 13px;
      color: #7a7189;
      margin: 0;
    }
  `],
})
export class AdminArchives {
  adminSvc = inject(AdminService);

  readonly searchQuery = signal('');
  readonly categoryFilter = signal<'all' | 'patient' | 'midwife' | 'user'>('all');

  readonly filteredArchives = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.categoryFilter();

    return this.adminSvc.archives().filter((a) => {
      if (cat !== 'all' && a.category !== cat) return false;
      if (q) {
        const mName = a.name.toLowerCase().includes(q);
        const mId = a.identifier.toLowerCase().includes(q);
        const mReason = a.reason.toLowerCase().includes(q);
        if (!mName && !mId && !mReason) return false;
      }
      return true;
    });
  });

  restoreRecord(rec: ArchiveRecord): void {
    if (confirm(`Restore record for "${rec.name}" back to the active directory?`)) {
      if (rec.category === 'patient') {
        this.adminSvc.restorePatient(rec);
      } else {
        this.adminSvc.restoreUser(rec);
      }
    }
  }

  confirmPurge(rec: ArchiveRecord): void {
    if (confirm(`Permanently delete archive record for "${rec.name}"? This action cannot be undone.`)) {
      this.adminSvc.deleteArchivePermanently(rec.id);
    }
  }
}

