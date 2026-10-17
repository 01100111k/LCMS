import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Patient, PatientProfile, PatientsService, PatientStatus, RiskLevel } from '../core/patients.service';

@Component({
  selector: 'app-patient-list',
  imports: [RouterLink, DatePipe, FormsModule, ReactiveFormsModule, NgClass],
  template: `
    <div class="directory-wrap">
      <!-- ============ HEADER ============ -->
      <div class="dir-head">
        <div>
          <h1>Patient Directory</h1>
          <p class="dir-sub">{{ filtered().length }} patients registered</p>
        </div>
        <button type="button" class="btn-register" (click)="openRegisterModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Register Patient
        </button>
      </div>

      <!-- ============ FILTERS BAR ============ -->
      <div class="filter-bar">
        <div class="search-input-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" placeholder="Search by name, email, or phone..."
                 [ngModel]="query()" (ngModelChange)="query.set($event)" aria-label="Search patients">
        </div>

        <div class="filter-dropdowns">
          <svg class="funnel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>

          <!-- Status Dropdown (Image 4) -->
          <div class="select-wrapper">
            <select [ngModel]="selectedStatus()" (ngModelChange)="selectedStatus.set($event)" aria-label="Filter by status">
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Postpartum">Postpartum</option>
              <option value="Completed">Completed</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <!-- Risk Level Dropdown (Image 5) -->
          <div class="select-wrapper">
            <select [ngModel]="selectedRisk()" (ngModelChange)="selectedRisk.set($event)" aria-label="Filter by risk level">
              <option value="All">All risk levels</option>
              <option value="Low risk">Low risk</option>
              <option value="Medium risk">Medium risk</option>
              <option value="High risk">High risk</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ============ TABLE ============ -->
      @if (loading()) {
        <div class="loading-state">
          <p>Loading patient directory…</p>
        </div>
      } @else if (error()) {
        <div class="error-msg" role="alert">
          {{ error() }}
          <button type="button" class="btn-retry" (click)="load()">Try again</button>
        </div>
      } @else if (all().length === 0) {
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="empty-icon">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
          <h3>No patients registered yet</h3>
          <p>Register your first patient to begin tracking their care journey.</p>
          <button type="button" class="btn-register" style="margin-top: 8px;" (click)="openRegisterModal()">
            + Register Patient
          </button>
        </div>
      } @else if (!filtered().length) {
        <div class="empty-state">
          <p>No patients match the search criteria.</p>
        </div>
      } @else {
        <div class="table-container">
          <table class="patient-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Gestational Age</th>
                <th>EDD</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of filtered(); track p.id) {
                <tr>
                  <!-- Patient Column -->
                  <td class="col-patient">
                    <div class="patient-cell">
                      <div class="dir-avatar" [ngClass]="'avatar-color-' + (($index % 4) + 1)">{{ getInitials(p.fullName) }}</div>
                      <div class="patient-meta">
                        <strong class="patient-name">{{ p.fullName }}</strong>
                        <span class="patient-sub">{{ p.bloodType }} blood · {{ p.gravidaPara || 'G1P0' }}</span>
                      </div>
                    </div>
                  </td>

                  <!-- Contact Column -->
                  <td class="col-contact">
                    <div class="contact-cell">
                      <span class="contact-row">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        {{ p.contactNumber }}
                      </span>
                      <span class="contact-row email-text">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                        </svg>
                        {{ p.email }}
                      </span>
                    </div>
                  </td>

                  <!-- Status Column -->
                  <td class="col-status">
                    <span class="badge-status" [ngClass]="'status-' + (p.status || 'active').toLowerCase()">
                      {{ p.status || 'Active' }}
                    </span>
                  </td>

                  <!-- Risk Column -->
                  <td class="col-risk">
                    <span class="badge-risk" [ngClass]="'risk-' + getRiskSlug(p.riskLevel)">
                      {{ p.riskLevel || 'Low risk' }}
                    </span>
                  </td>

                  <!-- Gestational Age Column -->
                  <td class="col-gestation">
                    {{ p.gestationalAge || '—' }}
                  </td>

                  <!-- EDD Column -->
                  <td class="col-edd">
                    {{ p.edd ? (p.edd | date: 'mediumDate') : '—' }}
                  </td>

                  <!-- Action Column -->
                  <td class="col-action">
                    <a [routerLink]="['/midwife/patients', p.id]" class="btn-view">
                      View &rsaquo;
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ============ REGISTER PATIENT POP-OUT MODAL ============ -->
      @if (showRegisterModal()) {
        <div class="modal-backdrop" (click)="closeRegisterModal()">
          <div class="modal-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div class="modal-head">
              <div>
                <h2 id="modal-title">Register Patient</h2>
                <p class="modal-sub">Create patient record and account for maternal care management.</p>
              </div>
              <button type="button" class="btn-close-modal" (click)="closeRegisterModal()" title="Close dialog">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            @if (registerSuccess()) {
              <div class="modal-success-box">
                <div class="success-icon-badge">✓</div>
                <h3>Patient Registered Successfully!</h3>
                <p><strong>{{ registeredPatientName() }}</strong> has been added to the directory.</p>
                <button type="button" class="btn-submit-modal" (click)="closeRegisterModal()">Done</button>
              </div>
            } @else {
              <form [formGroup]="registerForm" (ngSubmit)="submitRegister()" class="modal-form-content" novalidate>
                @if (registerError()) {
                  <div class="modal-alert-error" role="alert">{{ registerError() }}</div>
                }

                <div class="form-section-label">Personal Information</div>
                <div class="form-fields-grid">
                  <div class="form-group span-2">
                    <label for="reg-fullname">Full Name <span class="req">*</span></label>
                    <input id="reg-fullname" formControlName="fullName" placeholder="e.g. Maria Santos" [class.is-bad]="isBad('fullName')">
                  </div>
                  <div class="form-group">
                    <label for="reg-email">Email Address <span class="req">*</span></label>
                    <input id="reg-email" type="email" formControlName="email" placeholder="patient@email.com" [class.is-bad]="isBad('email')">
                  </div>
                  <div class="form-group">
                    <label for="reg-dob">Date of Birth <span class="req">*</span></label>
                    <input id="reg-dob" type="date" formControlName="birthDate" [max]="todayIso" [class.is-bad]="isBad('birthDate')">
                  </div>
                  <div class="form-group">
                    <label for="reg-phone">Contact Number <span class="req">*</span></label>
                    <input id="reg-phone" type="tel" formControlName="contactNumber" placeholder="0912 345 6789" [class.is-bad]="isBad('contactNumber')">
                  </div>
                  <div class="form-group">
                    <label for="reg-blood">Blood Type</label>
                    <select id="reg-blood" formControlName="bloodType">
                      <option value="">Select blood type</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                  <div class="form-group span-2">
                    <label for="reg-address">Address <span class="req">*</span></label>
                    <input id="reg-address" formControlName="address" placeholder="Barangay, Municipality / City, Province" [class.is-bad]="isBad('address')">
                  </div>
                </div>

                <div class="form-section-label">Emergency Contact</div>
                <div class="form-fields-grid">
                  <div class="form-group">
                    <label for="reg-ec-name">Contact Person <span class="req">*</span></label>
                    <input id="reg-ec-name" formControlName="emergencyContactName" placeholder="Spouse or Guardian name" [class.is-bad]="isBad('emergencyContactName')">
                  </div>
                  <div class="form-group">
                    <label for="reg-ec-phone">Contact Number <span class="req">*</span></label>
                    <input id="reg-ec-phone" type="tel" formControlName="emergencyContactNumber" placeholder="0912 345 6789" [class.is-bad]="isBad('emergencyContactNumber')">
                  </div>
                </div>

                <div class="form-section-label">Care & Pregnancy Details</div>
                <div class="form-fields-grid">
                  <div class="form-group">
                    <label for="reg-lmp">Last Menstrual Period (LMP)</label>
                    <input id="reg-lmp" type="date" formControlName="lmp" [max]="todayIso" (change)="onLmpChange()">
                  </div>
                  <div class="form-group">
                    <label for="reg-edd">Estimated Due Date (EDD)</label>
                    <input id="reg-edd" type="date" formControlName="edd">
                  </div>
                  <div class="form-group">
                    <label for="reg-status">Status</label>
                    <select id="reg-status" formControlName="status">
                      <option value="Active">Active</option>
                      <option value="Postpartum">Postpartum</option>
                      <option value="Completed">Completed</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="reg-risk">Risk Level</label>
                    <select id="reg-risk" formControlName="riskLevel">
                      <option value="Low risk">Low risk</option>
                      <option value="Medium risk">Medium risk</option>
                      <option value="High risk">High risk</option>
                    </select>
                  </div>
                </div>

                <div class="modal-footer-actions">
                  <button type="button" class="btn-cancel-modal" (click)="closeRegisterModal()">Cancel</button>
                  <button type="submit" class="btn-submit-modal" [disabled]="submittingRegister()">
                    {{ submittingRegister() ? 'Registering…' : 'Register Patient' }}
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .directory-wrap {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Head */
    .dir-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
    }

    .dir-head h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #271442;
      letter-spacing: -0.01em;
    }

    .dir-sub {
      margin: 4px 0 0;
      font-size: 12.5px;
      color: #7a7189;
    }

    .btn-register {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #361759;
      color: #ffffff;
      padding: 8px 20px;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
      transition: transform 0.15s, background 0.15s;
    }

    .btn-register svg {
      width: 14px;
      height: 14px;
    }

    .btn-register:hover {
      background: #492178;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(54, 23, 89, 0.35);
    }

    /* Filters Bar */
    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .search-input-box {
      position: relative;
      flex: 1;
      min-width: 280px;
      max-width: 480px;
      display: flex;
      align-items: center;
    }

    .search-input-box svg {
      position: absolute;
      left: 16px;
      width: 17px;
      height: 17px;
      color: #9a8fa8;
      pointer-events: none;
    }

    .search-input-box input {
      width: 100%;
      padding: 11px 16px 11px 44px;
      border-radius: 999px;
      border: 1.5px solid #ebe5f5;
      background: #ffffff;
      font-size: 14px;
      color: #2a2438;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .search-input-box input:focus {
      border-color: #6b4fa3;
      box-shadow: 0 0 0 3px rgba(107, 79, 163, 0.12);
    }

    .filter-dropdowns {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .funnel-icon {
      width: 19px;
      height: 19px;
      color: #8c829e;
      flex-shrink: 0;
    }

    .select-wrapper {
      position: relative;
    }

    .select-wrapper select {
      appearance: none;
      padding: 9px 36px 9px 16px;
      border-radius: 12px;
      border: 1.5px solid #4a287c;
      background: #ffffff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a287c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat calc(100% - 12px) center;
      font-size: 13.5px;
      font-weight: 500;
      color: #2a1647;
      cursor: pointer;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .select-wrapper select:focus {
      border-color: #6b4fa3;
      box-shadow: 0 0 0 3px rgba(107, 79, 163, 0.15);
    }

    /* Table Container */
    .table-container {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 16px;
      overflow-x: auto;
      box-shadow: 0 4px 20px rgba(50, 24, 78, 0.03);
    }

    .patient-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13.5px;
    }

    .patient-table th {
      padding: 16px 20px;
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #7a7189;
      border-bottom: 1px solid #f0eaf8;
      background: #faf8fc;
    }

    .patient-table td {
      padding: 15px 20px;
      border-bottom: 1px solid #f3eff9;
      vertical-align: middle;
      color: #2a2438;
    }

    .patient-table tr:last-child td {
      border-bottom: none;
    }

    .patient-table tr:hover td {
      background: #faf8fe;
    }

    /* Patient Column */
    .patient-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dir-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 12.5px;
      font-weight: 700;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .avatar-color-1 { background: #efe8fa; color: #6b4fa3; }
    .avatar-color-2 { background: #e0f2fe; color: #0284c7; }
    .avatar-color-3 { background: #fce7f3; color: #db2777; }
    .avatar-color-4 { background: #e8f5e9; color: #2e7d32; }

    .patient-meta {
      display: flex;
      flex-direction: column;
    }

    .patient-name {
      font-size: 14px;
      font-weight: 600;
      color: #271442;
    }

    .patient-sub {
      font-size: 12px;
      color: #7a7189;
      margin-top: 1px;
    }

    /* Contact Column */
    .contact-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .contact-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: #554e63;
    }

    .contact-row svg {
      width: 13px;
      height: 13px;
      color: #8c829e;
      flex-shrink: 0;
    }

    .email-text {
      color: #7a7189;
    }

    /* Badges */
    .badge-status {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      text-align: center;
    }

    .status-active {
      background: #dcfce7;
      color: #15803d;
    }

    .status-postpartum {
      background: #efe8fa;
      color: #6b4fa3;
    }

    .status-completed {
      background: #f1f5f9;
      color: #475569;
    }

    .status-inactive {
      background: #f3f4f6;
      color: #6b7280;
    }

    .badge-risk {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      text-align: center;
    }

    .risk-low {
      background: #eafaf1;
      color: #1e704d;
      border: 1px solid #c7f0d8;
    }

    .risk-medium {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    .risk-high {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .col-gestation,
    .col-edd {
      font-size: 13.5px;
      color: #4a4257;
      white-space: nowrap;
    }

    .btn-view {
      color: #3b82f6;
      font-weight: 600;
      font-size: 13px;
      text-decoration: none;
      transition: color 0.15s;
      white-space: nowrap;
    }

    .btn-view:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    /* Empty / Loading */
    .empty-state, .loading-state {
      padding: 60px 20px;
      text-align: center;
      color: #7a7189;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #ebe5f5;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .empty-icon {
      width: 48px;
      height: 48px;
      color: #a59cb6;
      margin-bottom: 12px;
    }

    .empty-state h3 {
      margin: 0 0 6px;
      font-size: 17px;
      color: #271442;
    }

    .empty-state p {
      margin: 0 0 16px;
      font-size: 13.5px;
      color: #7a7189;
    }

    .error-msg {
      padding: 14px 18px;
      background: #fbe6ee;
      color: #8f2a52;
      border-radius: 12px;
      font-size: 13.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn-retry {
      background: #8f2a52;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      cursor: pointer;
    }

    /* ============ MODAL POP-OUT ============ */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(26, 12, 42, 0.6);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.15s ease-out;
    }

    .modal-card {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 660px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(35, 12, 60, 0.35);
      border: 1px solid rgba(110, 79, 168, 0.15);
      animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .modal-head {
      padding: 18px 24px;
      border-bottom: 1px solid #f0eaf8;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      background: #faf8fd;
    }

    .modal-head h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #271442;
    }

    .modal-sub {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: #7a7189;
    }

    .btn-close-modal {
      background: transparent;
      border: none;
      color: #7a7189;
      padding: 6px;
      border-radius: 8px;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background 0.15s, color 0.15s;
    }

    .btn-close-modal:hover {
      background: #f0eaf8;
      color: #271442;
    }

    .btn-close-modal svg {
      width: 18px;
      height: 18px;
    }

    .modal-form-content {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-section-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b4fa3;
      padding-bottom: 6px;
      border-bottom: 1px solid #f3eff9;
      margin-top: 4px;
    }

    .form-fields-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-group.span-2 {
      grid-column: span 2;
    }

    .form-group label {
      font-size: 12.5px;
      font-weight: 600;
      color: #2a1647;
    }

    .req {
      color: #c2527a;
    }

    .form-group input,
    .form-group select {
      padding: 8px 12px;
      border-radius: 8px;
      border: 1.5px solid #ebe5f5;
      background: #fbf9fe;
      font-size: 13px;
      color: #2a2438;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .form-group input:focus,
    .form-group select:focus {
      background: #ffffff;
      border-color: #6b4fa3;
      box-shadow: 0 0 0 3px rgba(107, 79, 163, 0.12);
    }

    .form-group input.is-bad {
      border-color: #e11d48;
      background: #fff1f2;
    }

    .modal-alert-error {
      padding: 10px 14px;
      background: #ffe4e6;
      border: 1px solid #fecdd3;
      border-radius: 8px;
      color: #9f1239;
      font-size: 12.5px;
    }

    .modal-footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 14px;
      border-top: 1px solid #f0eaf8;
      margin-top: 8px;
    }

    .btn-cancel-modal {
      padding: 8.5px 18px;
      border-radius: 999px;
      border: 1px solid #d8cde9;
      background: #ffffff;
      color: #554869;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-cancel-modal:hover {
      background: #f7f3fc;
    }

    .btn-submit-modal {
      padding: 8.5px 22px;
      border-radius: 999px;
      border: none;
      background: #4a1e78;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(74, 30, 120, 0.3);
      transition: background 0.15s, transform 0.15s;
    }

    .btn-submit-modal:hover:not(:disabled) {
      background: #391461;
      transform: translateY(-1px);
    }

    .btn-submit-modal:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .modal-success-box {
      padding: 36px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .success-icon-badge {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #dcfce7;
      color: #15803d;
      font-size: 24px;
      font-weight: 700;
      display: grid;
      place-items: center;
    }

    .modal-success-box h3 {
      margin: 0;
      font-size: 18px;
      color: #1e1b4b;
    }

    .modal-success-box p {
      margin: 0;
      font-size: 13.5px;
      color: #4b5563;
    }
  `,
})
export class PatientList implements OnInit {
  private patients = inject(PatientsService);
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly all = signal<Patient[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly selectedStatus = signal<string>('All');
  readonly selectedRisk = signal<string>('All');

  // Modal signals
  readonly showRegisterModal = signal(false);
  readonly submittingRegister = signal(false);
  readonly registerError = signal('');
  readonly registerSuccess = signal(false);
  readonly registeredPatientName = signal('');
  readonly todayIso = new Date().toISOString().split('T')[0];

  readonly registerForm = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    birthDate: ['', Validators.required],
    contactNumber: ['', Validators.required],
    address: ['', Validators.required],
    emergencyContactName: ['', Validators.required],
    emergencyContactNumber: ['', Validators.required],
    bloodType: [''],
    lmp: [''],
    edd: [''],
    status: ['Active' as PatientStatus],
    riskLevel: ['Low risk' as RiskLevel],
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const st = this.selectedStatus();
    const rk = this.selectedRisk();

    return this.all().filter((p) => {
      // Search matching
      const matchesText =
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.contactNumber.toLowerCase().includes(q);

      // Status filter
      const matchesStatus =
        st === 'All' || (p.status || 'Active').toLowerCase() === st.toLowerCase();

      // Risk level filter
      const matchesRisk =
        rk === 'All' || (p.riskLevel || 'Low risk').toLowerCase() === rk.toLowerCase();

      return matchesText && matchesStatus && matchesRisk;
    });
  });

  ngOnInit(): void {
    void this.load();
    if (this.route.snapshot.queryParams['register'] === 'true') {
      this.openRegisterModal();
    }
  }

  openRegisterModal(): void {
    this.registerForm.reset({
      fullName: '',
      email: '',
      birthDate: '',
      contactNumber: '',
      address: '',
      emergencyContactName: '',
      emergencyContactNumber: '',
      bloodType: '',
      lmp: '',
      edd: '',
      status: 'Active',
      riskLevel: 'Low risk',
    });
    this.registerError.set('');
    this.registerSuccess.set(false);
    this.showRegisterModal.set(true);
  }

  closeRegisterModal(): void {
    this.showRegisterModal.set(false);
    if (this.route.snapshot.queryParams['register']) {
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  onLmpChange(): void {
    const lmp = this.registerForm.controls.lmp.value;
    if (lmp) {
      const d = new Date(lmp);
      d.setDate(d.getDate() + 280);
      const edd = d.toISOString().split('T')[0];
      this.registerForm.controls.edd.setValue(edd);
    }
  }

  isBad(controlName: keyof typeof this.registerForm.controls): boolean {
    const c = this.registerForm.controls[controlName];
    return c.invalid && (c.touched || c.dirty);
  }

  async submitRegister(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.registerError.set('Please fill in all required fields marked with *');
      return;
    }

    this.submittingRegister.set(true);
    this.registerError.set('');

    try {
      const val = this.registerForm.getRawValue();
      const profile: PatientProfile = {
        fullName: val.fullName.trim(),
        email: val.email.trim().toLowerCase(),
        birthDate: val.birthDate,
        contactNumber: val.contactNumber.trim(),
        address: val.address.trim(),
        emergencyContactName: val.emergencyContactName.trim(),
        emergencyContactNumber: val.emergencyContactNumber.trim(),
        bloodType: val.bloodType || '',
        lmp: val.lmp || '',
        edd: val.edd || '',
        status: val.status,
        riskLevel: val.riskLevel,
        gravidaPara: 'G1P0',
      };

      await this.patients.register(profile);
      this.registeredPatientName.set(profile.fullName);
      this.registerSuccess.set(true);
      await this.load();
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/email-already-in-use') {
        this.registerError.set('A patient with this email already exists.');
      } else {
        this.registerError.set(e?.message || 'Could not register patient. Please check the information and try again.');
      }
    } finally {
      this.submittingRegister.set(false);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.all.set(await this.patients.list());
    } catch (e) {
      this.error.set(this.patients.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  getRiskSlug(risk?: RiskLevel): string {
    if (!risk) return 'low';
    if (risk.toLowerCase().includes('high')) return 'high';
    if (risk.toLowerCase().includes('medium')) return 'medium';
    return 'low';
  }
}