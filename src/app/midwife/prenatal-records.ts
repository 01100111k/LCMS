import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';
import { PrenatalRecord, RecordsService } from '../core/records.service';

@Component({
  selector: 'app-prenatal-records',
  imports: [DatePipe, FormsModule, NgClass],
  template: `
    <div class="records-page-wrap">
      <!-- ============ TOP HEADER ============ -->
      <div class="records-header-row">
        <div>
          <h1>Prenatal Care & Clinical Records</h1>
          <p class="header-sub">
            Track gestational progress, maternal vitals, fetal heart rates, fundal measurements, and clinical checkup history.
          </p>
        </div>

        <div class="header-action-group">
          <button type="button" class="btn-primary-action" (click)="openAddModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Log Prenatal Visit
          </button>
        </div>
      </div>

      <!-- Toast Feedback Message -->
      @if (actionFeedback()) {
        <div class="feedback-toast" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {{ actionFeedback() }}
        </div>
      }

      <!-- ============ SEARCH & FILTER BAR ============ -->
      <div class="filter-controls-row">
        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Search patient name, midwife, or findings..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>

        <div class="filter-selects-group">
          <select [ngModel]="filterTrimester()" (ngModelChange)="filterTrimester.set($event)">
            <option value="All">All Trimesters</option>
            <option value="1st Trimester">1st Trimester (Weeks 1-13)</option>
            <option value="2nd Trimester">2nd Trimester (Weeks 14-27)</option>
            <option value="3rd Trimester">3rd Trimester (Weeks 28-40+)</option>
          </select>

          <select [ngModel]="filterRisk()" (ngModelChange)="filterRisk.set($event)">
            <option value="All">All Risk Levels</option>
            <option value="Low risk">Low Risk</option>
            <option value="Medium risk">Medium Risk</option>
            <option value="High risk">High Risk</option>
          </select>
        </div>
      </div>

      <!-- ============ RECORDS TABLE & LIST ============ -->
      @if (loading()) {
        <div class="loading-state-card">
          <p>Loading prenatal records from clinical database...</p>
        </div>
      } @else if (filteredRecords().length === 0) {
        <div class="empty-records-card">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <h3>No Prenatal Visit Records Found</h3>
          <p>Log a checkup to record maternal vitals, fundal measurements, and fetal wellness.</p>
          <button type="button" class="btn-primary-action" (click)="openAddModal()" style="margin-top: 10px;">
            Log Prenatal Visit
          </button>
        </div>
      } @else {
        <div class="table-container-card">
          <table class="clinical-table">
            <thead>
              <tr>
                <th>Date & Visit</th>
                <th>Patient Name</th>
                <th>Gestational Age</th>
                <th>Vitals (BP · Wt)</th>
                <th>Fundal & FHR</th>
                <th>Lie & Urine</th>
                <th>Risk Level</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredRecords(); track r.id) {
                <tr>
                  <td>
                    <strong>{{ r.date | date: 'MMM d, y' }}</strong>
                    <div class="sub-label">{{ r.time || 'Routine' }}</div>
                  </td>
                  <td>
                    <strong class="patient-name-cell">{{ r.patientName }}</strong>
                    <div class="sub-label">Attending: {{ r.attendingMidwife }}</div>
                  </td>
                  <td>
                    <span class="ga-badge">{{ r.gestationalAge }}</span>
                    <div class="sub-label">{{ r.trimester }}</div>
                  </td>
                  <td>
                    <strong>{{ r.bp }}</strong> mmHg
                    <div class="sub-label">{{ r.weightKg }} kg</div>
                  </td>
                  <td>
                    <strong>{{ r.fundalHeightCm }} cm</strong>
                    <div class="sub-label">{{ r.fetalHeartRateBpm }} bpm</div>
                  </td>
                  <td>
                    <div>Lie: <strong>{{ r.fetalPresentation }}</strong></div>
                    <div class="sub-label">Urine: {{ r.urinalysisProtein }}</div>
                  </td>
                  <td>
                    <span class="risk-badge" [ngClass]="'risk-' + getRiskSlug(r.riskLevel)">
                      {{ r.riskLevel }}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <div class="row-actions-group">
                      <button type="button" class="btn-row-action" (click)="viewRecord(r)" title="View Details">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button type="button" class="btn-row-action btn-danger" (click)="deleteRecord(r)" title="Delete Record">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ==================== LOG PRENATAL VISIT WIZARD MODAL ==================== -->
      @if (showAddModal()) {
        <div class="modal-backdrop" (click)="closeAddModal()">
          <div class="modal-dialog-card modal-lg wizard-modal-card" (click)="$event.stopPropagation()">
            <!-- Modal Header -->
            <div class="modal-header">
              <div class="modal-title-row">
                <div class="modal-icon tone-purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <div>
                  <h2>Log Prenatal Checkup Record</h2>
                  <p class="modal-subtitle">Record clinical measurements, maternal vitals, and obstetric assessment.</p>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="closeAddModal()" title="Close dialog">✕</button>
            </div>

            <!-- Stepper Progress Bar -->
            <div class="wizard-stepper-wrap">
              <div class="wizard-stepper-bar">
                @for (step of steps; track step.num) {
                  <button
                    type="button"
                    class="step-item"
                    [class.active]="currentStep() === step.num"
                    [class.completed]="currentStep() > step.num"
                    (click)="goToStep(step.num)"
                    [attr.aria-current]="currentStep() === step.num ? 'step' : null"
                  >
                    <div class="step-circle">
                      @if (currentStep() > step.num) {
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
                    <div class="step-connector" [class.filled]="currentStep() > step.num"></div>
                  }
                }
              </div>
            </div>

            <!-- Modal Body (Step Specific Content) -->
            <div class="wizard-step-body">
              @if (stepError()) {
                <div class="step-alert-banner" role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{{ stepError() }}</span>
                </div>
              }

              <!-- STEP 1: PATIENT IDENTIFICATION & VISIT DATE -->
              @if (currentStep() === 1) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 1</span>
                    <h3>Patient Identification & Visit Date</h3>
                    <p>Select the registered patient from the directory and record the visit date.</p>
                  </div>

                  <div class="form-row-2">
                    <div class="form-field">
                      <label>Select Registered Patient <span class="req">*</span></label>
                      <select [(ngModel)]="formPatientId" name="patientId" (change)="onPatientSelect()" required>
                        <option value="" disabled>-- Choose patient from directory --</option>
                        @for (p of patients(); track p.id) {
                          <option [value]="p.id">{{ p.fullName }} ({{ p.contactNumber || p.email }})</option>
                        }
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Visit Date <span class="req">*</span></label>
                      <input type="date" [(ngModel)]="formDate" name="formDate" required />
                    </div>
                  </div>

                  @if (selectedPatientObj(); as pt) {
                    <div class="patient-preview-card">
                      <div class="pt-avatar">{{ getInitials(pt.fullName) }}</div>
                      <div class="pt-info">
                        <div class="pt-title-row">
                          <strong class="pt-name">{{ pt.fullName }}</strong>
                          <span class="badge-status status-active">{{ pt.status || 'Active' }}</span>
                          <span class="badge-risk" [ngClass]="'risk-' + getRiskSlug(pt.riskLevel)">{{ pt.riskLevel || 'Low risk' }}</span>
                        </div>
                        <div class="pt-meta-row">
                          <span>Phone: <strong>{{ pt.contactNumber || '—' }}</strong></span>
                          <span class="meta-dot">•</span>
                          <span>Email: <strong>{{ pt.email || '—' }}</strong></span>
                          <span class="meta-dot">•</span>
                          <span>Blood: <strong>{{ pt.bloodType || 'Not recorded' }}</strong></span>
                          <span class="meta-dot">•</span>
                          <span>Obstetric: <strong>{{ pt.gravidaPara || 'G1P0' }}</strong></span>
                          @if (pt.lmp) {
                            <span class="meta-dot">•</span>
                            <span>LMP: <strong>{{ pt.lmp | date: 'mediumDate' }}</strong></span>
                          }
                        </div>
                      </div>
                    </div>
                  } @else {
                    <div class="patient-select-hint">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      <span>Selecting a registered patient will automatically populate their baseline risk level and estimate gestational age based on their LMP or EDD.</span>
                    </div>
                  }
                </div>
              }

              <!-- STEP 2: GESTATIONAL TIMELINE & RISK -->
              @if (currentStep() === 2) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 2</span>
                    <h3>Gestational Timeline & Risk Classification</h3>
                    <p>Verify or adjust the patient's gestational timeline, trimester stage, and risk category.</p>
                  </div>

                  <div class="form-row-3">
                    <div class="form-field">
                      <label>Gestational Age (e.g. 24 weeks) <span class="req">*</span></label>
                      <input type="text" [(ngModel)]="formGestationalAge" name="formGestationalAge" placeholder="24 weeks" required />
                    </div>

                    <div class="form-field">
                      <label>Trimester Stage</label>
                      <select [(ngModel)]="formTrimester" name="formTrimester">
                        <option value="1st Trimester">1st Trimester (Weeks 1-13)</option>
                        <option value="2nd Trimester">2nd Trimester (Weeks 14-27)</option>
                        <option value="3rd Trimester">3rd Trimester (Weeks 28-40+)</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Maternal Risk Level</label>
                      <select [(ngModel)]="formRiskLevel" name="formRiskLevel">
                        <option value="Low risk">Low Risk</option>
                        <option value="Medium risk">Medium Risk</option>
                        <option value="High risk">High Risk</option>
                      </select>
                    </div>
                  </div>

                  <div class="clinical-info-callout">
                    <div class="callout-icon">💡</div>
                    <div class="callout-body">
                      <strong>Automated Gestational Calculation</strong>
                      <p>Gestational age is pre-calculated from the patient's Last Menstrual Period (LMP). You can manually modify it if an ultrasound biometry report indicates an adjusted clinical gestational age.</p>
                    </div>
                  </div>
                </div>
              }

              <!-- STEP 3: PHYSICAL & OBSTETRIC VITALS -->
              @if (currentStep() === 3) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 3</span>
                    <h3>Physical & Obstetric Vitals</h3>
                    <p>Record maternal physical parameters, fundal height, and fetal heart sounds.</p>
                  </div>

                  <div class="form-row-4">
                    <div class="form-field">
                      <label>Blood Pressure (mmHg) <span class="req">*</span></label>
                      <input type="text" [(ngModel)]="formBp" name="formBp" placeholder="110/70" required />
                    </div>

                    <div class="form-field">
                      <label>Maternal Weight (kg) <span class="req">*</span></label>
                      <input type="number" step="0.1" [(ngModel)]="formWeightKg" name="formWeightKg" placeholder="58.5" required />
                    </div>

                    <div class="form-field">
                      <label>Fundal Height (cm)</label>
                      <input type="number" [(ngModel)]="formFundalHeightCm" name="formFundalHeightCm" placeholder="24" />
                    </div>

                    <div class="form-field">
                      <label>Fetal Heart Rate (bpm)</label>
                      <input type="number" [(ngModel)]="formFhr" name="formFhr" placeholder="140" />
                    </div>
                  </div>

                  <div class="form-row-3" style="margin-top: 14px;">
                    <div class="form-field">
                      <label>Fetal Presentation / Lie</label>
                      <select [(ngModel)]="formFetalPresentation" name="formFetalPresentation">
                        <option value="Cephalic">Cephalic (Head-down)</option>
                        <option value="Breech">Breech</option>
                        <option value="Transverse">Transverse</option>
                        <option value="Not palpable / Early">Not palpable / Early</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Fetal Movement</label>
                      <select [(ngModel)]="formFetalMovement" name="formFetalMovement">
                        <option value="Active / Good">Active / Good</option>
                        <option value="Decreased">Decreased</option>
                        <option value="Not yet felt (<18w)">Not yet felt (&lt;18w)</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Edema / Swelling</label>
                      <select [(ngModel)]="formEdema" name="formEdema">
                        <option value="None">None</option>
                        <option value="Mild (Feet/Ankles)">Mild (Feet/Ankles)</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Severe / Generalized">Severe / Generalized</option>
                      </select>
                    </div>
                  </div>

                  <div class="vitals-reference-pill">
                    <span>Clinical Reference: Normal Fetal Heart Rate is <strong>110 – 160 bpm</strong> · Normal BP &lt; <strong>120/80 mmHg</strong></span>
                  </div>
                </div>
              }

              <!-- STEP 4: URINALYSIS & PRESCRIBED SUPPLEMENTS -->
              @if (currentStep() === 4) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 4</span>
                    <h3>Urinalysis & Prescribed Prenatal Supplements</h3>
                    <p>Screen for proteinuria or glycosuria, log hemoglobin, and record micronutrient supplementation.</p>
                  </div>

                  <div class="form-row-3">
                    <div class="form-field">
                      <label>Urine Protein (Albumin)</label>
                      <select [(ngModel)]="formUrineProtein" name="formUrineProtein">
                        <option value="Negative">Negative</option>
                        <option value="Trace">Trace</option>
                        <option value="+1">+1</option>
                        <option value="+2">+2 (Requires monitoring)</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Urine Glucose</label>
                      <select [(ngModel)]="formUrineGlucose" name="formUrineGlucose">
                        <option value="Negative">Negative</option>
                        <option value="+1">+1</option>
                        <option value="+2">+2</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Hemoglobin (g/dL)</label>
                      <input type="text" [(ngModel)]="formHemoglobin" name="formHemoglobin" placeholder="12.0 g/dL" />
                    </div>
                  </div>

                  <div class="supplements-checks-wrap" style="margin-top: 14px;">
                    <span class="supp-label">Supplements / Vaccines Administered This Visit:</span>
                    <div class="checks-grid">
                      <label class="check-box-item">
                        <input type="checkbox" [(ngModel)]="suppFeFolate" name="suppFeFolate" />
                        <span>Ferrous Sulfate + Folic Acid</span>
                      </label>
                      <label class="check-box-item">
                        <input type="checkbox" [(ngModel)]="suppCalcium" name="suppCalcium" />
                        <span>Calcium Carbonate</span>
                      </label>
                      <label class="check-box-item">
                        <input type="checkbox" [(ngModel)]="suppTetanus" name="suppTetanus" />
                        <span>Tetanus Toxoid (TT) Immunization</span>
                      </label>
                    </div>
                  </div>
                </div>
              }

              <!-- STEP 5: CLINICAL FINDINGS & MIDWIFE SIGN-OFF -->
              @if (currentStep() === 5) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 5</span>
                    <h3>Clinical Findings & Next Appointment</h3>
                    <p>Document patient dietary advice, complaints, next scheduled visit, and midwife validation.</p>
                  </div>

                  <!-- Quick Clinical Summary Card -->
                  <div class="wizard-summary-card">
                    <div class="summary-head">
                      <strong>Checkup Record Summary</strong>
                      <span class="summary-patient">{{ selectedPatientObj()?.fullName || 'Selected Patient' }}</span>
                    </div>
                    <div class="summary-grid">
                      <div class="summary-item">
                        <span class="sum-lbl">Gestational Timeline</span>
                        <strong class="sum-val">{{ formGestationalAge }} ({{ formTrimester }})</strong>
                      </div>
                      <div class="summary-item">
                        <span class="sum-lbl">Risk Classification</span>
                        <span class="badge-risk inline-risk" [ngClass]="'risk-' + getRiskSlug(formRiskLevel)">{{ formRiskLevel }}</span>
                      </div>
                      <div class="summary-item">
                        <span class="sum-lbl">Vitals</span>
                        <strong class="sum-val">BP {{ formBp }} · {{ formWeightKg }} kg · FHR {{ formFhr }} bpm</strong>
                      </div>
                      <div class="summary-item">
                        <span class="sum-lbl">Urinalysis</span>
                        <strong class="sum-val">Protein: {{ formUrineProtein }} · Glucose: {{ formUrineGlucose }}</strong>
                      </div>
                    </div>
                  </div>

                  <div class="form-field" style="margin-top: 10px;">
                    <label>Clinical Notes / Patient Complaints / Dietary Advice</label>
                    <textarea [(ngModel)]="formNotes" name="formNotes" rows="2" style="height: 52px; min-height: 48px; resize: vertical;" placeholder="e.g. Normal maternal progression. Healthy fetal heart tones. Advised on kick counts and hydration."></textarea>
                  </div>

                  <div class="form-row-2" style="margin-top: 10px;">
                    <div class="form-field">
                      <label>Next Follow-Up Date</label>
                      <input type="date" [(ngModel)]="formNextDate" name="formNextDate" />
                    </div>

                    <div class="form-field">
                      <label>Attending Midwife <span class="req">*</span></label>
                      <input type="text" [(ngModel)]="formMidwife" name="formMidwife" required />
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Wizard Footer Navigation -->
            <div class="modal-footer wizard-footer">
              <div class="footer-left">
                <button type="button" class="btn-cancel" (click)="closeAddModal()">Cancel</button>
              </div>

              <div class="footer-right">
                @if (currentStep() > 1) {
                  <button type="button" class="btn-wizard-prev" (click)="prevStep()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
                    Previous
                  </button>
                }

                @if (currentStep() < 5) {
                  <button type="button" class="btn-wizard-next" (click)="nextStep()">
                    Next Step
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                } @else {
                  <button type="button" class="btn-submit" (click)="submitPrenatalRecord()" [disabled]="saving()">
                    {{ saving() ? 'Saving Visit Record...' : 'Save Prenatal Record' }}
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ==================== VIEW RECORD DETAIL MODAL ==================== -->
      @if (viewingRecord(); as r) {
        <div class="modal-backdrop" (click)="viewingRecord.set(null)">
          <div class="modal-dialog-card modal-view" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-row">
                <div class="modal-icon tone-purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div>
                  <h2>Clinical Prenatal Record Summary</h2>
                  <p class="modal-subtitle">Patient: <strong>{{ r.patientName }}</strong> · Date: {{ r.date | date: 'fullDate' }}</p>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="viewingRecord.set(null)">✕</button>
            </div>

            <div class="view-sheet-body">
              <div class="sheet-kpi-banner">
                <div class="sheet-kpi-item">
                  <span>Gestational Age</span>
                  <strong>{{ r.gestationalAge }}</strong>
                  <small>{{ r.trimester }}</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>Blood Pressure</span>
                  <strong>{{ r.bp }} mmHg</strong>
                  <small>Weight: {{ r.weightKg }} kg</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>Fundal Height</span>
                  <strong>{{ r.fundalHeightCm }} cm</strong>
                  <small>Lie: {{ r.fetalPresentation }}</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>Fetal Heart Rate</span>
                  <strong>{{ r.fetalHeartRateBpm }} bpm</strong>
                  <small>{{ r.fetalMovement }}</small>
                </div>
              </div>

              <div class="sheet-detail-grid">
                <div class="sheet-col">
                  <h4>Clinical Vitals & Triage</h4>
                  <ul class="detail-list">
                    <li><span>Risk Level:</span> <strong>{{ r.riskLevel }}</strong></li>
                    <li><span>Urine Protein:</span> <strong>{{ r.urinalysisProtein }}</strong></li>
                    <li><span>Urine Glucose:</span> <strong>{{ r.urinalysisGlucose }}</strong></li>
                    <li><span>Hemoglobin:</span> <strong>{{ r.hemoglobin || 'Normal' }}</strong></li>
                    <li><span>Edema:</span> <strong>{{ r.edema }}</strong></li>
                  </ul>
                </div>

                <div class="sheet-col">
                  <h4>Medications & Care Instructions</h4>
                  <div class="supplements-tags">
                    @for (s of r.supplementsGiven; track s) {
                      <span class="supp-tag">✓ {{ s }}</span>
                    }
                  </div>
                  @if (r.nextFollowUpDate) {
                    <p style="margin-top:12px; font-size:12.5px; color:#271442;">
                      <strong>Next Scheduled Visit:</strong> {{ r.nextFollowUpDate | date: 'longDate' }}
                    </p>
                  }
                </div>
              </div>

              <div class="sheet-notes-box">
                <h4>Midwife Clinical Notes & Recommendations</h4>
                <p>{{ r.complaintsRiskNotes || 'No specific maternal complaints reported. Vitals within expected clinical ranges.' }}</p>
                <div class="sheet-midwife-sign">
                  Attending Midwife: <strong>{{ r.attendingMidwife }}</strong>
                </div>
              </div>

              <div class="modal-footer" style="margin-top: 18px;">
                <button type="button" class="btn-cancel" (click)="viewingRecord.set(null)">Close</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .records-page-wrap {
      padding: 24px;
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .records-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .records-header-row h1 {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 800;
      color: #271442;
    }

    .header-sub {
      margin: 0;
      font-size: 13.5px;
      color: #7a7189;
      max-width: 650px;
      line-height: 1.45;
    }

    .btn-primary-action {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #361759;
      color: #ffffff;
      padding: 9px 20px;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
      transition: all 0.15s;
    }

    .btn-primary-action:hover {
      background: #4a2179;
      transform: translateY(-1px);
    }

    .btn-primary-action svg { width: 15px; height: 15px; }

    .feedback-toast {
      background: #e6f7f3;
      border: 1px solid #99e6d4;
      color: #0b6b58;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .feedback-toast svg { width: 16px; height: 16px; }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 12px;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.03);
    }

    .kpi-icon-pill {
      width: 44px;
      height: 44px;
      border-radius: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kpi-icon-pill.tone-purple { background: #f3effa; color: #361759; }
    .kpi-icon-pill.tone-teal { background: #e6f7f3; color: #0d8a72; }
    .kpi-icon-pill.tone-amber { background: #fff4e5; color: #b76e00; }
    .kpi-icon-pill.tone-coral { background: #fee2e2; color: #b91c1c; }

    .kpi-icon-pill svg { width: 22px; height: 22px; }

    .kpi-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }

    .kpi-tag {
      font-size: 11px;
      font-weight: 600;
      color: #7a7189;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .kpi-number {
      font-size: 19px;
      font-weight: 800;
      color: #271442;
      margin-top: 2px;
    }

    .kpi-subtext {
      font-size: 11.5px;
      color: #928a9f;
      margin-top: 1px;
    }

    /* Filters Row */
    .filter-controls-row {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-input-wrap {
      flex: 1;
      min-width: 260px;
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-input-wrap svg {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: #7a7189;
    }

    .search-input-wrap input {
      width: 100%;
      padding: 9px 12px 9px 36px;
      border: 1px solid #dcd1ed;
      border-radius: 999px;
      font-size: 13px;
      background: #ffffff;
      outline: none;
    }

    .search-input-wrap input:focus {
      border-color: #361759;
      box-shadow: 0 0 0 3px rgba(54, 23, 89, 0.08);
    }

    .filter-selects-group {
      display: flex;
      gap: 8px;
    }

    .filter-selects-group select {
      padding: 8px 14px;
      border: 1px solid #dcd1ed;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      background: #ffffff;
      color: #361759;
      outline: none;
      cursor: pointer;
    }

    /* Table & Cards */
    .table-container-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      overflow-x: auto;
      box-shadow: 0 2px 10px rgba(54, 23, 89, 0.03);
    }

    .clinical-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    .clinical-table th {
      background: #fbf9fd;
      padding: 12px 16px;
      font-size: 11.5px;
      font-weight: 700;
      color: #55476d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #ece4f5;
    }

    .clinical-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f4effb;
      vertical-align: middle;
      color: #271442;
    }

    .clinical-table tr:hover {
      background: #faf7fd;
    }

    .sub-label {
      font-size: 11.5px;
      color: #7a7189;
      margin-top: 2px;
    }

    .patient-name-cell {
      color: #361759;
      font-size: 13.5px;
    }

    .ga-badge {
      display: inline-block;
      padding: 3px 8px;
      background: #f3effa;
      color: #361759;
      font-weight: 700;
      border-radius: 6px;
      font-size: 11.5px;
    }

    .risk-badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }

    .risk-low-risk { background: #e6f7f3; color: #0d8a72; }
    .risk-medium-risk { background: #fff4e5; color: #b76e00; }
    .risk-high-risk { background: #fee2e2; color: #b91c1c; }

    .row-actions-group {
      display: inline-flex;
      gap: 6px;
    }

    .btn-row-action {
      background: #f7f3fb;
      border: 1px solid #e1d6ef;
      color: #361759;
      border-radius: 8px;
      padding: 6px 9px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .btn-row-action:hover {
      background: #ede6f7;
    }

    .btn-row-action.btn-danger {
      color: #c92a42;
      border-color: #fecdd3;
      background: #fff5f5;
    }

    .btn-row-action.btn-danger:hover {
      background: #fee2e2;
    }

    .btn-row-action svg { width: 14px; height: 14px; }

    /* Empty & Loading States */
    .empty-records-card, .loading-state-card {
      background: #ffffff;
      border: 1.5px dashed #dcd1ed;
      border-radius: 14px;
      padding: 48px 20px;
      text-align: center;
    }

    .empty-icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #f4effb;
      color: #361759;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 14px;
    }

    .empty-icon-wrap svg { width: 28px; height: 28px; }

    .empty-records-card h3 {
      margin: 0 0 6px;
      color: #271442;
      font-size: 17px;
    }

    .empty-records-card p {
      margin: 0;
      color: #7a7189;
      font-size: 13px;
    }

    /* Modal Styles */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(39, 20, 66, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1050;
      padding: 20px;
    }

    .modal-dialog-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 48px rgba(39, 20, 66, 0.2);
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-dialog-card.modal-lg { max-width: 820px; }

    @keyframes modalPop {
      0% { opacity: 0; transform: scale(0.96); }
      100% { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid #ebe5f5;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fbf9fd;
    }

    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-icon.tone-purple { background: #f3effa; color: #361759; }
    .modal-icon svg { width: 20px; height: 20px; }

    .modal-title-row h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      color: #271442;
    }

    .modal-subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #7a7189;
    }

    .btn-close-modal {
      background: none;
      border: none;
      font-size: 18px;
      color: #7a7189;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
    }

    .btn-close-modal:hover { background: #ede7f6; color: #271442; }

    .modal-body-scroll {
      padding: 22px 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-section-title {
      font-size: 12px;
      font-weight: 800;
      color: #361759;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #ebe5f5;
      padding-bottom: 4px;
      margin-top: 6px;
    }

    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .form-row-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .form-field label {
      font-size: 12px;
      font-weight: 700;
      color: #361759;
    }

    .req { color: #c92a42; }

    .form-field input, .form-field select, .form-field textarea {
      padding: 9px 12px;
      border: 1px solid #dcd1ed;
      border-radius: 8px;
      font-size: 13px;
      color: #271442;
      background: #ffffff;
      outline: none;
    }

    .form-field input:focus, .form-field select:focus, .form-field textarea:focus {
      border-color: #361759;
      box-shadow: 0 0 0 3px rgba(54, 23, 89, 0.08);
    }

    .supplements-checks-wrap {
      background: #fbf9fd;
      border: 1px solid #ece4f5;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .supp-label {
      font-size: 12px;
      font-weight: 700;
      color: #361759;
    }

    .checks-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }

    .check-box-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: #271442;
      cursor: pointer;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 14px;
      border-top: 1px solid #ebe5f5;
    }

    .btn-cancel {
      padding: 9px 18px;
      background: #f4effb;
      color: #361759;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-submit {
      padding: 9px 22px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    /* ==================== WIZARD STEPPER STYLES ==================== */
    .wizard-modal-card {
      max-width: 860px !important;
      width: 100%;
      display: flex;
      flex-direction: column;
      max-height: 92vh;
      overflow: hidden;
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

    .step-alert-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 8px;
      padding: 9px 12px;
      color: #be123c;
      font-size: 12.5px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .step-alert-banner svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
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

    .patient-select-hint {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f7f3fb;
      border: 1px dashed #d8cde9;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 12.5px;
      color: #6b5c82;
      margin-top: 14px;
    }

    .patient-select-hint svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: #6b4fa3;
    }

    .clinical-info-callout {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #fdfaf5;
      border: 1px solid #fae8cc;
      border-radius: 10px;
      padding: 12px 14px;
      margin-top: 16px;
    }

    .callout-icon {
      font-size: 18px;
      line-height: 1;
    }

    .callout-body strong {
      display: block;
      font-size: 12.5px;
      color: #78350f;
      font-weight: 700;
    }

    .callout-body p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #92400e;
      line-height: 1.4;
    }

    .vitals-reference-pill {
      background: #f4effa;
      border-radius: 8px;
      padding: 9px 13px;
      font-size: 12px;
      color: #4a287c;
      margin-top: 14px;
      border: 1px solid #e7ddf2;
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

    .summary-patient {
      font-size: 12px;
      font-weight: 700;
      color: #361759;
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
      background: #4a2178;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(54, 23, 89, 0.35);
    }

    .btn-wizard-next svg {
      width: 14px;
      height: 14px;
    }

    @media (max-width: 680px) {
      .step-title-text, .step-num-text {
        display: none;
      }
      .wizard-footer {
        flex-direction: column-reverse;
        gap: 12px;
        align-items: stretch;
      }
      .footer-left, .footer-center, .footer-right {
        justify-content: center;
      }
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }

    /* View Summary Sheet */
    .view-sheet-body {
      padding: 22px 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .sheet-kpi-banner {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #fbf9fd;
      border: 1px solid #ece4f5;
      border-radius: 12px;
      padding: 14px;
    }

    .sheet-kpi-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sheet-kpi-item span { font-size: 11px; color: #7a7189; text-transform: uppercase; font-weight: 600; }
    .sheet-kpi-item strong { font-size: 16px; color: #361759; font-weight: 800; }
    .sheet-kpi-item small { font-size: 11.5px; color: #0d8a72; font-weight: 600; }

    .sheet-detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .sheet-col h4 {
      margin: 0 0 10px;
      font-size: 13px;
      color: #361759;
      border-bottom: 1px solid #ebe5f5;
      padding-bottom: 4px;
    }

    .detail-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 7px;
      font-size: 12.5px;
    }

    .detail-list li {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed #f0eaf7;
      padding-bottom: 4px;
    }

    .detail-list li span { color: #7a7189; }
    .detail-list li strong { color: #271442; }

    .supplements-tags {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .supp-tag {
      background: #e6f7f3;
      color: #0b6b58;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .sheet-notes-box {
      background: #faf8fc;
      border: 1px solid #e5dbee;
      border-radius: 10px;
      padding: 14px;
    }

    .sheet-notes-box h4 {
      margin: 0 0 6px;
      font-size: 12.5px;
      color: #361759;
    }

    .sheet-notes-box p {
      margin: 0 0 12px;
      font-size: 13px;
      color: #4a3a60;
      line-height: 1.45;
    }

    .sheet-midwife-sign {
      font-size: 12px;
      color: #7a7189;
      border-top: 1px dashed #ded4ea;
      padding-top: 8px;
    }

    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: 1fr 1fr; }
      .form-row-2, .form-row-3, .form-row-4, .sheet-detail-grid, .sheet-kpi-banner { grid-template-columns: 1fr; }
    }
  `],
})
export class PrenatalRecords implements OnInit {
  private readonly recordsSvc = inject(RecordsService);
  private readonly patientsSvc = inject(PatientsService);
  private readonly auth = inject(AuthService);

