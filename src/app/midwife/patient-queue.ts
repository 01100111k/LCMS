import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Appointment, AppointmentsService, formatTime, todayIso } from '../core/appointments.service';
import { Patient, PatientsService } from '../core/patients.service';
import { EXAMPLE_QUEUE_TICKETS } from '../core/example-data';

export type QueueStatus = 'waiting' | 'serving' | 'completed' | 'skipped';
export type QueuePriority = 'Regular' | 'High Risk' | 'Emergency' | 'Senior/PWD';

export interface QueueTicket {
  id: string;
  ticketNumber: string; // e.g. "Q-001"
  patientId?: string;
  patientName: string;
  contactNumber?: string;
  visitType: string;
  priority: QueuePriority;
  status: QueueStatus;
  checkInTime: string; // HH:mm
  servingStartTime?: string;
  completedTime?: string;
  station: string; // e.g. "Consultation Room 1", "Triage & Vitals"
  notes?: string;
  bp?: string;
  weight?: string;
}

@Component({
  selector: 'app-patient-queue',
  imports: [NgClass, FormsModule],
  template: `
    <div class="queue-page-wrap">
      <!-- ============ TOP HEADER ============ -->
      <div class="queue-header-row">
        <div>
          <h1>Daily Patient Queue Management</h1>
          <p class="header-sub">
            Live outpatient consultation queue, patient calling system, triage vitals, and walk-in ticket issuing.
          </p>
        </div>

        <div class="header-action-group">
          @if (queueList().length > 0) {
            <button type="button" class="btn-clear-queue" (click)="clearAllQueue()" title="Reset the queue list for today">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Clear Queue
            </button>
          }

          <button type="button" class="btn-tv-mode" (click)="toggleTvMode()" [class.is-active]="tvMode()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
            {{ tvMode() ? 'Exit Full Display' : 'Waiting Lobby Display' }}
          </button>

          <button type="button" class="btn-issue-ticket" (click)="openCheckInModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Issue Ticket / Check-in
          </button>
        </div>
      </div>

      <!-- Action Toast Message -->
      @if (actionFeedback()) {
        <div class="queue-feedback-toast" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {{ actionFeedback() }}
        </div>
      }

      <!-- ============ 4 METRIC STAT CARDS ============ -->
      <section class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon-pill tone-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="kpi-meta">
            <span class="kpi-tag">Total Checked-In</span>
            <strong class="kpi-number">{{ queueList().length }}</strong>
            <span class="kpi-subtext">Patients today</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-pill tone-amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="kpi-meta">
            <span class="kpi-tag">Waiting in Line</span>
            <strong class="kpi-number">{{ waitingTickets().length }}</strong>
            <span class="kpi-subtext">Average wait: ~12 mins</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-pill tone-teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="kpi-meta">
            <span class="kpi-tag">Now in Consultation</span>
            <strong class="kpi-number">{{ servingTicket() ? '1 Patient' : 'Room Open' }}</strong>
            <span class="kpi-subtext">{{ servingTicket() ? servingTicket()?.station : 'Ready for next' }}</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-pill tone-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="kpi-meta">
            <span class="kpi-tag">Completed Consults</span>
            <strong class="kpi-number">{{ completedTickets().length }}</strong>
            <span class="kpi-subtext">Finished today</span>
          </div>
        </div>
      </section>

      <!-- ============ MAIN QUEUE LAYOUT ============ -->
      <div class="queue-main-grid" [class.is-fullscreen-tv]="tvMode()">

        <!-- ============ LEFT: NOW SERVING HERO CARD ============ -->
        <div class="serving-hero-card">
          <div class="serving-card-head">
            <div class="pulsing-live-badge">
              <span class="pulse-dot"></span>
              NOW CALLING / SERVING
            </div>
            <span class="station-badge">{{ servingTicket()?.station || 'Consultation Room 1' }}</span>
          </div>

          @if (servingTicket(); as current) {
            <div class="serving-ticket-body">
              <div class="ticket-number-display">{{ current.ticketNumber }}</div>
              <h2 class="serving-patient-name">{{ current.patientName }}</h2>
              <div class="serving-service-pill">{{ current.visitType }}</div>

              @if (current.priority !== 'Regular') {
                <span class="priority-pill" [ngClass]="'priority-' + getPrioritySlug(current.priority)">
                  {{ current.priority }} Priority
                </span>
              }

              <div class="serving-vitals-row">
                <div class="mini-vital">
                  <span>Checked in:</span>
                  <strong>{{ current.checkInTime }}</strong>
                </div>
                <div class="mini-vital">
                  <span>Blood Pressure:</span>
                  <strong>{{ current.bp || '110/70' }}</strong>
                </div>
                <div class="mini-vital">
                  <span>Weight:</span>
                  <strong>{{ current.weight || '58 kg' }}</strong>
                </div>
              </div>

              <!-- Midwife Controller Actions -->
              <div class="serving-actions-row">
                <button type="button" class="btn-complete-serving" (click)="completeCurrentServing(current)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Mark Complete
                </button>
                <button type="button" class="btn-call-next" (click)="callNextInQueue()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                  Call Next Ticket
                </button>
                <button type="button" class="btn-skip-serving" (click)="skipTicket(current)" title="Move patient to skipped/paused">
                  Skip / Hold
                </button>
              </div>
            </div>
          } @else {
            <div class="serving-empty-state">
              <div class="empty-icon-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3>Consultation Room is Currently Open</h3>
              <p>There is currently no patient inside the consultation room.</p>
              @if (waitingTickets().length > 0) {
                <button type="button" class="btn-call-next-hero" (click)="callNextInQueue()">
                  Call Next Patient ({{ waitingTickets()[0].ticketNumber }})
                </button>
              } @else {
                <button type="button" class="btn-call-next-hero" (click)="openCheckInModal()">
                  Check-in Patient
                </button>
              }
            </div>
          }

          <!-- Quick Today's Appointment Sync Box -->
          <div class="today-appointments-sync-card">
            <div class="sync-card-head">
              <h4>Scheduled Appointments for Today ({{ todayAppointments().length }})</h4>
              <span class="sub-counter">{{ todayAppointments().length }} Booked</span>
            </div>

            @if (todayAppointments().length === 0) {
              <p class="empty-sync-note">No pre-booked appointments for today.</p>
            } @else {
              <div class="appt-sync-scroll-list">
                @for (a of todayAppointments(); track a.id) {
                  <div class="appt-sync-row">
                    <div class="appt-sync-info">
                      <strong>{{ a.time }} — {{ a.patientName }}</strong>
                      <span>{{ a.type }}</span>
                    </div>

                    @if (isAlreadyInQueue(a.patientName)) {
                      <span class="badge-in-queue">In Queue</span>
                    } @else {
                      <button type="button" class="btn-checkin-quick" (click)="checkInFromAppointment(a)">
                        Check In
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- ============ RIGHT: WAITING LIST & TICKETS TABLE ============ -->
        <div class="waiting-list-panel">
          <div class="panel-section-head">
            <div>
              <h3>Waiting Queue ({{ waitingTickets().length }})</h3>
              <p class="section-subtext">Patients in waiting lounge ready for consultation.</p>
            </div>
            <button type="button" class="btn-call-next-sm" (click)="callNextInQueue()" [disabled]="waitingTickets().length === 0">
              Call Next ({{ waitingTickets().length ? waitingTickets()[0].ticketNumber : '—' }})
            </button>
          </div>

          @if (waitingTickets().length === 0) {
            <div class="empty-waiting-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <p>No patients currently waiting in line.</p>
              <button type="button" class="btn-issue-ticket" (click)="openCheckInModal()" style="font-size:12px; padding:6px 14px;">
                Issue Walk-in Ticket
              </button>
            </div>
          } @else {
            <div class="waiting-tickets-list">
              @for (t of waitingTickets(); track t.id; let idx = $index) {
                <div class="queue-ticket-card" [class.is-first]="idx === 0">
                  <div class="ticket-left-col">
                    <div class="ticket-badge-box">{{ t.ticketNumber }}</div>
                    <div class="ticket-patient-details">
                      <h4>{{ t.patientName }}</h4>
                      <p class="ticket-type-meta">
                        <span>{{ t.visitType }}</span>
                        <span>•</span>
                        <span>Arrived at {{ t.checkInTime }}</span>
                      </p>
                    </div>
                  </div>

                  <div class="ticket-right-col">
                    @if (t.priority !== 'Regular') {
                      <span class="priority-pill" [ngClass]="'priority-' + getPrioritySlug(t.priority)">
                        {{ t.priority }}
                      </span>
                    }

                    <div class="ticket-btn-actions">
                      <button type="button" class="btn-call-direct" (click)="serveSpecificTicket(t)">
                        Call In
                      </button>
                      <button type="button" class="btn-remove-ticket" (click)="removeTicket(t.id)" title="Remove from queue">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Completed Consultations Table -->
          @if (completedTickets().length > 0) {
            <div class="completed-section-head">
              <h3>Finished Consultations Today ({{ completedTickets().length }})</h3>
            </div>
            <div class="completed-table-wrap">
              <table class="completed-mini-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Patient</th>
                    <th>Service</th>
                    <th>Time In</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of completedTickets(); track c.id) {
                    <tr>
                      <td><span class="ticket-tag-sm">{{ c.ticketNumber }}</span></td>
                      <td><strong>{{ c.patientName }}</strong></td>
                      <td>{{ c.visitType }}</td>
                      <td>{{ c.checkInTime }}</td>
                      <td><span class="completed-badge">✓ Done {{ c.completedTime || '12:00' }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      <!-- ========================================================
           MODAL: ISSUE TICKET / CHECK-IN PATIENT
           ======================================================== -->
      @if (showCheckInModal()) {
        <div class="modal-backdrop" (click)="closeCheckInModal()">
          <div class="modal-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modal-checkin-title">
            <div class="modal-head">
              <div>
                <h2 id="modal-checkin-title">Patient Check-In & Ticket Issuance</h2>
                <p class="modal-sub">Generate queue ticket for an appointment or walk-in patient.</p>
              </div>
              <button type="button" class="btn-close-modal" (click)="closeCheckInModal()" title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form (ngSubmit)="submitCheckIn()" class="modal-form-content">
              <div class="form-fields-grid">
                <!-- Check-in mode toggle: Existing Registered Patient or Walk-in -->
                <div class="form-group span-2">
                  <label>Patient Type</label>
                  <div class="pill-toggle-group">
                    <button type="button" class="pill-btn" [class.active]="checkInMode === 'registered'" (click)="checkInMode = 'registered'">
                      Registered Patient
                    </button>
                    <button type="button" class="pill-btn" [class.active]="checkInMode === 'walkin'" (click)="checkInMode = 'walkin'">
                      Walk-In Patient
                    </button>
                  </div>
                </div>

                @if (checkInMode === 'registered') {
                  <div class="form-group span-2">
                    <label for="select-patient">Select Registered Patient <span class="req">*</span></label>
                    <select id="select-patient" [(ngModel)]="selectedPatientId" name="selectedPatientId" (change)="onPatientSelectChange()" required>
                      <option value="">-- Choose patient from directory --</option>
                      @for (p of registeredPatients(); track p.id) {
                        <option [value]="p.id">{{ p.fullName }} ({{ p.contactNumber || p.email }})</option>
                      }
                    </select>
                  </div>
                } @else {
                  <div class="form-group span-2">
                    <label for="input-walkin-name">Patient Full Name <span class="req">*</span></label>
                    <input id="input-walkin-name" type="text" [(ngModel)]="walkinName" name="walkinName" placeholder="Enter patient full name" required>
                  </div>
                  <div class="form-group span-2">
                    <label for="input-walkin-phone">Contact Number (Optional)</label>
                    <input id="input-walkin-phone" type="tel" [(ngModel)]="walkinPhone" name="walkinPhone" placeholder="0912 345 6789">
                  </div>
                }

                <!-- Service / Visit Type -->
                <div class="form-group">
                  <label for="select-service">Service Requested <span class="req">*</span></label>
                  <select id="select-service" [(ngModel)]="checkInService" name="checkInService" required>
                    <option value="Prenatal Checkup">Prenatal Checkup</option>
                    <option value="Ultrasound Scan">Ultrasound Scan</option>
                    <option value="Fetal Heart Rate & Vitals">Fetal Heart Rate & Vitals</option>
                    <option value="Postpartum Consultation">Postpartum Consultation</option>
                    <option value="Lab Test Review">Laboratory Test Review</option>
                    <option value="Triage / Urgent">Triage / Urgent Check</option>
                  </select>
                </div>

                <!-- Priority Level -->
                <div class="form-group">
                  <label for="select-priority">Queue Priority</label>
                  <select id="select-priority" [(ngModel)]="checkInPriority" name="checkInPriority">
                    <option value="Regular">Regular (Default)</option>
                    <option value="High Risk">High Risk Pregnancy</option>
                    <option value="Senior/PWD">Senior / PWD</option>
                    <option value="Emergency">Emergency / Active Labor</option>
                  </select>
                </div>

                <!-- Triage Vitals (Optional) -->
                <div class="form-group">
                  <label for="input-bp">Initial Blood Pressure</label>
                  <input id="input-bp" type="text" [(ngModel)]="triageBp" name="triageBp" placeholder="e.g. 110/70">
                </div>

                <div class="form-group">
                  <label for="input-wt">Weight (kg)</label>
                  <input id="input-wt" type="text" [(ngModel)]="triageWeight" name="triageWeight" placeholder="e.g. 58 kg">
                </div>
              </div>

              <div class="modal-footer-actions" style="margin-top:20px;">
                <button type="button" class="btn-cancel-modal" (click)="closeCheckInModal()">Cancel</button>
                <button type="submit" class="btn-submit-modal" [disabled]="!canSubmitCheckin()">
                  Generate Ticket & Check-in
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .queue-page-wrap {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Header */
    .queue-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .queue-header-row h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #271442;
      letter-spacing: -0.01em;
    }

    .header-sub {
      margin: 4px 0 0;
      font-size: 13px;
      color: #7a7189;
      max-width: 650px;
      line-height: 1.45;
    }

    .header-action-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .btn-clear-queue {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fff5f5;
      color: #c92a42;
      border: 1px solid #fecdd3;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-clear-queue:hover {
      background: #fee2e2;
      border-color: #f87171;
    }

    .btn-clear-queue svg { width: 14px; height: 14px; }

    .btn-tv-mode {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #fbf9fd;
      color: #361759;
      border: 1px solid #dcd1ed;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-tv-mode:hover, .btn-tv-mode.is-active {
      background: #ede7f6;
      border-color: #361759;
    }

    .btn-tv-mode svg { width: 15px; height: 15px; }

    .btn-issue-ticket {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #361759;
      color: #ffffff;
      padding: 9px 20px;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
      transition: background 0.15s, transform 0.15s;
    }

    .btn-issue-ticket:hover {
      background: #4a2179;
      transform: translateY(-1px);
    }

    .btn-issue-ticket svg { width: 14px; height: 14px; }

    /* Toast */
    .queue-feedback-toast {
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

    .queue-feedback-toast svg { width: 16px; height: 16px; }

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
    .kpi-icon-pill.tone-amber { background: #fff4e5; color: #b76e00; }
    .kpi-icon-pill.tone-teal { background: #e6f7f3; color: #0d8a72; }
    .kpi-icon-pill.tone-green { background: #e9f8f3; color: #0f8564; }

    .kpi-icon-pill svg { width: 20px; height: 20px; }

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
      font-size: 18px;
      font-weight: 800;
      color: #271442;
      margin-top: 2px;
    }

    .kpi-subtext {
      font-size: 11.5px;
      color: #928a9f;
      margin-top: 1px;
    }

    /* Main Grid */
    .queue-main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    /* Fullscreen TV Mode */
    .queue-main-grid.is-fullscreen-tv {
      grid-template-columns: 1fr;
    }

    /* Serving Hero Card */
    .serving-hero-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 22px 24px;
      box-shadow: 0 4px 14px rgba(50, 24, 78, 0.03);
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .serving-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pulsing-live-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 800;
      color: #0d8a72;
      background: #e6f7f3;
      padding: 4px 10px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #0d8a72;
      animation: pulseAnim 1.5s infinite;
    }

    @keyframes pulseAnim {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(13, 138, 114, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(13, 138, 114, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(13, 138, 114, 0); }
    }

    .station-badge {
      font-size: 12px;
      font-weight: 600;
      color: #361759;
      background: #f4effb;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .serving-ticket-body {
      background: linear-gradient(135deg, #fbf9fd 0%, #f7f2fc 100%);
      border: 2px solid #361759;
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(54, 23, 89, 0.08);
    }

    .ticket-number-display {
      font-size: 48px;
      font-weight: 900;
      color: #361759;
      letter-spacing: 1px;
      line-height: 1;
      margin-bottom: 6px;
    }

    .serving-patient-name {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 800;
      color: #271442;
    }

    .serving-service-pill {
      display: inline-block;
      background: #361759;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .priority-pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      margin: 0 auto 12px;
    }

    .priority-high-risk { background: #fff0f3; color: #c92a42; border: 1px solid #fed7df; }
    .priority-emergency { background: #fee2e2; color: #b91c1c; font-weight: 800; }
    .priority-senior { background: #fff4e5; color: #b76e00; }

    .serving-vitals-row {
      display: flex;
      justify-content: center;
      gap: 20px;
      border-top: 1px solid #e7dcf3;
      padding-top: 14px;
      margin-top: 10px;
      font-size: 12.5px;
    }

    .mini-vital span { color: #7a7189; margin-right: 4px; }
    .mini-vital strong { color: #271442; }

    .serving-actions-row {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 20px;
      flex-wrap: wrap;
    }

    .btn-complete-serving {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 20px;
      background: #0d8a72;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(13, 138, 114, 0.25);
    }

    .btn-complete-serving:hover { background: #0a705c; }
    .btn-complete-serving svg { width: 15px; height: 15px; }

    .btn-call-next {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.25);
    }

    .btn-call-next:hover { background: #4a2179; }
    .btn-call-next svg { width: 14px; height: 14px; }

    .btn-skip-serving {
      padding: 9px 14px;
      background: #ffffff;
      border: 1px solid #dcd1ed;
      color: #7a7189;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-skip-serving:hover { background: #fbf9fd; color: #271442; }

    /* Empty Serving State */
    .serving-empty-state {
      padding: 36px 20px;
      text-align: center;
      background: #faf8fc;
      border: 1.5px dashed #dcd1ed;
      border-radius: 14px;
    }

    .empty-icon-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #f3effa;
      color: #361759;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
    }

    .empty-icon-circle svg { width: 22px; height: 22px; }

    .serving-empty-state h3 {
      margin: 0 0 6px;
      font-size: 16px;
      font-weight: 700;
      color: #271442;
    }

    .serving-empty-state p {
      margin: 0 0 16px;
      font-size: 13px;
      color: #7a7189;
    }

    .btn-call-next-hero {
      padding: 10px 24px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 999px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
    }

    /* Today's Appointments Sync Box */
    .today-appointments-sync-card {
      border: 1px solid #ebe5f5;
      border-radius: 12px;
      padding: 14px 16px;
      background: #ffffff;
    }

    .sync-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .sync-card-head h4 {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: #271442;
    }

    .sub-counter {
      font-size: 11.5px;
      font-weight: 600;
      color: #0d8a72;
      background: #e6f7f3;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .empty-sync-note {
      font-size: 12px;
      color: #7a7189;
      margin: 6px 0;
    }

    .appt-sync-scroll-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 180px;
      overflow-y: auto;
    }

    .appt-sync-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fbf9fd;
      border: 1px solid #ebe5f5;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
    }

    .appt-sync-info strong {
      display: block;
      color: #271442;
    }

    .appt-sync-info span {
      color: #7a7189;
      font-size: 11.5px;
    }

    .btn-checkin-quick {
      padding: 4px 10px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .badge-in-queue {
      font-size: 11px;
      color: #0d8a72;
      font-weight: 700;
      background: #e6f7f3;
      padding: 3px 8px;
      border-radius: 4px;
    }

    /* Right: Waiting List Panel */
    .waiting-list-panel {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 20px 22px;
      box-shadow: 0 4px 14px rgba(50, 24, 78, 0.03);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .panel-section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-section-head h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #271442;
    }

    .section-subtext {
      margin: 3px 0 0;
      font-size: 12px;
      color: #7a7189;
    }

    .btn-call-next-sm {
      padding: 6px 14px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-call-next-sm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .empty-waiting-box {
      text-align: center;
      padding: 36px 16px;
      border: 1px dashed #dcd1ed;
      border-radius: 10px;
      color: #7a7189;
      font-size: 13px;
    }

    .empty-waiting-box svg {
      width: 32px;
      height: 32px;
      margin-bottom: 8px;
      color: #a89bbd;
    }

    .waiting-tickets-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .queue-ticket-card {
      border: 1px solid #ebe5f5;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: #fdfcff;
      transition: all 0.15s;
    }

    .queue-ticket-card:hover {
      border-color: #d8cde9;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.04);
    }

    .queue-ticket-card.is-first {
      border-left: 3.5px solid #0d8a72;
      background: #faf7fd;
    }

    .ticket-left-col {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ticket-badge-box {
      font-size: 16px;
      font-weight: 900;
      color: #361759;
      background: #ede7f6;
      padding: 6px 10px;
      border-radius: 8px;
      min-width: 54px;
      text-align: center;
    }

    .ticket-patient-details h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #271442;
    }

    .ticket-type-meta {
      margin: 2px 0 0;
      font-size: 12px;
      color: #7a7189;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ticket-right-col {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ticket-btn-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-call-direct {
      padding: 5px 12px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-call-direct:hover { background: #4a2179; }

    .btn-remove-ticket {
      background: transparent;
      border: none;
      color: #c92a42;
      font-size: 14px;
      cursor: pointer;
      padding: 4px;
    }

    /* Completed Mini Table */
    .completed-section-head h3 {
      margin: 10px 0 6px;
      font-size: 13.5px;
      font-weight: 700;
      color: #271442;
    }

    .completed-table-wrap {
      overflow-x: auto;
      border: 1px solid #ebe5f5;
      border-radius: 8px;
    }

    .completed-mini-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    .completed-mini-table th {
      background: #fbf9fd;
      padding: 8px 10px;
      border-bottom: 1px solid #ebe5f5;
      font-weight: 700;
      color: #7a7189;
    }

    .completed-mini-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #f3effa;
      color: #382c4e;
    }

    .ticket-tag-sm {
      background: #f4effb;
      color: #361759;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .completed-badge {
      color: #0d8a72;
      font-weight: 600;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(30, 15, 50, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .modal-card {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 16px 40px rgba(40, 15, 65, 0.22);
      overflow: hidden;
      animation: modalPop 0.2s ease-out;
    }

    @keyframes modalPop {
      from { transform: scale(0.96); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .modal-head {
      padding: 18px 22px;
      background: #fbf9fd;
      border-bottom: 1.5px solid #ebe5f5;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-head h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #271442;
    }

    .modal-sub {
      margin: 3px 0 0;
      font-size: 12px;
      color: #7a7189;
    }

    .btn-close-modal {
      background: none;
      border: none;
      cursor: pointer;
      color: #7a7189;
      padding: 4px;
    }

    .modal-form-content {
      padding: 20px 22px;
    }

    .form-fields-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 14px;
    }

    .form-group.span-2 {
      grid-column: span 2;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .form-group label {
      font-size: 12px;
      font-weight: 700;
      color: #382c4e;
    }

    .form-group select, .form-group input {
      border: 1.5px solid #dcd1ed;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12.5px;
      outline: none;
      color: #271442;
    }

    .pill-toggle-group {
      display: flex;
      gap: 8px;
      background: #f4effb;
      padding: 3px;
      border-radius: 8px;
    }

    .pill-btn {
      flex: 1;
      padding: 6px;
      border: none;
      background: transparent;
      font-size: 12px;
      font-weight: 600;
      color: #7a7189;
      cursor: pointer;
      border-radius: 6px;
    }

    .pill-btn.active {
      background: #ffffff;
      color: #361759;
      font-weight: 700;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    .modal-footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .btn-cancel-modal {
      padding: 8px 16px;
      background: #ffffff;
      border: 1px solid #dcd1ed;
      color: #55476d;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-submit-modal {
      padding: 8px 20px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
    }

    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .queue-main-grid { grid-template-columns: 1fr; }
    }
  `,
})
export class PatientQueue implements OnInit {
  private appointmentsSvc = inject(AppointmentsService);
  private patientsSvc = inject(PatientsService);

