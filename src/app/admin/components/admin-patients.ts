import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { Patient, PatientProfile, PatientStatus, RiskLevel } from '../../core/patients.service';
import { parseTimestamp } from '../models/admin.models';

@Component({
  selector: 'app-admin-patients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="patients-view">
      <!-- Top Directory Header (Matches Image 1) -->
      <div class="dir-head">
        <div>
          <h2>Patient Directory</h2>
          <p class="dir-sub">{{ filteredPatients().length }} patients registered</p>
        </div>
        <button type="button" class="btn-register-top" (click)="openRegisterModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Register Patient</span>
        </button>
      </div>

      <!-- Filter Bar with Search & Funnel Filters -->
      <div class="dir-filter-bar">
        <div class="search-input-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>

        <div class="filter-dropdowns">
          <svg class="funnel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          
          <div class="select-wrapper">
            <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" aria-label="Filter by Status">
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Postpartum">Postpartum</option>
              <option value="Completed">Completed</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div class="select-wrapper">
            <select [ngModel]="riskFilter()" (ngModelChange)="riskFilter.set($event)" aria-label="Filter by Risk">
              <option value="All">All risk levels</option>
              <option value="Low risk">Low risk</option>
              <option value="Medium risk">Medium risk</option>
              <option value="High risk">High risk</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Patient Table Matching Image 1 -->
      <div class="table-container">
        <table class="patient-table">
          <thead>
            <tr>
              <th>PATIENT</th>
              <th>CONTACT</th>
              <th>STATUS</th>
              <th>RISK</th>
              <th>GESTATIONAL AGE</th>
              <th>EDD</th>
              <th style="text-align: right;">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filteredPatients(); track p.id) {
              <tr>
                <td>
                  <div class="patient-cell">
                    <div class="dir-avatar" [style.background]="getAvatarColor(p.fullName)">
                      {{ getInitials(p.fullName) }}
                    </div>
                    <div>
                      <strong class="patient-name">{{ p.fullName }}</strong>
                      <span class="patient-meta-tag">{{ p.bloodType || 'O+' }} blood &bull; {{ p.gravidaPara || 'G1P0' }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="contact-rows">
                    <span class="contact-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {{ p.contactNumber }}
                    </span>
                    <span class="contact-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      {{ p.email }}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="badge-status" [ngClass]="'status-' + (p.status || 'Active').toLowerCase()">
                    {{ p.status || 'Active' }}
                  </span>
                </td>
                <td>
                  <span class="badge-risk" [ngClass]="'risk-' + getRiskSlug(p.riskLevel)">
                    {{ p.riskLevel || 'Low risk' }}
                  </span>
                </td>
                <td>
                  <span class="gestation-text">{{ p.gestationalAge || '20 weeks' }}</span>
                </td>
                <td>
                  <span class="edd-text">{{ p.edd || 'Mar 20, 2027' }}</span>
                </td>
                <td style="text-align: right;">
                  <div class="row-actions">
                    <button type="button" class="btn-view" (click)="openViewModal(p)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <span>View</span>
                    </button>
                    <button type="button" class="btn-edit-row" (click)="openEditModal(p)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      <span>Edit</span>
                    </button>
                    <button type="button" class="btn-archive-row" (click)="archivePatient(p)">
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty-table-cell">
                  No patients found matching search and filters.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Register Patient Modal -->
      @if (showRegisterModal()) {
        <div class="modal-backdrop" (click)="!submittingPatient() && showRegisterModal.set(false)">
          <div class="modal-card modal-sm" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>Register New Patient</h3>
              <button type="button" class="btn-close-modal" [disabled]="submittingPatient()" (click)="showRegisterModal.set(false)">&times;</button>
            </div>
            <form (ngSubmit)="saveRegisterPatient()" class="modal-body-form">
              @if (patientError()) {
                <div class="form-error-banner" style="background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:12px;">
                  {{ patientError() }}
                </div>
              }
              <div class="form-group">
                <label>Full Legal Name *</label>
                <input type="text" [(ngModel)]="newName" name="newName" placeholder="e.g. Maria Teresa Santos" [disabled]="submittingPatient()" required />
              </div>
              <div class="form-group">
                <label>Email Address *</label>
                <input type="email" [(ngModel)]="newEmail" name="newEmail" placeholder="patient@gmail.com" [disabled]="submittingPatient()" required />
              </div>
              <div class="form-group">
                <label>Contact Phone</label>
                <input type="text" [(ngModel)]="newPhone" name="newPhone" placeholder="0917-123-4567" [disabled]="submittingPatient()" />
              </div>
              <div class="form-group">
                <label>Residential Address</label>
                <input type="text" [(ngModel)]="newAddress" name="newAddress" placeholder="e.g. Purok 3, Poblacion 2, Villanueva, Misamis Oriental" [disabled]="submittingPatient()" />
              </div>
              <div class="form-row-two">
                <div class="form-group">
                  <label>Blood Type</label>
                  <select [(ngModel)]="newBlood" name="newBlood" [disabled]="submittingPatient()">
                    <option value="O+">O+</option>
                    <option value="A+">A+</option>
                    <option value="B+">B+</option>
                    <option value="AB+">AB+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Gravida / Para</label>
                  <input type="text" [(ngModel)]="newGravida" name="newGravida" placeholder="G1P0" [disabled]="submittingPatient()" />
                </div>
              </div>
              <div class="form-row-two">
                <div class="form-group">
                  <label>Gestational Stage</label>
                  <input type="text" [(ngModel)]="newGestation" name="newGestation" placeholder="e.g. 18 weeks" [disabled]="submittingPatient()" />
                </div>
                <div class="form-group">
                  <label>Estimated Due Date</label>
                  <input type="date" [(ngModel)]="newEdd" name="newEdd" [disabled]="submittingPatient()" />
                </div>
              </div>
              <div class="form-group">
                <label>Risk Assessment</label>
                <select [(ngModel)]="newRisk" name="newRisk" [disabled]="submittingPatient()">
                  <option value="Low risk">Low risk</option>
                  <option value="Medium risk">Medium risk</option>
                  <option value="High risk">High risk</option>
                </select>
              </div>
              <div class="form-group">
                <label>Patient Portal Password</label>
                <input type="text" [(ngModel)]="newPassword" name="newPassword" placeholder="Patient@2026!" [disabled]="submittingPatient()" />
                <small style="color:#7a7189;font-size:11.5px;margin-top:3px;display:block;">Allows patient immediate sign-in to the patient portal.</small>
              </div>
              <div class="modal-foot">
                <button type="button" class="btn-modal-close" [disabled]="submittingPatient()" (click)="showRegisterModal.set(false)">Cancel</button>
                <button type="submit" class="btn-modal-accept" [disabled]="submittingPatient()">
                  {{ submittingPatient() ? 'Saving to Database...' : 'Register Patient' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- View Patient Modal -->
      @if (viewingPatient(); as p) {
        <div class="modal-backdrop" (click)="viewingPatient.set(null)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <div class="patient-cell">
                <div class="dir-avatar large-avatar" [style.background]="getAvatarColor(p.fullName)">
                  {{ getInitials(p.fullName) }}
                </div>
                <div>
                  <h3>{{ p.fullName }}</h3>
                  <span class="patient-meta-tag">{{ p.bloodType || 'O+' }} blood &bull; {{ p.gravidaPara || 'G1P0' }}</span>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="viewingPatient.set(null)">&times;</button>
            </div>
            <div class="modal-body-form">
              <div class="details-grid">
                <div class="detail-box">
                  <label>Contact Phone</label>
                  <p>{{ p.contactNumber }}</p>
                </div>
                <div class="detail-box">
                  <label>Email Address</label>
                  <p>{{ p.email }}</p>
                </div>
                <div class="detail-box">
                  <label>Gestational Age</label>
                  <p>{{ p.gestationalAge || '20 weeks' }}</p>
                </div>
                <div class="detail-box">
                  <label>Expected Due Date</label>
                  <p>{{ p.edd || 'Mar 20, 2027' }}</p>
                </div>
                <div class="detail-box">
                  <label>Clinical Status</label>
                  <p>{{ p.status || 'Active' }}</p>
                </div>
                <div class="detail-box">
                  <label>Risk Assessment</label>
                  <p>{{ p.riskLevel || 'Low risk' }}</p>
                </div>
                <div class="detail-box full-span">
                  <label>Residential Address</label>
                  <p>{{ p.address || 'Villanueva, Misamis Oriental' }}</p>
                </div>
              </div>
              <div class="modal-foot">
                <button type="button" class="btn-modal-close" (click)="viewingPatient.set(null)">Close</button>
                <button type="button" class="btn-modal-accept" (click)="openEditModal(p); viewingPatient.set(null)">Edit Record</button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Edit Patient Modal -->
      @if (editingPatient(); as p) {
        <div class="modal-backdrop" (click)="editingPatient.set(null)">
          <div class="modal-card modal-sm" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>Edit Patient Record</h3>
              <button type="button" class="btn-close-modal" (click)="editingPatient.set(null)">&times;</button>
            </div>
            <form (ngSubmit)="saveEditPatient()" class="modal-body-form">
              <div class="form-group">
                <label>Full Name</label>
                <input type="text" [(ngModel)]="editName" name="editName" required />
              </div>
              <div class="form-group">
                <label>Contact Phone</label>
                <input type="text" [(ngModel)]="editPhone" name="editPhone" required />
              </div>
              <div class="form-group">
                <label>Residential Address</label>
                <input type="text" [(ngModel)]="editAddress" name="editAddress" required />
              </div>
              <div class="form-row-two">
                <div class="form-group">
                  <label>Gestational Age</label>
                  <input type="text" [(ngModel)]="editGestation" name="editGestation" />
                </div>
                <div class="form-group">
                  <label>Estimated Due Date</label>
                  <input type="date" [(ngModel)]="editEdd" name="editEdd" />
                </div>
              </div>
              <div class="form-row-two">
                <div class="form-group">
                  <label>Clinical Status</label>
                  <select [(ngModel)]="editStatus" name="editStatus">
                    <option value="Active">Active</option>
                    <option value="Postpartum">Postpartum</option>
                    <option value="Completed">Completed</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Risk Level</label>
                  <select [(ngModel)]="editRisk" name="editRisk">
                    <option value="Low risk">Low risk</option>
                    <option value="Medium risk">Medium risk</option>
                    <option value="High risk">High risk</option>
                  </select>
                </div>
              </div>
              <div class="modal-foot">
                <button type="button" class="btn-modal-close" (click)="editingPatient.set(null)">Cancel</button>
                <button type="submit" class="btn-modal-accept">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .patients-view {
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

    .btn-register-top {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 999px;
      background: #35164f;
      color: #ffffff;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(53, 22, 79, 0.2);
    }

    .btn-register-top svg {
      width: 16px;
      height: 16px;
    }

    /* Filter bar matching Image 1 */
    .dir-filter-bar {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .search-input-box {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #ffffff;
      border: 1px solid #e1d5f2;
      border-radius: 999px;
      padding: 10px 18px;
      box-shadow: 0 2px 8px rgba(50, 24, 78, 0.03);
    }

    .search-input-box svg {
      width: 17px;
      height: 17px;
      color: #8c7f9f;
    }

    .search-input-box input {
      border: none;
      outline: none;
      font-size: 13.5px;
      width: 100%;
      color: #271442;
      background: transparent;
    }

    .filter-dropdowns {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .funnel-icon {
      width: 18px;
      height: 18px;
      color: #6b4fa3;
    }

    .select-wrapper select {
      background: #ffffff;
      border: 1px solid #e1d5f2;
      border-radius: 999px;
      padding: 9px 18px;
      font-size: 13px;
      color: #271442;
      font-weight: 500;
      outline: none;
      cursor: pointer;
    }

    /* Table */
    .table-container {
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #ebe5f5;
      overflow: hidden;
      box-shadow: 0 4px 18px rgba(50, 24, 78, 0.04);
    }

    .patient-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .patient-table th {
      background: #faf8fc;
      padding: 14px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #7a7189;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #ebe5f5;
    }

    .patient-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f3eff9;
      color: #271442;
      vertical-align: middle;
    }

    .patient-table tr:hover td {
      background: #faf8fd;
    }

    .patient-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dir-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      font-weight: 700;
      font-size: 12.5px;
      color: #35164f;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .dir-avatar.large-avatar {
      width: 48px;
      height: 48px;
      font-size: 16px;
    }

    .patient-name {
      display: block;
      font-size: 13.5px;
      color: #271442;
      font-weight: 600;
    }

    .patient-meta-tag {
      font-size: 11.5px;
      color: #7a7189;
    }

    .contact-rows {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 12px;
    }

    .contact-item {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #645a75;
    }

    .contact-item svg {
      width: 13px;
      height: 13px;
      color: #8c7f9f;
    }

    .badge-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .status-active { background: #dcfce7; color: #15803d; }
    .status-postpartum { background: #ede8f8; color: #6b21a8; }
    .status-completed { background: #e0f2fe; color: #0369a1; }
    .status-inactive { background: #fee2e2; color: #b91c1c; }

    .badge-risk {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .risk-low { background: #dcfce7; color: #15803d; }
    .risk-medium { background: #fef3c7; color: #b45309; }
    .risk-high { background: #fee2e2; color: #b91c1c; }

    .gestation-text, .edd-text {
      font-size: 12.5px;
      color: #3b3149;
    }

    .row-actions {
      display: inline-flex;
      gap: 6px;
    }

    .btn-view, .btn-edit-row, .btn-archive-row {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-view {
      background: #f1ebfa;
      color: #35164f;
      border: 1px solid #dfd2f5;
    }

    .btn-view:hover {
      background: #35164f;
      color: #ffffff;
    }

    .btn-edit-row {
      background: #ffffff;
      color: #6b4fa3;
      border: 1px solid #dfd2f5;
    }

    .btn-edit-row:hover {
      background: #f4eefb;
    }

    .btn-archive-row {
      background: #ffffff;
      color: #7a7189;
      border: 1px solid #ebe5f5;
    }

    .btn-archive-row:hover {
      background: #fee2e2;
      color: #dc2626;
      border-color: #fca5a5;
    }

    .btn-view svg, .btn-edit-row svg {
      width: 13px;
      height: 13px;
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
      max-width: 540px;
      box-shadow: 0 16px 40px rgba(20, 8, 35, 0.2);
      overflow: hidden;
    }

    .modal-card.modal-sm {
      max-width: 480px;
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

    .form-group input, .form-group select {
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

    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .detail-box.full-span {
      grid-column: span 2;
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
export class AdminPatients {
  adminSvc = inject(AdminService);

  readonly searchQuery = signal('');
  readonly statusFilter = signal('All');
  readonly riskFilter = signal('All');

  readonly showRegisterModal = signal(false);
  readonly submittingPatient = signal(false);
  readonly patientError = signal('');
  readonly viewingPatient = signal<Patient | null>(null);
  readonly editingPatient = signal<Patient | null>(null);

  // New form
  newName = '';
  newEmail = '';
  newPhone = '';
  newAddress = '';
  newBlood = 'O+';
  newGravida = 'G1P0';
  newGestation = '';
  newEdd = '';
  newRisk: RiskLevel = 'Low risk';
  newPassword = 'Patient@2026!';

  // Edit form
  editName = '';
  editPhone = '';
  editAddress = '';
  editGestation = '';
  editEdd = '';
  editStatus: PatientStatus = 'Active';
  editRisk: RiskLevel = 'Low risk';

  readonly filteredPatients = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.statusFilter();
    const rk = this.riskFilter();

    const list = this.adminSvc.patients().filter((p) => {
      if (st !== 'All') {
        const pStatus = p.status || 'Active';
        if (pStatus.toLowerCase() !== st.toLowerCase()) return false;
      }
      if (rk !== 'All') {
        const pRisk = p.riskLevel || 'Low risk';
        if (pRisk.toLowerCase() !== rk.toLowerCase()) return false;
      }
      if (q) {
        const mName = p.fullName?.toLowerCase().includes(q);
        const mEmail = p.email?.toLowerCase().includes(q);
        const mPhone = p.contactNumber?.includes(q);
        if (!mName && !mEmail && !mPhone) return false;
      }
      return true;
    });

    // Place newly approved & most recently updated patients AT THE VERY TOP
    list.sort((a, b) => {
      const getRecordTime = (item: any): number => {
        const tRev = parseTimestamp(item.reviewedAt);
        const tUpd = parseTimestamp(item.updatedAt);
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

  getRiskSlug(risk?: string): string {
    if (!risk) return 'low';
    const r = risk.toLowerCase();
    if (r.includes('high')) return 'high';
    if (r.includes('medium')) return 'medium';
    return 'low';
  }

  openRegisterModal(): void {
    this.newName = '';
    this.newEmail = '';
    this.newPhone = '';
    this.newAddress = '';
    this.newBlood = 'O+';
    this.newGravida = 'G1P0';
    this.newGestation = '16 weeks';
    this.newEdd = '2027-03-01';
    this.newRisk = 'Low risk';
    this.newPassword = 'Patient@2026!';
    this.patientError.set('');
    this.showRegisterModal.set(true);
  }

  async saveRegisterPatient(): Promise<void> {
    this.patientError.set('');
    if (!this.newName.trim() || !this.newEmail.trim()) {
      this.patientError.set('Please fill in patient full legal name and email address.');
      return;
    }
    this.submittingPatient.set(true);
    try {
      const profile: PatientProfile = {
        fullName: this.newName.trim(),
        email: this.newEmail.trim().toLowerCase(),
        contactNumber: this.newPhone.trim() || '0917-123-4567',
        address: this.newAddress.trim() || 'Poblacion 2, Villanueva, Misamis Oriental',
        bloodType: this.newBlood || 'O+',
        birthDate: '1998-05-15',
        emergencyContactName: 'Family Contact',
        emergencyContactNumber: this.newPhone.trim() || '0917-123-4567',
        lmp: '2026-06-01',
        edd: this.newEdd || '2027-03-01',
        status: 'Active',
        riskLevel: this.newRisk,
        gravidaPara: this.newGravida || 'G1P0',
        gestationalAge: this.newGestation || '16 weeks',
      };

      await this.adminSvc.addPatient(profile, this.newPassword.trim() || 'Patient@2026!');
      this.showRegisterModal.set(false);
    } catch (err: any) {
      this.patientError.set(err?.message || 'Failed to register patient in Firestore.');
    } finally {
      this.submittingPatient.set(false);
    }
  }

  openViewModal(p: Patient): void {
    this.viewingPatient.set(p);
  }

  openEditModal(p: Patient): void {
    this.editName = p.fullName;
    this.editPhone = p.contactNumber;
    this.editAddress = p.address || '';
    this.editGestation = p.gestationalAge || '';
    this.editEdd = p.edd || '';
    this.editStatus = p.status || 'Active';
    this.editRisk = p.riskLevel || 'Low risk';
    this.editingPatient.set(p);
  }

  saveEditPatient(): void {
    const cur = this.editingPatient();
    if (!cur) return;
    const updated: Patient = {
      ...cur,
      fullName: this.editName,
      contactNumber: this.editPhone,
      address: this.editAddress,
      gestationalAge: this.editGestation,
      edd: this.editEdd,
      status: this.editStatus,
      riskLevel: this.editRisk,
    };
    this.adminSvc.updatePatient(updated);
    this.editingPatient.set(null);
  }

  archivePatient(p: Patient): void {
    if (confirm(`Move ${p.fullName} to Archives?`)) {
      this.adminSvc.archivePatient(p);
    }
  }
}