  readonly records = signal<PrenatalRecord[]>([]);
  readonly patients = signal<Patient[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly actionFeedback = signal('');

  // Filter signals
  readonly searchQuery = signal('');
  readonly filterTrimester = signal('All');
  readonly filterRisk = signal('All');

  // Modal signals
  readonly showAddModal = signal(false);
  readonly viewingRecord = signal<PrenatalRecord | null>(null);

  // Wizard state
  readonly currentStep = signal(1);
  readonly stepError = signal('');

  readonly steps = [
    { num: 1, title: 'Patient & Date' },
    { num: 2, title: 'Gestation' },
    { num: 3, title: 'Vitals' },
    { num: 4, title: 'Urinalysis' },
    { num: 5, title: 'Sign-off' },
  ];

  readonly selectedPatientObj = computed(() => {
    return this.patients().find((p) => p.id === this.formPatientId) || null;
  });

  // Add Form Model
  formPatientId = '';
  formDate = new Date().toISOString().split('T')[0];
  formGestationalAge = '24 weeks';
  formTrimester: '1st Trimester' | '2nd Trimester' | '3rd Trimester' = '2nd Trimester';
  formRiskLevel: 'Low risk' | 'Medium risk' | 'High risk' = 'Low risk';
  formBp = '110/70';
  formWeightKg = 58;
  formFundalHeightCm = 24;
  formFhr = 142;
  formFetalPresentation = 'Cephalic';
  formFetalMovement = 'Active / Good';
  formEdema = 'None';
  formUrineProtein = 'Negative';
  formUrineGlucose = 'Negative';
  formHemoglobin = '12.0 g/dL';
  suppFeFolate = true;
  suppCalcium = true;
  suppTetanus = false;
  formNotes = '';
  formNextDate = '';
  formMidwife = '';

  // Computed filtered records
  readonly filteredRecords = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const trim = this.filterTrimester();
    const risk = this.filterRisk();

    return this.records().filter((r) => {
      const matchQ =
        !q ||
        r.patientName.toLowerCase().includes(q) ||
        r.attendingMidwife.toLowerCase().includes(q) ||
        (r.complaintsRiskNotes || '').toLowerCase().includes(q);

      const matchTrim = trim === 'All' || r.trimester === trim;
      const matchRisk = risk === 'All' || r.riskLevel === risk;

      return matchQ && matchTrim && matchRisk;
    });
  });

  readonly countEarlyTrimester = computed(() =>
    this.records().filter((r) => r.trimester === '1st Trimester' || r.trimester === '2nd Trimester').length,
  );

  readonly countThirdTrimester = computed(() =>
    this.records().filter((r) => r.trimester === '3rd Trimester').length,
  );

  readonly countHighRisk = computed(() =>
    this.records().filter((r) => r.riskLevel === 'High risk').length,
  );

  async ngOnInit(): Promise<void> {
    this.refreshAttendingMidwife();
    await this.loadAll();
  }

  private refreshAttendingMidwife(): void {
    const name = this.auth.userFullName();
    if (name && name !== 'Midwife') {
      this.formMidwife = name.toLowerCase().startsWith('midwife') ? `${name}, RM` : `Midwife ${name}, RM`;
    } else {
      this.formMidwife = 'Licensed Midwife, RM';
    }
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [recs, pts] = await Promise.all([this.recordsSvc.listPrenatal(), this.patientsSvc.list()]);
      this.records.set(recs);
      this.patients.set(pts);
    } catch {
      // ignore
    } finally {
      this.loading.set(false);
    }
  }

  onPatientSelect(): void {
    const p = this.patients().find((x) => x.id === this.formPatientId);
    if (!p) return;

    if (p.riskLevel) {
      this.formRiskLevel = p.riskLevel;
    }

    // Auto-calculate gestational week from LMP or EDD if available
    if (p.lmp) {
      const diffMs = Date.now() - new Date(p.lmp).getTime();
      const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      if (weeks >= 1 && weeks <= 42) {
        this.formGestationalAge = `${weeks} weeks`;
        this.updateTrimesterFromWeeks(weeks);
        this.formFundalHeightCm = Math.max(12, weeks);
      }
    } else if (p.edd) {
      const eddMs = new Date(p.edd).getTime();
      const remainingMs = eddMs - Date.now();
      const remainingWeeks = Math.floor(remainingMs / (7 * 24 * 60 * 60 * 1000));
      const currentWeek = 40 - remainingWeeks;
      if (currentWeek >= 1 && currentWeek <= 42) {
        this.formGestationalAge = `${currentWeek} weeks`;
        this.updateTrimesterFromWeeks(currentWeek);
        this.formFundalHeightCm = Math.max(12, currentWeek);
      }
    }
  }

  private updateTrimesterFromWeeks(w: number): void {
    if (w <= 13) this.formTrimester = '1st Trimester';
    else if (w <= 27) this.formTrimester = '2nd Trimester';
    else this.formTrimester = '3rd Trimester';
  }

  validateCurrentStep(): boolean {
    this.stepError.set('');
    const step = this.currentStep();

    if (step === 1) {
      if (!this.formPatientId) {
        this.stepError.set('Please select a registered patient from the directory.');
        return false;
      }
      if (!this.formDate) {
        this.stepError.set('Please enter a valid visit date.');
        return false;
      }
    } else if (step === 2) {
      if (!this.formGestationalAge || !this.formGestationalAge.trim()) {
        this.stepError.set('Please enter gestational age (e.g. 24 weeks).');
        return false;
      }
    } else if (step === 3) {
      if (!this.formBp || !this.formBp.trim()) {
        this.stepError.set('Please enter maternal blood pressure (e.g. 110/70).');
        return false;
      }
      if (!this.formWeightKg || Number(this.formWeightKg) <= 0) {
        this.stepError.set('Please enter a valid maternal weight in kg.');
        return false;
      }
    } else if (step === 5) {
      if (!this.formMidwife || !this.formMidwife.trim()) {
        this.stepError.set('Please enter the attending midwife name.');
        return false;
      }
    }

    return true;
  }

  nextStep(): void {
    if (!this.validateCurrentStep()) return;
    if (this.currentStep() < 5) {
      this.currentStep.update((s) => s + 1);
      this.stepError.set('');
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
      this.stepError.set('');
    }
  }

  goToStep(stepNum: number): void {
    if (stepNum === this.currentStep()) return;
    if (stepNum < this.currentStep()) {
      this.currentStep.set(stepNum);
      this.stepError.set('');
    } else {
      if (this.validateCurrentStep()) {
        this.currentStep.set(stepNum);
        this.stepError.set('');
      }
    }
  }

  getInitials(name?: string): string {
    if (!name) return 'PT';
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  openAddModal(): void {
    this.currentStep.set(1);
    this.stepError.set('');
    this.formDate = new Date().toISOString().split('T')[0];
    const next = new Date();
    next.setDate(next.getDate() + 28);
    this.formNextDate = next.toISOString().split('T')[0];
    this.refreshAttendingMidwife();
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.currentStep.set(1);
    this.stepError.set('');
  }

  viewRecord(r: PrenatalRecord): void {
    this.viewingRecord.set(r);
  }

  async submitPrenatalRecord(): Promise<void> {
    if (!this.validateCurrentStep()) return;
    if (!this.formPatientId) {
      this.currentStep.set(1);
      this.stepError.set('Please select a patient.');
      return;
    }

    const patient = this.patients().find((p) => p.id === this.formPatientId);
    if (!patient) return;

    this.saving.set(true);
    try {
      const supps: string[] = [];
      if (this.suppFeFolate) supps.push('Ferrous Sulfate + Folic Acid');
      if (this.suppCalcium) supps.push('Calcium Carbonate');
      if (this.suppTetanus) supps.push('Tetanus Toxoid (TT)');

      const gaWeeksNum = parseInt(this.formGestationalAge, 10) || 24;

      await this.recordsSvc.addPrenatal({
        patientId: patient.id,
        patientName: patient.fullName,
        patientContact: patient.contactNumber || patient.email,
        date: this.formDate,
        gestationalAge: this.formGestationalAge,
        gestationalWeeksNum: gaWeeksNum,
        trimester: this.formTrimester,
        bp: this.formBp,
        weightKg: Number(this.formWeightKg) || 55,
        fundalHeightCm: Number(this.formFundalHeightCm) || 20,
        fetalHeartRateBpm: Number(this.formFhr) || 140,
        fetalPresentation: this.formFetalPresentation,
        fetalMovement: this.formFetalMovement,
        urinalysisProtein: this.formUrineProtein,
        urinalysisGlucose: this.formUrineGlucose,
        hemoglobin: this.formHemoglobin,
        edema: this.formEdema,
        riskLevel: this.formRiskLevel,
        supplementsGiven: supps,
        complaintsRiskNotes: this.formNotes,
        attendingMidwife: this.formMidwife,
        nextFollowUpDate: this.formNextDate,
      });

      this.closeAddModal();
      this.triggerToast('Prenatal visit record saved successfully and synced with patient portal!');
      await this.loadAll();
    } catch {
      alert('Error saving record. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteRecord(r: PrenatalRecord): Promise<void> {
    if (!r.id) return;
    if (!confirm(`Are you sure you want to delete prenatal record for ${r.patientName} dated ${r.date}?`)) return;

    try {
      await this.recordsSvc.deletePrenatal(r.id);
      this.triggerToast('Record deleted.');
      await this.loadAll();
    } catch {
      alert('Failed to delete record.');
    }
  }

  getRiskSlug(r?: string): string {
    return (r || 'low').toLowerCase().replace(/\s+/g, '-');
  }

  private triggerToast(msg: string): void {
    this.actionFeedback.set(msg);
    setTimeout(() => this.actionFeedback.set(''), 3500);
  }
}
