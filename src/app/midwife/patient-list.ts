import { DatePipe, NgClass } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
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
            Register Patient
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
                    <div class="action-buttons-cell">
                      <button type="button" class="btn-view" (click)="openViewModal(p)" [attr.aria-label]="'View details of ' + p.fullName">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                        <span>View</span>
                      </button>
                      <button type="button" class="btn-edit-row" (click)="openEditModal(p, false)" [attr.aria-label]="'Edit ' + p.fullName">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        <span>Edit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ============ PATIENT DETAILS POP-OUT MODAL ============ -->
      @if (selectedPatient(); as patient) {
        <div class="modal-backdrop" (click)="closeViewModal()">
          <div class="modal-card patient-detail-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="view-modal-title">
            <!-- Modal Head -->
            <div class="modal-head">
              <div class="modal-patient-header-info">
                <div class="dir-avatar large-avatar" [ngClass]="'avatar-color-' + ((filtered().indexOf(patient) % 4) + 1)">
                  {{ getInitials(patient.fullName) }}
                </div>
                <div>
                  <div class="modal-title-row">
                    <h2 id="view-modal-title">{{ patient.fullName }}</h2>
                    <span class="badge-status" [ngClass]="'status-' + (patient.status || 'active').toLowerCase()">
                      {{ patient.status || 'Active' }}
                    </span>
                    <span class="badge-risk" [ngClass]="'risk-' + getRiskSlug(patient.riskLevel)">
                      {{ patient.riskLevel || 'Low risk' }}
                    </span>
                  </div>
                  <p class="modal-sub">{{ patient.email }} · Patient Record #{{ patient.id }}</p>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="closeViewModal()" title="Close dialog">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- Modal Body with Details -->
            <div class="modal-view-body">
              <!-- Quick Stats Banner -->
              <div class="patient-stats-banner">
                <div class="stat-pill">
                  <span class="stat-lbl">Gestational Age</span>
                  <strong class="stat-val">{{ patient.gestationalAge || '—' }}</strong>
                </div>
                <div class="stat-pill">
                  <span class="stat-lbl">Blood Type</span>
                  <strong class="stat-val">{{ patient.bloodType || '—' }}</strong>
                </div>
                <div class="stat-pill">
                  <span class="stat-lbl">Gravida / Para</span>
                  <strong class="stat-val">{{ patient.gravidaPara || 'G1P0' }}</strong>
                </div>
                <div class="stat-pill">
                  <span class="stat-lbl">Estimated Due Date</span>
                  <strong class="stat-val">{{ patient.edd ? (patient.edd | date: 'mediumDate') : '—' }}</strong>
                </div>
              </div>

              <!-- Information Grid -->
              <div class="view-grid">
                <!-- Card 1: Personal & Contact -->
                <div class="info-section-card">
                  <h3 class="section-heading">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Personal Information
                  </h3>
                  <div class="info-rows">
                    <div class="info-item">
                      <span class="info-k">Date of Birth</span>
                      <span class="info-v">{{ patient.birthDate ? (patient.birthDate | date: 'longDate') : '—' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-k">Contact Phone</span>
                      <span class="info-v highlight-text">{{ patient.contactNumber || '—' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-k">Email Address</span>
                      <span class="info-v">{{ patient.email || '—' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-k">Home Address</span>
                      <span class="info-v">{{ patient.address || '—' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Card 2: Obstetric & Maternal -->
                <div class="info-section-card">
                  <h3 class="section-heading">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    Pregnancy & Care Cycle
                  </h3>
                  <div class="info-rows">
                    <div class="info-item">
                      <span class="info-k">Last Menstrual Period (LMP)</span>
                      <span class="info-v">{{ patient.lmp ? (patient.lmp | date: 'mediumDate') : '—' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-k">Obstetric Score</span>
                      <span class="info-v">{{ patient.gravidaPara || 'G1P0' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-k">Risk Classification</span>
                      <span class="info-v">
                        <span class="badge-risk inline-badge" [ngClass]="'risk-' + getRiskSlug(patient.riskLevel)">
                          {{ patient.riskLevel || 'Low risk' }}
                        </span>
                      </span>
                    </div>
                    <div class="info-item">
                      <span class="info-k">Current Care Status</span>
                      <span class="info-v">{{ patient.status || 'Active' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Card 3: Emergency Contact (Full width) -->
                <div class="info-section-card full-width">
                  <h3 class="section-heading">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Emergency Contact Person
                  </h3>
                  <div class="info-rows emergency-grid">
                    <div class="info-item">
                      <span class="info-k">Contact Person</span>
                      <strong class="info-v">{{ patient.emergencyContactName || '—' }}</strong>
                    </div>
                    <div class="info-item">
                      <span class="info-k">Emergency Phone</span>
                      <span class="info-v highlight-text">{{ patient.emergencyContactNumber || '—' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer with Quick Actions -->
            <div class="modal-view-footer">
              <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="btn-secondary-link" (click)="openEditModal(patient, true)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Profile
                </button>
                <a [routerLink]="['/midwife/journey']" [queryParams]="{ patient: patient.id }" class="btn-secondary-link" (click)="closeViewModal()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Pregnancy Journey
                </a>
              </div>
              <div class="right-actions">
                <a [routerLink]="['/midwife/appointments']" [queryParams]="{ new: 'true', patient: patient.id }" class="btn-schedule-appt" (click)="closeViewModal()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Schedule Appointment
                </a>
                <button type="button" class="btn-close-done" (click)="closeViewModal()">Done</button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ============ REGISTER PATIENT POP-OUT MODAL ============ -->
      @if (showRegisterModal()) {
        <div class="modal-backdrop" (click)="closeRegisterModal()">
          <div class="modal-card modal-register-wizard" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div class="modal-head">
              <div class="modal-reg-head-info">
                <div class="reg-badge-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                </div>
                <div>
                  <h2 id="modal-title">Register Patient</h2>
                  <p class="modal-sub">Create maternal health record and directory entry.</p>
                </div>
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
              <!-- Stepper Progress Bar -->
              <div class="wizard-stepper-wrap">
                <div class="wizard-stepper-bar">
                  @for (step of regSteps; track step.num) {
                    <button
                      type="button"
                      class="step-item"
                      [class.active]="regStep() === step.num"
                      [class.completed]="regStep() > step.num"
                      (click)="goToRegStep(step.num)"
                      [attr.aria-current]="regStep() === step.num ? 'step' : null"
                    >
                      <div class="step-circle">
                        @if (regStep() > step.num) {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        } @else {
                          <span>{{ step.num }}</span>
                        }
                      </div>
                      <div class="step-label-group">
                        <span class="step-num-text">Step {{ step.num }}</span>
                        <strong class="step-title-text">{{ step.title }}</strong>
                      </div>
                    </button>
                    @if (!$last) {
                      <div class="step-connector" [class.filled]="regStep() > step.num"></div>
                    }
                  }
                </div>
              </div>

              <!-- Wizard Step Body -->
              <div class="wizard-step-body">
                @if (regStepError()) {
                  <div class="modal-alert-error" role="alert">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>{{ regStepError() }}</span>
                  </div>
                }
                @if (registerError()) {
                  <div class="modal-alert-error" role="alert">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>{{ registerError() }}</span>
                  </div>
                }

                <form [formGroup]="registerForm" novalidate>
                  <!-- STEP 1: PERSONAL INFORMATION -->
                  @if (regStep() === 1) {
                    <div class="wizard-step-pane">
                      <div class="step-header-intro">
                        <span class="step-badge">Section 1</span>
                        <h3>Personal Details</h3>
                        <p>Patient identification, date of birth, blood group, and residential address.</p>
                      </div>

                      <div class="form-fields-grid">
                        <div class="form-group span-2">
                          <label for="reg-fullname">Full Name <span class="req">*</span></label>
                          <input id="reg-fullname" formControlName="fullName" placeholder="Enter patient full name" [class.is-bad]="isBad('fullName')">
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
                    </div>
                  }

                  <!-- STEP 2: EMERGENCY CONTACT -->
                  @if (regStep() === 2) {
                    <div class="wizard-step-pane">
                      <div class="step-header-intro">
                        <span class="step-badge">Section 2</span>
                        <h3>Emergency Contact Person</h3>
                        <p>Provide contact information of next-of-kin or spouse in case of labor or maternal emergencies.</p>
                      </div>

                      <div class="form-fields-grid">
                        <div class="form-group">
                          <label for="reg-ec-name">Contact Person / Guardian <span class="req">*</span></label>
                          <input id="reg-ec-name" formControlName="emergencyContactName" placeholder="Spouse or Guardian name" [class.is-bad]="isBad('emergencyContactName')">
                        </div>
                        <div class="form-group">
                          <label for="reg-ec-phone">Emergency Phone Number <span class="req">*</span></label>
                          <input id="reg-ec-phone" type="tel" formControlName="emergencyContactNumber" placeholder="0912 345 6789" [class.is-bad]="isBad('emergencyContactNumber')">
                        </div>
                      </div>

                      <div class="patient-preview-card" style="margin-top: 16px;">
                        <div class="pt-avatar">{{ getInitials(registerForm.get('fullName')?.value) }}</div>
                        <div class="pt-info">
                          <div class="pt-title-row">
                            <strong class="pt-name">{{ registerForm.get('fullName')?.value || 'Patient' }}</strong>
                            <span class="badge-status status-active">{{ registerForm.get('status')?.value || 'Active' }}</span>
                          </div>
                          <div class="pt-meta-row">
                            <span>Phone: <strong>{{ registerForm.get('contactNumber')?.value || '—' }}</strong></span>
                            <span class="meta-dot">•</span>
                            <span>Email: <strong>{{ registerForm.get('email')?.value || '—' }}</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  }

                  <!-- STEP 3: CARE & PREGNANCY DETAILS -->
                  @if (regStep() === 3) {
                    <div class="wizard-step-pane">
                      <div class="step-header-intro">
                        <span class="step-badge">Section 3</span>
                        <h3>Care Cycle & Risk Classification</h3>
                        <p>Specify menstrual cycle, expected due date, active care state, and initial risk classification.</p>
                      </div>

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
                          <label for="reg-status">Care Status</label>
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

                      <!-- Registration Summary Card -->
                      <div class="wizard-summary-card" style="margin-top: 14px;">
                        <div class="summary-head">
                          <strong>Registration Summary</strong>
                          <span class="badge-risk inline-risk" [ngClass]="'risk-' + getRiskSlug(registerForm.get('riskLevel')?.value)">{{ registerForm.get('riskLevel')?.value || 'Low risk' }}</span>
                        </div>
                        <div class="summary-grid">
                          <div class="summary-item">
                            <span class="sum-lbl">Patient Name</span>
                            <strong class="sum-val">{{ registerForm.get('fullName')?.value || '—' }}</strong>
                          </div>
                          <div class="summary-item">
                            <span class="sum-lbl">Email / Contact</span>
                            <strong class="sum-val">{{ registerForm.get('email')?.value || '—' }} · {{ registerForm.get('contactNumber')?.value || '—' }}</strong>
                          </div>
                          <div class="summary-item">
                            <span class="sum-lbl">Emergency Contact</span>
                            <strong class="sum-val">{{ registerForm.get('emergencyContactName')?.value || '—' }} ({{ registerForm.get('emergencyContactNumber')?.value || '—' }})</strong>
                          </div>
                          <div class="summary-item">
                            <span class="sum-lbl">Care Status & EDD</span>
                            <strong class="sum-val">{{ registerForm.get('status')?.value || 'Active' }} · EDD: {{ registerForm.get('edd')?.value || 'TBD' }}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                </form>
              </div>

              <!-- Wizard Footer Navigation -->
              <div class="modal-footer wizard-footer">
                <div class="footer-left">
                  <button type="button" class="btn-cancel-modal" (click)="closeRegisterModal()">Cancel</button>
                </div>

                <div class="footer-right">
                  @if (regStep() > 1) {
                    <button type="button" class="btn-wizard-prev" (click)="prevRegStep()">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
                      Previous
                    </button>
                  }

                  @if (regStep() < 3) {
                    <button type="button" class="btn-wizard-next" (click)="nextRegStep()">
                      Next Step
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  } @else {
                    <button type="button" class="btn-submit-modal" (click)="submitRegister()" [disabled]="submittingRegister()">
                      {{ submittingRegister() ? 'Registering…' : 'Register Patient' }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ============ EDIT PATIENT POP-OUT MODAL ============ -->
      @if (showEditModal()) {
        @if (editingPatient(); as p) {
          <div class="modal-backdrop" (click)="closeEditModal()">
            <div class="modal-card edit-patient-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
              <div class="modal-head">
                <div class="modal-edit-head-info">
                  <div class="edit-badge-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 id="edit-modal-title">Edit Patient Profile</h2>
                    <p class="modal-sub">Updating maternal care record for <strong>{{ p.fullName }}</strong></p>
                  </div>
                </div>
                <button type="button" class="btn-close-modal" (click)="closeEditModal()" title="Close dialog">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <form [formGroup]="editForm" (ngSubmit)="submitEdit()" class="modal-form-content" novalidate>
                @if (editError()) {
                  <div class="modal-alert-error" role="alert">{{ editError() }}</div>
                }

                <div class="form-section-label">Personal Information</div>
                <div class="form-fields-grid">
                  <div class="form-group span-2">
                    <label for="edit-fullname">Full Name <span class="req">*</span></label>
                    <input id="edit-fullname" formControlName="fullName" placeholder="Enter patient full name" [class.is-bad]="isEditBad('fullName')">
                  </div>
                  <div class="form-group">
                    <label for="edit-email">Email (Account Login)</label>
                    <input id="edit-email" type="email" formControlName="email" class="input-disabled" title="Login email cannot be changed">
                    <span class="field-hint">Login email cannot be changed</span>
                  </div>
                  <div class="form-group">
                    <label for="edit-dob">Date of Birth <span class="req">*</span></label>
                    <input id="edit-dob" type="date" formControlName="birthDate" [max]="todayIso" [class.is-bad]="isEditBad('birthDate')">
                  </div>
                  <div class="form-group">
                    <label for="edit-phone">Contact Number <span class="req">*</span></label>
                    <input id="edit-phone" type="tel" formControlName="contactNumber" placeholder="09XX XXX XXXX" [class.is-bad]="isEditBad('contactNumber')">
                  </div>
                  <div class="form-group">
                    <label for="edit-blood">Blood Type</label>
                    <select id="edit-blood" formControlName="bloodType">
                      <option value="">Not recorded</option>
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
                    <label for="edit-address">Home Address <span class="req">*</span></label>
                    <input id="edit-address" formControlName="address" placeholder="Barangay, Municipality / City" [class.is-bad]="isEditBad('address')">
                  </div>
                </div>

                <div class="form-section-label" style="margin-top: 8px;">Emergency Contact Person</div>
                <div class="form-fields-grid">
                  <div class="form-group">
                    <label for="edit-ecname">Contact Person Name <span class="req">*</span></label>
                    <input id="edit-ecname" formControlName="emergencyContactName" placeholder="e.g. Juan Santos (Spouse)" [class.is-bad]="isEditBad('emergencyContactName')">
                  </div>
                  <div class="form-group">
                    <label for="edit-ecphone">Emergency Phone <span class="req">*</span></label>
                    <input id="edit-ecphone" type="tel" formControlName="emergencyContactNumber" placeholder="09XX XXX XXXX" [class.is-bad]="isEditBad('emergencyContactNumber')">
                  </div>
                </div>

                <div class="form-section-label" style="margin-top: 8px;">Pregnancy & Clinical Details</div>
                <div class="form-fields-grid">
                  <div class="form-group">
                    <label for="edit-lmp">Last Menstrual Period (LMP)</label>
                    <input id="edit-lmp" type="date" formControlName="lmp" [max]="todayIso" (change)="onEditLmpChange()">
                  </div>
                  <div class="form-group">
                    <label for="edit-edd">Estimated Due Date (EDD)</label>
                    <input id="edit-edd" type="date" formControlName="edd">
                  </div>
                  <div class="form-group">
                    <label for="edit-gp">Obstetric Score (Gravida/Para)</label>
                    <input id="edit-gp" formControlName="gravidaPara" placeholder="e.g. G1P0, G2P1">
                  </div>
                  <div class="form-group">
                    <label for="edit-status">Care Status</label>
                    <select id="edit-status" formControlName="status">
                      <option value="Active">Active</option>
                      <option value="Postpartum">Postpartum</option>
                      <option value="Completed">Completed</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div class="form-group span-2">
                    <label for="edit-risk">Risk Level</label>
                    <select id="edit-risk" formControlName="riskLevel">
                      <option value="Low risk">Low risk</option>
                      <option value="Medium risk">Medium risk</option>
                      <option value="High risk">High risk</option>
                    </select>
                  </div>
                </div>

                <div class="modal-footer-actions">
                  <button type="button" class="btn-cancel-modal" (click)="closeEditModal()">Cancel</button>
                  <button type="submit" class="btn-submit-modal" [disabled]="submittingEdit()">
                    {{ submittingEdit() ? 'Saving Changes…' : 'Save Changes' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        }
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
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 15px;
      border-radius: 999px;
      background: #f4effa;
      color: #4a287c;
      border: 1.2px solid #dfd3f2;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(74, 40, 124, 0.06);
    }

    .btn-view svg {
      width: 14px;
      height: 14px;
      color: #6b4fa3;
      transition: transform 0.2s ease, color 0.2s ease;
    }

    .btn-view:hover {
      background: #4a287c;
      color: #ffffff;
      border-color: #4a287c;
      box-shadow: 0 4px 12px rgba(74, 40, 124, 0.24);
      transform: translateY(-1px);
    }

    .btn-view:hover svg {
      color: #ffffff;
      transform: scale(1.1);
    }

    .btn-view:active {
      transform: translateY(0);
      box-shadow: 0 1px 4px rgba(74, 40, 124, 0.15);
    }

    .action-buttons-cell {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      justify-content: flex-end;
    }

    .btn-edit-row {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 7px 13px;
      border-radius: 999px;
      background: #fbf9fe;
      color: #6b4fa3;
      border: 1.2px solid #e1d5f2;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(74, 40, 124, 0.04);
    }

    .btn-edit-row svg {
      width: 13px;
      height: 13px;
      color: #6b4fa3;
      transition: transform 0.2s ease, color 0.2s ease;
    }

    .btn-edit-row:hover {
      background: #6b4fa3;
      color: #ffffff;
      border-color: #6b4fa3;
      box-shadow: 0 4px 12px rgba(107, 79, 163, 0.25);
      transform: translateY(-1px);
    }

    .btn-edit-row:hover svg {
      color: #ffffff;
      transform: scale(1.1);
    }

    .btn-edit-row:active {
      transform: translateY(0);
      box-shadow: 0 1px 4px rgba(107, 79, 163, 0.15);
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

    /* ==================== REGISTER WIZARD STYLES ==================== */
    .modal-register-wizard {
      max-width: 760px !important;
      width: 100%;
      display: flex;
      flex-direction: column;
      max-height: 92vh;
      overflow: hidden;
    }

    .modal-reg-head-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .reg-badge-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #ede6f7;
      color: #4a287c;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .reg-badge-icon svg {
      width: 20px;
      height: 20px;
    }

    .wizard-stepper-wrap {
      padding: 12px 18px;
      background: #faf8fd;
      border-bottom: 1px solid #efe8f8;
      box-sizing: border-box;
      overflow: hidden;
    }

    .wizard-stepper-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
      box-sizing: border-box;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 7px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 4px;
      border-radius: 8px;
      transition: all 0.2s ease;
      text-align: left;
      flex-shrink: 0;
    }

    .step-item:hover .step-circle {
      border-color: #361759;
    }

    .step-circle {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 12.5px;
      font-weight: 700;
      border: 1.8px solid #d4c8e8;
      background: #ffffff;
      color: #6b5b82;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
    }

    .step-circle svg {
      width: 13px;
      height: 13px;
    }

    .step-item.active .step-circle {
      background: #361759;
      border-color: #361759;
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(54, 23, 89, 0.28);
      transform: scale(1.05);
    }

    .step-item.completed .step-circle {
      background: #ede6f8;
      border-color: #361759;
      color: #361759;
    }

    .step-label-group {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }

    .step-num-text {
      font-size: 9.5px;
      font-weight: 700;
      color: #8c829e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .step-title-text {
      font-size: 11.5px;
      font-weight: 600;
      color: #554a66;
      white-space: nowrap;
    }

    .step-item.active .step-title-text {
      color: #271442;
      font-weight: 800;
    }

    .step-item.completed .step-title-text {
      color: #361759;
    }

    .step-connector {
      flex: 1 1 10px;
      min-width: 8px;
      height: 2px;
      background: #e8dfef;
      margin: 0 3px;
      border-radius: 2px;
      transition: background 0.3s ease;
    }

    .step-connector.filled {
      background: #361759;
    }

    .wizard-step-body {
      padding: 18px 24px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      max-height: calc(88vh - 170px);
    }

    .wizard-step-pane {
      animation: fadeInStep 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeInStep {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .step-header-intro {
      margin-bottom: 12px;
    }

    .step-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: #ede6f8;
      color: #4a287c;
      padding: 2px 8px;
      border-radius: 999px;
      margin-bottom: 4px;
    }

    .step-header-intro h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #271442;
    }

    .step-header-intro p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #7a7189;
    }

    .wizard-summary-card {
      background: #fcfaff;
      border: 1.5px solid #ebdff5;
      border-radius: 10px;
      padding: 10px 14px;
    }

    .summary-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #efe5f8;
      padding-bottom: 5px;
      margin-bottom: 7px;
    }

    .summary-head strong {
      font-size: 12.5px;
      color: #271442;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5px 12px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sum-lbl {
      font-size: 10.5px;
      color: #7a7189;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
    }

    .sum-val {
      font-size: 12px;
      color: #271442;
    }

    .inline-risk {
      display: inline-block;
      width: fit-content;
      padding: 2px 8px;
      font-size: 11px;
    }

    .wizard-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px;
      border-top: 1px solid #ebe5f5;
      background: #fbf9fd;
    }

    .footer-left, .footer-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .step-indicator-pill {
      background: #f0eaf8;
      color: #4a287c;
      padding: 5px 13px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .btn-wizard-prev {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 999px;
      border: 1px solid #d4c8e8;
      background: #ffffff;
      color: #361759;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-wizard-prev:hover {
      background: #f3ecfb;
      border-color: #361759;
    }

    .btn-wizard-prev svg {
      width: 14px;
      height: 14px;
    }

    .btn-wizard-next {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 20px;
      border-radius: 999px;
      border: none;
      background: #361759;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
      transition: all 0.15s ease;
    }

    .btn-wizard-next:hover {
      background: #4a2179;
      transform: translateY(-1px);
    }

    .btn-wizard-next svg {
      width: 14px;
      height: 14px;
    }

    .patient-preview-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #fbf9fd;
      border: 1.5px solid #ece4f5;
      border-radius: 12px;
      padding: 12px 16px;
      margin-top: 14px;
    }

    .pt-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #361759;
      color: #ffffff;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 14px;
      flex-shrink: 0;
      box-shadow: 0 3px 8px rgba(54, 23, 89, 0.2);
    }

    .pt-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .pt-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pt-name {
      font-size: 14.5px;
      color: #271442;
    }

    .pt-meta-row {
      font-size: 12px;
      color: #695f77;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .meta-dot {
      color: #b5a9c8;
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

        /* ============ PATIENT DETAILS POP-OUT MODAL (Original Picture 1 Design) ============ */
    .patient-detail-modal {
      max-width: 680px;
    }

    .modal-patient-header-info {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .large-avatar {
      width: 48px;
      height: 48px;
      font-size: 16px;
    }

    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .modal-title-row h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #271442;
    }

    .patient-stats-banner {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #fbf9fd;
      border: 1px solid #efe8f8;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 4px;
    }

    .stat-pill {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-lbl {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #7b7189;
    }

    .stat-val {
      font-size: 13.5px;
      font-weight: 700;
      color: #271442;
    }

    .modal-view-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .view-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .info-section-card {
      background: #ffffff;
      border: 1px solid #f0eaf8;
      border-radius: 12px;
      padding: 14px 16px;
    }

    .info-section-card.full-width {
      grid-column: span 2;
    }

    .section-heading {
      margin: 0 0 12px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b4fa3;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-heading svg {
      width: 15px;
      height: 15px;
      color: #6b4fa3;
    }

    .info-rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .emergency-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .info-k {
      font-size: 11.5px;
      font-weight: 500;
      color: #7b7189;
    }

    .info-v {
      font-size: 13.5px;
      color: #2a2438;
      word-break: break-word;
    }

    .highlight-text {
      color: #4a287c;
      font-weight: 600;
    }

    .inline-badge {
      display: inline-block;
      margin-top: 2px;
    }

    .modal-view-footer {
      padding: 16px 24px;
      border-top: 1px solid #f0eaf8;
      background: #faf8fd;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      border-radius: 0 0 16px 16px;
    }

    .btn-secondary-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #6b4fa3;
      background: transparent;
      border: none;
      font-family: inherit;
      cursor: pointer;
      text-decoration: none;
      padding: 7px 12px;
      border-radius: 8px;
      transition: background 0.15s, color 0.15s;
    }

    .btn-secondary-link:hover {
      background: #ede6f7;
      color: #3b1d6b;
    }

    .modal-edit-head-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .edit-badge-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #ede6f7;
      color: #5c3596;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .edit-badge-icon svg {
      width: 20px;
      height: 20px;
    }

    .field-hint {
      font-size: 11px;
      color: #8c829e;
      margin-top: 3px;
    }

    .input-disabled {
      background: #f4effa !important;
      color: #726884 !important;
      cursor: not-allowed;
      border-color: #e4dcee !important;
    }

    .btn-secondary-link svg {
      width: 14px;
      height: 14px;
    }

    .right-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-schedule-appt {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8.5px 18px;
      border-radius: 999px;
      background: #4a287c;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(74, 40, 124, 0.2);
    }

    .btn-schedule-appt:hover {
      background: #3b1d6b;
      box-shadow: 0 4px 12px rgba(74, 40, 124, 0.3);
      transform: translateY(-1px);
    }

    .btn-schedule-appt svg {
      width: 14px;
      height: 14px;
    }

    .btn-close-done {
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

    .btn-close-done:hover {
      background: #f7f3fc;
      color: #271442;
    }

    @media (max-width: 600px) {
      .patient-stats-banner {
        grid-template-columns: repeat(2, 1fr);
      }
      .view-grid {
        grid-template-columns: 1fr;
      }
      .info-section-card.full-width {
        grid-column: span 1;
      }
      .emergency-grid {
        grid-template-columns: 1fr;
      }
      .modal-view-footer {
        flex-direction: column-reverse;
        align-items: stretch;
      }
      .right-actions {
        flex-direction: column;
      }
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

  // Selected patient for View modal
  readonly selectedPatient = signal<Patient | null>(null);

  // Modal signals
  readonly showRegisterModal = signal(false);
  readonly submittingRegister = signal(false);
  readonly registerError = signal('');
  readonly registerSuccess = signal(false);
  readonly registeredPatientName = signal('');
  readonly todayIso = new Date().toISOString().split('T')[0];

  // Register Wizard State
  readonly regStep = signal(1);
  readonly regStepError = signal('');
  readonly regSteps = [
    { num: 1, title: 'Personal Info' },
    { num: 2, title: 'Emergency Contact' },
    { num: 3, title: 'Care & Risk' },
  ];

  // Edit Modal signals
  readonly showEditModal = signal(false);
  readonly editingPatient = signal<Patient | null>(null);
  readonly previousViewPatient = signal<Patient | null>(null);
  readonly submittingEdit = signal(false);
  readonly editError = signal('');

  readonly editForm = this.fb.group({
    fullName: ['', Validators.required],
    email: [{ value: '', disabled: true }],
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
    gravidaPara: ['G1P0'],
  });

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

  
  // Close modal on Escape key
  @HostListener('window:keydown.escape')
  handleEscapeKey(): void {
    if (this.showEditModal()) {
      this.closeEditModal();
    } else if (this.selectedPatient()) {
      this.closeViewModal();
    } else if (this.showRegisterModal()) {
      this.closeRegisterModal();
    }
  }

  ngOnInit(): void {
    void this.load();
    if (this.route.snapshot.queryParams['register'] === 'true') {
      this.openRegisterModal();
    }
  }

  openViewModal(p: Patient): void {
    this.selectedPatient.set(p);
  }

  closeViewModal(): void {
    this.selectedPatient.set(null);
  }

  openEditModal(p: Patient, fromView = false): void {
    if (fromView) {
      this.previousViewPatient.set(p);
      this.selectedPatient.set(null);
    } else {
      this.previousViewPatient.set(null);
    }
    this.editingPatient.set(p);
    this.editError.set('');
    this.editForm.reset({
      fullName: p.fullName || '',
      email: p.email || '',
      birthDate: p.birthDate || '',
      contactNumber: p.contactNumber || '',
      address: p.address || '',
      emergencyContactName: p.emergencyContactName || '',
      emergencyContactNumber: p.emergencyContactNumber || '',
      bloodType: p.bloodType || '',
      lmp: p.lmp || '',
      edd: p.edd || '',
      status: (p.status || 'Active') as PatientStatus,
      riskLevel: (p.riskLevel || 'Low risk') as RiskLevel,
      gravidaPara: p.gravidaPara || 'G1P0',
    });
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    const prev = this.previousViewPatient();
    this.showEditModal.set(false);
    this.editingPatient.set(null);
    this.previousViewPatient.set(null);
    if (prev) {
      this.openViewModal(prev);
    }
  }

  onEditLmpChange(): void {
    const lmp = this.editForm.controls.lmp.value;
    if (lmp) {
      const d = new Date(lmp);
      d.setDate(d.getDate() + 280);
      const edd = d.toISOString().split('T')[0];
      this.editForm.controls.edd.setValue(edd);
    }
  }

  isEditBad(controlName: keyof typeof this.editForm.controls): boolean {
    const c = this.editForm.controls[controlName];
    return c.invalid && (c.touched || c.dirty);
  }

  async submitEdit(): Promise<void> {
    const patient = this.editingPatient();
    if (!patient) return;

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.editError.set('Please fill in all required fields marked with *');
      return;
    }

    this.submittingEdit.set(true);
    this.editError.set('');

    try {
      const val = this.editForm.getRawValue();
      const profile: PatientProfile = {
        fullName: val.fullName.trim(),
        email: patient.email,
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
        gravidaPara: val.gravidaPara.trim() || 'G1P0',
      };

      await this.patients.update(patient.id, profile);
      await this.load();

      const updated = this.all().find((x) => x.id === patient.id) || { ...patient, ...profile };
      this.showEditModal.set(false);
      this.editingPatient.set(null);
      this.previousViewPatient.set(null);
      this.openViewModal(updated);
    } catch (e: any) {
      this.editError.set(e?.message || 'Could not update patient profile. Please try again.');
    } finally {
      this.submittingEdit.set(false);
    }
  }

  validateRegStep(): boolean {
    this.regStepError.set('');
    const s = this.regStep();
    if (s === 1) {
      const controls = ['fullName', 'email', 'birthDate', 'contactNumber', 'address'] as const;
      let hasInvalid = false;
      for (const ctrl of controls) {
        const c = this.registerForm.controls[ctrl];
        if (c.invalid) {
          c.markAsTouched();
          c.markAsDirty();
          hasInvalid = true;
        }
      }
      if (hasInvalid) {
        this.regStepError.set('Please fill in all required personal information fields marked with *');
        return false;
      }
    } else if (s === 2) {
      const controls = ['emergencyContactName', 'emergencyContactNumber'] as const;
      let hasInvalid = false;
      for (const ctrl of controls) {
        const c = this.registerForm.controls[ctrl];
        if (c.invalid) {
          c.markAsTouched();
          c.markAsDirty();
          hasInvalid = true;
        }
      }
      if (hasInvalid) {
        this.regStepError.set('Please fill in all emergency contact details marked with *');
        return false;
      }
    }
    return true;
  }

  nextRegStep(): void {
    if (!this.validateRegStep()) return;
    if (this.regStep() < this.regSteps.length) {
      this.regStep.update((s) => s + 1);
    }
  }

  prevRegStep(): void {
    this.regStepError.set('');
    if (this.regStep() > 1) {
      this.regStep.update((s) => s - 1);
    }
  }

  goToRegStep(stepNum: number): void {
    if (stepNum === this.regStep()) return;
    if (stepNum > this.regStep()) {
      if (!this.validateRegStep()) return;
    }
    this.regStepError.set('');
    this.regStep.set(stepNum);
  }

  openRegisterModal(): void {
    this.regStep.set(1);
    this.regStepError.set('');
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
    if (!this.validateRegStep()) return;
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

  
  getAge(birthDate?: string): string {
    if (!birthDate) return '';
    const dob = new Date(birthDate);
    if (isNaN(dob.getTime())) return '';
    const diffMs = Date.now() - dob.getTime();
    const age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
    return age > 0 ? ` (age ${age})` : '';
  }

  getGestationWeeks(gestationalAge?: string): number {
    if (!gestationalAge) return 0;
    const match = gestationalAge.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  getProgressPercent(p: Patient): number {
    if (p.status === 'Postpartum' || p.status === 'Completed') return 100;
    const w = this.getGestationWeeks(p.gestationalAge);
    if (w > 0) return Math.min(100, Math.round((w / 40) * 100));
    return 20;
  }

  getTrimesterName(p: Patient): string {
    if (p.status === 'Postpartum') return 'Postpartum care';
    if (p.status === 'Completed') return 'Completed maternal care';
    const w = this.getGestationWeeks(p.gestationalAge);
    if (w <= 13) return 'First trimester';
    if (w <= 27) return 'Second trimester';
    return 'Third trimester';
  }

  getEmergencyInfo(rawName?: string): { name: string; rel: string } {
    if (!rawName) return { name: '—', rel: 'Emergency Contact' };
    const match = rawName.match(/^(.*?)(?:\s*\((.*?)\))?$/);
    if (match) {
      return {
        name: match[1]?.trim() || rawName,
        rel: match[2]?.trim() || 'Emergency Contact',
      };
    }
    return { name: rawName, rel: 'Emergency Contact' };
  }

  getGravidaParaDisplay(gp?: string): string {
    if (!gp) return 'G1P0 (first pregnancy)';
    const clean = gp.trim();
    if (clean === 'G1P0') return 'G1P0 (first pregnancy)';
    if (clean === 'G2P1') return 'G2P1 (second pregnancy)';
    if (clean === 'G1P1') return 'G1P1 (first birth)';
    if (clean === 'G3P2') return 'G3P2 (third pregnancy)';
    if (clean === 'G2P2') return 'G2P2 (second birth)';
    return clean;
  }

  getInitials(name?: string | null): string {
    if (!name) return 'PT';
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  getRiskSlug(risk?: RiskLevel | string | null): string {
    if (!risk) return 'low';
    const r = risk.toLowerCase();
    if (r.includes('high')) return 'high';
    if (r.includes('medium')) return 'medium';
    return 'low';
  }
}