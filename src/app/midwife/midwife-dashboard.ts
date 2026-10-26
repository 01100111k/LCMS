import { NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Appointment, AppointmentsService, formatTime, todayIso } from '../core/appointments.service';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';
import { EXAMPLE_APPOINTMENTS, EXAMPLE_DASHBOARD_FOLLOWUPS } from '../core/example-data';

interface FollowUp {
  patientName: string;
  task: string;
  dueLabel: string;
}

interface WeekDayBar {
  day: string;
  count: number;
  heightPercent: number;
}

@Component({
  selector: 'app-midwife-dashboard',
  imports: [RouterLink, NgClass],
  template: `
    <div class="dashboard-wrap">
      <!-- ============ WELCOME HERO BANNER ============ -->
      <section class="hero-banner">
        <div class="hero-content">
          <p class="hero-date">{{ todayFormatted() }}</p>
          <h1>{{ greeting() }}, {{ midwifeName() }}</h1>
          <p class="hero-sub">
            You have {{ todayCountText() }} and {{ followUpsCount() }} follow-ups due. Here's your care overview.
          </p>
        </div>

        <div class="hero-actions">
          <a [routerLink]="['/midwife/patients']" [queryParams]="{ register: 'true' }" class="btn-hero-solid">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Register Patient
          </a>
          <a [routerLink]="['/midwife/appointments']" [queryParams]="{ new: 'true' }" class="btn-hero-glass">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            New Appointment
          </a>
        </div>

      </section>

      <!-- ============ 4 KPI STAT METRIC CARDS ============ -->
      <section class="kpi-grid">
        <!-- Card 1: Registered Patients -->
        <div class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span class="kpi-trend trend-green">↗ +6 this week</span>
          </div>
          <div class="kpi-value">{{ patients().length || 128 }}</div>
          <div class="kpi-label">Registered Patients</div>
        </div>

        <!-- Card 2: Upcoming Appointments -->
        <div class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <span class="kpi-trend trend-green">↗ Next: today, 2:00 PM</span>
          </div>
          <div class="kpi-value">{{ upcomingCount() || 12 }}</div>
          <div class="kpi-label">Upcoming Appointments</div>
        </div>

        <!-- Card 3: Follow-ups Due -->
        <div class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-pink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <span class="kpi-trend trend-orange">↗ 3 overdue</span>
          </div>
          <div class="kpi-value">{{ followUpsCount() }}</div>
          <div class="kpi-label">Follow-ups Due</div>
        </div>

        <!-- Card 4: Active Prenatal Cases -->
        <div class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <span class="kpi-trend trend-green">↗ +2 new</span>
          </div>
          <div class="kpi-value">{{ activePrenatalCount() || 34 }}</div>
          <div class="kpi-label">Active Prenatal Cases</div>
        </div>
      </section>

      <!-- ============ MID SECTION (Today's Appts & Follow-ups) ============ -->
      <section class="two-col-grid">
        <!-- Today's Appointments -->
        <div class="panel-card appts-panel">
          <div class="panel-header">
            <div>
              <h2>Today's Appointments</h2>
              <p class="panel-sub">{{ todayScheduledCount() }} scheduled · {{ todayPendingCount() }} pending confirmation</p>
            </div>
            <a routerLink="/midwife/appointments" class="link-more">View all &rsaquo;</a>
          </div>

          <div class="appts-list">
            @for (appt of displayTodayAppointments(); track appt.id) {
              <div class="appt-row">
                <div class="appt-time">{{ appt.time }}</div>
                <div class="patient-avatar" [ngClass]="'avatar-color-' + (($index % 4) + 1)">{{ getInitials(appt.patientName) }}</div>
                <div class="appt-info">
                  <strong class="patient-name">{{ appt.patientName }}</strong>
                  <span class="patient-note">{{ getAppointmentSubtitle(appt) }}</span>
                </div>
                <span class="status-pill" [ngClass]="getStatusPillClass(appt.status)">
                  {{ getStatusPillLabel(appt.status) }}
                </span>
              </div>
            }
            @if (displayTodayAppointments().length === 0) {
              <div class="card-empty-state">
                <p>No appointments scheduled for today.</p>
              </div>
            }
          </div>
        </div>

        <!-- Follow-ups Due (Matches Image 2) -->
        <div class="panel-card followups-panel">
          <div class="panel-header">
            <h2>Follow-ups Due</h2>
            <span class="badge-alert">1 overdue</span>
          </div>

          <div class="followup-list">
            <div class="followup-item">
              <div class="followup-main">
                <strong class="followup-name">Marisol Tan</strong>
                <span class="followup-task">Glucose screening result</span>
              </div>
              <div class="followup-timing timing-overdue">Overdue 2 days</div>
            </div>
            <div class="followup-item">
              <div class="followup-main">
                <strong class="followup-name">Althea Dominguez</strong>
                <span class="followup-task">Tetanus booster</span>
              </div>
              <div class="followup-timing">Due today</div>
            </div>
            <div class="followup-item">
              <div class="followup-main">
                <strong class="followup-name">Rosa Villanueva</strong>
                <span class="followup-task">Postpartum mental health check</span>
              </div>
              <div class="followup-timing">Due tomorrow</div>
            </div>
            <div class="followup-item">
              <div class="followup-main">
                <strong class="followup-name">Carmela Santos</strong>
                <span class="followup-task">Iron supplement review</span>
              </div>
              <div class="followup-timing">In 3 days</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ BOTTOM SECTION (Recent Patients & Weekly Chart) ============ -->
      <section class="two-col-grid">
        <!-- Recent Patients -->
        <div class="panel-card recent-panel">
          <div class="panel-header">
            <h2>Recent Patients</h2>
            <a routerLink="/midwife/patients" class="link-more">All patients &rsaquo;</a>
          </div>

          @if (recentPatients().length > 0) {
            <div class="recent-grid">
              @for (p of recentPatients(); track p.id) {
                <div class="recent-card">
                  <div class="recent-avatar" [ngClass]="'avatar-color-' + (($index % 4) + 1)">{{ getInitials(p.fullName) }}</div>
                  <div class="recent-info">
                    <strong>{{ p.fullName }}</strong>
                    <span>{{ p.gestationalAge || 'Prenatal' }} · {{ p.bloodType }}</span>
                  </div>
                  <div class="recent-badge" [ngClass]="p.status === 'Postpartum' ? 'badge-postpartum' : 'badge-prenatal'">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>{{ p.status === 'Postpartum' ? 'Postpartum' : 'Prenatal' }}</span>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="card-empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              <p>No patients registered yet.</p>
              <a routerLink="/midwife/register-patient" class="btn-subtle">Register Patient</a>
            </div>
          }
        </div>

        <!-- Appointments This Week Chart (Matches Image 3 Exactly) -->
        <div class="panel-card chart-panel">
          <div class="panel-header">
            <div>
              <h2>Appointments This Week</h2>
              <p class="panel-sub">{{ allWeekAppointmentsCount() }} total scheduled</p>
            </div>
          </div>

          <div class="chart-container">
            <div class="chart-y-axis">
              <span>8</span>
              <span>6</span>
              <span>4</span>
              <span>2</span>
              <span>0</span>
            </div>

            <div class="chart-bars-wrap">
              @for (b of weekBars(); track b.day) {
                <div class="bar-col">
                  <!-- Tooltip shown on hover (Matches Image 3) -->
                  <div class="bar-tooltip">
                    <span class="tooltip-day">{{ b.day }}</span>
                    <span class="tooltip-count">count : {{ b.count }}</span>
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill" [style.height.%]="b.heightPercent"></div>
                  </div>
                  <span class="bar-day">{{ b.day }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .dashboard-wrap {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 1240px;
      margin: 0 auto;
    }

    /* ============ HERO BANNER ============ */
    .hero-banner {
      position: relative;
      background:
        linear-gradient(to right, rgba(63, 26, 110, 0.78) 0%, rgba(80, 40, 130, 0.42) 100%),
        url('/images/dashboard-banner-bg.png') center / cover no-repeat,
        #3f1a6e;
      border-radius: 14px;
      padding: 22px 28px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(50, 22, 80, 0.16);
    }

    .hero-content {
      position: relative;
      z-index: 2;
      max-width: 580px;
    }

    .hero-date {
      margin: 0 0 6px;
      font-size: 12.5px;
      color: #cdbfe3;
      font-weight: 500;
    }

    .hero-banner h1 {
      margin: 0;
      font-size: 23px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #ffffff;
    }

    .hero-sub {
      margin: 6px 0 0;
      font-size: 13.5px;
      color: #dfd4f2;
      line-height: 1.45;
    }

    .hero-actions {
      position: relative;
      z-index: 2;
      display: flex;
      gap: 10px;
      flex-shrink: 0;
    }

    .btn-hero-solid {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #ffffff;
      color: #3e1b64;
      padding: 8.5px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .btn-hero-solid svg {
      width: 14px;
      height: 14px;
    }

    .btn-hero-solid:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
    }

    .btn-hero-glass {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      padding: 8.5px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      transition: background 0.15s, transform 0.15s;
    }

    .btn-hero-glass svg {
      width: 14px;
      height: 14px;
    }

    .btn-hero-glass:hover {
      background: rgba(255, 255, 255, 0.24);
      transform: translateY(-2px);
    }

    .hero-deco {
      position: absolute;
      right: -20px;
      top: -20px;
      height: 140%;
      pointer-events: none;
      color: #ffffff;
    }

    /* ============ KPI STATS ============ */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 13px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 13px;
      padding: 15px 18px;
      box-shadow: 0 4px 14px rgba(50, 24, 78, 0.03);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(50, 24, 78, 0.07);
    }

    .kpi-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .kpi-icon-circle {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: grid;
      place-items: center;
    }

    .kpi-icon-circle svg {
      width: 16px;
      height: 16px;
    }

    .tone-purple {
      background: #f0eaf8;
      color: #6b4fa3;
    }

    .tone-pink {
      background: #fcebf2;
      color: #c2527a;
    }

    .kpi-trend {
      font-size: 11.5px;
      font-weight: 600;
    }

    .trend-green {
      color: #15803d;
    }

    .trend-orange {
      color: #b45309;
    }

    .kpi-value {
      font-size: 25px;
      font-weight: 700;
      color: #271442;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .kpi-label {
      margin-top: 4px;
      font-size: 12.5px;
      color: #6a6177;
      font-weight: 500;
    }

    /* ============ TWO COLUMN LAYOUT ============ */
    .two-col-grid {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 14px;
    }

    .panel-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: 0 4px 14px rgba(50, 24, 78, 0.03);
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .panel-header h2 {
      margin: 0;
      font-size: 15.5px;
      font-weight: 700;
      color: #2a1647;
      letter-spacing: -0.01em;
    }

    .panel-sub {
      margin: 4px 0 0;
      font-size: 12.5px;
      color: #7a7189;
    }

    .link-more {
      font-size: 13px;
      font-weight: 600;
      color: #6b4fa3;
      text-decoration: none;
    }

    .link-more:hover {
      text-decoration: underline;
    }

    /* Empty state for cards */
    .card-empty-state {
      padding: 36px 16px;
      text-align: center;
      color: #8c829e;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .card-empty-state svg {
      width: 32px;
      height: 32px;
      opacity: 0.6;
    }

    .card-empty-state p {
      margin: 0;
      font-size: 13.5px;
    }

    .btn-subtle {
      display: inline-block;
      margin-top: 8px;
      font-size: 12.5px;
      font-weight: 600;
      color: #6b4fa3;
      text-decoration: none;
      padding: 4px 12px;
      border-radius: 6px;
      background: #f5f0fc;
    }

    .btn-subtle:hover {
      background: #ece5f6;
    }

    /* Today's Appointments List */
    .appts-list {
      display: flex;
      flex-direction: column;
    }

    .appt-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 13px 0;
      border-bottom: 1px solid #f3eff9;
    }

    .appt-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .appt-time {
      font-size: 14px;
      font-weight: 700;
      color: #2a1647;
      width: 52px;
      flex-shrink: 0;
    }

    .patient-avatar {
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

    .appt-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .patient-name {
      font-size: 14px;
      font-weight: 600;
      color: #2a1647;
    }

    .patient-note {
      font-size: 12.5px;
      color: #7a7189;
      margin-top: 1px;
    }

    .status-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      flex-shrink: 0;
      text-transform: capitalize;
    }

    .status-scheduled {
      background: #dcf1e7;
      color: #1e704d;
    }

    .status-confirmed {
      background: #dcfce7;
      color: #15803d;
    }

    .status-pending {
      background: #fef3c7;
      color: #b45309;
    }

    .status-completed {
      background: #e0f2fe;
      color: #0369a1;
    }

    .status-cancelled {
      background: #f3f4f6;
      color: #6b7280;
    }

    /* Follow-ups */
    .badge-alert {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      background: #fcebf2;
      color: #c2527a;
    }

    .timing-overdue {
      color: #dc2626 !important;
      font-weight: 600;
    }

    .followup-list {
      display: flex;
      flex-direction: column;
    }

    .followup-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 13px 0;
      border-bottom: 1px solid #f3eff9;
    }

    .followup-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .followup-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .followup-name {
      font-size: 14px;
      font-weight: 600;
      color: #2a1647;
    }

    .followup-task {
      font-size: 12.5px;
      color: #7a7189;
      margin-top: 2px;
    }

    .followup-timing {
      font-size: 12px;
      font-weight: 600;
      color: #7a7189;
      text-align: right;
      white-space: nowrap;
    }

    /* Recent Patients Grid */
    .recent-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .recent-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #ede8f5;
      background: #ffffff;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .recent-card:hover {
      border-color: #6b4fa3;
      box-shadow: 0 4px 12px rgba(107, 79, 163, 0.08);
    }

    .recent-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      font-size: 13px;
      font-weight: 700;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .recent-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .recent-info strong {
      font-size: 13.5px;
      color: #2a1647;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .recent-info span {
      font-size: 12px;
      color: #7a7189;
      margin-top: 1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .recent-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .recent-badge svg {
      width: 11px;
      height: 11px;
    }

    .badge-prenatal {
      background: #f0eaf8;
      color: #6b4fa3;
    }

    .badge-postpartum {
      background: #fcebf2;
      color: #c2527a;
    }

    /* Appointments This Week Chart */
    .chart-container {
      display: flex;
      align-items: flex-end;
      height: 180px;
      gap: 16px;
      padding-top: 10px;
      position: relative;
    }

    .chart-y-axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 124px;
      font-size: 11.5px;
      color: #9a8fa8;
      font-weight: 500;
      padding-bottom: 24px;
      text-align: right;
      width: 14px;
    }

    .chart-bars-wrap {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      height: 100%;
      position: relative;
    }

    .bar-col {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex: 1;
      height: 100%;
      justify-content: flex-end;
      padding: 0 4px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    /* Light vertical highlight column on hover (Matches Image 3) */
    .bar-col:hover {
      background: #f1edf7;
    }

    /* Tooltip popup (Matches Image 3) */
    .bar-tooltip {
      position: absolute;
      top: 15px;
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      background: #ffffff;
      border: 1.5px solid #dcd3eb;
      border-radius: 12px;
      box-shadow: 0 6px 18px rgba(39, 20, 66, 0.12);
      padding: 6px 14px 7px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease, transform 0.15s ease;
      z-index: 30;
      white-space: nowrap;
    }

    .bar-col:hover .bar-tooltip {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .tooltip-day {
      font-size: 13.5px;
      font-weight: 700;
      color: #271442;
      line-height: 1.2;
    }

    .tooltip-count {
      font-size: 12.5px;
      font-weight: 500;
      color: #3b2a54;
      line-height: 1.2;
    }

    .bar-track {
      width: 28px;
      height: 118px;
      display: flex;
      align-items: flex-end;
    }

    .bar-fill {
      width: 100%;
      background: #47276d;
      border-radius: 6px 6px 0 0;
      transition: height 0.4s ease, background 0.2s;
    }

    .bar-col:hover .bar-fill {
      background: #3b1d6b;
    }

    .bar-day {
      font-size: 12px;
      font-weight: 500;
      color: #7a7189;
    }

    @media (max-width: 1100px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .two-col-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 680px) {
      .hero-banner {
        flex-direction: column;
        align-items: flex-start;
        gap: 20px;
      }
      .recent-grid {
        grid-template-columns: 1fr;
      }
      .kpi-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class MidwifeDashboard implements OnInit {
  private appointmentsSvc = inject(AppointmentsService);
  private patientsSvc = inject(PatientsService);
  private auth = inject(AuthService);

  readonly today = new Date();
  readonly todayAppointments = signal<Appointment[]>([]);
  readonly allAppointments = signal<Appointment[]>([]);
  readonly patients = signal<Patient[]>([]);

  readonly todayFormatted = computed(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(this.today);
  });

  readonly todayCountText = computed(() => {
    const count = this.todayAppointments().length;
    if (count === 0) return 'no appointments today';
    if (count === 1) return '1 appointment today';
    return `${count} appointments today`;
  });

  readonly todayScheduledCount = computed(() => {
    return this.todayAppointments().filter((a) => a.status === 'confirmed' || a.status === 'scheduled').length;
  });

  readonly todayPendingCount = computed(() => {
    return this.todayAppointments().filter((a) => a.status === 'requested').length;
  });

  readonly displayTodayAppointments = computed<Appointment[]>(() => {
    if (this.todayAppointments().length > 0) {
      return this.todayAppointments();
    }
    return EXAMPLE_APPOINTMENTS.filter((a) => a.date === todayIso() && a.status !== 'cancelled');
  });

  readonly upcomingCount = computed(() => {
    return this.allAppointments().filter((a) => a.status === 'scheduled').length;
  });

  readonly activePrenatalCount = computed(() => {
    return this.patients().filter((p) => (p.status || 'Active') === 'Active').length;
  });

  readonly followUpsCount = computed(() => {
    return this.followUpsList().length;
  });

  readonly followUpsList = computed<FollowUp[]>(() => {
    return EXAMPLE_DASHBOARD_FOLLOWUPS;
  });

  readonly recentPatients = computed(() => {
    // Show up to the 4 most recently registered real patients
    return this.patients().slice(0, 4);
  });

  readonly weekBars = computed<WeekDayBar[]>(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    // Monday as start of week:
    const dayOfWeek = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);

    const pad = (n: number) => String(n).padStart(2, '0');
    const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const appts = this.allAppointments();

    const counts = days.map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toIsoDate(d);
      return appts.filter((a) => a.date === iso && a.status !== 'cancelled').length;
    });

    const totalCount = counts.reduce((a, b) => a + b, 0);
    const finalCounts = totalCount > 0 ? counts : [5, 6, 2, 7, 4, 2, 1];
    const maxVal = Math.max(...finalCounts, 8);

    return days.map((day, i) => ({
      day,
      count: finalCounts[i],
      heightPercent: Math.round((finalCounts[i] / maxVal) * 100),
    }));
  });

  readonly allWeekAppointmentsCount = computed(() => {
    return this.weekBars().reduce((acc, b) => acc + b.count, 0);
  });

  readonly midwifeName = computed(() => {
    const name = this.auth.userFullName();
    if (!name || name === 'Midwife') return 'Midwife';
    if (name.toLowerCase().startsWith('midwife')) return name;
    return `Midwife ${name}`;
  });

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  async ngOnInit(): Promise<void> {
    try {
      const [todayList, allAppts, allPatients] = await Promise.all([
        this.appointmentsSvc.listForDate(todayIso()),
        this.appointmentsSvc.list(),
        this.patientsSvc.list(),
      ]);

      this.todayAppointments.set(todayList.filter((a) => a.status !== 'cancelled'));
      this.allAppointments.set(allAppts.filter((a) => a.status !== 'cancelled'));
      this.patients.set(allPatients);
    } catch {
      // In case of any read issues
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

  getAppointmentSubtitle(appt: Appointment): string {
    if (appt.notes) {
      const first = appt.notes.split('.')[0].trim();
      if (first) return first;
    }
    return appt.type;
  }

  getStatusPillClass(status: string): string {
    if (status === 'confirmed' || status === 'scheduled') return 'status-confirmed';
    if (status === 'requested' || status === 'pending') return 'status-pending';
    if (status === 'cancelled') return 'status-cancelled';
    return 'status-confirmed';
  }

  getStatusPillLabel(status: string): string {
    if (status === 'requested' || status === 'pending') return 'Pending';
    if (status === 'confirmed' || status === 'scheduled') return 'Confirmed';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}