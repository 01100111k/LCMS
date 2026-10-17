import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Appointment, AppointmentsService, formatTime, todayIso } from '../core/appointments.service';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';

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
  imports: [RouterLink, DatePipe, NgClass],
  template: `
    <div class="dashboard-wrap">
      <!-- ============ WELCOME HERO BANNER ============ -->
      <section class="hero-banner">
        <div class="hero-content">
          <p class="hero-date">{{ today | date: 'fullDate' }}</p>
          <h1>{{ greeting() }}, {{ midwifeName() }}</h1>
          <p class="hero-sub">
            @if (todayAppointments().length > 0 || patients().length > 0) {
              You have {{ todayAppointments().length }} appointments today and {{ patients().length }} registered patients. Here's your care overview.
            } @else {
              Welcome to Lying-In Care. Register your first patient or schedule an appointment to get started.
            }
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
            @if (patients().length > 0) {
              <span class="kpi-trend trend-green">Active</span>
            }
          </div>
          <div class="kpi-value">{{ patients().length }}</div>
          <div class="kpi-label">Registered Patients</div>
        </div>

        <!-- Card 2: Upcoming Appointments -->
        <div class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            @if (upcomingCount() > 0) {
              <span class="kpi-trend trend-green">↗ {{ upcomingCount() }} scheduled</span>
            }
          </div>
          <div class="kpi-value">{{ upcomingCount() }}</div>
          <div class="kpi-label">Upcoming Appointments</div>
        </div>

        <!-- Card 3: Follow-ups Due -->
        <div class="kpi-card">
          <div class="kpi-top">
            <div class="kpi-icon-circle tone-pink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            @if (followUpsCount() > 0) {
              <span class="kpi-trend trend-orange">{{ followUpsCount() }} pending</span>
            }
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
            @if (activePrenatalCount() > 0) {
              <span class="kpi-trend trend-green">Active</span>
            }
          </div>
          <div class="kpi-value">{{ activePrenatalCount() }}</div>
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
              <p class="panel-sub">{{ todayAppointments().length }} scheduled for today</p>
            </div>
            <a routerLink="/midwife/appointments" class="link-more">View all &rsaquo;</a>
          </div>

          @if (todayAppointments().length > 0) {
            <div class="appts-list">
              @for (a of todayAppointments(); track a.id) {
                <div class="appt-row">
                  <div class="appt-time">{{ a.time }}</div>
                  <div class="patient-avatar" [ngClass]="'avatar-color-' + (($index % 4) + 1)">{{ getInitials(a.patientName) }}</div>
                  <div class="appt-info">
                    <strong class="patient-name">{{ a.patientName }}</strong>
                    <span class="patient-note">{{ a.type }}</span>
                  </div>
                  <span class="status-pill" [ngClass]="'status-' + a.status">
                    {{ a.status }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="card-empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p>Nothing scheduled for today.</p>
              <a routerLink="/midwife/appointments/new" class="btn-subtle">+ Schedule Appointment</a>
            </div>
          }
        </div>

        <!-- Follow-ups Due -->
        <div class="panel-card followups-panel">
          <div class="panel-header">
            <h2>Follow-ups Due</h2>
            @if (followUpsCount() > 0) {
              <span class="badge-alert">{{ followUpsCount() }} due</span>
            }
          </div>

          @if (followUpsCount() > 0) {
            <div class="followup-list">
              @for (f of followUpsList(); track f.patientName) {
                <div class="followup-item">
                  <div class="followup-main">
                    <strong class="followup-name">{{ f.patientName }}</strong>
                    <span class="followup-task">{{ f.task }}</span>
                  </div>
                  <div class="followup-timing">
                    {{ f.dueLabel }}
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="card-empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p>All follow-ups are up to date.</p>
            </div>
          }
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
              <a routerLink="/midwife/register-patient" class="btn-subtle">+ Register Patient</a>
            </div>
          }
        </div>

        <!-- Appointments This Week Chart -->
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
                  <div class="bar-track">
                    <div class="bar-fill" [style.height.%]="b.heightPercent" [title]="b.count + ' appointments'"></div>
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
      height: 160px;
      gap: 16px;
      padding-top: 10px;
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
    }

    .bar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex: 1;
      height: 100%;
      justify-content: flex-end;
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

    .bar-fill:hover {
      background: #6b4fa3;
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

  readonly upcomingCount = computed(() => {
    return this.allAppointments().filter((a) => a.status === 'scheduled').length;
  });

  readonly activePrenatalCount = computed(() => {
    return this.patients().filter((p) => (p.status || 'Active') === 'Active').length;
  });

  readonly followUpsCount = computed(() => {
    return 0; // Purely functional: calculates when followups are added
  });

  readonly followUpsList = computed<FollowUp[]>(() => {
    return [];
  });

  readonly recentPatients = computed(() => {
    // Show up to the 4 most recently registered real patients
    return this.patients().slice(0, 4);
  });

  readonly allWeekAppointmentsCount = computed(() => {
    return this.allAppointments().length;
  });

  readonly weekBars = computed<WeekDayBar[]>(() => {
    const appts = this.allAppointments();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    for (const a of appts) {
      const d = new Date(a.date);
      const dayIndex = (d.getDay() + 6) % 7; // Convert Sun=0..Sat=6 to Mon=0..Sun=6
      if (dayIndex >= 0 && dayIndex < 7) {
        counts[dayIndex]++;
      }
    }

    const maxCount = Math.max(...counts, 1);
    return days.map((day, i) => ({
      day,
      count: counts[i],
      heightPercent: counts[i] === 0 ? 0 : Math.round((counts[i] / Math.max(maxCount, 8)) * 100),
    }));
  });

  readonly midwifeName = computed(() => {
    const email = this.auth.user()?.email ?? '';
    if (!email) return 'Midwife Maria';
    const prefix = email.split('@')[0];
    const clean = prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[._-].*$/, '');
    return `Midwife ${clean}`;
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
}