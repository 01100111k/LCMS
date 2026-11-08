import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { AccountIntegrityItem, SystemUser, parseTimestamp } from '../models/admin.models';
import { Role } from '../../core/auth.service';

@Component({
  selector: 'app-admin-pending-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pending-approvals-view">
      <!-- Header -->
      <div class="dir-head">
        <div>
          <h2>Pending Approvals</h2>
          <p class="dir-sub">Review credential applications, inspect proof of identity, and authorize access</p>
        </div>
        <div class="head-stat-pill">
          <span class="stat-count">{{ adminSvc.pendingCount() }}</span>
          <span>Awaiting Verification</span>
        </div>
      </div>

      <!-- Tab filter -->
      <div class="subtabs-bar">
        <button
          type="button"
          class="subtab-btn"
          [class.active]="activeFilter() === 'pending'"
          (click)="activeFilter.set('pending')"
        >
          Pending Review
          @if (adminSvc.pendingCount() > 0) {
            <span class="tab-badge">{{ adminSvc.pendingCount() }}</span>
          }
        </button>
        <button
          type="button"
          class="subtab-btn"
          [class.active]="activeFilter() === 'approved'"
          (click)="activeFilter.set('approved')"
        >
          Approved Accounts
        </button>
        <button
          type="button"
          class="subtab-btn"
          [class.active]="activeFilter() === 'rejected'"
          (click)="activeFilter.set('rejected')"
        >
          Rejected
        </button>
        <button
          type="button"
          class="subtab-btn"
          [class.active]="activeFilter() === 'all'"
          (click)="activeFilter.set('all')"
        >
          All Users
        </button>
        <button
          type="button"
          class="subtab-btn"
          [class.active]="activeFilter() === 'repair'"
          (click)="switchToRepairTab()"
        >
          Database Integrity & Sync
          @if (missingRecordsCount() > 0) {
            <span class="tab-badge" style="background: #dc2626; color: white;">{{ missingRecordsCount() }}</span>
          }
        </button>
      </div>

      @if (activeFilter() === 'repair') {
        <!-- Database Integrity & Repair Tab View -->
        <div class="repair-container">
          <div class="repair-header-card">
            <div>
              <h3>Firebase Auth & Firestore Record Consistency</h3>
              <p>Audits every user account to ensure matching <code>users/&#123;uid&#125;</code> and role profiles (<code>midwives/&#123;uid&#125;</code> or <code>patients/&#123;uid&#125;</code>) exist in Firestore with identical UIDs.</p>
            </div>
            <div class="repair-actions">
              <button type="button" class="btn-rescan" (click)="runAudit()" [disabled]="isAuditing()">
                {{ isAuditing() ? 'Scanning...' : 'Re-scan Database' }}
              </button>
              @if (missingRecordsCount() > 0) {
                <button type="button" class="btn-repair-all" (click)="onRepairAll()" [disabled]="isRepairingAll()">
                  {{ isRepairingAll() ? 'Repairing...' : 'Repair All (' + missingRecordsCount() + ')' }}
                </button>
              }
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ACCOUNT</th>
                  <th>ROLE</th>
                  <th>AUTH UID</th>
                  <th>USERS/&#123;UID&#125;</th>
                  <th>ROLE PROFILE DOC</th>
                  <th>DIAGNOSTIC STATUS</th>
                  <th style="text-align: right;">ACTION</th>
                </tr>
              </thead>
              <tbody>
                @for (item of auditItems(); track item.id) {
                  <tr>
                    <td>
                      <div class="applicant-cell">
                        <div class="applicant-avatar">{{ getInitials(item.displayName) }}</div>
                        <div>
                          <strong>{{ item.displayName }}</strong>
                          <span class="email-sub">{{ item.email }}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="role-badge" [ngClass]="'role-' + item.role">{{ item.role }}</span>
                    </td>
                    <td>
                      <span style="font-family: monospace; font-size: 11px; color: #475569;">{{ item.uid }}</span>
                    </td>
                    <td>
                      @if (item.hasUsersDoc) {
                        <span class="status-pill status-approved" style="font-size: 11px;">✓ Found</span>
                      } @else {
                        <span class="status-pill" style="font-size: 11px; background: #fee2e2; color: #dc2626;">✗ Missing</span>
                      }
                    </td>
                    <td>
                      @if (item.hasProfileDoc) {
                        <span class="status-pill status-approved" style="font-size: 11px;">✓ Found ({{ item.profileCollection }})</span>
                      } @else {
                        <span class="status-pill" style="font-size: 11px; background: #fee2e2; color: #dc2626;">✗ Missing ({{ item.profileCollection }})</span>
                      }
                    </td>
                    <td>
                      <span style="font-size: 12px; color: #64748b;">{{ item.details }}</span>
                    </td>
                    <td style="text-align: right;">
                      @if (item.status !== 'healthy') {
                        <button type="button" class="btn-approve-solid" style="padding: 6px 14px; font-size: 12px;" (click)="onRepairItem(item)" [disabled]="isProcessing(item.id)">
                          {{ isProcessing(item.id) ? 'Repairing...' : 'Repair Records' }}
                        </button>
                      } @else {
                        <span style="color: #16a34a; font-weight: 600; font-size: 12px;">✓ Linked & Synced</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty-table-cell">
                      <div class="empty-state-card">
                        <div class="empty-check">✓</div>
                        <h3>All Accounts Fully Synchronized</h3>
                        <p>No missing Firestore documents detected across Firebase Authentication accounts.</p>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <!-- Search Bar -->
        <div class="filter-bar">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search by applicant name, email, or PRC license..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
            />
          </div>
        </div>

        <!-- Applicants List -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>APPLICANT</th>
                <th>REQUESTED ROLE</th>
                <th>CREDENTIALS / PRC</th>
                <th>PROOF OF IDENTITY</th>
                <th>STATUS</th>
                <th style="text-align: right;">ACTION</th>
              </tr>
            </thead>
            <tbody>
              @for (u of filteredUsers(); track u.id) {
                <tr>
                  <td>
                    <div class="applicant-cell">
                      <div class="applicant-avatar">
                        {{ getInitials(u.displayName || u.email) }}
                      </div>
                      <div>
                        <strong>{{ u.displayName || u.email }}</strong>
                        <span class="email-sub">{{ u.email }} &bull; {{ u.contactNumber || 'No phone' }}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="role-badge" [ngClass]="'role-' + u.role">
                      {{ u.role }}
                    </span>
                  </td>
                  <td>
                    @if (u.prcLicense) {
                      <span class="prc-pill">PRC #{{ u.prcLicense }}</span>
                    } @else {
                      <span class="text-muted">Maternal Registration</span>
                    }
                  </td>
                  <td>
                    @if (u.proofOfIdentity && u.proofOfIdentity.length > 0) {
                      <button type="button" class="btn-view-proof" (click)="openProofModal(u)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>{{ u.proofOfIdentity.length }} Document(s)</span>
                      </button>
                    } @else {
                      <span class="text-muted">Standard signup</span>
                    }
                  </td>
                  <td>
                    <span class="status-pill" [ngClass]="'status-' + (u.approvalStatus || 'approved')">
                      {{ u.approvalStatus === 'pending' ? 'Pending Review' : (u.approvalStatus || 'Approved') }}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <div class="action-btn-group">
                      <button type="button" class="btn-view-proof" (click)="openProofModal(u)">
                        Details
                      </button>
                      @if (u.approvalStatus === 'pending') {
                        <button
                          type="button"
                          class="btn-approve-solid"
                          [disabled]="isProcessing(u.id)"
                          (click)="onApprove(u)"
                        >
                          {{ isProcessing(u.id) ? 'Approving...' : 'Approve' }}
                        </button>
                        <button type="button" class="btn-reject-outline" [disabled]="isProcessing(u.id)" (click)="openRejectModal(u)">
                          Reject
                        </button>
                      } @else {
                        <select class="role-selector" [ngModel]="u.role" (ngModelChange)="adminSvc.changeUserRole(u, $event)">
                          <option value="midwife">Midwife</option>
                          <option value="patient">Patient</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          type="button"
                          class="btn-status-toggle"
                          (click)="adminSvc.toggleUserStatus(u)"
                        >
                          {{ u.status === 'inactive' ? 'Activate' : 'Deactivate' }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty-table-cell">
                    @if (activeFilter() === 'pending') {
                      <div class="empty-state-card">
                        <div class="empty-check">✓</div>
                        <h3>No Pending Approvals</h3>
                        <p>All submitted midwife and patient applications have been reviewed.</p>
                      </div>
                    } @else {
                      No accounts found for the selected filter.
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Proof of Identity Modal (Extended Width Whole View) -->
      @if (previewUser(); as u) {
        <div class="modal-backdrop" (click)="previewUser.set(null)">
          <div class="reg-modal-card reg-modal-wide" (click)="$event.stopPropagation()">
            <!-- Close Button -->
            <button type="button" class="btn-reg-close" (click)="previewUser.set(null)" aria-label="Close">&times;</button>

            <!-- Header -->
            <div class="reg-modal-head">
              <h3 class="reg-title">{{ u.displayName || u.email }}</h3>
              <p class="reg-subtitle">{{ (u.role | titlecase) }} Registration</p>
            </div>

            <!-- Two-Column Body Content (Whole View) -->
            <div class="reg-modal-body-split">
              <!-- Left Column: Details Table -->
              <div class="reg-col-info">
                <table class="reg-details-table">
                  <tbody>
                    <tr>
                      <td class="lbl">First name</td>
                      <td class="val">{{ getFirstAndLastName(u.displayName).first }}</td>
                    </tr>
                    <tr>
                      <td class="lbl">Last name</td>
                      <td class="val">{{ getFirstAndLastName(u.displayName).last }}</td>
                    </tr>
                    <tr>
                      <td class="lbl">Gmail</td>
                      <td class="val">{{ u.email }}</td>
                    </tr>
                    <tr>
                      <td class="lbl">Role</td>
                      <td class="val">{{ u.role }}</td>
                    </tr>
                    @if (u.prcLicense) {
                      <tr>
                        <td class="lbl">PRC License</td>
                        <td class="val">{{ u.prcLicense }}</td>
                      </tr>
                    }
                    @if (u.contactNumber) {
                      <tr>
                        <td class="lbl">Contact</td>
                        <td class="val">{{ u.contactNumber }}</td>
                      </tr>
                    }
                    <tr>
                      <td class="lbl">Submitted</td>
                      <td class="val">{{ formatSubmitted(u.createdAt) }}</td>
                    </tr>
                    <tr>
                      <td class="lbl">Registration type</td>
                      <td class="val">{{ u.role === 'midwife' ? 'PRC-licensed Midwife' : 'Self-registration' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Right Column: Uploaded Proof -->
              <div class="reg-col-proof">
                <h4 class="reg-proof-heading">Uploaded proof</h4>

                @if (u.proofOfIdentity && u.proofOfIdentity.length > 0) {
                  @let activeDoc = u.proofOfIdentity[selectedDocIndex()] || u.proofOfIdentity[0];
                  <div class="reg-proof-preview-frame" (click)="viewDocument(activeDoc)" [title]="'Click to open ' + activeDoc.name">
                    @if (activeDoc.type.includes('image') || isImageFile(activeDoc.name)) {
                      <img [src]="activeDoc.dataUrl" [alt]="activeDoc.name" class="reg-proof-image" />
                    } @else {
                      <div class="reg-proof-pdf">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        <strong>PDF Document</strong>
                      </div>
                    }
                  </div>

                  <ul class="reg-proof-list">
                    @for (doc of u.proofOfIdentity; track doc.name; let idx = $index) {
                      <li [class.active-doc]="selectedDocIndex() === idx">
                        <span class="reg-bullet">&bull;</span>
                        <a class="reg-file-link" (click)="selectedDocIndex.set(idx); viewDocument(doc)">{{ doc.name }}</a>
                        <span class="reg-file-meta">{{ (doc.size / 1024) | number:'1.0-0' }} KB &bull; {{ getDocTypeLabel(doc) }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="reg-no-proof">No verification documents uploaded.</p>
                }
              </div>
            </div>

            <!-- Footer Action Buttons -->
            <div class="reg-modal-foot">
              <button type="button" class="btn-reg-reject" (click)="openRejectModal(u); previewUser.set(null)">
                Reject
              </button>
              <button
                type="button"
                class="btn-reg-approve"
                [disabled]="isProcessing(u.id)"
                (click)="onModalApprove(u)"
              >
                {{ isProcessing(u.id) ? 'Approving...' : 'Approve' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Reject Confirmation Modal -->
      @if (rejectingUser(); as u) {
        <div class="modal-backdrop" (click)="rejectingUser.set(null)">
          <div class="modal-card modal-sm" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>Reject Application</h3>
              <button type="button" class="btn-close-modal" (click)="rejectingUser.set(null)">&times;</button>
            </div>
            <div class="modal-body-form">
              <p style="font-size: 13.5px; color: #4a3b60; margin: 0 0 8px;">
                Are you sure you want to reject the application for <strong>{{ u.displayName || u.email }}</strong>?
              </p>
              <div class="form-group">
                <label>Reason for rejection</label>
                <input type="text" [(ngModel)]="rejectReason" placeholder="e.g. Unverified PRC license or invalid document upload" />
              </div>
              <div class="modal-foot">
                <button type="button" class="btn-modal-close" (click)="rejectingUser.set(null)">Cancel</button>
                <button type="button" class="btn-reject-confirm" (click)="confirmReject()">Reject Account</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .pending-approvals-view {
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

    .head-stat-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 18px;
      border-radius: 999px;
      background: #fef3c7;
      color: #b45309;
      font-size: 12.5px;
      font-weight: 600;
      border: 1px solid #fde68a;
    }

    .stat-count {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #b45309;
      color: #ffffff;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
    }

    /* Subtabs */
    .subtabs-bar {
      display: flex;
      gap: 8px;
      border-bottom: 2px solid #ede8f5;
      padding-bottom: 2px;
    }

    .subtab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
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

    .tab-badge {
      padding: 2px 7px;
      border-radius: 999px;
      background: #ef4444;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 700;
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

    .applicant-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .applicant-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #ede7f6;
      color: #35164f;
      font-weight: 700;
      font-size: 13px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .applicant-cell strong {
      display: block;
      font-size: 13.5px;
      color: #271442;
    }

    .email-sub {
      font-size: 11.5px;
      color: #7a7189;
    }

    .role-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .role-midwife { background: #dcfce7; color: #15803d; }
    .role-patient { background: #fce7f3; color: #be185d; }
    .role-admin { background: #f3e8ff; color: #6b21a8; }

    .prc-pill {
      font-size: 12px;
      font-weight: 600;
      color: #6b21a8;
      background: #f3e8ff;
      padding: 3px 8px;
      border-radius: 6px;
    }

    .text-muted {
      color: #8c7f9f;
      font-size: 12px;
    }

    .btn-view-proof {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      border: 1px solid #dcd3eb;
      background: #faf8fd;
      color: #35164f;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-view-proof:hover {
      background: #f0eaf8;
      border-color: #35164f;
    }

    .btn-view-proof svg {
      width: 14px;
      height: 14px;
    }

    .status-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .status-pending { background: #fef3c7; color: #b45309; }
    .status-approved { background: #dcfce7; color: #15803d; }
    .status-rejected { background: #fee2e2; color: #b91c1c; }

    .action-btn-group {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    .btn-approve-solid {
      padding: 6.5px 15px;
      background: linear-gradient(135deg, #361759 0%, #6b4fa3 100%);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.2);
      transition: all 0.15s ease;
    }

    .btn-approve-solid:hover {
      background: linear-gradient(135deg, #2b1148 0%, #5b3e91 100%);
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.3);
      transform: translateY(-1px);
    }

    .btn-reject-outline {
      padding: 6px 12px;
      background: #ffffff;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .role-selector {
      padding: 5px 10px;
      border-radius: 8px;
      border: 1px solid #e1d5f2;
      font-size: 12px;
      color: #35164f;
      background: #ffffff;
    }

    .btn-status-toggle {
      padding: 5px 10px;
      border-radius: 8px;
      border: 1px solid #e1d5f2;
      background: #faf8fd;
      font-size: 12px;
      color: #574c6d;
      cursor: pointer;
    }

    .empty-table-cell {
      padding: 40px 20px;
      text-align: center;
      color: #7a7189;
    }

    .empty-state-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-check {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #dcfce7;
      color: #16a34a;
      display: grid;
      place-items: center;
      font-size: 22px;
      font-weight: bold;
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
      max-width: 500px;
      box-shadow: 0 16px 40px rgba(20, 8, 35, 0.2);
      overflow: hidden;
    }

    .modal-card.modal-lg {
      max-width: 640px;
    }

    .modal-card.modal-sm {
      max-width: 440px;
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 22px;
      border-bottom: 1px solid #ebe5f5;
    }

    .modal-head h3 {
      font-size: 17px;
      font-weight: 700;
      color: #271442;
      margin: 0;
    }

    .proof-sub {
      font-size: 12px;
      color: #7a7189;
      margin: 2px 0 0;
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

    /* Registration Details Modal (Extended Width Whole View) */
    .reg-modal-card {
      position: relative;
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 490px;
      padding: 28px 28px 22px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
    }

    .reg-modal-card.reg-modal-wide {
      max-width: 780px;
      padding: 28px 32px 24px;
    }

    .btn-reg-close {
      position: absolute;
      top: 18px;
      right: 20px;
      background: transparent;
      border: none;
      font-size: 24px;
      color: #64748b;
      cursor: pointer;
      line-height: 1;
      padding: 4px;
      transition: color 0.15s;
    }

    .btn-reg-close:hover {
      color: #0f172a;
    }

    .reg-modal-head {
      margin-bottom: 18px;
      padding-right: 24px;
    }

    .reg-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px;
      letter-spacing: -0.01em;
    }

    .reg-subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }

    /* Two-column layout */
    .reg-modal-body-split {
      display: grid;
      grid-template-columns: 1.12fr 1fr;
      gap: 32px;
      align-items: start;
      margin-bottom: 22px;
    }

    /* Details Table */
    .reg-details-table {
      width: 100%;
      border-collapse: collapse;
    }

    .reg-details-table td {
      padding: 6px 0;
      font-size: 13.5px;
      vertical-align: top;
    }

    .reg-details-table td.lbl {
      color: #64748b;
      width: 135px;
      font-weight: 500;
    }

    .reg-details-table td.val {
      color: #0f172a;
      font-weight: 700;
      word-break: break-all;
    }

    /* Uploaded Proof Column */
    .reg-col-proof {
      display: flex;
      flex-direction: column;
    }

    .reg-proof-heading {
      font-size: 13.5px;
      font-weight: 700;
      color: #334155;
      margin: 0 0 10px;
    }

    .reg-proof-preview-frame {
      display: block;
      width: 100%;
      max-width: 320px;
      max-height: 200px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      background: #f8fafc;
      transition: all 0.15s ease;
    }

    .reg-proof-preview-frame:hover {
      border-color: #6b4fa3;
      box-shadow: 0 4px 14px rgba(107, 79, 163, 0.18);
    }

    .reg-proof-image {
      display: block;
      width: 100%;
      height: 195px;
      object-fit: cover;
      object-position: center 20%;
    }

    .reg-proof-pdf {
      padding: 36px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      color: #6b4fa3;
    }

    .reg-proof-pdf svg {
      width: 44px;
      height: 44px;
    }

    .reg-proof-pdf strong {
      font-size: 13px;
      color: #1e293b;
    }

    .reg-proof-list {
      list-style: none;
      padding: 0;
      margin: 12px 0 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .reg-proof-list li {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      flex-wrap: wrap;
    }

    .reg-bullet {
      color: #0f172a;
      font-size: 14px;
      line-height: 1;
    }

    .reg-file-link {
      color: #6b4fa3;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }

    .reg-file-link:hover {
      text-decoration: underline;
    }

    .reg-file-meta {
      color: #94a3b8;
      font-size: 12px;
    }

    .reg-no-proof {
      font-size: 13px;
      color: #94a3b8;
      font-style: italic;
      margin: 4px 0 0;
    }

    /* Modal Footer */
    .reg-modal-foot {
      border-top: 1px solid #f1f5f9;
      padding-top: 18px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
    }

    .btn-reg-reject {
      padding: 8.5px 24px;
      border-radius: 8px;
      background: #ffffff;
      color: #dc2626;
      border: 1px solid #fca5a5;
      font-weight: 700;
      font-size: 13.5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-reg-reject:hover {
      background: #fef2f2;
      border-color: #dc2626;
      color: #b91c1c;
    }

    .btn-reg-approve {
      padding: 8.5px 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #361759 0%, #6b4fa3 100%);
      color: #ffffff;
      border: none;
      font-weight: 700;
      font-size: 13.5px;
      cursor: pointer;
      box-shadow: 0 3px 10px rgba(54, 23, 89, 0.25);
      transition: all 0.15s ease;
    }

    .btn-reg-approve:hover {
      background: linear-gradient(135deg, #2b1148 0%, #5b3e91 100%);
      box-shadow: 0 5px 14px rgba(54, 23, 89, 0.35);
      transform: translateY(-1px);
    }

    @media (max-width: 720px) {
      .reg-modal-card.reg-modal-wide {
        max-width: 95vw;
        padding: 20px;
      }
      .reg-modal-body-split {
        grid-template-columns: 1fr;
        gap: 20px;
      }
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

    .btn-reject-confirm {
      padding: 8px 18px;
      border-radius: 8px;
      background: #dc2626;
      color: #ffffff;
      border: none;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }

    /* Database Integrity & Repair Tab */
    .repair-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .repair-header-card {
      background: #ffffff;
      border: 1px solid #e2d9f0;
      border-radius: 12px;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      box-shadow: 0 2px 8px rgba(50, 24, 78, 0.03);
    }

    .repair-header-card h3 {
      font-size: 16px;
      font-weight: 700;
      color: #271442;
      margin: 0 0 4px;
    }

    .repair-header-card p {
      font-size: 13px;
      color: #7a7189;
      margin: 0;
    }

    .repair-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .btn-rescan {
      padding: 8.5px 18px;
      border-radius: 8px;
      background: #f1ebfa;
      color: #35164f;
      border: none;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .btn-rescan:hover {
      background: #e5daf3;
    }

    .btn-repair-all {
      padding: 8.5px 20px;
      border-radius: 8px;
      background: #dc2626;
      color: #ffffff;
      border: none;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.25);
    }

    .btn-repair-all:hover {
      background: #b91c1c;
    }
  `],
})
export class AdminPendingApprovals implements OnInit {
  adminSvc = inject(AdminService);

  readonly activeFilter = signal<'pending' | 'approved' | 'rejected' | 'all' | 'repair'>('pending');
  readonly searchQuery = signal('');
  readonly previewUser = signal<SystemUser | null>(null);
  readonly selectedDocIndex = signal(0);
  readonly rejectingUser = signal<SystemUser | null>(null);
  readonly processingId = signal<string>('');
  rejectReason = '';

  readonly auditItems = signal<AccountIntegrityItem[]>([]);
  readonly isAuditing = signal(false);
  readonly isRepairingAll = signal(false);
  readonly missingRecordsCount = computed(() =>
    this.auditItems().filter((item) => item.status !== 'healthy').length
  );

  ngOnInit(): void {
    this.runAudit();
  }

  async runAudit(): Promise<void> {
    this.isAuditing.set(true);
    try {
      const items = await this.adminSvc.auditAccountIntegrity();
      this.auditItems.set(items);
    } catch (err) {
      console.warn('Audit error:', err);
    } finally {
      this.isAuditing.set(false);
    }
  }

  switchToRepairTab(): void {
    this.activeFilter.set('repair');
    this.runAudit();
  }

  async onRepairItem(item: AccountIntegrityItem): Promise<void> {
    this.processingId.set(item.id);
    try {
      await this.adminSvc.repairAccount(item);
      await this.runAudit();
    } catch (err: any) {
      alert(err?.message || 'Repair operation failed.');
    } finally {
      this.processingId.set('');
    }
  }

  async onRepairAll(): Promise<void> {
    this.isRepairingAll.set(true);
    try {
      const res = await this.adminSvc.repairAllAccounts(this.auditItems());
      alert(`Repair complete: ${res.repaired} accounts restored successfully.`);
      await this.runAudit();
    } catch (err: any) {
      alert(err?.message || 'Repair all failed.');
    } finally {
      this.isRepairingAll.set(false);
    }
  }

  isProcessing(id: string): boolean {
    return this.processingId() === id;
  }

  async onApprove(u: SystemUser): Promise<void> {
    this.processingId.set(u.id);
    try {
      await this.adminSvc.approveUser(u);
    } catch (e: any) {
      alert(e?.message || 'Could not approve application');
      throw e;
    } finally {
      this.processingId.set('');
    }
  }

  async onModalApprove(u: SystemUser): Promise<void> {
    try {
      await this.onApprove(u);
      this.previewUser.set(null);
    } catch {
      // Keep modal open so admin sees error and can retry
    }
  }

  readonly filteredUsers = computed(() => {
    const filt = this.activeFilter();
    const q = this.searchQuery().toLowerCase().trim();

    // Map applications from pendingApprovals
    const apps: SystemUser[] = this.adminSvc.pendingApprovals().map((a) => ({
      id: a.id,
      displayName: a.fullName,
      email: a.email,
      role: a.requestedRole,
      prcLicense: a.prcLicense,
      contactNumber: a.contactNumber,
      proofOfIdentity: a.proofOfIdentity,
      approvalStatus: a.status,
      rejectionReason: a.rejectionReason,
      status: 'active',
      createdAt: a.submittedAt,
      reviewedAt: a.reviewedAt,
      reviewedBy: a.reviewedBy,
    }));

    // Merge with users in users() if not already in apps
    const seenEmails = new Set(apps.map((a) => a.email.toLowerCase()));
    for (const u of this.adminSvc.users()) {
      if (u.role !== 'admin' && !seenEmails.has(u.email.toLowerCase())) {
        apps.push(u);
        seenEmails.add(u.email.toLowerCase());
      }
    }

    const result = apps.filter((u) => {
      // Role admin shouldn't be listed in approvals
      if (u.role === 'admin') return false;

      // Status filter
      if (filt === 'pending' && u.approvalStatus !== 'pending') return false;
      if (filt === 'approved' && u.approvalStatus !== 'approved') return false;
      if (filt === 'rejected' && u.approvalStatus !== 'rejected') return false;

      // Search query
      if (q) {
        const mName = u.displayName?.toLowerCase().includes(q);
        const mEmail = u.email?.toLowerCase().includes(q);
        const mPrc = u.prcLicense?.toLowerCase().includes(q);
        const mPhone = u.contactNumber?.toLowerCase().includes(q);
        if (!mName && !mEmail && !mPrc && !mPhone) return false;
      }
      return true;
    });

    // Place newly approved & most recently updated accounts AT THE VERY TOP
    result.sort((a, b) => {
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

    return result;
  });

  getInitials(name?: string): string {
    if (!name) return 'LC';
    const clean = name.replace(/,?\s*(RM|MD|RN)\.?/gi, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatSubmitted(dateVal: any): string {
    if (!dateVal) return 'Oct 14, 2026, 1:22 PM';
    try {
      let d: Date;
      if (typeof dateVal?.toDate === 'function') {
        d = dateVal.toDate();
      } else if (dateVal instanceof Date) {
        d = dateVal;
      } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
        d = new Date(dateVal);
      } else if (dateVal.seconds) {
        d = new Date(dateVal.seconds * 1000);
      } else {
        return 'Recently submitted';
      }
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Recently submitted';
    }
  }

  getFirstAndLastName(name?: string): { first: string; last: string } {
    if (!name) return { first: 'Applicant', last: '' };
    const clean = name.replace(/,?\s*(RM|MD|RN)\.?/gi, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: '' };
    const last = parts.pop() || '';
    const first = parts.join(' ');
    return { first, last };
  }

  getDocTypeLabel(doc: { type?: string; name?: string }): string {
    if (doc.type?.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.name || '')) return 'Image';
    if (doc.type?.includes('pdf') || /\.pdf$/i.test(doc.name || '')) return 'PDF Document';
    return 'Document';
  }

  isImageFile(name?: string): boolean {
    if (!name) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name);
  }

  viewDocument(doc: { dataUrl: string; name: string }): void {
    if (doc?.dataUrl) {
      const win = window.open();
      if (win) {
        win.opener = null;
        win.location.href = doc.dataUrl;
      }
    }
  }

  openProofModal(u: SystemUser): void {
    this.selectedDocIndex.set(0);
    this.previewUser.set(u);
  }

  openRejectModal(u: SystemUser): void {
    this.rejectReason = 'Did not meet facility clinical verification requirements';
    this.rejectingUser.set(u);
  }

  confirmReject(): void {
    const cur = this.rejectingUser();
    if (!cur) return;
    this.adminSvc.rejectUser(cur, this.rejectReason);
    this.rejectingUser.set(null);
  }
}

