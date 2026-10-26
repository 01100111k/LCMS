import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Appointment, AppointmentsService } from '../core/appointments.service';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';
import {
  DeliveryRecord,
  PostpartumRecord,
  PrenatalRecord,
  RecordsService,
} from '../core/records.service';

interface TrimesterMilestone {
  title: string;
  category: string;
  description: string;
  timing: string;
  completed: boolean;
  required: boolean;
}

@Component({
  selector: 'app-pregnancy-journey',
  imports: [CommonModule, RouterLink, DatePipe, FormsModule, NgClass],
  template: `
    <div class="journey-page-wrap">
      <!-- ============ TOP HEADER & PATIENT SELECTOR ============ -->
      <div class="journey-header-card">
        <div class="header-left">
          <div class="journey-icon-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div>
            <h1>Maternal Care & Pregnancy Journey Panel</h1>
            <p class="header-subtitle">Comprehensive longitudinal care tracker: trimesters, milestones, fetal growth, and clinical checkups.</p>
          </div>
        </div>

        <div class="header-right">
          <div class="patient-select-box">
            <label for="journey-pt-select">Selected Mother:</label>
            <select
              id="journey-pt-select"
              [ngModel]="selectedPatientId()"
              (ngModelChange)="onSelectPatient($event)"
              class="patient-dropdown"
            >
              @for (p of patients(); track p.id) {
                <option [value]="p.id">{{ p.fullName }} ({{ p.status || 'Active' }} · {{ p.gestationalAge || 'Care' }})</option>
              }
            </select>
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-state-card">
          <div class="spinner"></div>
          <p>Loading patient maternal care timeline...</p>
        </div>
      } @else if (currentPatient(); as pt) {

        <!-- ============ PATIENT SPOTLIGHT HERO BANNER ============ -->
        <div class="patient-spotlight-card">
          <div class="spotlight-left">
            <div class="patient-avatar-circle">{{ getInitials(pt.fullName) }}</div>
            <div class="patient-hero-info">
              <div class="name-status-row">
                <h2>{{ pt.fullName }}</h2>
                <span class="status-badge" [ngClass]="'status-' + (pt.status || 'active').toLowerCase()">
                  {{ pt.status || 'Active' }}
                </span>
                <span class="risk-badge" [ngClass]="'risk-' + getRiskSlug(pt.riskLevel)">
                  {{ pt.riskLevel || 'Low risk' }}
                </span>
              </div>
              <div class="meta-inline-pills">
                <span>Contact: <strong>{{ pt.contactNumber || '—' }}</strong></span>
                <span class="dot-separator">•</span>
                <span>Email: <strong>{{ pt.email || '—' }}</strong></span>
                <span class="dot-separator">•</span>
                <span>Blood Type: <strong>{{ pt.bloodType || 'Unknown' }}</strong></span>
                <span class="dot-separator">•</span>
                <span>Obstetric Score: <strong>{{ pt.gravidaPara || 'G1P0' }}</strong></span>
              </div>
            </div>
          </div>

          <div class="spotlight-actions">
            <a [routerLink]="['/midwife/prenatal']" class="btn-spotlight-action primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Log Prenatal Checkup
            </a>
            <a [routerLink]="['/midwife/appointments']" [queryParams]="{ new: 'true', patient: pt.id }" class="btn-spotlight-action secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Schedule Visit
            </a>
            <a [routerLink]="['/midwife/patients']" class="btn-spotlight-action outline">
              View Directory
            </a>
          </div>
        </div>

        <!-- ============ 4 PREGNANCY HIGHLIGHT CARDS ============ -->
        <div class="kpi-cards-grid">
          <div class="kpi-glass-card">
            <div class="kpi-icon-pill tone-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="kpi-meta">
              <span class="kpi-label">Gestational Age</span>
              <strong class="kpi-value">{{ currentWeeks() }} Weeks</strong>
              <small class="kpi-hint">{{ currentTrimesterName() }}</small>
            </div>
          </div>

          <div class="kpi-glass-card">
            <div class="kpi-icon-pill tone-pink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="kpi-meta">
              <span class="kpi-label">Estimated Due Date</span>
              <strong class="kpi-value">{{ pt.edd ? (pt.edd | date: 'mediumDate') : 'TBD' }}</strong>
              <small class="kpi-hint">
                @if (daysRemaining() !== null) {
                  @if (daysRemaining()! > 0) {
                    {{ daysRemaining() }} days remaining
                  } @else {
                    Due date reached / Term
                  }
                } @else {
                  Based on LMP: {{ pt.lmp ? (pt.lmp | date: 'mediumDate') : '—' }}
                }
              </small>
            </div>
          </div>

          <div class="kpi-glass-card">
            <div class="kpi-icon-pill tone-teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div class="kpi-meta">
              <span class="kpi-label">Latest Blood Pressure</span>
              <strong class="kpi-value">{{ latestBp() || '110/70' }}</strong>
              <small class="kpi-hint tone-success">Normotensive Range</small>
            </div>
          </div>

          <div class="kpi-glass-card">
            <div class="kpi-icon-pill tone-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <div class="kpi-meta">
              <span class="kpi-label">Clinical Checkups Logged</span>
              <strong class="kpi-value">{{ patientPrenatals().length }} Visits</strong>
              <small class="kpi-hint">{{ patientAppts().length }} Appointments scheduled</small>
            </div>
          </div>
        </div>

        <!-- ============ 40-WEEK TIMELINE VISUAL PROGRESS TRACK ============ -->
        <div class="timeline-track-card">
          <div class="timeline-top-row">
            <div>
              <h3>Gestational Timeline & Trimester Progression</h3>
              <p>Visual 40-week gestational continuum tracking maternal & fetal developmental milestones.</p>
            </div>
            <div class="progress-pill">
              <strong>{{ progressPercent() }}%</strong> Completed (Week {{ currentWeeks() }} of 40)
            </div>
          </div>

          <!-- Progress Bar with Current Marker -->
          <div class="timeline-bar-wrapper">
            <div class="timeline-bar-track">
              <div class="timeline-bar-fill" [style.width.%]="progressPercent()"></div>
              <!-- Floating indicator pin -->
              <div class="timeline-current-pin" [style.left.%]="progressPercent()">
                <div class="pin-bubble">Wk {{ currentWeeks() }}</div>
                <div class="pin-dot"></div>
              </div>
            </div>

            <!-- Trimester Zones -->
            <div class="trimester-zones-bar">
              <div class="zone zone-1" [class.current-zone]="currentWeeks() <= 13">
                <span class="zone-title">1st Trimester</span>
                <span class="zone-weeks">Weeks 1 – 13</span>
              </div>
              <div class="zone zone-2" [class.current-zone]="currentWeeks() > 13 && currentWeeks() <= 27">
                <span class="zone-title">2nd Trimester</span>
                <span class="zone-weeks">Weeks 14 – 27</span>
              </div>
              <div class="zone zone-3" [class.current-zone]="currentWeeks() > 27">
                <span class="zone-title">3rd Trimester</span>
                <span class="zone-weeks">Weeks 28 – 40+</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ CURRENT FETAL SIZE & MIDWIFE CLINICAL FOCUS ============ -->
        <div class="two-column-grid">
          <!-- Left: Baby Development -->
          <div class="journey-content-card">
            <div class="card-head-row">
              <div class="head-icon tone-pink">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </div>
              <div>
                <h3>Week {{ currentWeeks() }} Fetal Development & Size</h3>
                <p>Anatomical growth comparison and physiological milestones.</p>
              </div>
            </div>

            <div class="baby-growth-box">
              <div class="baby-fruit-circle">
                <span class="fruit-emoji">{{ babySize().icon }}</span>
              </div>
              <div class="baby-growth-details">
                <span class="fruit-label">Approximate Size Comparison</span>
                <strong class="fruit-name">{{ babySize().name }}</strong>
                <div class="growth-stats-row">
                  <span>Estimated Length: <strong>{{ babySize().sizeCm }}</strong></span>
                  <span class="sep-bullet">•</span>
                  <span>Estimated Weight: <strong>{{ babySize().weightG }}</strong></span>
                </div>
              </div>
            </div>

            <div class="growth-desc-box">
              <h4>Developmental Highlights this Week:</h4>
              <p>{{ babySize().desc }}</p>
            </div>
          </div>

          <!-- Right: Midwife Clinical Focus -->
          <div class="journey-content-card">
            <div class="card-head-row">
              <div class="head-icon tone-purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div>
                <h3>Midwife Clinical Care Focus ({{ currentTrimesterName() }})</h3>
                <p>Clinical assessments and health counseling priorities.</p>
              </div>
            </div>

            <div class="clinical-focus-list">
              <div class="focus-item">
                <div class="focus-icon">✓</div>
                <div class="focus-text">
                  <strong>Vital Signs & Pre-eclampsia Screening</strong>
                  <p>Check Blood Pressure at every visit (&lt;140/90 mmHg) and evaluate for sudden facial/hand edema or proteinuria.</p>
                </div>
              </div>

              <div class="focus-item">
                <div class="focus-icon">✓</div>
                <div class="focus-text">
                  <strong>Obstetric Measurements & Fetal Well-being</strong>
                  <p>Measure fundal height in cm (McDoanld's rule: height in cm correlates with gestational age after 20w) and auscultate FHR (110–160 bpm).</p>
                </div>
              </div>

              <div class="focus-item">
                <div class="focus-icon">✓</div>
                <div class="focus-text">
                  <strong>Micronutrient Supplementation & Nutrition</strong>
                  <p>Ensure adherence to daily Ferrous Sulfate + Folic Acid (60mg elemental iron / 400mcg folate) and Calcium Carbonate.</p>
                </div>
              </div>

              <div class="focus-item">
                <div class="focus-icon">✓</div>
                <div class="focus-text">
                  <strong>Birth Preparedness & Danger Signs</strong>
                  <p>Educate mother on vaginal bleeding, severe headache, epigastric pain, watery discharge (PROM), and reduced fetal kicks.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ TRIMESTER MILESTONES & CARE PLAN TABS ============ -->
        <div class="journey-milestones-card">
          <div class="milestones-header">
            <div>
              <h3>Maternal Clinical Care Plan & Checklist</h3>
              <p>Key clinical screening, ultrasound imaging, immunization, and laboratory milestones.</p>
            </div>

            <!-- Milestone Stage Tabs -->
            <div class="milestone-tabs">
              <button
                type="button"
                class="m-tab"
                [class.active]="selectedMilestoneTab() === '1st'"
                (click)="selectedMilestoneTab.set('1st')"
              >
                1st Trimester (W1-13)
              </button>
              <button
                type="button"
                class="m-tab"
                [class.active]="selectedMilestoneTab() === '2nd'"
                (click)="selectedMilestoneTab.set('2nd')"
              >
                2nd Trimester (W14-27)
              </button>
              <button
                type="button"
                class="m-tab"
                [class.active]="selectedMilestoneTab() === '3rd'"
                (click)="selectedMilestoneTab.set('3rd')"
              >
                3rd Trimester (W28-40)
              </button>
              <button
                type="button"
                class="m-tab"
                [class.active]="selectedMilestoneTab() === 'postpartum'"
                (click)="selectedMilestoneTab.set('postpartum')"
              >
                Birth & Postpartum
              </button>
            </div>
          </div>

          <!-- Milestones List Grid -->
          <div class="milestones-grid">
            @for (m of activeMilestones(); track m.title) {
              <div class="milestone-card" [class.is-done]="m.completed">
                <div class="m-check-col">
                  <div class="m-checkbox" [class.checked]="m.completed">
                    @if (m.completed) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    }
                  </div>
                </div>
                <div class="m-content-col">
                  <div class="m-title-row">
                    <strong>{{ m.title }}</strong>
                    <span class="m-timing-tag">{{ m.timing }}</span>
                  </div>
                  <p class="m-desc">{{ m.description }}</p>
                  <div class="m-footer-row">
                    <span class="m-category-badge">{{ m.category }}</span>
                    @if (m.required) {
                      <span class="m-req-pill">Standard DOH Protocol</span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- ============ CLINICAL CHECKUP TIMELINE (RECORDED VISITS) ============ -->
        <div class="checkup-history-card">
          <div class="card-head-row">
            <div class="head-icon tone-teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div>
              <h3>Recorded Clinical Checkups & Visit History</h3>
              <p>Chronological prenatal visits, delivery records, and postpartum checkups for this mother.</p>
            </div>
          </div>

          @if (patientPrenatals().length === 0 && !patientDelivery() && patientPostpartum().length === 0) {
            <div class="no-records-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h4>No clinical records logged yet for {{ pt.fullName }}</h4>
              <p>Start recording prenatal visits to populate the maternal care timeline and vital health trends.</p>
              <a [routerLink]="['/midwife/prenatal']" class="btn-spotlight-action primary" style="margin-top: 10px;">
                Log First Prenatal Checkup
              </a>
            </div>
          } @else {
            <div class="history-timeline-list">
              <!-- Postpartum Records if any -->
              @for (pp of patientPostpartum(); track pp.id) {
                <div class="history-item pp-item">
                  <div class="history-badge tone-purple">Postpartum</div>
                  <div class="history-content">
                    <div class="h-top-row">
                      <strong class="h-title">{{ pp.visitStage }}</strong>
                      <span class="h-date">{{ pp.visitDate | date: 'longDate' }}</span>
                    </div>
                    <div class="h-vitals-row">
                      <span>BP: <strong>{{ pp.maternalBp }}</strong></span>
                      <span>Fundus: <strong>{{ pp.fundalFirmness }}</strong></span>
                      <span>Lochia: <strong>{{ pp.lochiaType }} ({{ pp.lochiaAmount }})</strong></span>
                      <span>Infant Feeding: <strong>{{ pp.feedingMethod }}</strong></span>
                    </div>
                    @if (pp.clinicalNotes) {
                      <p class="h-notes">"{{ pp.clinicalNotes }}"</p>
                    }
                    <span class="h-midwife">Attending: {{ pp.attendingMidwife }}</span>
                  </div>
                </div>
              }

              <!-- Delivery Record if any -->
              @if (patientDelivery(); as del) {
                <div class="history-item delivery-item">
                  <div class="history-badge tone-pink">Birth / Delivery</div>
                  <div class="history-content">
                    <div class="h-top-row">
                      <strong class="h-title">{{ del.deliveryType }} ({{ del.babySex }} Newborn)</strong>
                      <span class="h-date">{{ del.deliveryDateTime | date: 'medium' }}</span>
                    </div>
                    <div class="h-vitals-row">
                      <span>Weight: <strong>{{ del.birthWeightGrams }}g</strong></span>
                      <span>Length: <strong>{{ del.birthLengthCm }}cm</strong></span>
                      <span>APGAR: <strong>{{ del.apgar1Min }}/10 · {{ del.apgar5Min }}/10</strong></span>
                      <span>EINC: <strong>Completed</strong></span>
                    </div>
                    @if (del.newbornNotes) {
                      <p class="h-notes">"{{ del.newbornNotes }}"</p>
                    }
                    <span class="h-midwife">Attending: {{ del.attendingMidwife }}</span>
                  </div>
                </div>
              }

              <!-- Prenatal Checkup Records -->
              @for (pr of patientPrenatals(); track pr.id) {
                <div class="history-item prenatal-item">
                  <div class="history-badge tone-teal">Prenatal Visit</div>
                  <div class="history-content">
                    <div class="h-top-row">
                      <strong class="h-title">{{ pr.gestationalAge }} · {{ pr.trimester }}</strong>
                      <span class="h-date">{{ pr.date | date: 'longDate' }}</span>
                    </div>
                    <div class="h-vitals-row">
                      <span>BP: <strong>{{ pr.bp }}</strong></span>
                      <span>Weight: <strong>{{ pr.weightKg }} kg</strong></span>
                      <span>Fundal Height: <strong>{{ pr.fundalHeightCm }} cm</strong></span>
                      <span>FHR: <strong>{{ pr.fetalHeartRateBpm }} bpm</strong></span>
                      <span>Protein: <strong>{{ pr.urinalysisProtein }}</strong></span>
                      <span>Glucose: <strong>{{ pr.urinalysisGlucose }}</strong></span>
                    </div>
                    @if (pr.complaintsRiskNotes) {
                      <p class="h-notes">"{{ pr.complaintsRiskNotes }}"</p>
                    }
                    <div class="h-bottom-row">
                      <span class="h-midwife">Attending: {{ pr.attendingMidwife }}</span>
                      @if (pr.nextFollowUpDate) {
                        <span class="h-next-date">Next: <strong>{{ pr.nextFollowUpDate | date: 'mediumDate' }}</strong></span>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>

      } @else {
        <div class="empty-selection-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3>No Patient Selected</h3>
          <p>Please select a patient from the dropdown above to view their maternal care journey.</p>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .journey-page-wrap {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Top Header Card */
    .journey-header-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      box-shadow: 0 2px 10px rgba(54, 23, 89, 0.03);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .journey-icon-badge {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      background: #361759;
      color: #ffffff;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
    }

    .journey-icon-badge svg {
      width: 22px;
      height: 22px;
    }

    .journey-header-card h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: #271442;
      letter-spacing: -0.01em;
    }

    .header-subtitle {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: #7a7189;
    }

    .patient-select-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .patient-select-box label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #7a7189;
      letter-spacing: 0.05em;
    }

    .patient-dropdown {
      padding: 9px 14px;
      border: 1.5px solid #d4c8e8;
      border-radius: 9px;
      font-size: 13.5px;
      font-weight: 600;
      color: #271442;
      background: #ffffff;
      outline: none;
      min-width: 280px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .patient-dropdown:focus {
      border-color: #361759;
      box-shadow: 0 0 0 3px rgba(54, 23, 89, 0.1);
    }

    /* Spotlight Hero Card */
    .patient-spotlight-card {
      background: #ffffff;
      border: 1px solid #ebdff5;
      border-radius: 14px;
      padding: 18px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      box-shadow: 0 3px 12px rgba(54, 23, 89, 0.04);
    }

    .spotlight-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .patient-avatar-circle {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #361759;
      color: #ffffff;
      font-size: 17px;
      font-weight: 800;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
    }

    .patient-hero-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .name-status-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .name-status-row h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: #271442;
    }

    .status-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: capitalize;
    }

    .status-active { background: #e6f7f3; color: #0b6b58; }
    .status-postpartum { background: #fdf2f8; color: #be185d; }
    .status-completed { background: #f0fdf4; color: #166534; }

    .risk-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: capitalize;
    }

    .risk-low { background: #e6f7f3; color: #0b6b58; }
    .risk-medium { background: #fef3c7; color: #92400e; }
    .risk-high { background: #fee2e2; color: #991b1b; }

    .meta-inline-pills {
      font-size: 12.5px;
      color: #695f77;
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
    }

    .dot-separator { color: #b5a9c8; }

    .spotlight-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn-spotlight-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-spotlight-action svg { width: 14px; height: 14px; }

    .btn-spotlight-action.primary {
      background: #361759;
      color: #ffffff;
      box-shadow: 0 3px 10px rgba(54, 23, 89, 0.22);
    }
    .btn-spotlight-action.primary:hover {
      background: #4a2179;
      transform: translateY(-1px);
    }

    .btn-spotlight-action.secondary {
      background: #f4effa;
      color: #361759;
      border: 1px solid #d4c8e8;
    }
    .btn-spotlight-action.secondary:hover {
      background: #ede6f8;
    }

    .btn-spotlight-action.outline {
      background: #ffffff;
      color: #554869;
      border: 1px solid #d8cde9;
    }
    .btn-spotlight-action.outline:hover {
      background: #faf8fd;
      color: #271442;
    }

    /* KPI Grid */
    .kpi-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }

    .kpi-glass-card {
      background: #ffffff;
      border: 1px solid #ece4f5;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.03);
    }

    .kpi-icon-pill {
      width: 44px;
      height: 44px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .kpi-icon-pill.tone-purple { background: #f3effa; color: #361759; }
    .kpi-icon-pill.tone-pink { background: #fdf2f8; color: #be185d; }
    .kpi-icon-pill.tone-teal { background: #e6f7f3; color: #0d8a72; }
    .kpi-icon-pill.tone-blue { background: #e0f2fe; color: #0369a1; }

    .kpi-icon-pill svg { width: 22px; height: 22px; }

    .kpi-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
      gap: 2px;
    }

    .kpi-label {
      font-size: 11px;
      font-weight: 600;
      color: #7a7189;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kpi-value {
      font-size: 16px;
      font-weight: 800;
      color: #271442;
    }

    .kpi-hint {
      font-size: 11.5px;
      color: #695f77;
      font-weight: 600;
    }

    .tone-success { color: #0b6b58 !important; }

    /* Timeline Track Card */
    .timeline-track-card {
      background: #ffffff;
      border: 1px solid #ebdff5;
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.03);
    }

    .timeline-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }

    .timeline-top-row h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #271442;
    }

    .timeline-top-row p {
      margin: 3px 0 0;
      font-size: 12px;
      color: #7a7189;
    }

    .progress-pill {
      background: #f4effa;
      border: 1px solid #e7ddf2;
      color: #361759;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
    }

    .progress-pill strong {
      color: #361759;
      font-weight: 800;
    }

    .timeline-bar-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 0 6px;
    }

    .timeline-bar-track {
      position: relative;
      height: 12px;
      background: #f0eaf8;
      border-radius: 999px;
      overflow: visible;
    }

    .timeline-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #5c3596, #361759);
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    .timeline-current-pin {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    }

    .pin-bubble {
      position: absolute;
      bottom: 18px;
      background: #361759;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 3px 8px rgba(54, 23, 89, 0.35);
    }

    .pin-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #ffffff;
      border: 3.5px solid #361759;
      box-shadow: 0 0 0 4px rgba(54, 23, 89, 0.2);
    }

    .trimester-zones-bar {
      display: grid;
      grid-template-columns: 13fr 14fr 13fr;
      gap: 6px;
      margin-top: 4px;
    }

    .zone {
      background: #faf8fd;
      border: 1px solid #ebe5f5;
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 0.2s ease;
    }

    .zone.current-zone {
      background: #f4effb;
      border-color: #361759;
    }

    .zone-title {
      font-size: 12px;
      font-weight: 700;
      color: #361759;
    }

    .zone-weeks {
      font-size: 10.5px;
      color: #7a7189;
      font-weight: 600;
    }

    /* Two column grid */
    .two-column-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .journey-content-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.03);
    }

    .card-head-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .head-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .head-icon.tone-pink { background: #fdf2f8; color: #be185d; }
    .head-icon.tone-purple { background: #f3effa; color: #361759; }
    .head-icon.tone-teal { background: #e6f7f3; color: #0b6b58; }

    .head-icon svg { width: 20px; height: 20px; }

    .card-head-row h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #271442;
    }

    .card-head-row p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #7a7189;
    }

    /* Baby Growth Box */
    .baby-growth-box {
      background: #fdf8fb;
      border: 1.5px solid #f9e2ed;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .baby-fruit-circle {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #ffffff;
      border: 2px solid #f4c2db;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      box-shadow: 0 3px 8px rgba(190, 24, 93, 0.12);
    }

    .fruit-emoji { font-size: 32px; line-height: 1; }

    .baby-growth-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .fruit-label {
      font-size: 10.5px;
      font-weight: 700;
      color: #be185d;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .fruit-name {
      font-size: 18px;
      color: #271442;
      font-weight: 800;
    }

    .growth-stats-row {
      font-size: 12px;
      color: #695f77;
      display: flex;
      gap: 6px;
      margin-top: 2px;
    }

    .sep-bullet { color: #d4c8e8; }

    .growth-desc-box {
      margin-top: 14px;
      background: #faf8fd;
      border: 1px solid #eee7f7;
      border-radius: 10px;
      padding: 12px 14px;
    }

    .growth-desc-box h4 {
      margin: 0 0 4px;
      font-size: 12.5px;
      color: #361759;
      font-weight: 700;
    }

    .growth-desc-box p {
      margin: 0;
      font-size: 12.5px;
      color: #4a3a60;
      line-height: 1.45;
    }

    /* Clinical Focus List */
    .clinical-focus-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .focus-item {
      display: flex;
      gap: 10px;
      background: #fbf9fd;
      border: 1px solid #eee7f7;
      border-radius: 10px;
      padding: 10px 12px;
    }

    .focus-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #361759;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .focus-text strong {
      display: block;
      font-size: 12.5px;
      color: #271442;
      margin-bottom: 2px;
    }

    .focus-text p {
      margin: 0;
      font-size: 11.5px;
      color: #695f77;
      line-height: 1.4;
    }

    /* Milestones Card */
    .journey-milestones-card {
      background: #ffffff;
      border: 1px solid #ebdff5;
      border-radius: 14px;
      padding: 20px 24px;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.03);
    }

    .milestones-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid #ebe5f5;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }

    .milestones-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #271442;
    }

    .milestones-header p {
      margin: 3px 0 0;
      font-size: 12px;
      color: #7a7189;
    }

    .milestone-tabs {
      display: flex;
      gap: 6px;
      background: #f6f2fa;
      padding: 4px;
      border-radius: 999px;
    }

    .m-tab {
      padding: 6px 14px;
      border: none;
      background: transparent;
      color: #695f77;
      font-size: 12px;
      font-weight: 700;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .m-tab.active {
      background: #361759;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.25);
    }

    .milestones-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .milestone-card {
      background: #faf8fd;
      border: 1.5px solid #ebe5f5;
      border-radius: 11px;
      padding: 12px 14px;
      display: flex;
      gap: 12px;
      transition: all 0.2s ease;
    }

    .milestone-card.is-done {
      background: #f3fdf9;
      border-color: #a3e6cf;
    }

    .m-checkbox {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 1.8px solid #c7b9de;
      background: #ffffff;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      transition: all 0.15s;
    }

    .m-checkbox.checked {
      background: #0d8a72;
      border-color: #0d8a72;
      color: #ffffff;
    }

    .m-checkbox svg { width: 13px; height: 13px; }

    .m-content-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .m-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .m-title-row strong {
      font-size: 13px;
      color: #271442;
    }

    .m-timing-tag {
      font-size: 11px;
      font-weight: 700;
      color: #361759;
      background: #f0eaf8;
      padding: 2px 7px;
      border-radius: 6px;
      white-space: nowrap;
    }

    .m-desc {
      margin: 0;
      font-size: 12px;
      color: #695f77;
      line-height: 1.4;
    }

    .m-footer-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .m-category-badge {
      font-size: 10.5px;
      font-weight: 700;
      color: #4a287c;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .m-req-pill {
      font-size: 10.5px;
      color: #0b6b58;
      background: #e6f7f3;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 600;
    }

    /* Checkup History Card */
    .checkup-history-card {
      background: #ffffff;
      border: 1px solid #ebdff5;
      border-radius: 14px;
      padding: 20px 24px;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.03);
    }

    .no-records-box {
      text-align: center;
      padding: 36px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .no-records-box svg { width: 38px; height: 38px; color: #a497b9; }
    .no-records-box h4 { margin: 0; font-size: 15px; color: #271442; }
    .no-records-box p { margin: 0; font-size: 12.5px; color: #7a7189; max-width: 440px; }

    .history-timeline-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 6px;
    }

    .history-item {
      background: #faf8fd;
      border: 1px solid #ebe5f5;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .history-badge {
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .history-badge.tone-teal { background: #e6f7f3; color: #0b6b58; }
    .history-badge.tone-pink { background: #fdf2f8; color: #be185d; }
    .history-badge.tone-purple { background: #f3effa; color: #361759; }

    .history-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .h-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .h-title {
      font-size: 14px;
      color: #271442;
    }

    .h-date {
      font-size: 12px;
      font-weight: 600;
      color: #7a7189;
    }

    .h-vitals-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 12px;
      color: #695f77;
      margin-top: 3px;
    }

    .h-vitals-row strong { color: #271442; }

    .h-notes {
      margin: 4px 0 0;
      font-size: 12.5px;
      font-style: italic;
      color: #4a3a60;
    }

    .h-bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
      font-size: 11.5px;
    }

    .h-midwife { color: #7a7189; }
    .h-next-date { color: #361759; }

    .empty-selection-card, .loading-state-card {
      background: #ffffff;
      border: 1px dashed #d8cde9;
      border-radius: 14px;
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #ede6f8;
      border-top-color: #361759;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 900px) {
      .journey-header-card, .patient-spotlight-card, .timeline-top-row, .milestones-header {
        flex-direction: column;
        align-items: stretch;
      }
      .kpi-cards-grid, .two-column-grid, .milestones-grid {
        grid-template-columns: 1fr;
      }
      .patient-dropdown { width: 100%; min-width: 0; }
    }
  `,
})
export class PregnancyJourney implements OnInit {
  private readonly patientsSvc = inject(PatientsService);
  private readonly recordsSvc = inject(RecordsService);
  private readonly apptsSvc = inject(AppointmentsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly patients = signal<Patient[]>([]);
  readonly selectedPatientId = signal<string>('');

  // Loaded records
  readonly prenatals = signal<PrenatalRecord[]>([]);
  readonly deliveries = signal<DeliveryRecord[]>([]);
  readonly postpartums = signal<PostpartumRecord[]>([]);
  readonly appointments = signal<Appointment[]>([]);

  // Active milestone tab
  readonly selectedMilestoneTab = signal<'1st' | '2nd' | '3rd' | 'postpartum'>('2nd');

  readonly currentPatient = computed(() => {
    const id = this.selectedPatientId();
    return this.patients().find((p) => p.id === id) || this.patients()[0] || null;
  });

  readonly patientPrenatals = computed(() => {
    const pt = this.currentPatient();
    if (!pt) return [];
    return this.prenatals()
      .filter((r) => r.patientId === pt.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  readonly patientDelivery = computed(() => {
    const pt = this.currentPatient();
    if (!pt) return null;
    return this.deliveries().find((r) => r.patientId === pt.id) || null;
  });

  readonly patientPostpartum = computed(() => {
    const pt = this.currentPatient();
    if (!pt) return [];
    return this.postpartums()
      .filter((r) => r.patientId === pt.id)
      .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  });

  readonly patientAppts = computed(() => {
    const pt = this.currentPatient();
    if (!pt) return [];
    return this.appointments().filter((a) => a.patientId === pt.id);
  });

  readonly currentWeeks = computed(() => {
    const pt = this.currentPatient();
    if (!pt) return 20;

    // Check latest prenatal record
    const latestPrenatal = this.patientPrenatals()[0];
    if (latestPrenatal && latestPrenatal.gestationalWeeksNum) {
      return latestPrenatal.gestationalWeeksNum;
    }

    if (pt.gestationalAge) {
      const m = pt.gestationalAge.match(/(\d+)/);
      if (m) return parseInt(m[1], 10);
    }

    if (pt.lmp) {
      const lmpDate = new Date(pt.lmp);
      const diff = Math.floor((Date.now() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) return Math.min(42, Math.max(1, Math.floor(diff / 7)));
    }

    if (pt.edd) {
      const eddDate = new Date(pt.edd);
      const diff = Math.floor((eddDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const passed = 280 - diff;
      if (passed > 0) return Math.min(42, Math.max(1, Math.floor(passed / 7)));
    }

    return 24;
  });

  readonly currentTrimesterName = computed(() => {
    const w = this.currentWeeks();
    if (w <= 13) return '1st Trimester';
    if (w <= 27) return '2nd Trimester';
    return '3rd Trimester';
  });

  readonly progressPercent = computed(() => {
    const w = this.currentWeeks();
    const pct = Math.round((w / 40) * 100);
    return Math.min(100, Math.max(0, pct));
  });

  readonly daysRemaining = computed(() => {
    const pt = this.currentPatient();
    if (!pt || !pt.edd) return null;
    const diff = Math.ceil((new Date(pt.edd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  });

  readonly latestBp = computed(() => {
    const latest = this.patientPrenatals()[0];
    return latest?.bp || null;
  });

  readonly babySize = computed(() => {
    const w = this.currentWeeks();
    if (w <= 8) {
      return {
        name: 'Raspberry',
        icon: '🫐',
        desc: 'Heart is beating at 150-160 bpm. Tiny webbed fingers, eyelids, and limb buds are forming.',
        sizeCm: '1.6 cm',
        weightG: '1 g',
      };
    }
    if (w <= 12) {
      return {
        name: 'Lime',
        icon: '🍋',
        desc: 'All vital organs are structurally formed; baby begins reflexive swallowing and thumb sucking.',
        sizeCm: '5.4 cm',
        weightG: '14 g',
      };
    }
    if (w <= 16) {
      return {
        name: 'Avocado',
        icon: '🥑',
        desc: 'Facial muscles practice moving, eyes react to gentle light, and tiny fingernails form.',
        sizeCm: '11.6 cm',
        weightG: '100 g',
      };
    }
    if (w <= 20) {
      return {
        name: 'Banana',
        icon: '🍌',
        desc: 'Halfway mark! Protective vernix caseosa coats delicate baby skin; active flutters/kicks felt by mom.',
        sizeCm: '25.6 cm',
        weightG: '300 g',
      };
    }
    if (w <= 24) {
      return {
        name: 'Ear of Corn',
        icon: '🌽',
        desc: 'Inner ear structures are complete; baby hears mom’s voice and familiar sounds clearly.',
        sizeCm: '30.0 cm',
        weightG: '600 g',
      };
    }
    if (w <= 28) {
      return {
        name: 'Eggplant',
        icon: '🍆',
        desc: 'Third trimester begins! Eyelids open; brain develops rhythmic sleep cycles and REM periods.',
        sizeCm: '37.6 cm',
        weightG: '1,000 g',
      };
    }
    if (w <= 32) {
      return {
        name: 'Butternut Squash',
        icon: '🎃',
        desc: 'Fat layers form under the skin for temperature regulation; practicing rhythmic breathing motions.',
        sizeCm: '42.4 cm',
        weightG: '1,700 g',
      };
    }
    if (w <= 36) {
      return {
        name: 'Papaya',
        icon: '🍈',
        desc: 'Lungs near full maturation; baby begins descending into the pelvic inlet (lightening).',
        sizeCm: '47.4 cm',
        weightG: '2,600 g',
      };
    }
    return {
      name: 'Watermelon',
      icon: '🍉',
      desc: 'Full term gestation! Baby is prepared for spontaneous delivery and immediate skin-to-skin transition.',
      sizeCm: '51.2 cm',
      weightG: '3,300 g',
    };
  });

  readonly activeMilestones = computed<TrimesterMilestone[]>(() => {
    const tab = this.selectedMilestoneTab();
    const hasPrenatal = this.patientPrenatals().length > 0;
    const hasDelivery = !!this.patientDelivery();
    const hasPostpartum = this.patientPostpartum().length > 0;
    const weeks = this.currentWeeks();

    if (tab === '1st') {
      return [
        {
          title: 'Initial Dating Ultrasound Scan',
          category: 'Ultrasound',
          description: 'Establish accurate gestational age and cardiac activity.',
          timing: 'Weeks 6 – 10',
          completed: weeks > 10,
          required: true,
        },
        {
          title: 'Baseline Blood Typing & Rh Factor',
          category: 'Laboratory',
          description: 'Determine maternal blood group and screen for Rh isoimmunization risks.',
          timing: 'Weeks 8 – 12',
          completed: hasPrenatal,
          required: true,
        },
        {
          title: 'Complete Blood Count (CBC) & Urinalysis',
          category: 'Laboratory',
          description: 'Screen for maternal anemia and asymptomatic bacteriuria.',
          timing: 'First Visit',
          completed: hasPrenatal,
          required: true,
        },
        {
          title: 'Folic Acid + Iron Prophylaxis Initiation',
          category: 'Supplements',
          description: 'Daily micronutrients to prevent neural tube defects and iron deficiency.',
          timing: 'From Week 4',
          completed: true,
          required: true,
        },
      ];
    }

    if (tab === '2nd') {
      return [
        {
          title: 'Congenital Anomaly Scan (CAS)',
          category: 'Ultrasound',
          description: 'Comprehensive anatomical survey and placental positioning check.',
          timing: 'Weeks 18 – 22',
          completed: weeks >= 22,
          required: true,
        },
        {
          title: 'Tetanus Toxoid (TT) Immunization',
          category: 'Vaccination',
          description: 'Administer maternal TT doses for neonatal tetanus protection.',
          timing: 'Weeks 16 – 24',
          completed: hasPrenatal,
          required: true,
        },
        {
          title: 'Oral Glucose Tolerance Test (OGTT)',
          category: 'Laboratory',
          description: '75g 2-hour fasting blood glucose screening for gestational diabetes.',
          timing: 'Weeks 24 – 28',
          completed: weeks >= 26,
          required: true,
        },
        {
          title: 'Quickening Tracking & Fundal Height',
          category: 'Obstetric Assessment',
          description: 'Log maternal perception of fetal movement and correlate fundal cm.',
          timing: 'Weeks 20 – 24',
          completed: weeks >= 20 && hasPrenatal,
          required: true,
        },
      ];
    }

    if (tab === '3rd') {
      return [
        {
          title: 'Fetal Presentation & Lie Evaluation',
          category: 'Obstetric Assessment',
          description: 'Leopold maneuvers to confirm cephalic versus breech orientation.',
          timing: 'Weeks 32 – 36',
          completed: weeks >= 34,
          required: true,
        },
        {
          title: 'Birthing Kit & PhilHealth Preparation',
          category: 'Delivery Prep',
          description: 'Review newborn clothing kit, PhilHealth MCP eligibility, and birth companion.',
          timing: 'Weeks 32 – 34',
          completed: weeks >= 32,
          required: true,
        },
        {
          title: 'Repeat Hemoglobin / Hematocrit Screening',
          category: 'Laboratory',
          description: 'Verify maternal oxygenation and prepare for physiological birth blood loss.',
          timing: 'Weeks 34 – 36',
          completed: weeks >= 36,
          required: true,
        },
        {
          title: 'Danger Signs & Labor Education',
          category: 'Patient Education',
          description: 'Instruct on true vs false contractions, membrane rupture, and emergency contacts.',
          timing: 'Weeks 36+',
          completed: weeks >= 36,
          required: true,
        },
      ];
    }

    // Birth & Postpartum
    return [
      {
        title: 'Essential Intrapartum & Newborn Care (EINC)',
        category: 'Clinical Delivery',
        description: 'Execution of immediate drying, skin-to-skin (90m), delayed clamping, and breastfeeding.',
        timing: 'At Delivery',
        completed: hasDelivery,
        required: true,
      },
      {
        title: 'Newborn Prophylaxis (Vit K, Eye, Hep B, BCG)',
        category: 'Immunization',
        description: 'Birth dose immunizations and phytonadione injection.',
        timing: 'First 2 Hours',
        completed: hasDelivery,
        required: true,
      },
      {
        title: '24-Hour Discharge Evaluation',
        category: 'Postpartum Check',
        description: 'Verify uterine firmness, normal rubra lochia, and vital sign stability.',
        timing: 'Day 1 Postpartum',
        completed: hasPostpartum,
        required: true,
      },
      {
        title: '6-Week Postnatal Concluding Checkup',
        category: 'Postpartum Check',
        description: 'Full uterine involution check, LAM family planning, and mental wellness assessment.',
        timing: 'Week 6 Postpartum',
        completed: this.patientPostpartum().some((p) => p.visitStage === 'Week 6 Postnatal Visit'),
        required: true,
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    await this.loadAll();

    // Check query params for preselected patient
    this.route.queryParams.subscribe((params) => {
      if (params['patient']) {
        this.selectedPatientId.set(params['patient']);
        this.autoSelectMilestoneTab();
      }
    });
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [pts, pre, del, post, appts] = await Promise.all([
        this.patientsSvc.list(),
        this.recordsSvc.listPrenatal(),
        this.recordsSvc.listDelivery(),
        this.recordsSvc.listPostpartum(),
        this.apptsSvc.list(),
      ]);

      this.patients.set(pts);
      this.prenatals.set(pre);
      this.deliveries.set(del);
      this.postpartums.set(post);
      this.appointments.set(appts);

      if (!this.selectedPatientId() && pts.length > 0) {
        this.selectedPatientId.set(pts[0].id);
        this.autoSelectMilestoneTab();
      }
    } catch {
      // ignore
    } finally {
      this.loading.set(false);
    }
  }

  onSelectPatient(id: string): void {
    this.selectedPatientId.set(id);
    this.autoSelectMilestoneTab();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { patient: id },
      queryParamsHandling: 'merge',
    });
  }

  private autoSelectMilestoneTab(): void {
    const pt = this.currentPatient();
    if (pt?.status === 'Postpartum' || pt?.status === 'Completed' || this.patientDelivery()) {
      this.selectedMilestoneTab.set('postpartum');
      return;
    }
    const w = this.currentWeeks();
    if (w <= 13) this.selectedMilestoneTab.set('1st');
    else if (w <= 27) this.selectedMilestoneTab.set('2nd');
    else this.selectedMilestoneTab.set('3rd');
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
}

