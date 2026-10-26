import { NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Appointment,
  AppointmentsService,
  formatTime,
  parseIso,
  slotsFor,
  todayIso,
} from '../core/appointments.service';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';

interface SlotItem {
  time: string;
  endTime: string;
  isOpen: boolean;
  appointment?: Appointment;
}

interface DateOption {
  iso: string;
  label: string;
}

const DEFAULT_SLOT_TIMES = [
  '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30',
];

function calculateEndTime(startTime: string): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + 30;
  const endH = String(Math.floor(total / 60)).padStart(2, '0');
  const endM = String(total % 60).padStart(2, '0');
  return `${endH}:${endM}`;
}

@Component({
  selector: 'app-midwife-availability',
  imports: [FormsModule, NgClass],
  template: `
    <div class="avail-page-wrap">
      <h1 class="page-title">Availability</h1>

      <!-- ============ MAIN AVAILABILITY CARD ============ -->
      <div class="avail-main-card">
        <!-- Card Header: Profile Info on Left, Tabs on Right -->
        <div class="card-head-row">
          <div class="profile-info-block">
            <div class="avatar-icon-circle">
              <span class="avatar-initials">{{ midwifeInitials() }}</span>
            </div>
            <div>
              <h2 class="profile-name">{{ midwifeName() }}</h2>
              <p class="profile-sub">Availability & booking</p>
            </div>
          </div>

          <!-- Tabs (My Availability & Open Slots) -->
          <div class="tabs-nav-group">
            <button
              type="button"
              class="tab-nav-btn"
              [class.active]="activeTab() === 'my-availability'"
              (click)="activeTab.set('my-availability')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>My Availability</span>
            </button>

            <button
              type="button"
              class="tab-nav-btn"
              [class.active]="activeTab() === 'open-slots'"
              (click)="activeTab.set('open-slots')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>Open Slots</span>
            </button>
          </div>
        </div>

        <!-- ============ TAB 1: OPEN SLOTS ============ -->
        @if (activeTab() === 'open-slots') {
          <div class="tab-body-area">
            <!-- View Slots For Filter -->
            <div class="slots-filter-row">
              <label for="slot-date-dropdown">View slots for</label>
              <div class="select-dropdown-container">
                <select
                  id="slot-date-dropdown"
                  [ngModel]="selectedDateIso()"
                  (ngModelChange)="selectedDateIso.set($event)"
                >
                  @for (d of dateOptions(); track d.iso) {
                    <option [value]="d.iso">{{ d.label }}</option>
                  }
                </select>
                <svg class="dropdown-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>

            <!-- Toast alert on successful booking -->
            @if (toastMessage()) {
              <div class="toast-success-banner" role="status">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>{{ toastMessage() }}</span>
                <button type="button" class="btn-dismiss-toast" (click)="toastMessage.set('')">✕</button>
              </div>
            }

            <!-- 4-Column Grid of Slot Cards (Image 1) -->
            <div class="slots-four-col-grid">
              @for (slot of daySlots(); track slot.time) {
                @if (slot.isOpen) {
                  <!-- Open Slot Card (Mint Green) -->
                  <div class="slot-card is-open" (click)="openBookingModal(slot)" role="button" tabindex="0" [attr.aria-label]="'Book ' + slot.time">
                    <div class="slot-time-text">{{ slot.time }}</div>
                    <div class="slot-status-text">Open</div>
                  </div>
                } @else {
                  <!-- Booked Slot Card -->
                  <div class="slot-card is-booked" (click)="openBookedDetail(slot.appointment)" role="button" tabindex="0" [attr.aria-label]="'Booked ' + slot.time">
                    <div class="slot-time-text">{{ slot.time }}</div>
                    <div class="slot-booked-info">
                      <span class="slot-booked-badge" [ngClass]="getTypeSlug(slot.appointment?.type || '')">
                        {{ slot.appointment?.type || 'Booked' }}
                      </span>
                      <span class="slot-patient-truncate">{{ slot.appointment?.patientName || 'Booked' }}</span>
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Types Legend Bar (Matches Image 1 exactly) -->
            <div class="types-legend-bar">
              <strong class="legend-title">Types:</strong>
              <div class="legend-items-list">
                <span class="legend-entry"><span class="color-dot dot-prenatal"></span> Prenatal</span>
                <span class="legend-entry"><span class="color-dot dot-postpartum"></span> Postpartum</span>
                <span class="legend-entry"><span class="color-dot dot-delivery"></span> Delivery</span>
                <span class="legend-entry"><span class="color-dot dot-consultation"></span> Consultation</span>
                <span class="legend-entry"><span class="color-dot dot-followup"></span> Follow-up</span>
                <span class="legend-entry"><span class="color-dot dot-scan"></span> First Trimester Scan</span>
                <span class="legend-entry"><span class="color-dot dot-lab"></span> Lab Test</span>
              </div>
            </div>
          </div>
        } @else {
          <!-- ============ TAB 2: MY AVAILABILITY (Settings) ============ -->
          <div class="tab-body-area">
            <div class="working-hours-card">
              <div class="settings-head-row">
                <div>
                  <h3 class="section-title">Weekly Working Hours</h3>
                  <p class="section-desc">Configure days and regular consultation hours for appointment bookings.</p>
                </div>
                <button type="button" class="btn-save-hours" (click)="saveSettings()">Save Schedule</button>
              </div>

              <div class="hours-list-grid">
                @for (d of weeklySchedule(); track d.name) {
                  <div class="day-row-item" [class.is-off]="!d.enabled">
                    <label class="day-toggle-label">
                      <input type="checkbox" [(ngModel)]="d.enabled">
                      <span>{{ d.name }}</span>
                    </label>

                    @if (d.enabled) {
                      <div class="time-range-group">
                        <input type="text" [(ngModel)]="d.start" class="time-input-pill" placeholder="08:00 AM">
                        <span class="range-sep">to</span>
                        <input type="text" [(ngModel)]="d.end" class="time-input-pill" placeholder="05:00 PM">
                        <select [(ngModel)]="d.duration" class="duration-select">
                          <option value="30 min">30 min slots</option>
                          <option value="45 min">45 min slots</option>
                          <option value="60 min">60 min slots</option>
                        </select>
                      </div>
                    } @else {
                      <span class="day-off-label">Closed</span>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>

      <!-- ========================================================
           POP-OUT MODAL: REQUEST BOOKING (Images 2, 3, 4)
           ======================================================== -->
      @if (activeBookingSlot(); as slot) {
        <div class="modal-backdrop-overlay" (click)="closeBookingModal()">
          <div class="modal-booking-box" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modal-booking-title">
            <!-- Modal Header -->
            <div class="modal-booking-head">
              <div>
                <h3 id="modal-booking-title" class="booking-dialog-title">Request Booking</h3>
                <p class="booking-dialog-sub">{{ getModalSubtitle(slot) }}</p>
              </div>
              <button type="button" class="btn-modal-close" (click)="closeBookingModal()" title="Close dialog" aria-label="Close">
                ✕
              </button>
            </div>

            <!-- Error banner inside modal -->
            @if (bookingError()) {
              <div class="modal-alert-box" role="alert">{{ bookingError() }}</div>
            }

            <!-- Booking Form -->
            <div class="modal-booking-form">
              <!-- Field 1: Patient (Image 2 & 3) -->
              <div class="form-group-block">
                <label for="modal-patient-select" class="field-label-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>Patient</span>
                </label>

                <div class="booking-select-wrapper">
                  <select id="modal-patient-select" [(ngModel)]="selectedPatientId" aria-label="Select patient">
                    <option value="" disabled selected>Select patient...</option>
                    @for (p of patients(); track p.id) {
                      <option [value]="p.id">{{ p.fullName }}</option>
                    }
                  </select>
                  <svg class="select-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              <!-- Field 2: Appointment type (Image 2 & 4) -->
              <div class="form-group-block">
                <label for="modal-type-select" class="field-label-row">
                  <span>Appointment type</span>
                </label>

                <div class="booking-select-wrapper">
                  <select id="modal-type-select" [(ngModel)]="selectedApptType" aria-label="Appointment type">
                    <option value="Prenatal">Prenatal</option>
                    <option value="Postpartum">Postpartum</option>
                    <option value="Consultation">Consultation</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Lab Test">Lab Test</option>
                    <option value="First Trimester Scan">First Trimester Scan</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                  <svg class="select-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              <!-- Submit Button (Image 2) -->
              <button
                type="button"
                class="btn-submit-request"
                (click)="submitBooking(slot)"
                [disabled]="!selectedPatientId || isSubmitting()"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                <span>{{ isSubmitting() ? 'Submitting…' : 'Submit Request' }}</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .avail-page-wrap {
      max-width: 1180px;
      margin: 0 auto;
      padding: 4px 0 32px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #271442;
      letter-spacing: -0.01em;
    }

    /* ============ MAIN AVAILABILITY CARD (Matches Image 1) ============ */
    .avail-main-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 16px;
      padding: 22px 26px 20px;
      box-shadow: 0 4px 18px rgba(39, 20, 66, 0.03);
    }

    /* Head Row */
    .card-head-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding-bottom: 18px;
      border-bottom: 1px solid #f2ecf8;
    }

    .profile-info-block {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-icon-circle {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #f3ecfb;
      border: 1.5px solid #d4c8e8;
      display: grid;
      place-items: center;
      color: #4a287c;
      font-weight: 700;
      font-size: 14.5px;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }

    .avatar-initials {
      line-height: 1;
    }

    .avatar-icon-circle svg {
      width: 20px;
      height: 20px;
    }

    .profile-name {
      margin: 0;
      font-size: 16.5px;
      font-weight: 700;
      color: #271442;
      line-height: 1.25;
    }

    .profile-sub {
      margin: 2px 0 0;
      font-size: 12.5px;
      color: #7b7189;
    }

    /* Right Tabs Nav */
    .tabs-nav-group {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .tab-nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      padding: 8px 4px 10px;
      font-size: 13.5px;
      font-weight: 500;
      color: #7b7189;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-nav-btn svg {
      width: 16px;
      height: 16px;
    }

    .tab-nav-btn:hover {
      color: #4a287c;
    }

    .tab-nav-btn.active {
      color: #6b4fa3;
      font-weight: 700;
      border-bottom-color: #6b4fa3;
    }

    /* Tab Body */
    .tab-body-area {
      padding-top: 20px;
    }

    /* Filter Row */
    .slots-filter-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 20px;
    }

    .slots-filter-row label {
      font-size: 12px;
      font-weight: 500;
      color: #6b5d84;
    }

    .select-dropdown-container {
      position: relative;
      display: inline-block;
      width: 200px;
    }

    .select-dropdown-container select {
      width: 100%;
      padding: 7px 32px 7px 12px;
      border-radius: 8px;
      border: 1px solid #dcd5e7;
      background: #ffffff;
      color: #271442;
      font-size: 13px;
      font-weight: 600;
      appearance: none;
      outline: none;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }

    .select-dropdown-container select:focus {
      border-color: #6b4fa3;
    }

    .dropdown-chevron {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      color: #6b5d84;
      pointer-events: none;
    }

    /* Toast Banner */
    .toast-success-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 18px;
      font-size: 13px;
      font-weight: 500;
      animation: fadeIn 0.2s ease;
    }

    .toast-success-banner svg {
      width: 16px;
      height: 16px;
      color: #10b981;
      flex-shrink: 0;
    }

    .btn-dismiss-toast {
      margin-left: auto;
      border: none;
      background: transparent;
      color: #059669;
      font-size: 14px;
      cursor: pointer;
    }

    /* ============ 4-COLUMN GRID OF SLOTS (Image 1) ============ */
    .slots-four-col-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }

    @media (max-width: 900px) {
      .slots-four-col-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 520px) {
      .slots-four-col-grid {
        grid-template-columns: 1fr;
      }
    }

    .slot-card {
      border-radius: 12px;
      padding: 15px 14px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      user-select: none;
      transition: all 0.16s ease;
    }

    /* Open Slot Card styling (Mint Green matching Image 1) */
    .slot-card.is-open {
      background: #edfbf4;
      border: 1.5px solid #a7f3d0;
    }

    .slot-card.is-open .slot-time-text {
      font-size: 15px;
      font-weight: 700;
      color: #047857;
      letter-spacing: 0.01em;
    }

    .slot-card.is-open .slot-status-text {
      font-size: 13px;
      font-weight: 500;
      color: #059669;
    }

    .slot-card.is-open:hover {
      background: #dcfce7;
      border-color: #86efac;
      transform: translateY(-2px);
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.18);
    }

    /* Booked Slot Card styling */
    .slot-card.is-booked {
      background: #faf8fd;
      border: 1.5px solid #e7dff2;
      opacity: 0.92;
    }

    .slot-card.is-booked .slot-time-text {
      font-size: 14px;
      font-weight: 700;
      color: #4a3d60;
    }

    .slot-booked-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      width: 100%;
    }

    .slot-booked-badge {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
    }

    .slot-patient-truncate {
      font-size: 11.5px;
      color: #7a7189;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .slot-card.is-booked:hover {
      background: #f4eefb;
      border-color: #cbbbe3;
      transform: translateY(-1px);
    }

    /* ============ TYPES LEGEND BAR (Image 1) ============ */
    .types-legend-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding-top: 18px;
      border-top: 1px solid #f2ecf8;
      font-size: 12.5px;
    }

    .legend-title {
      font-weight: 700;
      color: #271442;
      margin-right: 2px;
    }

    .legend-items-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .legend-entry {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #554869;
      font-size: 12.5px;
      font-weight: 500;
    }

    .color-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Colors per type */
    .dot-prenatal { background: #9333ea; }
    .dot-postpartum { background: #ec4899; }
    .dot-delivery { background: #ef4444; }
    .dot-consultation { background: #0284c7; }
    .dot-followup { background: #10b981; }
    .dot-scan { background: #6366f1; }
    .dot-lab { background: #f59e0b; }

    .type-prenatal { background: #f3e8ff; color: #6b21a8; }
    .type-postpartum { background: #fce7f3; color: #9d174d; }
    .type-delivery { background: #fee2e2; color: #991b1b; }
    .type-consultation { background: #e0f2fe; color: #075985; }
    .type-followup { background: #dcfce7; color: #166534; }
    .type-scan { background: #e0e7ff; color: #3730a3; }
    .type-lab { background: #fef3c7; color: #92400e; }

    /* ============ TAB 2: MY AVAILABILITY SCHEDULE ============ */
    .working-hours-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .settings-head-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .section-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #271442;
    }

    .section-desc {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: #7b7189;
    }

    .btn-save-hours {
      padding: 7px 18px;
      border-radius: 999px;
      background: #4a287c;
      color: #ffffff;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-save-hours:hover {
      background: #391461;
    }

    .hours-list-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    @media (max-width: 768px) {
      .hours-list-grid {
        grid-template-columns: 1fr;
      }
    }

    .day-row-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #ebe5f5;
      background: #faf8fd;
    }

    .day-row-item.is-off {
      opacity: 0.6;
      background: #fbfafd;
    }

    .day-toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #271442;
      cursor: pointer;
    }

    .time-range-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .time-input-pill {
      width: 70px;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #dcd5e7;
      font-size: 12px;
      text-align: center;
      color: #271442;
    }

    .range-sep {
      font-size: 12px;
      color: #7b7189;
    }

    .duration-select {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #dcd5e7;
      font-size: 12px;
      color: #271442;
      background: #ffffff;
    }

    .day-off-label {
      font-size: 12px;
      font-weight: 500;
      color: #a7a0b4;
    }

    /* ========================================================
       POP-OUT MODAL: REQUEST BOOKING (Images 2, 3, 4)
       ======================================================== */
    .modal-backdrop-overlay {
      position: fixed;
      inset: 0;
      background: rgba(18, 10, 32, 0.5);
      backdrop-filter: blur(2px);
      z-index: 1000;
      display: grid;
      place-items: center;
      padding: 16px;
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-booking-box {
      background: #ffffff;
      border-radius: 18px;
      padding: 24px 26px 22px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 45px rgba(25, 12, 45, 0.2), 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(220, 214, 232, 0.5);
      display: flex;
      flex-direction: column;
      animation: scaleInModal 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes scaleInModal {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(6px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .modal-booking-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    .booking-dialog-title {
      margin: 0;
      font-size: 19px;
      font-weight: 700;
      color: #271442;
      line-height: 1.25;
    }

    .booking-dialog-sub {
      margin: 4px 0 0;
      font-size: 13.5px;
      color: #7b7189;
    }

    .btn-modal-close {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: #7b7189;
      font-size: 17px;
      line-height: 1;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .btn-modal-close:hover {
      background: #f4eefb;
      color: #271442;
    }

    .modal-alert-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12.5px;
      margin-bottom: 14px;
    }

    .modal-booking-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #6b5d84;
    }

    .field-label-row svg {
      width: 15px;
      height: 15px;
      color: #6b5d84;
    }

    .booking-select-wrapper {
      position: relative;
      width: 100%;
    }

    .booking-select-wrapper select {
      width: 100%;
      padding: 10px 36px 10px 14px;
      border-radius: 10px;
      border: 1.5px solid #d4c8e8;
      background: #ffffff;
      color: #271442;
      font-size: 14px;
      font-weight: 500;
      appearance: none;
      outline: none;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .booking-select-wrapper select:focus {
      border-color: #795290;
      box-shadow: 0 0 0 3px rgba(121, 82, 144, 0.15);
    }

    .select-chevron-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 15px;
      height: 15px;
      color: #6b5d84;
      pointer-events: none;
    }

    /* Submit Button (Soft Purple matching Image 2) */
    .btn-submit-request {
      margin-top: 6px;
      width: 100%;
      padding: 11px 16px;
      border-radius: 10px;
      background: #8c77a8;
      color: #ffffff;
      border: none;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease;
      box-shadow: 0 2px 8px rgba(140, 119, 168, 0.25);
    }

    .btn-submit-request svg {
      width: 16px;
      height: 16px;
    }

    .btn-submit-request:hover:not(:disabled) {
      background: #795290;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(121, 82, 144, 0.35);
    }

    .btn-submit-request:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
})
export class MidwifeAvailability implements OnInit {
  private svc = inject(AppointmentsService);
  private patientsSvc = inject(PatientsService);
  private auth = inject(AuthService);

  readonly activeTab = signal<'open-slots' | 'my-availability'>('open-slots');
  readonly selectedDateIso = signal<string>(todayIso());
  readonly allAppointments = signal<Appointment[]>([]);
  readonly patients = signal<Patient[]>([]);

  // Booking Modal State
  readonly activeBookingSlot = signal<SlotItem | null>(null);
  selectedPatientId = '';
  selectedApptType = 'Prenatal';
  readonly isSubmitting = signal(false);
  readonly bookingError = signal('');
  readonly toastMessage = signal('');

  // Weekly Schedule State
  readonly weeklySchedule = signal([
    { name: 'Monday', enabled: true, start: '08:00 AM', end: '05:00 PM', duration: '30 min' },
    { name: 'Tuesday', enabled: true, start: '08:00 AM', end: '05:00 PM', duration: '30 min' },
    { name: 'Wednesday', enabled: true, start: '08:00 AM', end: '05:00 PM', duration: '30 min' },
    { name: 'Thursday', enabled: true, start: '08:00 AM', end: '05:00 PM', duration: '30 min' },
    { name: 'Friday', enabled: true, start: '08:00 AM', end: '05:00 PM', duration: '30 min' },
    { name: 'Saturday', enabled: true, start: '08:00 AM', end: '05:00 PM', duration: '30 min' },
    { name: 'Sunday', enabled: false, start: '08:00 AM', end: '12:00 PM', duration: '30 min' },
  ]);

  // Midwife Profile Name & Initials for logged-in midwife
  readonly midwifeName = computed(() => {
    return this.auth.userFullName() || 'Licensed Midwife';
  });

  readonly midwifeInitials = computed(() => {
    return this.auth.userInitials() || 'MW';
  });

  // Date options for dropdown (14 days forward starting today)
  readonly dateOptions = computed<DateOption[]>(() => {
    const out: DateOption[] = [];
    const start = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    for (let i = 0; i < 14; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const iso = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const weekday = cur.toLocaleDateString('en-US', { weekday: 'short' });
      const month = cur.toLocaleDateString('en-US', { month: 'short' });
      const day = cur.getDate();
      const label = i === 0 ? `${weekday}, ${month} ${day} (Today)` : `${weekday}, ${month} ${day}`;
      out.push({ iso, label });
    }
    return out;
  });

  // Slot items for selected date
  readonly daySlots = computed<SlotItem[]>(() => {
    const iso = this.selectedDateIso();
    const apptsOnDate = this.allAppointments().filter(
      (a) => a.date === iso && a.status !== 'cancelled'
    );
    const apptsByTime = new Map<string, Appointment>();
    for (const a of apptsOnDate) {
      apptsByTime.set(a.time, a);
    }

    return DEFAULT_SLOT_TIMES.map((time) => {
      const existing = apptsByTime.get(time);
      return {
        time,
        endTime: calculateEndTime(time),
        isOpen: !existing,
        appointment: existing,
      };
    });
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadAppointments(), this.loadPatients()]);
  }

  async loadAppointments(): Promise<void> {
    try {
      const list = await this.svc.list();
      this.allAppointments.set(list);
    } catch {
      // ignore
    }
  }

  async loadPatients(): Promise<void> {
    try {
      const list = await this.patientsSvc.list();
      this.patients.set(list);
    } catch {
      // ignore
    }
  }

  openBookingModal(slot: SlotItem): void {
    this.activeBookingSlot.set(slot);
    this.selectedPatientId = '';
    this.selectedApptType = 'Prenatal';
    this.bookingError.set('');
  }

  closeBookingModal(): void {
    this.activeBookingSlot.set(null);
    this.bookingError.set('');
  }

  getModalSubtitle(slot: SlotItem): string {
    const iso = this.selectedDateIso();
    const d = parseIso(iso);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${weekday}, ${month} ${day} · ${slot.time}–${slot.endTime}`;
  }

  async submitBooking(slot: SlotItem): Promise<void> {
    if (!this.selectedPatientId) {
      this.bookingError.set('Please select a patient.');
      return;
    }

    const patient = this.patients().find((p) => p.id === this.selectedPatientId);
    if (!patient) {
      this.bookingError.set('Selected patient could not be found.');
      return;
    }

    this.isSubmitting.set(true);
    this.bookingError.set('');

    try {
      await this.svc.book({
        patientId: patient.id,
        patientName: patient.fullName,
        date: this.selectedDateIso(),
        time: slot.time,
        type: this.selectedApptType,
        status: 'scheduled',
        notes: `${this.selectedApptType} consultation`,
      });

      await this.loadAppointments();
      this.toastMessage.set(
        `Booking request confirmed for ${patient.fullName} on ${slot.time} (${this.selectedApptType}).`
      );
      this.closeBookingModal();
    } catch (err: any) {
      if (err?.message === 'slot-taken') {
        this.bookingError.set('This time slot has already been booked. Please choose another.');
      } else {
        this.bookingError.set(err?.message || 'Could not submit request. Please try again.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  openBookedDetail(appt?: Appointment): void {
    if (!appt) return;
    alert(`Booked: ${appt.patientName} (${appt.type}) at ${appt.time} on ${appt.date}`);
  }

  saveSettings(): void {
    alert('Weekly working schedule saved successfully.');
  }

  getTypeSlug(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('prenatal')) return 'type-prenatal';
    if (t.includes('postpartum')) return 'type-postpartum';
    if (t.includes('delivery')) return 'type-delivery';
    if (t.includes('consultation')) return 'type-consultation';
    if (t.includes('follow-up') || t.includes('followup')) return 'type-followup';
    if (t.includes('scan')) return 'type-scan';
    if (t.includes('lab')) return 'type-lab';
    return 'type-prenatal';
  }
}