  readonly today = todayIso();
  readonly tvMode = signal(false);
  readonly actionFeedback = signal('');

  // Queue state
  readonly queueList = signal<QueueTicket[]>([]);
  readonly registeredPatients = signal<Patient[]>([]);
  readonly todayAppointments = signal<Appointment[]>([]);

  // Modal State
  readonly showCheckInModal = signal(false);
  checkInMode: 'registered' | 'walkin' = 'registered';
  selectedPatientId = '';
  walkinName = '';
  walkinPhone = '';
  checkInService = 'Prenatal Checkup';
  checkInPriority: QueuePriority = 'Regular';
  triageBp = '';
  triageWeight = '';

  // Computed signals
  readonly waitingTickets = computed(() =>
    this.queueList().filter((t) => t.status === 'waiting'),
  );

  readonly servingTicket = computed(() =>
    this.queueList().find((t) => t.status === 'serving') || null,
  );

  readonly completedTickets = computed(() =>
    this.queueList().filter((t) => t.status === 'completed'),
  );

  ngOnInit(): void {
    this.loadPersistedQueue();
    void this.loadTodayAppointments();
    void this.loadPatients();
  }

  loadPersistedQueue(): void {
    try {
      const raw = localStorage.getItem('lcms_daily_queue_' + this.today);
      if (raw) {
        const parsed: QueueTicket[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.queueList.set(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Default to the connected example queue tickets for today
    this.queueList.set(EXAMPLE_QUEUE_TICKETS);
  }

  clearAllQueue(): void {
    if (!confirm('Are you sure you want to clear the daily patient queue?')) return;
    this.queueList.set([]);
    this.saveQueue();
    this.showToast('Queue has been reset.');
  }

  async loadTodayAppointments(): Promise<void> {
    try {
      const all = await this.appointmentsSvc.listForDate(this.today);
      this.todayAppointments.set(all.filter((a) => a.status !== 'cancelled'));
    } catch {
      // ignore
    }
  }

  async loadPatients(): Promise<void> {
    try {
      const list = await this.patientsSvc.list();
      this.registeredPatients.set(list);
    } catch {
      // ignore
    }
  }

  saveQueue(): void {
    try {
      localStorage.setItem('lcms_daily_queue_' + this.today, JSON.stringify(this.queueList()));
    } catch {
      // ignore
    }
  }

  toggleTvMode(): void {
    this.tvMode.update((v) => !v);
  }

  isAlreadyInQueue(name: string): boolean {
    return this.queueList().some((t) => t.patientName.toLowerCase() === name.toLowerCase());
  }

  // Queue Progression Operations
  callNextInQueue(): void {
    const waiting = this.waitingTickets();
    if (!waiting.length) return;

    const currentServing = this.servingTicket();
    const nextTicket = waiting[0];

    const updated = this.queueList().map((t) => {
      if (currentServing && t.id === currentServing.id) {
        return {
          ...t,
          status: 'completed' as QueueStatus,
          completedTime: this.currentTimeString(),
        };
      }
      if (t.id === nextTicket.id) {
        return {
          ...t,
          status: 'serving' as QueueStatus,
          servingStartTime: this.currentTimeString(),
        };
      }
      return t;
    });

    this.queueList.set(updated);
    this.saveQueue();
    this.showToast(`Calling ${nextTicket.ticketNumber} — ${nextTicket.patientName}!`);
  }

  serveSpecificTicket(t: QueueTicket): void {
    const currentServing = this.servingTicket();
    const updated = this.queueList().map((item) => {
      if (currentServing && item.id === currentServing.id) {
        return {
          ...item,
          status: 'completed' as QueueStatus,
          completedTime: this.currentTimeString(),
        };
      }
      if (item.id === t.id) {
        return {
          ...item,
          status: 'serving' as QueueStatus,
          servingStartTime: this.currentTimeString(),
        };
      }
      return item;
    });

    this.queueList.set(updated);
    this.saveQueue();
    this.showToast(`Now serving ${t.ticketNumber} (${t.patientName})`);
  }

  completeCurrentServing(t: QueueTicket): void {
    const updated = this.queueList().map((item) => {
      if (item.id === t.id) {
        return {
          ...item,
          status: 'completed' as QueueStatus,
          completedTime: this.currentTimeString(),
        };
      }
      return item;
    });
    this.queueList.set(updated);
    this.saveQueue();
    this.showToast(`Ticket ${t.ticketNumber} completed!`);
  }

  skipTicket(t: QueueTicket): void {
    const updated = this.queueList().map((item) => {
      if (item.id === t.id) {
        return {
          ...item,
          status: 'waiting' as QueueStatus, // put back at bottom of waiting
        };
      }
      return item;
    });
    this.queueList.set(updated);
    this.saveQueue();
    this.showToast(`Ticket ${t.ticketNumber} moved to hold.`);
  }

  removeTicket(id: string): void {
    const updated = this.queueList().filter((t) => t.id !== id);
    this.queueList.set(updated);
    this.saveQueue();
  }

  // Check In from Appointment
  checkInFromAppointment(a: Appointment): void {
    const nextNum = this.nextTicketNumber();
    const newTicket: QueueTicket = {
      id: 'q-' + Date.now(),
      ticketNumber: nextNum,
      patientId: a.patientId,
      patientName: a.patientName,
      visitType: a.type,
      priority: 'Regular',
      status: 'waiting',
      checkInTime: this.currentTimeString(),
      station: 'Consultation Room 1',
      notes: a.notes,
    };

    this.queueList.update((curr) => [...curr, newTicket]);
    this.saveQueue();
    this.showToast(`Ticket ${nextNum} issued for ${a.patientName}!`);
  }

  // Check-In Modal Operations
  openCheckInModal(): void {
    this.checkInMode = 'registered';
    this.selectedPatientId = '';
    this.walkinName = '';
    this.walkinPhone = '';
    this.checkInService = 'Prenatal Checkup';
    this.checkInPriority = 'Regular';
    this.triageBp = '110/70';
    this.triageWeight = '58 kg';
    this.showCheckInModal.set(true);
  }

  closeCheckInModal(): void {
    this.showCheckInModal.set(false);
  }

  onPatientSelectChange(): void {
    const p = this.registeredPatients().find((item) => item.id === this.selectedPatientId);
    if (p) {
      if (p.riskLevel === 'High risk') {
        this.checkInPriority = 'High Risk';
      }
    }
  }

  canSubmitCheckin(): boolean {
    if (this.checkInMode === 'registered') {
      return !!this.selectedPatientId;
    }
    return !!this.walkinName.trim();
  }

  submitCheckIn(): void {
    let name = '';
    let phone = '';
    let pId: string | undefined = undefined;

    if (this.checkInMode === 'registered') {
      const p = this.registeredPatients().find((item) => item.id === this.selectedPatientId);
      if (!p) return;
      name = p.fullName;
      phone = p.contactNumber || '';
      pId = p.id;
    } else {
      name = this.walkinName.trim();
      phone = this.walkinPhone.trim();
    }

    const nextNum = this.nextTicketNumber();
    const newTicket: QueueTicket = {
      id: 'q-' + Date.now(),
      ticketNumber: nextNum,
      patientId: pId,
      patientName: name,
      contactNumber: phone,
      visitType: this.checkInService,
      priority: this.checkInPriority,
      status: 'waiting',
      checkInTime: this.currentTimeString(),
      station: 'Consultation Room 1',
      bp: this.triageBp || '110/70',
      weight: this.triageWeight || '58 kg',
    };

    this.queueList.update((curr) => [...curr, newTicket]);
    this.saveQueue();
    this.closeCheckInModal();
    this.showToast(`Ticket ${nextNum} issued for ${name}!`);
  }

  private nextTicketNumber(): string {
    const count = this.queueList().length + 1;
    return `Q-${String(count).padStart(3, '0')}`;
  }

  private currentTimeString(): string {
    const d = new Date();
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  }

  getPrioritySlug(priority: QueuePriority): string {
    switch (priority) {
      case 'High Risk': return 'high-risk';
      case 'Emergency': return 'emergency';
      case 'Senior/PWD': return 'senior';
      default: return 'regular';
    }
  }

  private showToast(msg: string): void {
    this.actionFeedback.set(msg);
    setTimeout(() => this.actionFeedback.set(''), 3500);
  }
}
