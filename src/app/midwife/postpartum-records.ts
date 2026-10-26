import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';
import { PostpartumRecord, RecordsService } from '../core/records.service';

@Component({
  selector: 'app-postpartum-records',
  imports: [DatePipe, FormsModule, NgClass],
  template: `
    <div class="records-page-wrap">
      <!-- ============ TOP HEADER ============ -->
      <div class="records-header-row">
        <div>
          <h1>Postpartum Care & Maternal Recovery Records</h1>
          <p class="header-sub">
            Track uterine involution, lochia progress, perineum healing, lactation support, maternal mental health, and newborn follow-up.
          </p>
        </div>

        <div class="header-action-group">
          <button type="button" class="btn-primary-action" (click)="openAddModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Record Postpartum Visit
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
            placeholder="Search mother's name, attending midwife, or notes..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>

        <div class="filter-selects-group">
          <select [ngModel]="filterStage()" (ngModelChange)="filterStage.set($event)">
            <option value="All">All Postpartum Stages</option>
            <option value="24 Hours Post-delivery">24 Hours Immediate</option>
            <option value="Day 3 - 7 (1st Week)">Day 3 - 7 (1st Week)</option>
            <option value="Week 2 Checkup">Week 2 Checkup</option>
            <option value="Week 6 Postnatal Visit">Week 6 Final Visit</option>
          </select>
        </div>
      </div>

      <!-- ============ RECORDS TABLE & LIST ============ -->
      @if (loading()) {
        <div class="loading-state-card">
          <p>Loading postpartum care records...</p>
        </div>
      } @else if (filteredRecords().length === 0) {
        <div class="empty-records-card">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h3>No Postpartum Visit Records Logged</h3>
          <p>Document postnatal visits, uterine involution, lactation support, and family planning.</p>
          <button type="button" class="btn-primary-action" (click)="openAddModal()" style="margin-top: 10px;">
            Record Postpartum Visit
          </button>
        </div>
      } @else {
        <div class="table-container-card">
          <table class="clinical-table">
            <thead>
              <tr>
                <th>Visit Date & Stage</th>
                <th>Mother's Name</th>
                <th>Maternal Vitals</th>
                <th>Uterine & Lochia</th>
                <th>Perineum Healing</th>
                <th>Lactation & Feeding</th>
                <th>Newborn Progress</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredRecords(); track r.id) {
                <tr>
                  <td>
                    <strong>{{ r.visitDate | date: 'MMM d, y' }}</strong>
                    <div class="sub-label"><span class="stage-tag">{{ r.visitStage }}</span></div>
                  </td>
                  <td>
                    <strong class="patient-name-cell">{{ r.patientName }}</strong>
                    <div class="sub-label">Midwife: {{ r.attendingMidwife }}</div>
                  </td>
                  <td>
                    <strong>{{ r.maternalBp }}</strong>
                    <div class="sub-label">{{ r.maternalTemp }} · {{ r.maternalPulse }}</div>
                  </td>
                  <td>
                    <div>{{ r.fundalFirmness }}</div>
                    <div class="sub-label">{{ r.lochiaType }} ({{ r.lochiaAmount }})</div>
                  </td>
                  <td>
                    <span class="healing-pill">{{ r.perineumHealing }}</span>
                  </td>
                  <td>
                    <div>{{ r.feedingMethod }}</div>
                    <div class="sub-label">{{ r.breastCondition }}</div>
                  </td>
                  <td>
                    <div><strong>{{ r.babyWeightKg }} kg</strong></div>
                    <div class="sub-label">Cord: {{ r.cordStumpStatus }}</div>
                  </td>
                  <td style="text-align: right;">
                    <div class="row-actions-group">
                      <button type="button" class="btn-row-action" (click)="viewRecord(r)" title="View Assessment">
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

      <!-- ==================== RECORD POSTPARTUM VISIT WIZARD MODAL ==================== -->
      @if (showAddModal()) {
        <div class="modal-backdrop" (click)="closeAddModal()">
          <div class="modal-dialog-card modal-lg wizard-modal-card" (click)="$event.stopPropagation()">
            <!-- Modal Header -->
            <div class="modal-header">
              <div class="modal-title-row">
                <div class="modal-icon tone-purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <h2>Record Postpartum Clinical Checkup</h2>
                  <p class="modal-subtitle">Document maternal involution, lochia, lactation, mental health, and newborn exam.</p>
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

              <!-- STEP 1: PATIENT IDENTIFICATION & VISIT TIMELINE -->
              @if (currentStep() === 1) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 1</span>
                    <h3>Patient Identification & Visit Timeline</h3>
                    <p>Select mother from registered patients and choose postpartum visit timing stage.</p>
                  </div>

                  <div class="form-row-3">
                    <div class="form-field">
                      <label>Select Postpartum Mother <span class="req">*</span></label>
                      <select [(ngModel)]="formPatientId" name="patientId" required>
                        <option value="" disabled>-- Choose mother from registered patients --</option>
                        @for (p of patients(); track p.id) {
                          <option [value]="p.id">{{ p.fullName }} ({{ p.status || 'Active' }})</option>
                        }
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Postpartum Visit Stage <span class="req">*</span></label>
                      <select [(ngModel)]="formVisitStage" name="formVisitStage" required>
                        <option value="24 Hours Post-delivery">24 Hours Post-delivery (Discharge)</option>
                        <option value="Day 3 - 7 (1st Week)">Day 3 - 7 (1st Week Follow-up)</option>
                        <option value="Week 2 Checkup">Week 2 Checkup</option>
                        <option value="Week 6 Postnatal Visit">Week 6 Postnatal Visit (Concluding)</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Visit Date <span class="req">*</span></label>
                      <input type="date" [(ngModel)]="formVisitDate" name="formVisitDate" required />
                    </div>
                  </div>

                  @if (selectedPatientObj(); as pt) {
                    <div class="patient-preview-card">
                      <div class="pt-avatar">{{ getInitials(pt.fullName) }}</div>
                      <div class="pt-info">
                        <div class="pt-title-row">
                          <strong class="pt-name">{{ pt.fullName }}</strong>
                          <span class="badge-status status-active">{{ pt.status || 'Postpartum' }}</span>
                          <span class="badge-risk" [ngClass]="'risk-' + getRiskSlug(pt.riskLevel)">{{ pt.riskLevel || 'Low risk' }}</span>
                        </div>
                        <div class="pt-meta-row">
                          <span>Phone: <strong>{{ pt.contactNumber || '—' }}</strong></span>
                          <span class="meta-dot">•</span>
                          <span>Email: <strong>{{ pt.email || '—' }}</strong></span>
                          <span class="meta-dot">•</span>
                          <span>Obstetric History: <strong>{{ pt.gravidaPara || 'G1P1' }}</strong></span>
                        </div>
                      </div>
                    </div>
                  } @else {
                    <div class="patient-select-hint">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      <span>Please select a registered mother above to verify postpartum records.</span>
                    </div>
                  }
                </div>
              }

              <!-- STEP 2: MATERNAL VITALS & UTERINE INVOLUTION -->
              @if (currentStep() === 2) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 2</span>
                    <h3>Maternal Vitals & Uterine Involution</h3>
                    <p>Record maternal vital signs, assess uterine firmness, and evaluate fundal descent.</p>
                  </div>

                  <div class="form-row-3">
                    <div class="form-field">
                      <label>Blood Pressure (mmHg) <span class="req">*</span></label>
                      <input type="text" [(ngModel)]="formBp" name="formBp" placeholder="110/70" required />
                    </div>

                    <div class="form-field">
                      <label>Temperature (°C)</label>
                      <input type="text" [(ngModel)]="formTemp" name="formTemp" placeholder="36.6 °C" />
                    </div>

                    <div class="form-field">
                      <label>Pulse Rate (bpm)</label>
                      <input type="text" [(ngModel)]="formPulse" name="formPulse" placeholder="78 bpm" />
                    </div>
                  </div>

                  <div class="form-row-2" style="margin-top: 14px;">
                    <div class="form-field">
                      <label>Fundal Firmness</label>
                      <select [(ngModel)]="formFundalFirmness" name="formFundalFirmness">
                        <option value="Firm and contracted">Firm and well-contracted (Normal)</option>
                        <option value="Moderately firm">Moderately firm</option>
                        <option value="Soft / Boggy">Soft / Boggy (Requires uterine massage)</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Fundal Position</label>
                      <input type="text" [(ngModel)]="formFundalPosition" name="formFundalPosition" placeholder="2 fingerbreadths below umbilicus" />
                    </div>
                  </div>

                  <div class="vitals-reference-pill">
                    <span>Clinical Reference: The fundus should descend by approximately <strong>1 cm (1 fingerbreadth)</strong> each day postpartum and feel firm.</span>
                  </div>
                </div>
              }

              <!-- STEP 3: LOCHIA CHARACTER & PERINEUM / WOUND HEALING -->
              @if (currentStep() === 3) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 3</span>
                    <h3>Lochia Character & Perineum / Wound Healing</h3>
                    <p>Inspect vaginal discharge characteristics and assess perineal laceration/episiotomy repair.</p>
                  </div>

                  <div class="form-row-3">
                    <div class="form-field">
                      <label>Lochia Type</label>
                      <select [(ngModel)]="formLochiaType" name="formLochiaType">
                        <option value="Lochia Rubra (Red)">Lochia Rubra (Dark red, Days 1-4)</option>
                        <option value="Lochia Serosa (Pink/Brown)">Lochia Serosa (Pinkish/brown, Days 4-10)</option>
                        <option value="Lochia Alba (Yellowish/White)">Lochia Alba (Creamy/white, Days 10+)</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Lochia Amount</label>
                      <select [(ngModel)]="formLochiaAmount" name="formLochiaAmount">
                        <option value="Scant">Scant (&lt;2.5 cm on pad)</option>
                        <option value="Light">Light (2.5 - 10 cm on pad)</option>
                        <option value="Moderate">Moderate (10 - 15 cm on pad)</option>
                        <option value="Heavy / Excessive">Heavy / Excessive (Soaking pad &lt;1h)</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Lochia Odor</label>
                      <select [(ngModel)]="formLochiaOdor" name="formLochiaOdor">
                        <option value="Normal / Fleshy">Normal / Fleshy (No infection)</option>
                        <option value="Foul-smelling">Foul-smelling (Sign of endometritis)</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-field" style="margin-top: 14px;">
                    <label>Perineum / Episiotomy Healing</label>
                    <select [(ngModel)]="formPerineumHealing" name="formPerineumHealing">
                      <option value="Intact / No tear">Intact / No tear</option>
                      <option value="Healing well / Sutures intact">Healing well / Sutures intact / Minimal tenderness</option>
                      <option value="Mild redness/edema">Mild redness or edema (Ice pack advised)</option>
                      <option value="Infection signs">Infection signs (Dehiscence / Purulent discharge)</option>
                    </select>
                  </div>

                  <div class="vitals-reference-pill">
                    <span>Clinical Reference: Check for redness, edema, ecchymosis, discharge, and approximation (REEDA scale). Foul odor indicates possible endometritis.</span>
                  </div>
                </div>
              }

              <!-- STEP 4: LACTATION & NEWBORN EXAMINATION -->
              @if (currentStep() === 4) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 4</span>
                    <h3>Lactation, Maternal Wellness & Newborn Assessment</h3>
                    <p>Evaluate breastfeeding establishment, maternal mental state, family planning counseling, and infant exam.</p>
                  </div>

                  <div class="form-row-3">
                    <div class="form-field">
                      <label>Breast Condition</label>
                      <select [(ngModel)]="formBreastCondition" name="formBreastCondition">
                        <option value="Soft, colostrum present">Soft, colostrum present</option>
                        <option value="Mature milk flowing">Mature milk flowing / Full</option>
                        <option value="Engorged">Engorged (Warm compress advised)</option>
                        <option value="Cracked nipples">Cracked / Sore nipples</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Infant Feeding Method</label>
                      <select [(ngModel)]="formFeedingMethod" name="formFeedingMethod">
                        <option value="Exclusive Breastfeeding">Exclusive Breastfeeding (Recommended)</option>
                        <option value="Mixed Feeding">Mixed Feeding (Breast + Formula)</option>
                        <option value="Formula Feeding">Formula Feeding</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Maternal Mental State</label>
                      <select [(ngModel)]="formMaternalMentalState" name="formMaternalMentalState">
                        <option value="Positive & bonding well">Positive & bonding well with baby</option>
                        <option value="Mild baby blues / Fatigued">Mild baby blues / Sleep-deprived</option>
                        <option value="Severe anxiety / Needs evaluation">Severe anxiety / Postpartum depression risk</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-field" style="margin-top: 14px;">
                    <label>Family Planning / Contraception Counseling</label>
                    <input type="text" [(ngModel)]="formFpCounseling" name="formFpCounseling" placeholder="e.g. Lactational Amenorrhea Method (LAM) explained; Progestin-only pills (POPs) prescribed." />
                  </div>

                  <div class="form-section-title" style="margin-top: 14px;">Newborn Follow-up Measurements</div>
                  <div class="form-row-3">
                    <div class="form-field">
                      <label>Newborn Weight (kg)</label>
                      <input type="number" step="0.01" [(ngModel)]="formBabyWeightKg" name="formBabyWeightKg" placeholder="3.4" />
                    </div>

                    <div class="form-field">
                      <label>Umbilical Cord Stump</label>
                      <select [(ngModel)]="formCordStumpStatus" name="formCordStumpStatus">
                        <option value="Clean & dry">Clean & dry, no redness</option>
                        <option value="Sloughed off completely">Sloughed off completely (Healed)</option>
                        <option value="Moist / Red">Moist / Slight redness (Clean with alcohol)</option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label>Jaundice Assessment</label>
                      <select [(ngModel)]="formJaundiceStatus" name="formJaundiceStatus">
                        <option value="None">None (Pinkish tone)</option>
                        <option value="Mild facial jaundice">Mild facial jaundice (Physiological)</option>
                        <option value="Moderate">Moderate (Advised sun exposure/monitor)</option>
                        <option value="Referred to pediatrician">Referred to pediatrician for phototherapy</option>
                      </select>
                    </div>
                  </div>
                </div>
              }

              <!-- STEP 5: ATTENDING MIDWIFE SIGN-OFF & SUMMARY -->
              @if (currentStep() === 5) {
                <div class="wizard-step-pane">
                  <div class="step-header-intro">
                    <span class="step-badge">Section 5</span>
                    <h3>Clinical Notes, Follow-up & Attending Midwife Sign-off</h3>
                    <p>Review checkup summary, provide home recovery instructions, and log attending practitioner.</p>
                  </div>

                  <!-- Quick Postpartum Summary Card -->
                  <div class="wizard-summary-card">
                    <div class="summary-head">
                      <strong>Postpartum Checkup Summary</strong>
                      <span class="summary-patient">{{ selectedPatientObj()?.fullName || 'Mother Selected' }}</span>
                    </div>
                    <div class="summary-grid">
                      <div class="summary-item">
                        <span class="sum-lbl">Visit Stage</span>
                        <strong class="sum-val">{{ formVisitStage }}</strong>
                      </div>
                      <div class="summary-item">
                        <span class="sum-lbl">Maternal Vitals</span>
                        <strong class="sum-val">BP {{ formBp }} · {{ formTemp }} · {{ formPulse }}</strong>
                      </div>
                      <div class="summary-item">
                        <span class="sum-lbl">Uterine & Lochia</span>
                        <strong class="sum-val">{{ formFundalFirmness }} · {{ formLochiaType }}</strong>
                      </div>
                      <div class="summary-item">
                        <span class="sum-lbl">Feeding & Baby</span>
                        <strong class="sum-val">{{ formFeedingMethod }} · Baby {{ formBabyWeightKg }} kg</strong>
                      </div>
                    </div>
                  </div>

                  <div class="form-field" style="margin-top: 10px;">
                    <label>Clinical Notes & Recommendations</label>
                    <textarea [(ngModel)]="formNotes" name="formNotes" rows="2" style="height: 52px; min-height: 48px; resize: vertical;" placeholder="e.g. Mother recovering well. Uterus firm, lochia appropriate for day. Baby latches vigorously. Continue multivitamins and rest."></textarea>
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
                  <button type="button" class="btn-submit" (click)="submitPostpartumRecord()" [disabled]="saving()">
                    {{ saving() ? 'Saving Postpartum Record...' : 'Save Postpartum Record' }}
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ==================== VIEW SUMMARY MODAL ==================== -->
      @if (viewingRecord(); as r) {
        <div class="modal-backdrop" (click)="viewingRecord.set(null)">
          <div class="modal-dialog-card modal-view" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-row">
                <div class="modal-icon tone-purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <h2>Clinical Postpartum Visit Summary</h2>
                  <p class="modal-subtitle">Mother: <strong>{{ r.patientName }}</strong> · Stage: {{ r.visitStage }} ({{ r.visitDate | date: 'fullDate' }})</p>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="viewingRecord.set(null)">✕</button>
            </div>

            <div class="view-sheet-body">
              <div class="sheet-kpi-banner">
                <div class="sheet-kpi-item">
                  <span>Maternal Blood Pressure</span>
                  <strong>{{ r.maternalBp }}</strong>
                  <small>{{ r.maternalTemp }} · {{ r.maternalPulse }}</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>Uterine Fundus</span>
                  <strong>{{ r.fundalFirmness }}</strong>
                  <small>{{ r.fundalPosition }}</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>Lochia Progress</span>
                  <strong>{{ r.lochiaType }}</strong>
                  <small>{{ r.lochiaAmount }} · {{ r.lochiaOdor }}</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>Newborn Weight</span>
                  <strong>{{ r.babyWeightKg }} kg</strong>
                  <small>Cord: {{ r.cordStumpStatus }}</small>
                </div>
              </div>

              <div class="sheet-detail-grid">
                <div class="sheet-col">
                  <h4>Maternal Physical & Mental Recovery</h4>
                  <ul class="detail-list">
                    <li><span>Perineum Healing:</span> <strong>{{ r.perineumHealing }}</strong></li>
                    <li><span>Breast Condition:</span> <strong>{{ r.breastCondition }}</strong></li>
                    <li><span>Feeding Method:</span> <strong>{{ r.feedingMethod }}</strong></li>
                    <li><span>Maternal Mood:</span> <strong>{{ r.maternalMentalState }}</strong></li>
                    <li><span>Family Planning:</span> <strong>{{ r.familyPlanningCounseling || 'LAM Method' }}</strong></li>
                  </ul>
                </div>

                <div class="sheet-col">
                  <h4>Newborn Wellness & Checkup</h4>
                  <ul class="detail-list">
                    <li><span>Current Weight:</span> <strong>{{ r.babyWeightKg }} kg</strong></li>
                    <li><span>Umbilical Cord:</span> <strong>{{ r.cordStumpStatus }}</strong></li>
                    <li><span>Jaundice Status:</span> <strong>{{ r.jaundiceStatus }}</strong></li>
                    @if (r.nextFollowUpDate) {
                      <li style="margin-top: 8px;">
                        <span>Next Clinic Visit:</span>
                        <strong style="color: #361759;">{{ r.nextFollowUpDate | date: 'longDate' }}</strong>
                      </li>
                    }
                  </ul>
                </div>
              </div>

              <div class="sheet-notes-box">
                <h4>Midwife Clinical Notes & Homecare Advice</h4>
                <p>{{ r.clinicalNotes || 'Mother and baby progress normally. Advised on adequate hydration, nutritious meals, exclusive breastfeeding, and danger sign vigilance.' }}</p>
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
    .kpi-icon-pill.tone-green { background: #e9f8f3; color: #0f8564; }

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

    .clinical-table tr:hover { background: #faf7fd; }

    .sub-label {
      font-size: 11.5px;
      color: #7a7189;
      margin-top: 2px;
    }

    .patient-name-cell {
      color: #361759;
      font-size: 13.5px;
    }

    .stage-tag {
      display: inline-block;
      padding: 2px 7px;
      background: #f3effa;
      color: #361759;
      font-size: 11px;
      font-weight: 700;
      border-radius: 4px;
    }

    .healing-pill {
      display: inline-block;
      padding: 3px 8px;
      background: #e6f7f3;
      color: #0b6b58;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
    }

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

    .btn-row-action:hover { background: #ede6f7; }

    .btn-row-action.btn-danger {
      color: #c92a42;
      border-color: #fecdd3;
      background: #fff5f5;
    }

    .btn-row-action.btn-danger:hover { background: #fee2e2; }
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

    .badge-status {
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }

    .status-active {
      background: #e6f7f3;
      color: #0b6b58;
    }

    .badge-risk {
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: capitalize;
    }

    .risk-low {
      background: #e6f7f3;
      color: #0b6b58;
    }

    .risk-medium {
      background: #fef3c7;
      color: #92400e;
    }

    .risk-high {
      background: #fee2e2;
      color: #991b1b;
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
    .sheet-kpi-item strong { font-size: 15px; color: #361759; font-weight: 800; }
    .sheet-kpi-item small { font-size: 11px; color: #0d8a72; font-weight: 600; }

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
      .form-row-2, .form-row-3, .sheet-detail-grid, .sheet-kpi-banner { grid-template-columns: 1fr; }
    }
  `],
})
export class PostpartumRecords implements OnInit {
  private readonly recordsSvc = inject(RecordsService);
  private readonly patientsSvc = inject(PatientsService);
  private readonly auth = inject(AuthService);

