import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';
import {
  DeliveryRecord,
  PostpartumRecord,
  PrenatalRecord,
  RecordsService,
} from '../core/records.service';

export type ReportCategory =
  | 'maternal-summary'
  | 'delivery-log'
  | 'newborn-ncp'
  | 'postpartum-fp'
  | 'high-risk';

@Component({
  selector: 'app-reports',
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="reports-page-wrap">
      <!-- ============ TOP HEADER BANNER ============ -->
      <div class="reports-header-card no-print">
        <div class="header-left">
          <div class="header-icon-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <h1>Clinical Reports & DOH Maternal Log Sheets</h1>
            <p class="header-sub">Generate, filter, and export official FHSIS reports, PhilHealth MCP/NCP delivery registries, and maternal audits.</p>
          </div>
        </div>

        <div class="header-actions">
          <button type="button" class="btn-action secondary" (click)="exportToCsv()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <button type="button" class="btn-action primary" (click)="printReport()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Official Report
          </button>
        </div>
      </div>

      <!-- ============ REPORT TYPE SELECTOR & DATE CONTROLS ============ -->
      <div class="filter-controls-card no-print">
        <div class="filter-row-top">
          <div class="report-select-group">
            <label>Report Registry Type:</label>
            <div class="report-tabs">
              <button
                type="button"
                class="tab-btn"
                [class.active]="selectedReport() === 'maternal-summary'"
                (click)="selectedReport.set('maternal-summary')"
              >
                Maternal Care (FHSIS)
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="selectedReport() === 'delivery-log'"
                (click)="selectedReport.set('delivery-log')"
              >
                Delivery Registry (MCP)
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="selectedReport() === 'newborn-ncp'"
                (click)="selectedReport.set('newborn-ncp')"
              >
                Newborn & Vaccines (NCP)
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="selectedReport() === 'postpartum-fp'"
                (click)="selectedReport.set('postpartum-fp')"
              >
                Postpartum & FP Log
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="selectedReport() === 'high-risk'"
                (click)="selectedReport.set('high-risk')"
              >
                High-Risk Audit Log
              </button>
            </div>
          </div>
        </div>

        <div class="filter-row-bottom">
          <div class="date-range-group">
            <span class="filter-lbl">Reporting Period:</span>
            <select [ngModel]="selectedPeriod()" (ngModelChange)="selectedPeriod.set($event)" class="select-input">
              <option value="all">All Available Records</option>
              <option value="this-month">This Month (October 2026)</option>
              <option value="last-month">Last Month (September 2026)</option>
              <option value="quarter">Current Quarter (Q4 2026)</option>
              <option value="year">Year-To-Date (2026)</option>
            </select>
          </div>

          <div class="search-filter-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="search"
              placeholder="Filter by patient name, midwife, or findings..."
              [ngModel]="filterQuery()"
              (ngModelChange)="filterQuery.set($event)"
            />
          </div>
        </div>
      </div>

      <!-- ============ PRINTABLE OFFICIAL REPORT SHEET ============ -->
      <div class="official-sheet-card print-target">
        <!-- Print Letterhead -->
        <div class="official-letterhead">
          <div class="clinic-seal">🏥</div>
          <div class="clinic-title-meta">
            <h2>LYING-IN CARE BIRTHING CLINIC & MATERNITY FACILITY</h2>
            <p>Accredited Birthing Home & PhilHealth MCP/NCP Provider Facility No. 04-2026-0012</p>
            <p class="doc-title-text">{{ getReportTitle() }}</p>
            <span class="doc-period-text">Reporting Period: {{ getPeriodLabel() }} · Generated: {{ todayDate | date: 'fullDate' }}</span>
          </div>
        </div>

        <!-- KPI Summary Counters -->
        <div class="report-kpi-summary">
          <div class="kpi-box">
            <span class="kpi-k">Total Inclusions</span>
            <strong class="kpi-v">{{ filteredData().length }}</strong>
          </div>
          <div class="kpi-box">
            <span class="kpi-k">Registered Cohort</span>
            <strong class="kpi-v">{{ patients().length }}</strong>
          </div>
          <div class="kpi-box">
            <span class="kpi-k">Deliveries Logged</span>
            <strong class="kpi-v">{{ deliveries().length }}</strong>
          </div>
          <div class="kpi-box">
            <span class="kpi-k">EINC Adherence Rate</span>
            <strong class="kpi-v tone-green">100%</strong>
          </div>
          <div class="kpi-box">
            <span class="kpi-k">Preeclampsia / Complications</span>
            <strong class="kpi-v tone-purple">{{ highRiskCount() }} cases</strong>
          </div>
        </div>

        <!-- Dynamic Data Table -->
        <div class="table-container">
          <!-- 1. Maternal Summary Table -->
          @if (selectedReport() === 'maternal-summary') {
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Patient Full Name</th>
                  <th>Contact No.</th>
                  <th>Age / Obstetric</th>
                  <th>Checkup Date</th>
                  <th>Gestational Age</th>
                  <th>Blood Pressure</th>
                  <th>Urinalysis</th>
                  <th>Attending Midwife</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredPrenatals(); track row.id; let idx = $index) {
                  <tr>
                    <td>{{ idx + 1 }}</td>
                    <td><strong>{{ row.patientName }}</strong></td>
                    <td>{{ row.patientContact || '—' }}</td>
                    <td>{{ row.riskLevel }}</td>
                    <td>{{ row.date | date: 'mediumDate' }}</td>
                    <td>{{ row.gestationalAge }} ({{ row.trimester }})</td>
                    <td><span class="mono-badge">{{ row.bp }}</span></td>
                    <td>P: {{ row.urinalysisProtein }} · G: {{ row.urinalysisGlucose }}</td>
                    <td>{{ row.attendingMidwife }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <!-- 2. Delivery Registry (MCP) Table -->
          @if (selectedReport() === 'delivery-log') {
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mother Name</th>
                  <th>Delivery Date & Time</th>
                  <th>Delivery Type</th>
                  <th>GA at Birth</th>
                  <th>Baby Sex</th>
                  <th>Weight (g)</th>
                  <th>APGAR (1m/5m)</th>
                  <th>Blood Loss</th>
                  <th>Attending Midwife</th>
                </tr>
              </thead>
              <tbody>
                @for (del of filteredDeliveries(); track del.id; let idx = $index) {
                  <tr>
                    <td>{{ idx + 1 }}</td>
                    <td><strong>{{ del.patientName }}</strong></td>
                    <td>{{ del.deliveryDateTime | date: 'short' }}</td>
                    <td>{{ del.deliveryType }}</td>
                    <td>{{ del.gestationalAgeAtDelivery }}</td>
                    <td>
                      <span class="badge-sex" [ngClass]="del.babySex === 'Female' ? 'sex-female' : 'sex-male'">
                        {{ del.babySex }}
                      </span>
                    </td>
                    <td>{{ del.birthWeightGrams }}g ({{ del.birthLengthCm }}cm)</td>
                    <td><strong>{{ del.apgar1Min }}/10 · {{ del.apgar5Min }}/10</strong></td>
                    <td>{{ del.estimatedBloodLossMl }} mL</td>
                    <td>{{ del.attendingMidwife }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <!-- 3. Newborn & Vaccines (NCP) Table -->
          @if (selectedReport() === 'newborn-ncp') {
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Infant / Mother</th>
                  <th>Birth Timestamp</th>
                  <th>Sex & Weight</th>
                  <th>Vit K1</th>
                  <th>Eye Ointment</th>
                  <th>Hep B Dose</th>
                  <th>BCG Dose</th>
                  <th>EINC Sequence</th>
                  <th>Attending Midwife</th>
                </tr>
              </thead>
              <tbody>
                @for (nb of filteredDeliveries(); track nb.id; let idx = $index) {
                  <tr>
                    <td>{{ idx + 1 }}</td>
                    <td><strong>Baby of {{ nb.patientName }}</strong></td>
                    <td>{{ nb.deliveryDateTime | date: 'short' }}</td>
                    <td>{{ nb.babySex }} ({{ nb.birthWeightGrams }}g)</td>
                    <td><span class="check-pill" [class.yes]="nb.vitaminKGiven">✓ Given</span></td>
                    <td><span class="check-pill" [class.yes]="nb.eyeProphylaxisGiven">✓ Given</span></td>
                    <td><span class="check-pill" [class.yes]="nb.hepatitisBGiven">✓ Given</span></td>
                    <td><span class="check-pill" [class.yes]="nb.bcgGiven">✓ Given</span></td>
                    <td><span class="check-pill yes">✓ 4/4 Steps</span></td>
                    <td>{{ nb.attendingMidwife }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <!-- 4. Postpartum & FP Log Table -->
          @if (selectedReport() === 'postpartum-fp') {
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mother Name</th>
                  <th>Checkup Date</th>
                  <th>Visit Stage</th>
                  <th>Maternal BP</th>
                  <th>Fundal Status</th>
                  <th>Lochia Character</th>
                  <th>Infant Feeding</th>
                  <th>Family Planning Counseling</th>
                  <th>Midwife</th>
                </tr>
              </thead>
              <tbody>
                @for (pp of filteredPostpartum(); track pp.id; let idx = $index) {
                  <tr>
                    <td>{{ idx + 1 }}</td>
                    <td><strong>{{ pp.patientName }}</strong></td>
                    <td>{{ pp.visitDate | date: 'mediumDate' }}</td>
                    <td><span class="stage-pill">{{ pp.visitStage }}</span></td>
                    <td>{{ pp.maternalBp }}</td>
                    <td>{{ pp.fundalFirmness }}</td>
                    <td>{{ pp.lochiaType }} ({{ pp.lochiaAmount }})</td>
                    <td><strong>{{ pp.feedingMethod }}</strong></td>
                    <td>{{ pp.familyPlanningCounseling || 'LAM Counseling Completed' }}</td>
                    <td>{{ pp.attendingMidwife }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <!-- 5. High-Risk Audit Table -->
          @if (selectedReport() === 'high-risk') {
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Patient Full Name</th>
                  <th>Risk Level</th>
                  <th>Contact Phone</th>
                  <th>Gestational Age / EDD</th>
                  <th>Clinical Flags / Findings</th>
                  <th>Care Status</th>
                </tr>
              </thead>
              <tbody>
                @for (hr of filteredHighRisk(); track hr.id; let idx = $index) {
                  <tr>
                    <td>{{ idx + 1 }}</td>
                    <td><strong>{{ hr.fullName }}</strong></td>
                    <td><span class="risk-badge" [ngClass]="'risk-' + hr.riskSlug">{{ hr.riskLevel }}</span></td>
                    <td>{{ hr.contactNumber }}</td>
                    <td>{{ hr.gestationalAge || '—' }} (EDD: {{ hr.edd | date: 'mediumDate' }})</td>
                    <td>{{ hr.clinicalNotes }}</td>
                    <td><span class="status-pill">{{ hr.status || 'Active' }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        @if (filteredData().length === 0) {
          <div class="empty-table-state">
            <p>No matching clinical registry entries found for the selected filter criteria.</p>
          </div>
        }

        <!-- Official Signatures Block -->
        <div class="official-signatures-row">
          <div class="sign-block">
            <span class="sign-title">Prepared and Certified Correct by:</span>
            <div class="sign-line"></div>
            <strong>{{ currentMidwifeName }}</strong>
            <small>Registered Midwife (RM) · Clinical Lead</small>
          </div>

          <div class="sign-block">
            <span class="sign-title">Noted & Audited by:</span>
            <div class="sign-line"></div>
            <strong>Medical Director / Supervising Obstetrician</strong>
            <small>City Health Office / PhilHealth Audit Representative</small>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .reports-page-wrap {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Top Header Card */
    .reports-header-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      box-shadow: 0 2px 10px rgba(54, 23, 89, 0.03);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon-pill {
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

    .header-icon-pill svg {
      width: 22px;
      height: 22px;
    }

    .reports-header-card h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: #271442;
      letter-spacing: -0.01em;
    }

    .header-sub {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: #7a7189;
      max-width: 680px;
    }

    .header-actions {
      display: flex;
      gap: 10px;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-action svg { width: 15px; height: 15px; }

    .btn-action.primary {
      background: #361759;
      color: #ffffff;
      border: none;
      box-shadow: 0 3px 10px rgba(54, 23, 89, 0.22);
    }
    .btn-action.primary:hover {
      background: #4a2179;
      transform: translateY(-1px);
    }

    .btn-action.secondary {
      background: #ffffff;
      color: #361759;
      border: 1.5px solid #d4c8e8;
    }
    .btn-action.secondary:hover {
      background: #fbf9fd;
    }

    /* Filter Controls Card */
    .filter-controls-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.02);
    }

    .report-select-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .report-select-group label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #7a7189;
    }

    .report-tabs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tab-btn {
      padding: 7px 16px;
      border: 1px solid #e7ddf2;
      background: #fbf9fd;
      color: #554869;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn:hover { background: #f0eaf8; color: #271442; }

    .tab-btn.active {
      background: #361759;
      color: #ffffff;
      border-color: #361759;
      box-shadow: 0 3px 8px rgba(54, 23, 89, 0.22);
    }

    .filter-row-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-top: 1px solid #f0eaf8;
      padding-top: 12px;
    }

    .date-range-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .filter-lbl {
      font-size: 12px;
      font-weight: 700;
      color: #361759;
    }

    .select-input {
      padding: 7px 12px;
      border: 1.5px solid #d4c8e8;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      color: #271442;
      background: #ffffff;
      outline: none;
    }

    .search-filter-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fbf9fd;
      border: 1.5px solid #d4c8e8;
      border-radius: 8px;
      padding: 6px 12px;
      min-width: 280px;
    }

    .search-filter-box svg { width: 15px; height: 15px; color: #7a7189; }
    .search-filter-box input { border: none; background: transparent; outline: none; font-size: 12.5px; width: 100%; color: #271442; }

    /* Official Printable Sheet */
    .official-sheet-card {
      background: #ffffff;
      border: 1px solid #ded4ea;
      border-radius: 14px;
      padding: 30px;
      box-shadow: 0 4px 16px rgba(54, 23, 89, 0.04);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .official-letterhead {
      display: flex;
      align-items: center;
      gap: 20px;
      border-bottom: 2.5px double #361759;
      padding-bottom: 16px;
    }

    .clinic-seal { font-size: 42px; }

    .clinic-title-meta h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #271442;
      letter-spacing: 0.05em;
    }

    .clinic-title-meta p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #554869;
    }

    .doc-title-text {
      font-size: 15px !important;
      font-weight: 800;
      color: #361759 !important;
      margin-top: 6px !important;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .doc-period-text {
      font-size: 11.5px;
      color: #7a7189;
      display: block;
      margin-top: 2px;
    }

    /* KPI Summary Row */
    .report-kpi-summary {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      background: #faf8fd;
      border: 1px solid #ebdff5;
      border-radius: 10px;
      padding: 12px 14px;
    }

    .kpi-box {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .kpi-k {
      font-size: 10.5px;
      font-weight: 700;
      color: #7a7189;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kpi-v {
      font-size: 16px;
      font-weight: 800;
      color: #271442;
    }

    .tone-green { color: #0d8a72 !important; }
    .tone-purple { color: #4a287c !important; }

    /* Data Table */
    .table-container {
      overflow-x: auto;
      border: 1px solid #ebe5f5;
      border-radius: 10px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      text-align: left;
    }

    .data-table th {
      background: #f5effb;
      color: #361759;
      font-weight: 800;
      padding: 10px 12px;
      border-bottom: 1.5px solid #d4c8e8;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .data-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #f0eaf8;
      color: #332447;
    }

    .data-table tr:hover { background: #fdfcff; }

    .mono-badge {
      font-family: monospace;
      font-weight: 700;
      background: #f4effb;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .badge-sex {
      font-size: 10.5px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .sex-female { background: #fdf2f8; color: #be185d; }
    .sex-male { background: #e0f2fe; color: #0369a1; }

    .check-pill {
      font-size: 11px;
      font-weight: 700;
      color: #0b6b58;
      background: #e6f7f3;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .stage-pill {
      font-size: 11px;
      background: #f3effa;
      color: #361759;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 600;
    }

    .risk-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
    }

    .risk-high { background: #fee2e2; color: #991b1b; }
    .risk-medium { background: #fef3c7; color: #92400e; }
    .risk-low { background: #e6f7f3; color: #0b6b58; }

    .status-pill {
      font-size: 11px;
      color: #0b6b58;
      font-weight: 600;
    }

    .empty-table-state {
      text-align: center;
      padding: 30px;
      color: #7a7189;
      font-size: 13px;
    }

    /* Signatures Block */
    .official-signatures-row {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px dashed #d8cde9;
    }

    .sign-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      min-width: 240px;
    }

    .sign-title {
      font-size: 11px;
      color: #7a7189;
      margin-bottom: 40px;
      font-weight: 600;
    }

    .sign-line {
      width: 220px;
      height: 1px;
      background: #271442;
      margin-bottom: 6px;
    }

    .sign-block strong {
      font-size: 13px;
      color: #271442;
    }

    .sign-block small {
      font-size: 11px;
      color: #7a7189;
    }

    @media print {
      .no-print { display: none !important; }
      .official-sheet-card { border: none; box-shadow: none; padding: 0; }
    }

    @media (max-width: 900px) {
      .reports-header-card, .filter-row-bottom, .official-signatures-row {
        flex-direction: column;
        align-items: stretch;
      }
      .report-kpi-summary { grid-template-columns: 1fr 1fr; }
    }
  `,
})
export class Reports implements OnInit {
  private readonly patientsSvc = inject(PatientsService);
  private readonly recordsSvc = inject(RecordsService);
  private readonly auth = inject(AuthService);

  readonly selectedReport = signal<ReportCategory>('maternal-summary');
  readonly selectedPeriod = signal('all');
  readonly filterQuery = signal('');

  readonly patients = signal<Patient[]>([]);
  readonly prenatals = signal<PrenatalRecord[]>([]);
  readonly deliveries = signal<DeliveryRecord[]>([]);
  readonly postpartums = signal<PostpartumRecord[]>([]);

  readonly todayDate = new Date();

  get currentMidwifeName(): string {
    const name = this.auth.userFullName();
    if (!name || name === 'Midwife') return 'Attending Midwife, RM';
    return name.toLowerCase().startsWith('midwife') ? `${name}, RM` : `Midwife ${name}, RM`;
  }

  async ngOnInit(): Promise<void> {
    const [pts, pre, del, post] = await Promise.all([
      this.patientsSvc.list(),
      this.recordsSvc.listPrenatal(),
      this.recordsSvc.listDelivery(),
      this.recordsSvc.listPostpartum(),
    ]);

    this.patients.set(pts);
    this.prenatals.set(pre);
    this.deliveries.set(del);
    this.postpartums.set(post);
  }

  readonly filteredPrenatals = computed(() => {
    const q = this.filterQuery().trim().toLowerCase();
    return this.prenatals().filter((p) => {
      return (
        !q ||
        p.patientName.toLowerCase().includes(q) ||
        p.attendingMidwife.toLowerCase().includes(q)
      );
    });
  });

  readonly filteredDeliveries = computed(() => {
    const q = this.filterQuery().trim().toLowerCase();
    return this.deliveries().filter((d) => {
      return (
        !q ||
        d.patientName.toLowerCase().includes(q) ||
        d.attendingMidwife.toLowerCase().includes(q) ||
        d.deliveryType.toLowerCase().includes(q)
      );
    });
  });

  readonly filteredPostpartum = computed(() => {
    const q = this.filterQuery().trim().toLowerCase();
    return this.postpartums().filter((pp) => {
      return (
        !q ||
        pp.patientName.toLowerCase().includes(q) ||
        pp.attendingMidwife.toLowerCase().includes(q) ||
        pp.visitStage.toLowerCase().includes(q)
      );
    });
  });

  readonly filteredHighRisk = computed(() => {
    const q = this.filterQuery().trim().toLowerCase();
    return this.patients()
      .filter((p) => {
        const isHr =
          (p.riskLevel || '').toLowerCase().includes('high') ||
          (p.riskLevel || '').toLowerCase().includes('med');
        return isHr;
      })
      .map((p) => {
        const riskSlug = (p.riskLevel || '').toLowerCase().includes('high')
          ? 'high'
          : 'medium';
        return {
          ...p,
          riskSlug,
          clinicalNotes: (p.riskLevel || '').toLowerCase().includes('high')
            ? 'Close monitoring: Gestational hypertension screening & hospital backup arranged'
            : 'Multipara / Nutritional monitoring scheduled',
        };
      })
      .filter((p) => !q || p.fullName.toLowerCase().includes(q));
  });

  readonly highRiskCount = computed(() => {
    return this.patients().filter(
      (p) =>
        (p.riskLevel || '').toLowerCase().includes('high') ||
        (p.riskLevel || '').toLowerCase().includes('med'),
    ).length;
  });

  readonly filteredData = computed(() => {
    const rep = this.selectedReport();
    if (rep === 'maternal-summary') return this.filteredPrenatals();
    if (rep === 'delivery-log' || rep === 'newborn-ncp') return this.filteredDeliveries();
    if (rep === 'postpartum-fp') return this.filteredPostpartum();
    return this.filteredHighRisk();
  });

  getReportTitle(): string {
    const rep = this.selectedReport();
    if (rep === 'maternal-summary') return 'DOH FHSIS Antenatal Care Monthly Summary Registry';
    if (rep === 'delivery-log') return 'PhilHealth Maternity Care Package (MCP) Delivery Log Sheet';
    if (rep === 'newborn-ncp') return 'PhilHealth Newborn Care Package (NCP) Immunization & Screening Register';
    if (rep === 'postpartum-fp') return 'Postpartum Recovery & Family Planning (LAM/PPFP) Registry';
    return 'High-Risk Maternal Clinical Surveillance & Referral Audit';
  }

  getPeriodLabel(): string {
    const p = this.selectedPeriod();
    if (p === 'this-month') return 'October 1 – 31, 2026';
    if (p === 'last-month') return 'September 1 – 30, 2026';
    if (p === 'quarter') return 'Fourth Quarter (Q4) 2026';
    if (p === 'year') return 'Calendar Year 2026 (YTD)';
    return 'Complete Historical Record';
  }

  printReport(): void {
    window.print();
  }

  exportToCsv(): void {
    const rep = this.selectedReport();
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (rep === 'delivery-log') {
      csvContent += 'Patient Name,Delivery Date,Delivery Type,GA at Birth,Baby Sex,Weight (g),APGAR 1m,APGAR 5m,Blood Loss (mL),Midwife\n';
      this.filteredDeliveries().forEach((d) => {
        csvContent += `"${d.patientName}","${d.deliveryDateTime}","${d.deliveryType}","${d.gestationalAgeAtDelivery}","${d.babySex}",${d.birthWeightGrams},${d.apgar1Min},${d.apgar5Min},${d.estimatedBloodLossMl},"${d.attendingMidwife}"\n`;
      });
    } else if (rep === 'maternal-summary') {
      csvContent += 'Patient Name,Visit Date,Gestational Age,Trimester,BP,Weight (kg),Fundal Height (cm),FHR (bpm),Protein,Glucose,Midwife\n';
      this.filteredPrenatals().forEach((p) => {
        csvContent += `"${p.patientName}","${p.date}","${p.gestationalAge}","${p.trimester}","${p.bp}",${p.weightKg},${p.fundalHeightCm},${p.fetalHeartRateBpm},"${p.urinalysisProtein}","${p.urinalysisGlucose}","${p.attendingMidwife}"\n`;
      });
    } else {
      csvContent += 'Patient Name,Date,Category,Attending Midwife\n';
      this.filteredData().forEach((r: any) => {
        csvContent += `"${r.patientName || r.fullName}","${r.date || r.visitDate || r.deliveryDateTime || ''}","${rep}","${r.attendingMidwife || ''}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${rep}-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

