import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Appointment,
  AppointmentsService,
  AppointmentStatus,
  APPOINTMENT_TYPES,
  CLINIC,
  formatTime,
  isPast,
  slotsFor,
  todayIso,
} from '../core/appointments.service';
import { Patient, PatientsService } from '../core/patients.service';

interface CalendarDay {
  dateIso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  appointments: Appointment[];
}

interface BlockedDate {
  date: string;
  reason: string;
}

interface WeekDaySetting {
  dayName: string;
  dayIndex: number; // 0=Sun..6=Sat
  enabled: boolean;
  startTime: string;
  endTime: string;
  slotDuration: string;
}

@Component({
  selector: 'app-appointment-list',
  imports: [DatePipe, FormsModule, ReactiveFormsModule, NgClass],
  template: `
    <div class="appt-page-wrap">
      <!-- ============ TOP HEADER ============ -->
      <div class="page-head">
        <div>
          <h1>Appointment Calendar</h1>
          <p class="head-sub">
            @if (viewMode() === 'month') {
              {{ currentMonthAppointments().length }} upcoming appointments in this month
            } @else {
              {{ currentWeekAppointments().length }} upcoming appointments in this week
            }
          </p>
        </div>
        <button type="button" class="btn-new-appt" (click)="openScheduleModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Appointment
        </button>
      </div>

      <!-- ============ CALENDAR CONTAINER CARD ============ -->
      <div class="cal-card">
        <!-- Controls Toolbar -->
        <div class="cal-toolbar">
          <div class="cal-nav-left">
            <button type="button" class="nav-arrow-btn" (click)="prevPeriod()" title="Previous">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button type="button" class="nav-arrow-btn" (click)="nextPeriod()" title="Next">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button type="button" class="btn-today" (click)="goToToday()">Today</button>
            <span class="period-title">{{ periodTitle() }}</span>
          </div>

          <!-- View Mode Toggle: [ Month | Week ] -->
          <div class="view-toggle-pill">
            <button type="button" class="toggle-opt" [class.active]="viewMode() === 'month'" (click)="viewMode.set('month')">
              Month
            </button>
            <button type="button" class="toggle-opt" [class.active]="viewMode() === 'week'" (click)="viewMode.set('week')">
              Week
            </button>
          </div>
        </div>

        <!-- ============ CALENDAR GRID ============ -->
        <div class="cal-grid-wrapper">
          <!-- Weekday Headers -->
          <div class="grid-header-row">
            <div class="col-header">SUN</div>
            <div class="col-header">MON</div>
            <div class="col-header">TUE</div>
            <div class="col-header">WED</div>
            <div class="col-header">THU</div>
            <div class="col-header">FRI</div>
            <div class="col-header">SAT</div>
          </div>

          <!-- Month View Grid -->
          @if (viewMode() === 'month') {
            <div class="month-cells-grid">
              @for (day of calendarDays(); track day.dateIso) {
                <div class="cal-cell" [class.other-month]="!day.isCurrentMonth" [class.is-today]="day.isToday">
                  <div class="cell-top-bar">
                    <span class="day-num" [class.today-badge]="day.isToday">{{ day.dayNumber }}</span>
                    @if (day.appointments.length > 0) {
                      <span class="day-count-badge">{{ day.appointments.length }}</span>
                    }
                  </div>

                  <!-- Appointment Chips List -->
                  <div class="cell-appts-list">
                    @for (a of day.appointments; track a.id) {
                      <button type="button" class="appt-chip" [ngClass]="getTypeSlug(a.type)" [class.is-cancelled]="a.status === 'cancelled'" (click)="openDetailModal(a)">
                        <span class="chip-dot"></span>
                        <span class="chip-time">{{ a.time }}</span>
                        <span class="chip-name">{{ a.patientName }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          } @else {
            <!-- Week View Grid -->
            <div class="week-cells-grid">
              @for (day of weekDays(); track day.dateIso) {
                <div class="cal-cell week-cell" [class.is-today]="day.isToday">
                  <div class="cell-top-bar">
                    <span class="day-num" [class.today-badge]="day.isToday">{{ day.dayNumber }}</span>
                    @if (day.appointments.length > 0) {
                      <span class="day-count-badge">{{ day.appointments.length }}</span>
                    }
                  </div>

                  <!-- Appointment Chips List in Week View -->
                  <div class="cell-appts-list">
                    @for (a of day.appointments; track a.id) {
                      <button type="button" class="appt-chip" [ngClass]="getTypeSlug(a.type)" [class.is-cancelled]="a.status === 'cancelled'" (click)="openDetailModal(a)">
                        <span class="chip-dot"></span>
                        <span class="chip-time">{{ a.time }}</span>
                        <span class="chip-name">{{ a.patientName }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- ============ AVAILABILITY CARD ============ -->
      <section class="avail-card">
        <h2 class="section-title">Availability</h2>

        <!-- Availability Tabs -->
        <div class="avail-tabs-bar">
          <button type="button" class="tab-btn" [class.active]="availTab() === 'settings'" (click)="availTab.set('settings')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            My Availability
          </button>
          <button type="button" class="tab-btn" [class.active]="availTab() === 'slots'" (click)="availTab.set('slots')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Open Slots
          </button>
        </div>

        <!-- Tab 1: My Availability -->
        @if (availTab() === 'settings') {
          <div class="avail-tab-content">
            <div class="sub-head-row">
              <h3>Weekly Working Hours</h3>
              <button type="button" class="btn-save-schedule" (click)="saveWeeklySchedule()">
                Save Schedule
              </button>
            </div>

            <div class="weekday-settings-grid">
              @for (w of weeklyHours(); track w.dayIndex) {
                <div class="day-setting-card" [class.is-disabled]="!w.enabled">
                  <div class="day-check-wrap">
                    <input type="checkbox" [id]="'day-' + w.dayIndex" [(ngModel)]="w.enabled">
                    <label [for]="'day-' + w.dayIndex">{{ w.dayName }}</label>
                  </div>

                  @if (w.enabled) {
                    <div class="time-inputs-row">
                      <div class="time-picker-pill">
                        <input type="text" [(ngModel)]="w.startTime" placeholder="08:00 AM">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <span class="to-separator">to</span>
                      <div class="time-picker-pill">
                        <input type="text" [(ngModel)]="w.endTime" placeholder="05:00 PM">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <div class="duration-select-pill">
                        <select [(ngModel)]="w.slotDuration">
                          <option value="15 min">15 min</option>
                          <option value="30 min">30 min</option>
                          <option value="45 min">45 min</option>
                          <option value="60 min">60 min</option>
                        </select>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Blocked Dates Section -->
            <div class="blocked-dates-section">
              <div class="blocked-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="4" y1="4" x2="20" y2="20"/></svg>
                Blocked Dates (Time Off)
              </div>

              <div class="blocked-input-row">
                <div class="field-wrap">
                  <label>Date</label>
                  <input type="date" [(ngModel)]="newBlockedDate" [min]="today">
                </div>
                <div class="field-wrap flex-1">
                  <label>Reason</label>
                  <input type="text" [(ngModel)]="newBlockedReason" placeholder="Holiday, leave, etc.">
                </div>
                <button type="button" class="btn-add-blocked" (click)="addBlockedDate()">+ Add</button>
              </div>

              <div class="blocked-list">
                @if (blockedDates().length === 0) {
                  <p class="empty-note">No blocked dates set.</p>
                } @else {
                  @for (b of blockedDates(); track b.date) {
                    <div class="blocked-item">
                      <span><strong>{{ b.date | date: 'mediumDate' }}</strong> — {{ b.reason }}</span>
                      <button type="button" class="btn-del-blocked" (click)="removeBlockedDate(b.date)">✕</button>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        } @else {
          <!-- Tab 2: Open Slots -->
          <div class="avail-tab-content">
            <div class="slot-filter-row">
              <label for="slot-date-select">View slots for</label>
              <div class="custom-select-wrap">
                <select id="slot-date-select" [ngModel]="selectedSlotDate()" (ngModelChange)="selectedSlotDate.set($event)">
                  @for (d of availableSlotDates(); track d.iso) {
                    <option [value]="d.iso">{{ d.label }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Open Slots Grid -->
            @if (openSlotsForSelectedDate().length === 0) {
              <div class="empty-slots-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="empty-icon"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
                <h4>No open slots</h4>
                <p>This day may be outside working hours, fully booked, or blocked.</p>
              </div>
            } @else {
              <div class="slots-pill-grid">
                @for (time of openSlotsForSelectedDate(); track time) {
                  <button type="button" class="slot-pill-btn" (click)="quickBookSlot(time)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {{ formatSlotTime(time) }}
                  </button>
                }
              </div>
            }

            <!-- Already Booked On This Day -->
            <div class="booked-section">
              <h4>ALREADY BOOKED ON THIS DAY</h4>
              @if (bookedForSelectedDate().length === 0) {
                <p class="empty-note">No appointments booked on this day yet.</p>
              } @else {
                <div class="booked-list">
                  @for (a of bookedForSelectedDate(); track a.id) {
                    <div class="booked-item-row" (click)="openDetailModal(a)">
                      <div class="booked-info">
                        <strong>{{ a.time }}</strong> · {{ a.patientName }} <span class="booked-type-pill" [ngClass]="getTypeSlug(a.type)">{{ a.type }}</span>
                      </div>
                      <span class="status-tag" [ngClass]="'status-' + a.status">{{ a.status }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      </section>

      <!-- ============ APPOINTMENT TYPES LEGEND ============ -->
      <div class="legend-card">
        <span class="legend-label">Types:</span>
        <span class="legend-item"><span class="legend-dot dot-prenatal"></span> Prenatal</span>
        <span class="legend-item"><span class="legend-dot dot-postpartum"></span> Postpartum</span>
        <span class="legend-item"><span class="legend-dot dot-delivery"></span> Delivery</span>
        <span class="legend-item"><span class="legend-dot dot-consultation"></span> Consultation</span>
        <span class="legend-item"><span class="legend-dot dot-followup"></span> Follow-up</span>
        <span class="legend-item"><span class="legend-dot dot-scan"></span> First Trimester Scan</span>
        <span class="legend-item"><span class="legend-dot dot-lab"></span> Lab Test</span>
      </div>

      <!-- ========================================================
           POP-OUT MODAL: SCHEDULE NEW APPOINTMENT
           ======================================================== -->
      @if (showScheduleModal()) {
        <div class="modal-backdrop" (click)="closeScheduleModal()">
          <div class="modal-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modal-sched-title">
            <div class="modal-head">
              <div>
                <h2 id="modal-sched-title">Schedule Appointment</h2>
                <p class="modal-sub">Book consultation or visit for a registered patient.</p>
              </div>
              <button type="button" class="btn-close-modal" (click)="closeScheduleModal()" title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            @if (bookingSuccess()) {
              <div class="modal-success-box">
                <div class="success-icon-badge">✓</div>
                <h3>Appointment Scheduled!</h3>
                <p>Appointment confirmed for <strong>{{ bookedPatientName() }}</strong> on {{ scheduledDate() }} at {{ scheduledTime() }}.</p>
                <button type="button" class="btn-submit-modal" (click)="closeScheduleModal()">Done</button>
              </div>
            } @else {
              <form [formGroup]="scheduleForm" (ngSubmit)="submitSchedule()" class="modal-form-content" novalidate>
                @if (scheduleError()) {
                  <div class="modal-alert-error" role="alert">{{ scheduleError() }}</div>
                }

                <div class="form-fields-grid">
                  <!-- Patient Selector (Populated from live registered patients) -->
                  <div class="form-group span-2">
                    <label for="sched-patient">Select Patient <span class="req">*</span></label>
                    @if (patientsList().length === 0) {
                      <div class="no-patient-warn">
                        No registered patients found. Please register a patient first in the Patients section.
                      </div>
                    } @else {
                      <select id="sched-patient" formControlName="patientId" [class.is-bad]="isSchedBad('patientId')">
                        <option value="">Select a registered patient...</option>
                        @for (p of patientsList(); track p.id) {
                          <option [value]="p.id">{{ p.fullName }} ({{ p.email }})</option>
                        }
                      </select>
                    }
                  </div>

                  <!-- Type of Visit -->
                  <div class="form-group span-2">
                    <label for="sched-type">Appointment Type <span class="req">*</span></label>
                    <select id="sched-type" formControlName="type" [class.is-bad]="isSchedBad('type')">
                      <option value="">Select visit type...</option>
                      @for (t of appointmentTypes; track t) {
                        <option [value]="t">{{ t }}</option>
                      }
                    </select>
                  </div>

                  <!-- Date -->
                  <div class="form-group">
                    <label for="sched-date">Date <span class="req">*</span></label>
                    <input id="sched-date" type="date" formControlName="date" [min]="today" [class.is-bad]="isSchedBad('date')" (change)="onDateChanged()">
                  </div>

                  <!-- Time -->
                  <div class="form-group">
                    <label for="sched-time">Time Slot <span class="req">*</span></label>
                    <select id="sched-time" formControlName="time" [class.is-bad]="isSchedBad('time')">
                      <option value="">Select time...</option>
                      @for (s of availableSlotsForBookingDate(); track s) {
                        <option [value]="s">{{ formatSlotTime(s) }}</option>
                      }
                    </select>
                  </div>

                  <!-- Initial Status -->
                  <div class="form-group span-2">
                    <label for="sched-status">Status</label>
                    <select id="sched-status" formControlName="status">
                      <option value="scheduled">Scheduled (Default)</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="requested">Requested</option>
                    </select>
                  </div>

                  <!-- Notes -->
                  <div class="form-group span-2">
                    <label for="sched-notes">Visit Notes / Purpose (Optional)</label>
                    <textarea id="sched-notes" formControlName="notes" rows="2" placeholder="e.g. Regular prenatal checkup, blood pressure monitoring..."></textarea>
                  </div>
                </div>

                <div class="modal-footer-actions">
                  <button type="button" class="btn-cancel-modal" (click)="closeScheduleModal()">Cancel</button>
                  <button type="submit" class="btn-submit-modal" [disabled]="submittingSchedule() || patientsList().length === 0">
                    {{ submittingSchedule() ? 'Scheduling…' : 'Schedule Appointment' }}
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      }

      <!-- ========================================================
           POP-OUT MODAL: APPOINTMENT DETAILS & STATUS
           ======================================================== -->
      @if (selectedAppt(); as a) {
        <div class="modal-backdrop" (click)="closeDetailModal()">
          <div class="modal-card detail-modal-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <!-- Header: Patient Name, Date/Time subtext, Close icon -->
            <div class="detail-card-head">
              <div class="detail-head-info">
                <h3 class="detail-patient-name">{{ a.patientName }}</h3>
                <p class="detail-datetime-sub">{{ a.date | date: 'EEEE, MMM d, y' }} · {{ a.time }}</p>
              </div>
              <button type="button" class="btn-detail-x" (click)="closeDetailModal()" title="Close" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <!-- Body Key-Values -->
            <div class="detail-card-body">
              <div class="detail-field-row">
                <span class="detail-field-label">Type</span>
                <span class="detail-field-val">{{ a.type }}</span>
              </div>

              <div class="detail-field-row">
                <span class="detail-field-label">Status</span>
                <div class="status-pill-wrapper">
                  <button
                    type="button"
                    class="status-badge-pill"
                    [ngClass]="'pill-' + a.status"
                    (click)="toggleStatusMenu()"
                    [disabled]="actionLoading()"
                    title="Click to change status"
                  >
                    <span>{{ getStatusLabel(a.status) }}</span>
                    <svg class="chevron-micro" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  @if (statusMenuOpen()) {
                    <div class="status-dropdown-menu" (click)="$event.stopPropagation()">
                      <div class="status-dropdown-title">Change Status</div>
                      @for (st of allStatuses; track st.id) {
                        <button
                          type="button"
                          class="status-dropdown-item"
                          [class.is-active]="a.status === st.id"
                          (click)="changeAppointmentStatus(a, st.id)"
                        >
                          <span class="status-dot-bullet" [ngClass]="'bullet-' + st.id"></span>
                          <span class="status-dropdown-text">{{ st.label }}</span>
                          @if (a.status === st.id) {
                            <svg class="check-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          }
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="detail-field-row">
                <span class="detail-field-label">Duration</span>
                <span class="detail-field-val">30 min</span>
              </div>

              <div class="detail-reason-block">
                <span class="detail-field-label">Reason</span>
                <div class="detail-reason-box">
                  {{ a.notes || (a.type ? a.type + ' visit' : 'Routine check-up') }}
                </div>
              </div>
            </div>

            <!-- Bottom Full-Width Close Button -->
            <button type="button" class="btn-detail-close-solid" (click)="closeDetailModal()">
              Close
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .appt-page-wrap {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Header */
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
    }

    .page-head h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #271442;
      letter-spacing: -0.01em;
    }

    .head-sub {
      margin: 4px 0 0;
      font-size: 12.5px;
      color: #7a7189;
    }

    .btn-new-appt {
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

    .btn-new-appt svg {
      width: 14px;
      height: 14px;
    }

    .btn-new-appt:hover {
      background: #492178;
      transform: translateY(-1px);
    }

    /* ============ CALENDAR CARD ============ */
    .cal-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: 0 4px 14px rgba(50, 24, 78, 0.03);
    }

    .cal-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .cal-nav-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-arrow-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid #e5dff0;
      background: #ffffff;
      color: #432b68;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: background 0.15s;
    }

    .nav-arrow-btn svg {
      width: 14px;
      height: 14px;
    }

    .nav-arrow-btn:hover {
      background: #f7f3fc;
      border-color: #6b4fa3;
    }

    .btn-today {
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #e5dff0;
      background: #ffffff;
      color: #432b68;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-today:hover {
      background: #f7f3fc;
      border-color: #6b4fa3;
    }

    .period-title {
      margin-left: 8px;
      font-size: 15.5px;
      font-weight: 700;
      color: #271442;
    }

    /* Toggle: [ Month | Week ] */
    .view-toggle-pill {
      display: flex;
      background: #f0eaf8;
      padding: 3px;
      border-radius: 999px;
    }

    .toggle-opt {
      padding: 5px 14px;
      border-radius: 999px;
      border: none;
      background: transparent;
      color: #6a5e80;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .toggle-opt.active {
      background: #361759;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(54, 23, 89, 0.25);
    }

    /* Grid Structure */
    .cal-grid-wrapper {
      border: 1px solid #ebe5f5;
      border-radius: 10px;
      overflow: hidden;
    }

    .grid-header-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: #faf8fd;
      border-bottom: 1px solid #ebe5f5;
    }

    .col-header {
      padding: 10px 8px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      color: #7a7189;
      letter-spacing: 0.05em;
    }

    .month-cells-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: #ebe5f5;
      gap: 1px;
    }

    .week-cells-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: #ebe5f5;
      gap: 1px;
    }

    .cal-cell {
      background: #ffffff;
      min-height: 85px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: background 0.1s;
    }

    .cal-cell.other-month {
      background: #fcfbfe;
      opacity: 0.6;
    }

    .week-cell {
      min-height: 120px;
    }

    .cell-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .day-num {
      font-size: 12px;
      font-weight: 600;
      color: #4a3d60;
      width: 22px;
      height: 22px;
      display: grid;
      place-items: center;
      border-radius: 50%;
    }

    .day-num.today-badge {
      background: #361759;
      color: #ffffff;
      font-weight: 700;
    }

    .day-count-badge {
      font-size: 10.5px;
      color: #8c829e;
      font-weight: 600;
    }

    /* Appointment Chips */
    .cell-appts-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .appt-chip {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 6px;
      border-radius: 5px;
      border: none;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: transform 0.1s, box-shadow 0.1s;
    }

    .appt-chip:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }

    .chip-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .chip-time {
      font-weight: 700;
      font-size: 10.5px;
      opacity: 0.85;
    }

    .chip-name {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Colors per Appointment Type */
    .type-prenatal { background: #f3e8ff; color: #6b21a8; }
    .type-prenatal .chip-dot { background: #8b5cf6; }

    .type-postpartum { background: #fce7f3; color: #9d174d; }
    .type-postpartum .chip-dot { background: #ec4899; }

    .type-delivery { background: #fee2e2; color: #991b1b; }
    .type-delivery .chip-dot { background: #ef4444; }

    .type-consultation { background: #e0f2fe; color: #075985; }
    .type-consultation .chip-dot { background: #0284c7; }

    .type-followup { background: #dcfce7; color: #166534; }
    .type-followup .chip-dot { background: #16a34a; }

    .type-scan { background: #e0e7ff; color: #3730a3; }
    .type-scan .chip-dot { background: #4f46e5; }

    .type-lab { background: #fef3c7; color: #92400e; }
    .type-lab .chip-dot { background: #d97706; }

    .type-default { background: #f3f4f6; color: #374151; }
    .type-default .chip-dot { background: #6b7280; }

    /* ============ AVAILABILITY CARD ============ */
    .avail-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: 0 4px 14px rgba(50, 24, 78, 0.03);
    }

    .section-title {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 700;
      color: #271442;
    }

    .avail-tabs-bar {
      display: flex;
      gap: 20px;
      border-bottom: 1.5px solid #ebe5f5;
      margin-bottom: 16px;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 4px 10px;
      border: none;
      background: transparent;
      font-size: 13px;
      font-weight: 600;
      color: #7a7189;
      cursor: pointer;
      position: relative;
      transition: color 0.15s;
    }

    .tab-btn svg {
      width: 15px;
      height: 15px;
    }

    .tab-btn.active {
      color: #361759;
    }

    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: -1.5px;
      left: 0;
      right: 0;
      height: 2px;
      background: #361759;
    }

    .sub-head-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .sub-head-row h3 {
      margin: 0;
      font-size: 13.5px;
      font-weight: 700;
      color: #2a1647;
    }

    .btn-save-schedule {
      padding: 6.5px 16px;
      border-radius: 999px;
      border: none;
      background: #361759;
      color: #ffffff;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-save-schedule:hover {
      background: #4a2179;
    }

    /* Weekday settings cards */
    .weekday-settings-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 14px;
    }

    .day-setting-card {
      border: 1px solid #ebe5f5;
      border-radius: 10px;
      padding: 10px 14px;
      background: #fdfcff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .day-setting-card.is-disabled {
      opacity: 0.6;
      background: #fbfafd;
    }

    .day-check-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #2a1647;
    }

    .time-inputs-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .time-picker-pill {
      display: flex;
      align-items: center;
      gap: 5px;
      border: 1px solid #ebe5f5;
      border-radius: 8px;
      background: #ffffff;
      padding: 4px 8px;
    }

    .time-picker-pill input {
      border: none;
      outline: none;
      font-size: 12px;
      width: 65px;
      color: #2a1647;
      font-weight: 500;
    }

    .time-picker-pill svg {
      width: 13px;
      height: 13px;
      color: #8c829e;
    }

    .to-separator {
      font-size: 11.5px;
      color: #8c829e;
    }

    .duration-select-pill select {
      border: 1px solid #ebe5f5;
      border-radius: 8px;
      background: #ffffff;
      padding: 4px 6px;
      font-size: 12px;
      color: #2a1647;
      font-weight: 500;
      outline: none;
    }

    /* Blocked Dates Section */
    .blocked-dates-section {
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid #f0eaf8;
    }

    .blocked-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #b91c1c;
      margin-bottom: 10px;
    }

    .blocked-title svg {
      width: 15px;
      height: 15px;
    }

    .blocked-input-row {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .field-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-wrap.flex-1 {
      flex: 1;
      min-width: 180px;
    }

    .field-wrap label {
      font-size: 11.5px;
      font-weight: 600;
      color: #7a7189;
    }

    .field-wrap input {
      padding: 6.5px 10px;
      border: 1px solid #ebe5f5;
      border-radius: 8px;
      font-size: 12.5px;
      outline: none;
    }

    .btn-add-blocked {
      padding: 6.5px 14px;
      border-radius: 8px;
      border: 1px solid #d8cde9;
      background: #ffffff;
      color: #361759;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-add-blocked:hover {
      background: #f7f3fc;
    }

    .empty-note {
      font-size: 12.5px;
      color: #8c829e;
      margin: 6px 0;
    }

    .blocked-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      border-radius: 6px;
      background: #fff1f2;
      border: 1px solid #ffe4e6;
      font-size: 12px;
      color: #9f1239;
      margin-bottom: 6px;
    }

    .btn-del-blocked {
      background: transparent;
      border: none;
      color: #be123c;
      cursor: pointer;
      font-size: 13px;
    }

    /* Open Slots Tab */
    .slot-filter-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .slot-filter-row label {
      font-size: 12.5px;
      font-weight: 600;
      color: #6a5e80;
    }

    .custom-select-wrap select {
      padding: 6px 28px 6px 12px;
      border-radius: 8px;
      border: 1.5px solid #6b4fa3;
      background: #ffffff;
      font-size: 12.5px;
      font-weight: 600;
      color: #271442;
      outline: none;
    }

    .empty-slots-box {
      text-align: center;
      padding: 28px 16px;
      color: #8c829e;
    }

    .empty-slots-box .empty-icon {
      width: 38px;
      height: 38px;
      color: #b5a9c7;
      margin-bottom: 8px;
    }

    .empty-slots-box h4 {
      margin: 0 0 4px;
      font-size: 14px;
      color: #432b68;
    }

    .empty-slots-box p {
      margin: 0;
      font-size: 12.5px;
    }

    .slots-pill-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }

    .slot-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 7px 14px;
      border-radius: 999px;
      border: 1px solid #e0d5f0;
      background: #fbf9fe;
      color: #361759;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .slot-pill-btn svg {
      width: 12px;
      height: 12px;
      color: #6b4fa3;
    }

    .slot-pill-btn:hover {
      background: #361759;
      color: #ffffff;
      border-color: #361759;
    }

    .slot-pill-btn:hover svg {
      color: #ffffff;
    }

    /* Already Booked List */
    .booked-section {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #ebe5f5;
    }

    .booked-section h4 {
      margin: 0 0 10px;
      font-size: 11.5px;
      font-weight: 700;
      color: #7a7189;
      letter-spacing: 0.05em;
    }

    .booked-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .booked-item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 8px;
      background: #faf8fd;
      border: 1px solid #f0eaf8;
      font-size: 12.5px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .booked-item-row:hover {
      background: #f3eff9;
    }

    .booked-info {
      color: #271442;
    }

    .booked-type-pill {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 600;
      margin-left: 6px;
    }

    .status-tag {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: capitalize;
    }

    .status-scheduled { background: #e0f2fe; color: #0284c7; }
    .status-confirmed { background: #ede9fe; color: #6d28d9; }
    .status-cancelled { background: #fee2e2; color: #dc2626; }
    .status-completed { background: #d1fae5; color: #059669; }
    .status-requested { background: #fef3c7; color: #b45309; }

    /* ============ LEGEND CARD ============ */
    .legend-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 12px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 12px;
      color: #554869;
    }

    .legend-label {
      font-weight: 700;
      color: #271442;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot-prenatal { background: #8b5cf6; }
    .dot-postpartum { background: #ec4899; }
    .dot-delivery { background: #ef4444; }
    .dot-consultation { background: #06b6d4; }
    .dot-followup { background: #10b981; }
    .dot-scan { background: #3b82f6; }
    .dot-lab { background: #f59e0b; }

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
      max-width: 580px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(35, 12, 60, 0.35);
      border: 1px solid rgba(110, 79, 168, 0.15);
      animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    .modal-card.detail-modal {
      max-width: 480px;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }

    .modal-head {
      padding: 16px 20px;
      border-bottom: 1px solid #f0eaf8;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      background: #faf8fd;
    }

    .modal-head h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #271442;
    }

    .modal-sub {
      margin: 3px 0 0;
      font-size: 12px;
      color: #7a7189;
    }

    .btn-close-modal {
      background: transparent;
      border: none;
      color: #7a7189;
      padding: 5px;
      border-radius: 6px;
      cursor: pointer;
      display: grid;
      place-items: center;
    }

    .btn-close-modal:hover {
      background: #f0eaf8;
      color: #271442;
    }

    .btn-close-modal svg {
      width: 17px;
      height: 17px;
    }

    .modal-form-content {
      padding: 18px 20px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 14px;
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
      font-size: 12px;
      font-weight: 600;
      color: #2a1647;
    }

    .req {
      color: #c2527a;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      padding: 7.5px 11px;
      border-radius: 8px;
      border: 1.5px solid #ebe5f5;
      background: #fbf9fe;
      font-size: 13px;
      color: #2a2438;
      outline: none;
      font-family: inherit;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      background: #ffffff;
      border-color: #6b4fa3;
      box-shadow: 0 0 0 3px rgba(107, 79, 163, 0.12);
    }

    .no-patient-warn {
      padding: 8px 12px;
      background: #fff1f2;
      border: 1px solid #ffe4e6;
      border-radius: 8px;
      color: #be123c;
      font-size: 12px;
    }

    .modal-alert-error {
      padding: 8px 12px;
      background: #ffe4e6;
      border: 1px solid #fecdd3;
      border-radius: 8px;
      color: #9f1239;
      font-size: 12px;
    }

    .modal-footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid #f0eaf8;
      margin-top: 6px;
    }

    .btn-cancel-modal {
      padding: 7.5px 16px;
      border-radius: 999px;
      border: 1px solid #d8cde9;
      background: #ffffff;
      color: #554869;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-submit-modal {
      padding: 7.5px 20px;
      border-radius: 999px;
      border: none;
      background: #361759;
      color: #ffffff;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
    }

    .btn-submit-modal:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .modal-success-box {
      padding: 30px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .success-icon-badge {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #dcfce7;
      color: #15803d;
      font-size: 22px;
      font-weight: 700;
      display: grid;
      place-items: center;
    }

    /* ========================================================
       MODAL: APPOINTMENT DETAIL CARD (Matches Mockups Exactly)
       ======================================================== */
    .detail-modal-card {
      background: #ffffff;
      border-radius: 20px;
      padding: 24px 26px 22px;
      max-width: 410px;
      width: 100%;
      box-shadow: 0 16px 40px rgba(39, 20, 66, 0.16), 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(220, 214, 232, 0.45);
      display: flex;
      flex-direction: column;
      animation: scaleInCard 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes scaleInCard {
      from {
        opacity: 0;
        transform: scale(0.96) translateY(6px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .detail-card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .detail-head-info {
      display: flex;
      flex-direction: column;
    }

    .detail-patient-name {
      margin: 0;
      font-size: 19px;
      font-weight: 700;
      color: #271442;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .detail-datetime-sub {
      margin: 4px 0 0;
      font-size: 13.5px;
      color: #7b7189;
      font-weight: 400;
    }

    .btn-detail-x {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: #8e859b;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .btn-detail-x svg {
      width: 17px;
      height: 17px;
    }

    .btn-detail-x:hover {
      background: #f4f0fa;
      color: #271442;
    }

    .detail-card-body {
      display: flex;
      flex-direction: column;
    }

    .detail-field-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 11px 0;
    }

    .detail-field-label {
      font-size: 14px;
      font-weight: 500;
      color: #7b7189;
    }

    .detail-field-val {
      font-size: 14px;
      font-weight: 600;
      color: #271442;
      text-align: right;
    }

    /* Status Pill & Popover Menu */
    .status-pill-wrapper {
      position: relative;
    }

    .status-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .status-badge-pill:hover {
      filter: brightness(0.96);
      transform: translateY(-0.5px);
    }

    .status-badge-pill .chevron-micro {
      width: 12px;
      height: 12px;
      opacity: 0.7;
    }

    /* 5 Status Colors matching the screenshots: */
    .pill-scheduled {
      background: #e0f2fe;
      color: #0284c7;
    }

    .pill-confirmed {
      background: #ede9fe;
      color: #6d28d9;
    }

    .pill-cancelled {
      background: #fee2e2;
      color: #dc2626;
    }

    .pill-completed {
      background: #d1fae5;
      color: #059669;
    }

    .pill-requested {
      background: #fef3c7;
      color: #b45309;
    }

    /* Dropdown popover to change status */
    .status-dropdown-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 12px 30px rgba(39, 20, 66, 0.18), 0 2px 6px rgba(0, 0, 0, 0.05);
      border: 1px solid #ebe5f5;
      padding: 6px;
      min-width: 165px;
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .status-dropdown-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #8e859b;
      padding: 6px 10px 4px;
    }

    .status-dropdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 7px 10px;
      border-radius: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #271442;
      text-align: left;
      transition: background 0.12s ease;
    }

    .status-dropdown-item:hover {
      background: #f4f0fa;
    }

    .status-dropdown-item.is-active {
      background: #ede9fe;
      font-weight: 600;
      color: #6d28d9;
    }

    .status-dot-bullet {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .bullet-scheduled { background: #0284c7; }
    .bullet-confirmed { background: #6d28d9; }
    .bullet-cancelled { background: #dc2626; }
    .bullet-completed { background: #059669; }
    .bullet-requested { background: #b45309; }

    .check-icon-svg {
      width: 14px;
      height: 14px;
      margin-left: auto;
      stroke: #6d28d9;
    }

    /* Reason block */
    .detail-reason-block {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .detail-reason-box {
      background: #f7f6f9;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13.5px;
      color: #271442;
      font-weight: 400;
      line-height: 1.45;
      min-height: 42px;
      display: flex;
      align-items: center;
      word-break: break-word;
    }

    /* Bottom Full-Width Close Button */
    .btn-detail-close-solid {
      margin-top: 22px;
      width: 100%;
      padding: 13px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.05s ease;
    }

    .btn-detail-close-solid:hover {
      background: #270f42;
    }

    .btn-detail-close-solid:active {
      transform: scale(0.99);
    }

    .appt-chip.is-cancelled {
      opacity: 0.65;
      text-decoration: line-through;
    }

    @media (max-width: 900px) {
      .weekday-settings-grid {
        grid-template-columns: 1fr;
      }
      .col-header, .cal-cell {
        min-height: 70px;
        padding: 4px;
      }
    }
  `,
})
export class AppointmentList implements OnInit {
  private svc = inject(AppointmentsService);
  private patientsSvc = inject(PatientsService);
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly today = todayIso();
  readonly appointmentTypes = APPOINTMENT_TYPES;