  readonly records = signal<PostpartumRecord[]>([]);
  readonly patients = signal<Patient[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly actionFeedback = signal('');

  // Filters
  readonly searchQuery = signal('');
  readonly filterStage = signal('All');

  // Modals
  readonly showAddModal = signal(false);
  readonly viewingRecord = signal<PostpartumRecord | null>(null);

  // Wizard State
  readonly currentStep = signal(1);
  readonly stepError = signal('');
  readonly steps = [
    { num: 1, title: 'Patient & Stage' },
    { num: 2, title: 'Vitals & Uterus' },
    { num: 3, title: 'Lochia & Healing' },
    { num: 4, title: 'Lactation & Baby' },
    { num: 5, title: 'Sign-off & Notes' },
  ];

  readonly selectedPatientObj = computed(() => {
    const id = this.formPatientId;
    return this.patients().find((p) => p.id === id) || null;
  });

  // Form Fields
  formPatientId = '';
  formVisitStage: '24 Hours Post-delivery' | 'Day 3 - 7 (1st Week)' | 'Week 2 Checkup' | 'Week 6 Postnatal Visit' =
    '24 Hours Post-delivery';
  formVisitDate = new Date().toISOString().split('T')[0];
  formBp = '110/70';
  formTemp = '36.6 °C';
  formPulse = '76 bpm';
  formFundalFirmness: 'Firm and contracted' | 'Moderately firm' | 'Soft / Boggy' = 'Firm and contracted';
  formFundalPosition = '2 fingerbreadths below umbilicus';
  formLochiaType: 'Lochia Rubra (Red)' | 'Lochia Serosa (Pink/Brown)' | 'Lochia Alba (Yellowish/White)' =
    'Lochia Rubra (Red)';
  formLochiaAmount: 'Scant' | 'Light' | 'Moderate' | 'Heavy / Excessive' = 'Moderate';
  formLochiaOdor: 'Normal / Fleshy' | 'Foul-smelling' = 'Normal / Fleshy';
  formPerineumHealing: 'Intact / No tear' | 'Healing well / Sutures intact' | 'Mild redness/edema' | 'Infection signs' =
    'Healing well / Sutures intact';
  formBreastCondition: 'Soft, colostrum present' | 'Engorged' | 'Cracked nipples' | 'Mature milk flowing' =
    'Soft, colostrum present';
  formFeedingMethod: 'Exclusive Breastfeeding' | 'Mixed Feeding' | 'Formula Feeding' = 'Exclusive Breastfeeding';
  formMaternalMentalState: 'Positive & bonding well' | 'Mild baby blues / Fatigued' | 'Severe anxiety / Needs evaluation' =
    'Positive & bonding well';
  formFpCounseling = 'Lactational Amenorrhea Method (LAM) explained; advised on exclusive breastfeeding.';
  formBabyWeightKg = 3.2;
  formCordStumpStatus: 'Clean & dry' | 'Sloughed off completely' | 'Moist / Red' = 'Clean & dry';
  formJaundiceStatus: 'None' | 'Mild facial jaundice' | 'Moderate' | 'Referred to pediatrician' = 'None';
  formMidwife = '';
  formNotes = '';
  formNextDate = '';

  readonly filteredRecords = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const stage = this.filterStage();

    return this.records().filter((r) => {
      const matchQ =
        !q ||
        r.patientName.toLowerCase().includes(q) ||
        r.attendingMidwife.toLowerCase().includes(q) ||
        (r.clinicalNotes || '').toLowerCase().includes(q);

      const matchStage = stage === 'All' || r.visitStage === stage;
      return matchQ && matchStage;
    });
  });

  readonly countImmediate = computed(
    () => this.records().filter((r) => r.visitStage === '24 Hours Post-delivery').length,
  );

  readonly countWeekly = computed(
    () =>
      this.records().filter(
        (r) => r.visitStage === 'Day 3 - 7 (1st Week)' || r.visitStage === 'Week 2 Checkup',
      ).length,
  );

  readonly countSixWeek = computed(
    () => this.records().filter((r) => r.visitStage === 'Week 6 Postnatal Visit').length,
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
      const [recs, pts] = await Promise.all([this.recordsSvc.listPostpartum(), this.patientsSvc.list()]);
      this.records.set(recs);
      this.patients.set(pts);
    } catch {
      // ignore
    } finally {
      this.loading.set(false);
    }
  }

  getInitials(name?: string): string {
    if (!name) return 'PT';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getRiskSlug(risk?: string): string {
    const r = (risk || '').toLowerCase();
    if (r.includes('high')) return 'high';
    if (r.includes('med')) return 'medium';
    return 'low';
  }

  validateCurrentStep(): boolean {
    this.stepError.set('');
    const s = this.currentStep();
    if (s === 1) {
      if (!this.formPatientId) {
        this.stepError.set('Please select a registered postpartum mother to proceed.');
        return false;
      }
      if (!this.formVisitStage) {
        this.stepError.set('Please select the postpartum visit stage.');
        return false;
      }
      if (!this.formVisitDate) {
        this.stepError.set('Please enter the checkup visit date.');
        return false;
      }
    } else if (s === 2) {
      if (!this.formBp?.trim()) {
        this.stepError.set('Please enter the maternal blood pressure (e.g. 110/70).');
        return false;
      }
    } else if (s === 5) {
      if (!this.formMidwife?.trim()) {
        this.stepError.set('Please enter the attending midwife name.');
        return false;
      }
    }
    return true;
  }

  nextStep(): void {
    if (!this.validateCurrentStep()) return;
    if (this.currentStep() < this.steps.length) {
      this.currentStep.update((s) => s + 1);
    }
  }

  prevStep(): void {
    this.stepError.set('');
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
    }
  }

  goToStep(stepNum: number): void {
    if (stepNum === this.currentStep()) return;
    if (stepNum > this.currentStep()) {
      if (!this.validateCurrentStep()) return;
    }
    this.stepError.set('');
    this.currentStep.set(stepNum);
  }

  openAddModal(): void {
    this.refreshAttendingMidwife();
    this.currentStep.set(1);
    this.stepError.set('');
    this.formVisitDate = new Date().toISOString().split('T')[0];
    const next = new Date();
    next.setDate(next.getDate() + 7);
    this.formNextDate = next.toISOString().split('T')[0];
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  viewRecord(r: PostpartumRecord): void {
    this.viewingRecord.set(r);
  }

  async submitPostpartumRecord(): Promise<void> {
    if (!this.validateCurrentStep()) return;
    if (!this.formPatientId) {
      this.stepError.set('Please select a mother / patient.');
      return;
    }

    const patient = this.patients().find((p) => p.id === this.formPatientId);
    if (!patient) return;

    this.saving.set(true);
    try {
      await this.recordsSvc.addPostpartum({
        patientId: patient.id,
        patientName: patient.fullName,
        visitStage: this.formVisitStage,
        visitDate: this.formVisitDate,
        maternalBp: this.formBp,
        maternalTemp: this.formTemp,
        maternalPulse: this.formPulse,
        fundalFirmness: this.formFundalFirmness,
        fundalPosition: this.formFundalPosition,
        lochiaType: this.formLochiaType,
        lochiaAmount: this.formLochiaAmount,
        lochiaOdor: this.formLochiaOdor,
        perineumHealing: this.formPerineumHealing,
        breastCondition: this.formBreastCondition,
        feedingMethod: this.formFeedingMethod,
        maternalMentalState: this.formMaternalMentalState,
        familyPlanningCounseling: this.formFpCounseling,
        babyWeightKg: Number(this.formBabyWeightKg) || 3.2,
        cordStumpStatus: this.formCordStumpStatus,
        jaundiceStatus: this.formJaundiceStatus,
        attendingMidwife: this.formMidwife,
        clinicalNotes: this.formNotes,
        nextFollowUpDate: this.formNextDate,
      });

      this.closeAddModal();
      this.triggerToast('Postpartum clinical checkup record saved successfully!');
      await this.loadAll();
    } catch {
      alert('Failed to save postpartum record. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteRecord(r: PostpartumRecord): Promise<void> {
    if (!r.id) return;
    if (!confirm(`Are you sure you want to delete postpartum record for ${r.patientName}?`)) return;

    try {
      await this.recordsSvc.deletePostpartum(r.id);
      this.triggerToast('Postpartum record deleted.');
      await this.loadAll();
    } catch {
      alert('Failed to delete postpartum record.');
    }
  }

  private triggerToast(msg: string): void {
    this.actionFeedback.set(msg);
    setTimeout(() => this.actionFeedback.set(''), 3500);
  }
}
