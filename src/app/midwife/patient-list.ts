import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Patient, PatientsService, RiskLevel } from '../core/patients.service';

@Component({
  selector: 'app-patient-list',
  imports: [RouterLink, DatePipe, FormsModule, NgClass],
  template: `
    <div class="directory-wrap">
      <!-- ============ HEADER ============ -->
      <div class="dir-head">
        <div>
          <h1>Patient Directory</h1>
          <p class="dir-sub">{{ filtered().length }} patients registered</p>
        </div>
        <a routerLink="/midwife/register-patient" class="btn-register">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Register Patient
        </a>
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
          <a routerLink="/midwife/register-patient" class="btn-register" style="margin-top: 8px;">
            + Register Patient
          </a>
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
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .directory-wrap {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Head */
    .dir-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .dir-head h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      color: #271442;
      letter-spacing: -0.01em;
    }

    .dir-sub {
      margin: 4px 0 0;
      font-size: 13.5px;
      color: #7a7189;
    }

    .btn-register {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #361759;
      color: #ffffff;
      padding: 10px 22px;
      border-radius: 999px;
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(54, 23, 89, 0.25);
      transition: transform 0.15s, background 0.15s;
    }

    .btn-register svg {
      width: 15px;
      height: 15px;
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
  `,
})
export class PatientList implements OnInit {
  private patients = inject(PatientsService);

  readonly all = signal<Patient[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly selectedStatus = signal<string>('All');
  readonly selectedRisk = signal<string>('All');

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