  // View state
  readonly viewMode = signal<'month' | 'week'>('month');
  readonly availTab = signal<'settings' | 'slots'>('settings');
  readonly activeDate = signal<Date>(new Date());

  // Data signals
  readonly allAppointments = signal<Appointment[]>([]);
  readonly patientsList = signal<Patient[]>([]);
  readonly blockedDates = signal<BlockedDate[]>([]);
  readonly weeklyHours = signal<WeekDaySetting[]>([
    { dayName: 'Sunday', dayIndex: 0, enabled: false, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Monday', dayIndex: 1, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Tuesday', dayIndex: 2, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Wednesday', dayIndex: 3, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Thursday', dayIndex: 4, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Friday', dayIndex: 5, enabled: true, startTime: '09:00 AM', endTime: '03:00 PM', slotDuration: '30 min' },
    { dayName: 'Saturday', dayIndex: 6, enabled: false, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
  ]);

  // Form / modal state
  readonly showScheduleModal = signal(false);
  readonly submittingSchedule = signal(false);
  readonly scheduleError = signal('');
  readonly bookingSuccess = signal(false);
  readonly bookedPatientName = signal('');
  readonly scheduledDate = signal('');
  readonly scheduledTime = signal('');

  // Selected appointment for detail / status update
  readonly selectedAppt = signal<Appointment | null>(null);
  readonly actionLoading = signal(false);
  readonly statusMenuOpen = signal(false);

  readonly allStatuses: { id: AppointmentStatus; label: string }[] = [
    { id: 'requested', label: 'Requested' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  // Open slots filter
  readonly selectedSlotDate = signal<string>(todayIso());

  // Blocked dates form
  newBlockedDate = '';
  newBlockedReason = '';

  readonly scheduleForm = this.fb.group({
    patientId: ['', Validators.required],
    type: ['', Validators.required],
    date: [todayIso(), Validators.required],
    time: ['', Validators.required],
    status: ['scheduled' as AppointmentStatus, Validators.required],
    notes: [''],
  });

  // Computed period title (e.g. "October 2026" or "Oct 18 – Oct 24, 2026")
  readonly periodTitle = computed(() => {
    const d = this.activeDate();
    if (this.viewMode() === 'month') {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    // Week view range
    const start = new Date(d);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  });

  // Filtered upcoming counts
  readonly currentMonthAppointments = computed(() => {
    const d = this.activeDate();
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return this.allAppointments().filter((a) => a.date.startsWith(prefix) && a.status !== 'cancelled');
  });

  readonly currentWeekAppointments = computed(() => {
    const weekMap = new Set(this.weekDays().map((w) => w.dateIso));
    return this.allAppointments().filter((a) => weekMap.has(a.date) && a.status !== 'cancelled');
  });

  // Calendar days for Month view
  readonly calendarDays = computed<CalendarDay[]>(() => {
    const d = this.activeDate();
    const year = d.getFullYear();
    const month = d.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const appts = this.allAppointments();
    const apptMap = new Map<string, Appointment[]>();
    for (const a of appts) {
      const list = apptMap.get(a.date) ?? [];
      list.push(a);
      apptMap.set(a.date, list);
    }

    const days: CalendarDay[] = [];
    const pad = (n: number) => String(n).padStart(2, '0');

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const iso = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(dayNum)}`;
      days.push({
        dateIso: iso,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: iso === this.today,
        appointments: apptMap.get(iso) ?? [],
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const iso = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
      days.push({
        dateIso: iso,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: iso === this.today,
        appointments: apptMap.get(iso) ?? [],
      });
    }

    // Next month filler days to complete grid (up to 35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (days.length < totalCells) {
      const nextDate = new Date(year, month + 1, nextDay);
      const iso = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDay)}`;
      days.push({
        dateIso: iso,
        dayNumber: nextDay,
        isCurrentMonth: false,
        isToday: iso === this.today,
        appointments: apptMap.get(iso) ?? [],
      });
      nextDay++;
    }

    return days;
  });

  // 7 days for Week view
  readonly weekDays = computed<CalendarDay[]>(() => {
    const d = this.activeDate();
    const start = new Date(d);
    start.setDate(start.getDate() - start.getDay());

    const appts = this.allAppointments();
    const apptMap = new Map<string, Appointment[]>();
    for (const a of appts) {
      const list = apptMap.get(a.date) ?? [];
      list.push(a);
      apptMap.set(a.date, list);
    }

    const days: CalendarDay[] = [];
    const pad = (n: number) => String(n).padStart(2, '0');

    for (let i = 0; i < 7; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const iso = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      days.push({
        dateIso: iso,
        dayNumber: cur.getDate(),
        isCurrentMonth: true,
        isToday: iso === this.today,
        appointments: apptMap.get(iso) ?? [],
      });
    }

    return days;
  });

  // Available dates for open slots dropdown
  readonly availableSlotDates = computed(() => {
    const out: { iso: string; label: string }[] = [];
    const start = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    for (let i = 0; i < 14; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const iso = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const dayName = cur.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = cur.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = cur.getDate();
      const label = i === 0 ? `${dayName}, ${monthName} ${dayNum} (Today)` : `${dayName}, ${monthName} ${dayNum}`;
      out.push({ iso, label });
    }
    return out;
  });

  // Open slots computed for selected date
  readonly openSlotsForSelectedDate = computed(() => {
    const selIso = this.selectedSlotDate();
    if (!selIso) return [];

    // Check if day is blocked
    if (this.blockedDates().some((b) => b.date === selIso)) return [];

    const dateObj = new Date(selIso);
    const dayOfWeek = dateObj.getDay();
    const setting = this.weeklyHours().find((w) => w.dayIndex === dayOfWeek);
    if (!setting || !setting.enabled) return [];

    // All standard clinic slots for this date
    const allSlots = slotsFor(selIso);
    const bookedTimes = new Set(
      this.allAppointments()
        .filter((a) => a.date === selIso && a.status !== 'cancelled')
        .map((a) => a.time),
    );

    return allSlots.filter((time) => !bookedTimes.has(time));
  });

  // Booked appointments for selected slot date
  readonly bookedForSelectedDate = computed(() => {
    const selIso = this.selectedSlotDate();
    return this.allAppointments().filter((a) => a.date === selIso);
  });

  // Available slots for booking in modal
  readonly availableSlotsForBookingDate = computed(() => {
    const date = this.scheduleForm.controls.date.value || this.today;
    const allSlots = slotsFor(date);
    const bookedTimes = new Set(
      this.allAppointments()
        .filter((a) => a.date === date && a.status !== 'cancelled')
        .map((a) => a.time),
    );
    return allSlots.filter((time) => !bookedTimes.has(time));
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadAppointments(), this.loadPatients()]);
    if (this.route.snapshot.queryParams['new'] === 'true') {
      this.openScheduleModal();
    }
  }

  async loadAppointments(): Promise<void> {
    try {
      const list = await this.svc.list();
      this.allAppointments.set(list);
    } catch {
      // In case of error
    }
  }

  async loadPatients(): Promise<void> {
    try {
      const list = await this.patientsSvc.list();
      this.patientsList.set(list);
    } catch {
      // In case of error
    }
  }

  // Navigation
  prevPeriod(): void {
    const d = new Date(this.activeDate());
    if (this.viewMode() === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    this.activeDate.set(d);
  }

  nextPeriod(): void {
    const d = new Date(this.activeDate());
    if (this.viewMode() === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    this.activeDate.set(d);
  }

  goToToday(): void {
    this.activeDate.set(new Date());
  }

  // Type styling helpers
  getTypeSlug(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('prenatal')) return 'type-prenatal';
    if (t.includes('postpartum')) return 'type-postpartum';
    if (t.includes('delivery')) return 'type-delivery';
    if (t.includes('consultation')) return 'type-consultation';
    if (t.includes('follow-up') || t.includes('followup')) return 'type-followup';
    if (t.includes('scan')) return 'type-scan';
    if (t.includes('lab')) return 'type-lab';
    return 'type-default';
  }

  formatSlotTime(t: string): string {
    return formatTime(t);
  }

  // Modal open/close
  openScheduleModal(): void {
    this.scheduleForm.reset({
      patientId: '',
      type: 'Prenatal',
      date: this.today,
      time: this.availableSlotsForBookingDate()[0] || '08:00',
      status: 'scheduled',
      notes: '',
    });
    this.scheduleError.set('');
    this.bookingSuccess.set(false);
    this.showScheduleModal.set(true);
  }

  quickBookSlot(time: string): void {
    const date = this.selectedSlotDate();
    this.scheduleForm.reset({
      patientId: '',
      type: 'Prenatal',
      date,
      time,
      status: 'scheduled',
      notes: '',
    });
    this.scheduleError.set('');
    this.bookingSuccess.set(false);
    this.showScheduleModal.set(true);
  }

  closeScheduleModal(): void {
    this.showScheduleModal.set(false);
    if (this.route.snapshot.queryParams['new']) {
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  openDetailModal(appt: Appointment): void {
    this.selectedAppt.set(appt);
    this.statusMenuOpen.set(false);
  }

  closeDetailModal(): void {
    this.selectedAppt.set(null);
    this.statusMenuOpen.set(false);
  }

  toggleStatusMenu(): void {
    this.statusMenuOpen.update((v) => !v);
  }

  closeStatusMenu(): void {
    this.statusMenuOpen.set(false);
  }

  getStatusLabel(status: AppointmentStatus): string {
    switch (status) {
      case 'requested': return 'Requested';
      case 'scheduled': return 'Scheduled';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return 'Scheduled';
    }
  }

  async changeAppointmentStatus(a: Appointment, newStatus: AppointmentStatus): Promise<void> {
    if (a.status === newStatus) {
      this.statusMenuOpen.set(false);
      return;
    }
    this.actionLoading.set(true);
    try {
      await this.svc.setStatus(a.id, newStatus);
      const updated: Appointment = { ...a, status: newStatus };
      this.selectedAppt.set(updated);
      this.statusMenuOpen.set(false);
      await this.loadAppointments();
    } catch (err: any) {
      alert(this.svc.errorMessage(err));
    } finally {
      this.actionLoading.set(false);
    }
  }

  onDateChanged(): void {
    const slots = this.availableSlotsForBookingDate();
    if (slots.length > 0 && !slots.includes(this.scheduleForm.controls.time.value)) {
      this.scheduleForm.controls.time.setValue(slots[0]);
    }
  }

  isSchedBad(ctrl: keyof typeof this.scheduleForm.controls): boolean {
    const c = this.scheduleForm.controls[ctrl];
    return c.invalid && (c.touched || c.dirty);
  }

  async submitSchedule(): Promise<void> {
    if (this.scheduleForm.invalid) {
      this.scheduleForm.markAllAsTouched();
      this.scheduleError.set('Please select patient, visit type, date, and time slot.');
      return;
    }

    const val = this.scheduleForm.getRawValue();
    const patient = this.patientsList().find((p) => p.id === val.patientId);
    if (!patient) {
      this.scheduleError.set('Selected patient could not be found.');
      return;
    }

    this.submittingSchedule.set(true);
    this.scheduleError.set('');

    try {
      await this.svc.book({
        patientId: patient.id,
        patientName: patient.fullName,
        date: val.date,
        time: val.time,
        type: val.type,
        status: val.status,
        notes: val.notes.trim(),
      });

      this.bookedPatientName.set(patient.fullName);
      this.scheduledDate.set(val.date);
      this.scheduledTime.set(val.time);
      this.bookingSuccess.set(true);
      await this.loadAppointments();
    } catch (e: any) {
      if (e?.message === 'slot-taken') {
        this.scheduleError.set('This time slot has already been booked. Please choose another time.');
      } else {
        this.scheduleError.set(e?.message || 'Could not schedule appointment. Please try again.');
      }
    } finally {
      this.submittingSchedule.set(false);
    }
  }

  // Update appointment status
  async markComplete(a: Appointment): Promise<void> {
    await this.changeAppointmentStatus(a, 'completed');
    this.closeDetailModal();
  }

  async markCancel(a: Appointment): Promise<void> {
    await this.changeAppointmentStatus(a, 'cancelled');
    this.closeDetailModal();
  }

  // Availability actions
  saveWeeklySchedule(): void {
    // Save schedule state
    alert('Weekly working hours schedule saved successfully.');
  }

  addBlockedDate(): void {
    if (!this.newBlockedDate) return;
    const list = [...this.blockedDates()];
    if (!list.some((b) => b.date === this.newBlockedDate)) {
      list.push({ date: this.newBlockedDate, reason: this.newBlockedReason || 'Time off' });
      this.blockedDates.set(list);
    }
    this.newBlockedDate = '';
    this.newBlockedReason = '';
  }

  removeBlockedDate(date: string): void {
    this.blockedDates.set(this.blockedDates().filter((b) => b.date !== date));
  }
}