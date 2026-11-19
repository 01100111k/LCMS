import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Appointment, AppointmentsService, formatTime, todayIso } from '../../core/appointments.service';
import { Patient, PatientsService } from '../../core/patients.service';
import { NotificationsService } from '../../core/notifications.service';
import { ActivityLogService } from '../../core/activity-log.service';
import { AuthService } from '../../core/auth.service';
import { auth, db } from '../../core/firebase';
import {
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

export type QueueStatus = 'waiting' | 'called' | 'serving' | 'completed' | 'skipped' | 'cancelled';
export type QueuePriority = 'Regular' | 'High Risk' | 'Emergency' | 'Senior/PWD';

export interface QueueTicket {
  id: string;
  ticketNumber: string; // e.g. "Q-101"
  patientId?: string | null;
  patientUid?: string | null;
  patientName: string;
  contactNumber?: string;
  visitType: string;
  priority: QueuePriority;
  status: QueueStatus;
  checkInTime: string; // HH:mm or HH:mm AM/PM
  checkInTimestamp?: any;
  servingStartTime?: string;
  servingStartTimestamp?: any;
  calledTime?: string;
  calledTimestamp?: any;
  completedTime?: string;
  completedTimestamp?: any;
  station: string; // e.g. "Consultation Room 1", "Triage & Vitals"
  notes?: string;
  bp?: string;
  weight?: string;
  appointmentId?: string | null;
  date?: string; // YYYY-MM-DD
  midwifeId?: string | null;
  assignedMidwifeId?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

@Component({
  selector: 'app-patient-queue',
  standalone: true,
  imports: [CommonModule, NgClass, FormsModule],
  template: `
    <div class="queue-page-wrap">
      <!-- ========================================================
           WAITING LOBBY DISPLAY (PUBLIC WAITING AREA / TV MODE)
           ======================================================== -->
      @if (tvMode()) {
        <div class="lobby-display-container">
          <!-- Top TV Bar -->
          <div class="lobby-topbar">
            <div class="lobby-brand">
              <div class="lobby-brand-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M12 7v5l3 3"/></svg>
              </div>
              <div>
                <h2>Lying-In Care Birthing Center & Maternity Clinic</h2>
                <p>Real-Time Outpatient Consultation & Triage Queue Board</p>
              </div>
            </div>

            <div class="lobby-clock-box">
              <span class="lobby-clock">{{ liveClock() }}</span>
              <span class="lobby-date">{{ liveDate() }}</span>
            </div>

            <button type="button" class="btn-exit-lobby" (click)="toggleTvMode()" title="Return to Midwife Queue Controls">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Exit Full Display
            </button>
          </div>

          <!-- Lobby Main Grid -->
          <div class="lobby-grid">
            <!-- HERO: NOW CALLING / SERVING -->
            <div class="lobby-hero-card" [class.is-calling]="!!servingTicket()">
              <div class="lobby-hero-head">
                <span class="lobby-live-badge">
                  <span class="pulse-dot"></span>
                  NOW CALLING / IN CONSULTATION
                </span>
                <span class="lobby-station-badge">{{ servingTicket()?.station || 'Consultation Room 1' }}</span>
              </div>

              @if (servingTicket(); as current) {
                <div class="lobby-hero-content">
                  <div class="lobby-ticket-hero-num">{{ current.ticketNumber }}</div>
                  <div class="lobby-instruction">
                    Please proceed to <strong>{{ current.station || 'Consultation Room 1' }}</strong>
                  </div>
                  <div class="lobby-ticket-meta">
                    <span class="lobby-meta-pill">{{ current.visitType }}</span>
                    @if (current.priority !== 'Regular') {
                      <span class="priority-pill" [ngClass]="'priority-' + getPrioritySlug(current.priority)">
                        {{ current.priority }} Priority
                      </span>
                    }
                  </div>
                  <div class="lobby-call-time">
                    Called at {{ current.servingStartTime || current.calledTime || current.checkInTime }}
                  </div>
                </div>
              } @else {
                <div class="lobby-hero-empty">
                  <div class="lobby-empty-num">—</div>
                  <h3>Consultation Room Is Open</h3>
                  <p>Please wait in the lounge. The next ticket will be announced shortly.</p>
                </div>
              }
            </div>

            <!-- SIDE: UPCOMING TICKETS -->
            <div class="lobby-side-card">
              <div class="lobby-side-head">
                <div>
                  <h3>Upcoming Numbers in Queue</h3>
                  <p class="lobby-side-sub">Please listen for your ticket number announcement</p>
                </div>
                <span class="lobby-wait-count">{{ waitingTickets().length }} In Line</span>
              </div>

              @if (waitingTickets().length === 0) {
                <div class="lobby-side-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <p>No patients currently waiting in line.</p>
                </div>
              } @else {
                <div class="lobby-tickets-grid">
                  @for (t of waitingTickets(); track t.id; let idx = $index) {
                    <div class="lobby-ticket-tile" [class.is-next]="idx === 0">
                      <div class="lobby-tile-top">
                        <span class="lobby-tile-pos">#{{ idx + 1 }}</span>
                        <span class="lobby-tile-status">{{ idx === 0 ? 'Next Up' : 'Waiting' }}</span>
                      </div>
                      <div class="lobby-tile-num">{{ t.ticketNumber }}</div>
                      <div class="lobby-tile-service">{{ t.visitType }}</div>
                      <div class="lobby-tile-station">{{ t.station || 'Room 1' }}</div>
                    </div>
                  }
                </div>
              }

              <!-- FINISHED CONSULTATIONS STRIP -->
              @if (completedTickets().length > 0) {
                <div class="lobby-finished-strip">
                  <h4>Finished Today ({{ completedTickets().length }})</h4>
                  <div class="lobby-finished-tags">
                    @for (c of completedTickets().slice(-6).reverse(); track c.id) {
                      <span class="lobby-done-tag">
                        ✓ {{ c.ticketNumber }} ({{ c.completedTime || 'Done' }})
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      } @else {
        <!-- ========================================================
             STANDARD MIDWIFE QUEUE MANAGEMENT VIEW
             ======================================================== -->
        <!-- ============ TOP HEADER ============ -->
        <div class="queue-header-row">
          <div>
            <h1>Daily Patient Queue Management</h1>
            <p class="header-sub">
              Live outpatient consultation queue, patient calling system, triage vitals, and walk-in ticket issuing.
            </p>
          </div>

          <div class="header-action-group">
            @if (activeQueueTickets().length > 0) {
              <button type="button" class="btn-clear-queue" (click)="clearAllQueue()" title="Reset the queue list for today">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Clear Queue
              </button>
            }

            <button type="button" class="btn-tv-mode" (click)="toggleTvMode()" [class.is-active]="tvMode()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
              Waiting Lobby Display
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
              <strong class="kpi-number">{{ totalCheckedInCount() }}</strong>
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
              <span class="kpi-subtext">{{ servingTicket() ? (servingTicket()?.station || 'Consultation Room 1') : 'Ready for next' }}</span>
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
        <div class="queue-main-grid">
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
                  <button type="button" class="btn-complete-serving" (click)="completeCurrentServing(current)" [disabled]="isProcessingAction()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Mark Complete
                  </button>
                  <button type="button" class="btn-call-next" (click)="callNextInQueue()" [disabled]="waitingTickets().length === 0 || isProcessingAction()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                    Call Next Ticket
                  </button>
                  <button type="button" class="btn-skip-serving" (click)="skipTicket(current)" [disabled]="isProcessingAction()" title="Move patient to skipped/paused">
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
                  <button type="button" class="btn-call-next-hero" (click)="callNextInQueue()" [disabled]="isProcessingAction()">
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
              <button type="button" class="btn-call-next-sm" (click)="callNextInQueue()" [disabled]="waitingTickets().length === 0 || isProcessingAction()">
                Call Next ({{ waitingTickets().length ? waitingTickets()[0].ticketNumber : '—' }})
              </button>
            </div>

            @if (waitingTickets().length === 0) {
              <div class="empty-waiting-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p>No patients are currently waiting in your queue.</p>
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
                          @if (t.status === 'skipped') {
                            <span class="tag-on-hold">On Hold</span>
                          }
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
                        <button type="button" class="btn-call-direct" (click)="serveSpecificTicket(t)" [disabled]="isProcessingAction()">
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
      }

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

                <!-- Station / Room -->
                <div class="form-group span-2">
                  <label for="select-station">Consultation Station</label>
                  <select id="select-station" [(ngModel)]="checkInStation" name="checkInStation">
                    <option value="Consultation Room 1">Consultation Room 1</option>
                    <option value="Consultation Room 2">Consultation Room 2</option>
                    <option value="Triage & Vitals Station">Triage & Vitals Station</option>
                    <option value="Ultrasound Suite">Ultrasound Suite</option>
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

      <!-- ========================================================
           MODAL: CLEAR QUEUE CONFIRMATION
           ======================================================== -->
      @if (showClearConfirmModal()) {
        <div class="modal-backdrop" (click)="showClearConfirmModal.set(false)">
          <div class="modal-card modal-confirm-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <div class="confirm-modal-inner">
              <div class="confirm-icon-circle-amber">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 class="confirm-head-title">Clear Active Waiting Queue?</h3>
              <p class="confirm-head-desc">
                This will cancel any active waiting and serving tickets for today.
                <strong>Completed consultation records are preserved permanently</strong> in the facility history.
              </p>
              <div class="confirm-modal-actions">
                <button type="button" class="btn-cancel-modal" (click)="showClearConfirmModal.set(false)">
                  Keep Queue Active
                </button>
                <button type="button" class="btn-confirm-clear" (click)="confirmClearQueue()">
                  Yes, Clear Active Queue
                </button>
              </div>
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
      animation: toastFade 0.2s ease-in;
    }

    @keyframes toastFade {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
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
    .priority-regular { background: #f3f0f7; color: #4a3860; }

    .tag-on-hold {
      background: #fef3c7;
      color: #92400e;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }

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
      transition: all 0.15s;
    }

    .btn-complete-serving:hover { background: #0a705c; transform: translateY(-1px); }
    .btn-complete-serving:disabled { opacity: 0.6; cursor: not-allowed; }
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
      transition: all 0.15s;
    }

    .btn-call-next:hover { background: #4a2179; transform: translateY(-1px); }
    .btn-call-next:disabled { opacity: 0.5; cursor: not-allowed; }
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
      transition: all 0.15s;
    }

    .btn-skip-serving:hover { background: #fbf9fd; color: #271442; border-color: #361759; }

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
      transition: all 0.15s;
    }

    .btn-call-next-hero:hover {
      background: #4a2179;
      transform: translateY(-1px);
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
      transition: all 0.15s;
    }

    .btn-call-next-sm:hover:not(:disabled) {
      background: #4a2179;
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
      flex-wrap: wrap;
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
      transition: all 0.15s;
    }

    .btn-call-direct:hover { background: #4a2179; }

    .btn-remove-ticket {
      background: transparent;
      border: none;
      color: #c92a42;
      font-size: 14px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }

    .btn-remove-ticket:hover {
      background: #fee2e2;
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
      background: rgba(30, 15, 50, 0.55);
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

    .modal-confirm-card {
      max-width: 440px;
      padding: 24px;
    }

    .confirm-modal-inner {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .confirm-icon-circle-amber {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #fffbeb;
      color: #d97706;
      border: 1px solid #fde68a;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .confirm-icon-circle-amber svg {
      width: 24px;
      height: 24px;
    }

    .confirm-head-title {
      font-size: 18px;
      font-weight: 700;
      color: #271442;
      margin: 0;
    }

    .confirm-head-desc {
      font-size: 13px;
      color: #7a7189;
      line-height: 1.5;
      margin: 0;
    }

    .confirm-head-desc strong {
      color: #271442;
    }

    .confirm-modal-actions {
      display: flex;
      gap: 10px;
      width: 100%;
      justify-content: center;
      margin-top: 10px;
    }

    .btn-confirm-clear {
      padding: 9px 18px;
      background: #b91c1c;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(185, 28, 28, 0.25);
    }

    .btn-confirm-clear:hover {
      background: #991b1b;
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

    /* ========================================================
       WAITING LOBBY DISPLAY VIEW STYLES
       ======================================================== */
    .lobby-display-container {
      background: #140d23;
      color: #ede7f6;
      border-radius: 18px;
      padding: 24px;
      min-height: 80vh;
      display: flex;
      flex-direction: column;
      gap: 24px;
      box-shadow: 0 16px 40px rgba(10, 4, 20, 0.6);
    }

    .lobby-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1f1437;
      border: 1px solid #3d2b63;
      border-radius: 14px;
      padding: 16px 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .lobby-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .lobby-brand-icon {
      width: 48px;
      height: 48px;
      background: #6b21a8;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: #ffffff;
      flex-shrink: 0;
    }

    .lobby-brand-icon svg { width: 26px; height: 26px; }

    .lobby-brand h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    .lobby-brand p {
      margin: 3px 0 0;
      font-size: 13px;
      color: #c4b5fd;
    }

    .lobby-clock-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .lobby-clock {
      font-size: 26px;
      font-weight: 800;
      color: #a78bfa;
      letter-spacing: 0.5px;
      font-variant-numeric: tabular-nums;
    }

    .lobby-date {
      font-size: 12px;
      color: #ddd6fe;
    }

    .btn-exit-lobby {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #2e1e52;
      color: #ede7f6;
      border: 1px solid #4c3384;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-exit-lobby:hover {
      background: #432b77;
      color: #ffffff;
    }

    .btn-exit-lobby svg { width: 15px; height: 15px; }

    .lobby-grid {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 22px;
    }

    .lobby-hero-card {
      background: #1e1338;
      border: 2px solid #58338e;
      border-radius: 16px;
      padding: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    .lobby-hero-card.is-calling {
      border-color: #10b981;
      background: linear-gradient(180deg, #1e153b 0%, #15272b 100%);
    }

    .lobby-hero-head {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .lobby-live-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 800;
      color: #34d399;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      padding: 6px 14px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }

    .lobby-station-badge {
      font-size: 14px;
      font-weight: 700;
      color: #f5f3ff;
      background: #3b2568;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #58338e;
    }

    .lobby-ticket-hero-num {
      font-size: 96px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 2px;
      line-height: 1;
      text-shadow: 0 4px 20px rgba(124, 58, 237, 0.6);
      margin: 10px 0 16px;
    }

    .lobby-instruction {
      font-size: 22px;
      color: #ede7f6;
      margin-bottom: 16px;
    }

    .lobby-instruction strong {
      color: #34d399;
    }

    .lobby-ticket-meta {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }

    .lobby-meta-pill {
      background: #3b2568;
      color: #ddd6fe;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 13.5px;
      font-weight: 600;
      border: 1px solid #5b3e94;
    }

    .lobby-call-time {
      font-size: 13px;
      color: #a78bfa;
    }

    .lobby-hero-empty {
      padding: 40px 20px;
    }

    .lobby-empty-num {
      font-size: 72px;
      font-weight: 900;
      color: #4c376e;
      margin-bottom: 12px;
    }

    .lobby-hero-empty h3 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 8px;
    }

    .lobby-hero-empty p {
      font-size: 14px;
      color: #c4b5fd;
      max-width: 420px;
      margin: 0 auto;
    }

    .lobby-side-card {
      background: #1e1338;
      border: 1px solid #3d2b63;
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .lobby-side-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #332354;
      padding-bottom: 12px;
    }

    .lobby-side-head h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #ffffff;
    }

    .lobby-side-sub {
      margin: 3px 0 0;
      font-size: 12px;
      color: #c4b5fd;
    }

    .lobby-wait-count {
      font-size: 12.5px;
      font-weight: 700;
      color: #a78bfa;
      background: #361f55;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid #553386;
    }

    .lobby-side-empty {
      text-align: center;
      padding: 40px 16px;
      color: #a78bfa;
    }

    .lobby-side-empty svg {
      width: 36px;
      height: 36px;
      color: #34d399;
      margin-bottom: 8px;
    }

    .lobby-tickets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
      max-height: 380px;
      overflow-y: auto;
    }

    .lobby-ticket-tile {
      background: #251845;
      border: 1px solid #432b77;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.2s;
    }

    .lobby-ticket-tile.is-next {
      border: 2px solid #34d399;
      background: #172d32;
    }

    .lobby-tile-top {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #c4b5fd;
      font-weight: 700;
    }

    .lobby-ticket-tile.is-next .lobby-tile-status {
      color: #34d399;
    }

    .lobby-tile-num {
      font-size: 24px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 0.5px;
    }

    .lobby-tile-service {
      font-size: 11px;
      color: #ddd6fe;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .lobby-tile-station {
      font-size: 10px;
      color: #a78bfa;
    }

    .lobby-finished-strip {
      border-top: 1px solid #332354;
      padding-top: 12px;
    }

    .lobby-finished-strip h4 {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 700;
      color: #c4b5fd;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .lobby-finished-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .lobby-done-tag {
      font-size: 11.5px;
      font-weight: 600;
      color: #34d399;
      background: #152e2c;
      border: 1px solid rgba(52, 211, 153, 0.3);
      padding: 3px 8px;
      border-radius: 6px;
    }

    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .queue-main-grid { grid-template-columns: 1fr; }
      .lobby-grid { grid-template-columns: 1fr; }
    }

    /* ---------------- DARK MODE OVERRIDES ---------------- */
    :host-context(body.dark-mode) .queue-header-row h1,
    :host-context(body.dark-mode) .kpi-number,
    :host-context(body.dark-mode) .serving-patient-name,
    :host-context(body.dark-mode) .sync-card-head h4,
    :host-context(body.dark-mode) .panel-section-head h3,
    :host-context(body.dark-mode) .completed-section-head h3,
    :host-context(body.dark-mode) .modal-head h2,
    :host-context(body.dark-mode) .confirm-head-title,
    :host-context(body.dark-mode) .ticket-patient-details h4 {
      color: #ffffff !important;
    }

    :host-context(body.dark-mode) .header-sub,
    :host-context(body.dark-mode) .kpi-subtext,
    :host-context(body.dark-mode) .serving-empty-state p,
    :host-context(body.dark-mode) .section-subtext,
    :host-context(body.dark-mode) .empty-sync-note,
    :host-context(body.dark-mode) .empty-waiting-box,
    :host-context(body.dark-mode) .ticket-type-meta,
    :host-context(body.dark-mode) .modal-sub,
    :host-context(body.dark-mode) .confirm-head-desc {
      color: #b7a8cf !important;
    }

    :host-context(body.dark-mode) .kpi-card,
    :host-context(body.dark-mode) .serving-hero-card,
    :host-context(body.dark-mode) .today-appointments-sync-card,
    :host-context(body.dark-mode) .waiting-list-panel,
    :host-context(body.dark-mode) .modal-card {
      background: #1e172c !important;
      border-color: #332549 !important;
    }

    :host-context(body.dark-mode) .serving-ticket-body {
      background: linear-gradient(135deg, #251c37 0%, #1e172c 100%) !important;
      border-color: #58338e !important;
    }

    :host-context(body.dark-mode) .ticket-number-display {
      color: #c4b5fd !important;
    }

    :host-context(body.dark-mode) .serving-empty-state {
      background: #251c37 !important;
      border-color: #4a346e !important;
    }

    :host-context(body.dark-mode) .serving-empty-state h3 {
      color: #ffffff !important;
    }

    :host-context(body.dark-mode) .queue-ticket-card {
      background: #251c37 !important;
      border-color: #3d2c5a !important;
    }

    :host-context(body.dark-mode) .queue-ticket-card.is-first {
      background: #2d2042 !important;
      border-left-color: #34d399 !important;
    }

    :host-context(body.dark-mode) .ticket-badge-box {
      background: #361f52 !important;
      color: #d8b4fe !important;
    }

    :host-context(body.dark-mode) .appt-sync-row {
      background: #251c37 !important;
      border-color: #3d2c5a !important;
    }

    :host-context(body.dark-mode) .appt-sync-info strong {
      color: #ffffff !important;
    }

    :host-context(body.dark-mode) .completed-table-wrap {
      border-color: #3d2c5a !important;
    }

    :host-context(body.dark-mode) .completed-mini-table th {
      background: #251c37 !important;
      color: #b7a8cf !important;
      border-bottom-color: #3d2c5a !important;
    }

    :host-context(body.dark-mode) .completed-mini-table td {
      border-bottom-color: #332549 !important;
      color: #ede7f6 !important;
    }

    :host-context(body.dark-mode) .completed-mini-table td strong {
      color: #ffffff !important;
    }

    :host-context(body.dark-mode) .btn-tv-mode {
      background: #251c37 !important;
      border-color: #4a346e !important;
      color: #ede7f6 !important;
    }

    :host-context(body.dark-mode) .btn-tv-mode:hover {
      background: #361f52 !important;
      color: #ffffff !important;
    }

    :host-context(body.dark-mode) .btn-skip-serving,
    :host-context(body.dark-mode) .btn-cancel-modal {
      background: #251c37 !important;
      border-color: #4a346e !important;
      color: #ede7f6 !important;
    }

    :host-context(body.dark-mode) .btn-skip-serving:hover,
    :host-context(body.dark-mode) .btn-cancel-modal:hover {
      background: #361f52 !important;
      color: #ffffff !important;
    }

    :host-context(body.dark-mode) .modal-head {
      background: #251c37 !important;
      border-bottom-color: #3d2c5a !important;
    }

    :host-context(body.dark-mode) .form-group label {
      color: #c4b5fd !important;
    }

    :host-context(body.dark-mode) .form-group select,
    :host-context(body.dark-mode) .form-group input {
      background: #251c37 !important;
      border-color: #3d2c5a !important;
      color: #ede7f6 !important;
    }

    :host-context(body.dark-mode) .pill-toggle-group {
      background: #251c37 !important;
    }

    :host-context(body.dark-mode) .pill-btn.active {
      background: #58338e !important;
      color: #ffffff !important;
    }
  `,
})
export class PatientQueue implements OnInit, OnDestroy {
  private appointmentsSvc = inject(AppointmentsService);
  private patientsSvc = inject(PatientsService);
  private notifSvc = inject(NotificationsService);
  private activityLog = inject(ActivityLogService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute, { optional: true });

  readonly today = todayIso();
  readonly tvMode = signal(false);
  readonly actionFeedback = signal('');
  readonly isProcessingAction = signal(false);

  // Live clock for TV Lobby Mode
  readonly liveClock = signal('');
  readonly liveDate = signal('');
  private clockTimer?: any;

  // Queue state
  readonly queueList = signal<QueueTicket[]>([]);
  readonly registeredPatients = signal<Patient[]>([]);
  readonly todayAppointments = signal<Appointment[]>([]);

  // Modal State
  readonly showCheckInModal = signal(false);
  readonly showClearConfirmModal = signal(false);
  checkInMode: 'registered' | 'walkin' = 'registered';
  selectedPatientId = '';
  walkinName = '';
  walkinPhone = '';
  checkInService = 'Prenatal Checkup';
  checkInPriority: QueuePriority = 'Regular';
  checkInStation = 'Consultation Room 1';
  triageBp = '';
  triageWeight = '';

  private queueUnsub: Unsubscribe | null = null;

  // Computed signals
  readonly activeQueueTickets = computed(() =>
    this.queueList().filter((t) => t.status !== 'cancelled')
  );

  readonly waitingTickets = computed(() =>
    this.queueList()
      .filter((t) => t.status === 'waiting' || t.status === 'skipped')
      .sort((a, b) => {
        // 'waiting' comes before 'skipped'
        if (a.status !== b.status) {
          return a.status === 'waiting' ? -1 : 1;
        }
        return (a.ticketNumber || '').localeCompare(b.ticketNumber || '', undefined, { numeric: true });
      })
  );

  readonly servingTicket = computed(() =>
    this.queueList().find((t) => t.status === 'serving' || t.status === 'called') || null
  );

  readonly completedTickets = computed(() =>
    this.queueList()
      .filter((t) => t.status === 'completed')
      .sort((a, b) => (b.completedTime || '').localeCompare(a.completedTime || ''))
  );

  readonly totalCheckedInCount = computed(() =>
    this.queueList().filter((t) => t.status !== 'cancelled').length
  );

  async ngOnInit(): Promise<void> {
    if (this.route?.snapshot.data['tvMode'] || (typeof window !== 'undefined' && window.location.pathname.includes('/lobby'))) {
      this.tvMode.set(true);
    }
    this.startLiveClock();

    // Clean up any legacy un-scoped localStorage queue from previous releases
    try {
      localStorage.removeItem('lcms_daily_queue_' + this.today);
    } catch {}

    await this.auth.ready;
    this.listenToQueueTickets();
    void this.loadTodayAppointments();
    void this.loadPatients();
  }

  ngOnDestroy(): void {
    if (this.queueUnsub) {
      this.queueUnsub();
      this.queueUnsub = null;
    }
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  private startLiveClock(): void {
    const updateTime = () => {
      const now = new Date();
      this.liveClock.set(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      this.liveDate.set(
        now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      );
    };
    updateTime();
    this.clockTimer = setInterval(updateTime, 1000);
  }

  listenToQueueTickets(): void {
    const currentUid = auth.currentUser?.uid || this.auth.user()?.uid;
    const role = this.auth.role() || (auth.currentUser?.email?.startsWith('admin') ? 'admin' : 'midwife');

    if (this.queueUnsub) {
      this.queueUnsub();
      this.queueUnsub = null;
    }

    try {
      // If admin, can view all clinic tickets today.
      // If midwife, strictly scoped to this midwife UID!
      const q = (role === 'admin' && !currentUid)
        ? query(collection(db, 'queue_tickets'), where('date', '==', this.today))
        : query(
            collection(db, 'queue_tickets'),
            where('date', '==', this.today),
            where('midwifeId', '==', currentUid || '__none__')
          );

      this.queueUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: QueueTicket[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              list.push({
                id: d.id,
                ticketNumber: data['ticketNumber'] || d.id,
                patientId: data['patientId'] || null,
                patientUid: data['patientUid'] || null,
                patientName: data['patientName'] || 'Outpatient',
                contactNumber: data['contactNumber'] || '',
                visitType: data['visitType'] || 'Prenatal Checkup',
                priority: data['priority'] || 'Regular',
                status: data['status'] || 'waiting',
                checkInTime: data['checkInTime'] || '',
                checkInTimestamp: data['checkInTimestamp'] || data['createdAt'],
                servingStartTime: data['servingStartTime'],
                servingStartTimestamp: data['servingStartTimestamp'],
                calledTime: data['calledTime'],
                calledTimestamp: data['calledTimestamp'],
                completedTime: data['completedTime'],
                completedTimestamp: data['completedTimestamp'],
                station: data['station'] || 'Consultation Room 1',
                notes: data['notes'] || '',
                bp: data['bp'] || '',
                weight: data['weight'] || '',
                appointmentId: data['appointmentId'] || null,
                date: data['date'] || this.today,
                midwifeId: data['midwifeId'] || currentUid,
                assignedMidwifeId: data['assignedMidwifeId'] || currentUid,
              });
            });
            list.sort((a, b) =>
              (a.ticketNumber || '').localeCompare(b.ticketNumber || '', undefined, { numeric: true })
            );
            this.queueList.set(list);
            this.saveQueueLocal(list);
          } else {
            // No queue records for this midwife today. Reset to empty state.
            this.queueList.set([]);
            this.saveQueueLocal([]);
          }
        },
        (err) => {
          console.warn('queue_tickets onSnapshot error:', err);
          const local = this.loadLocalQueue();
          this.queueList.set(local);
        }
      );
    } catch (err) {
      console.warn('queue_tickets listener setup error:', err);
      const local = this.loadLocalQueue();
      this.queueList.set(local);
    }
  }

  loadLocalQueue(): QueueTicket[] {
    try {
      const currentUid = auth.currentUser?.uid || this.auth.user()?.uid;
      if (!currentUid) return [];
      const raw = localStorage.getItem(`lcms_daily_queue_${currentUid}_${this.today}`);
      if (raw) {
        const parsed: QueueTicket[] = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  saveQueueLocal(list: QueueTicket[]): void {
    try {
      const currentUid = auth.currentUser?.uid || this.auth.user()?.uid;
      if (!currentUid) return;
      localStorage.setItem(`lcms_daily_queue_${currentUid}_${this.today}`, JSON.stringify(list));
    } catch {}
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

  toggleTvMode(): void {
    this.tvMode.update((v) => !v);
  }

  isAlreadyInQueue(name: string): boolean {
    return this.queueList().some(
      (t) => t.status !== 'cancelled' && t.patientName.toLowerCase() === name.toLowerCase()
    );
  }

  // ========================================================
  // PATIENT NOTIFICATION SYSTEM
  // ========================================================
  /**
   * Resolves patient UID dynamically from ticket data, registered patients list,
   * or Firestore users directory.
   */
  async resolvePatientUid(ticket: QueueTicket): Promise<string | null> {
    // 1. Check direct patientUid on ticket
    if (ticket.patientUid && ticket.patientUid.length > 20) {
      return ticket.patientUid;
    }

    // 2. Check registered patients directory
    if (ticket.patientId) {
      const reg = this.registeredPatients().find((p) => p.id === ticket.patientId);
      if (reg?.uid && reg.uid.length > 20) return reg.uid;
      if (reg && reg.id && reg.id.length > 20) return reg.id;
    }

    // 3. Match by name or phone in registeredPatients list
    const nameMatch = this.registeredPatients().find(
      (p) => p.fullName.trim().toLowerCase() === ticket.patientName.trim().toLowerCase()
    );
    if (nameMatch?.uid && nameMatch.uid.length > 20) return nameMatch.uid;
    if (nameMatch && nameMatch.id && nameMatch.id.length > 20) return nameMatch.id;

    // 4. Query Firestore users collection for patient by full name
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'patient'))
      );
      const targetName = ticket.patientName.trim().toLowerCase();
      for (const d of snap.docs) {
        const u = d.data();
        const uName = (u['fullName'] || u['displayName'] || '').trim().toLowerCase();
        if (uName === targetName) {
          return d.id;
        }
      }
    } catch (e) {
      console.warn('Could not query users collection:', e);
    }

    return null;
  }

  /**
   * Creates an official real-time notification in Firestore for the called patient.
   */
  async sendPatientNotification(ticket: QueueTicket): Promise<boolean> {
    try {
      const patientUid = await this.resolvePatientUid(ticket);
      if (!patientUid) {
        console.log(`[Queue Notification] Ticket ${ticket.ticketNumber} (${ticket.patientName}) has no linked Patient Portal UID.`);
        return false;
      }

      const room = ticket.station || 'Consultation Room 1';
      const title = "It's Your Turn!";
      const message = `Your queue number ${ticket.ticketNumber} is now being called. Please proceed to ${room}.`;

      await this.notifSvc.createNotification({
        title,
        message,
        type: 'patient',
        targetRole: 'patient',
        targetUserId: patientUid,
        patientUid,
        patientName: ticket.patientName,
        queueTicketNumber: ticket.ticketNumber,
        consultationRoom: room,
        queueRecordId: ticket.id,
        route: '/patient',
      });

      console.log(`[Queue Notification] Successfully dispatched calling alert to ${ticket.patientName} (UID: ${patientUid})`);
      return true;
    } catch (err) {
      console.error('[Queue Notification] Failed to dispatch patient notification:', err);
      return false;
    }
  }

  /**
   * Audio chime / speech announcement for waiting lobby.
   */
  announceTicket(ticketNumber: string, room: string): void {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = `Now calling ticket ${ticketNumber}. Please proceed to ${room}.`;
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  }

  // ========================================================
  // QUEUE PROGRESSION OPERATIONS
  // ========================================================

  /**
   * 1. CALL NEXT TICKET:
   * Finds next eligible patient in line, completes any currently serving patient,
   * updates Firestore, notifies the patient, and announces ticket.
   */
  async callNextInQueue(): Promise<void> {
    if (this.isProcessingAction()) return;
    const waiting = this.waitingTickets();
    if (!waiting.length) {
      this.showToast('No patients currently waiting in line.');
      return;
    }

    this.isProcessingAction.set(true);
    const nextTicket = waiting[0];
    const currentServing = this.servingTicket();
    const curTime = this.currentTimeString();
    const room = nextTicket.station || 'Consultation Room 1';

    try {
      // 1. Complete existing serving ticket in Firestore
      if (currentServing) {
        await setDoc(
          doc(db, 'queue_tickets', currentServing.id),
          {
            status: 'completed',
            completedTime: curTime,
            completedTimestamp: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (currentServing.appointmentId) {
          updateDoc(doc(db, 'appointments', currentServing.appointmentId), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }

      // 2. Set next ticket to 'serving'
      await setDoc(
        doc(db, 'queue_tickets', nextTicket.id),
        {
          status: 'serving',
          servingStartTime: curTime,
          calledTime: curTime,
          calledTimestamp: serverTimestamp(),
          servingStartTimestamp: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3. Update local signal state immediately
      const updated = this.queueList().map((t) => {
        if (currentServing && t.id === currentServing.id) {
          return {
            ...t,
            status: 'completed' as QueueStatus,
            completedTime: curTime,
          };
        }
        if (t.id === nextTicket.id) {
          return {
            ...t,
            status: 'serving' as QueueStatus,
            servingStartTime: curTime,
            calledTime: curTime,
          };
        }
        return t;
      });
      this.queueList.set(updated);
      this.saveQueueLocal(updated);

      // 4. Send official patient notification
      const notified = await this.sendPatientNotification(nextTicket);

      // 5. Audio announcement
      this.announceTicket(nextTicket.ticketNumber, room);

      // 6. Midwife feedback toast
      if (notified) {
        this.showToast(`Calling ${nextTicket.ticketNumber} — ${nextTicket.patientName}! (Notification sent to Patient Portal)`);
      } else {
        this.showToast(`Calling ${nextTicket.ticketNumber} — ${nextTicket.patientName}!`);
      }

      // 7. Log audit activity
      void this.activityLog.logActivity({
        userName: this.auth.user()?.displayName || 'Midwife on Duty',
        userRole: 'midwife',
        userEmail: this.auth.user()?.email || 'midwife@lyingincare.ph',
        targetRecordId: nextTicket.id,
        activity: `Called ticket ${nextTicket.ticketNumber} (${nextTicket.patientName}) to ${room}`,
      });
    } catch (err: any) {
      console.error('Error calling next ticket:', err);
      this.showToast('Could not call next ticket: ' + (err?.message || 'Network error'));
    } finally {
      this.isProcessingAction.set(false);
    }
  }

  /**
   * 2. CALL IN SPECIFIC TICKET:
   * Serves an individual selected ticket from the waiting list.
   */
  async serveSpecificTicket(t: QueueTicket): Promise<void> {
    if (this.isProcessingAction()) return;
    this.isProcessingAction.set(true);
    const currentServing = this.servingTicket();
    const curTime = this.currentTimeString();
    const room = t.station || 'Consultation Room 1';

    try {
      if (currentServing && currentServing.id !== t.id) {
        await setDoc(
          doc(db, 'queue_tickets', currentServing.id),
          {
            status: 'completed',
            completedTime: curTime,
            completedTimestamp: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (currentServing.appointmentId) {
          updateDoc(doc(db, 'appointments', currentServing.appointmentId), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }

      await setDoc(
        doc(db, 'queue_tickets', t.id),
        {
          status: 'serving',
          servingStartTime: curTime,
          calledTime: curTime,
          calledTimestamp: serverTimestamp(),
          servingStartTimestamp: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const updated = this.queueList().map((item) => {
        if (currentServing && item.id === currentServing.id) {
          return { ...item, status: 'completed' as QueueStatus, completedTime: curTime };
        }
        if (item.id === t.id) {
          return { ...item, status: 'serving' as QueueStatus, servingStartTime: curTime, calledTime: curTime };
        }
        return item;
      });
      this.queueList.set(updated);
      this.saveQueueLocal(updated);

      const notified = await this.sendPatientNotification(t);
      this.announceTicket(t.ticketNumber, room);

      if (notified) {
        this.showToast(`Now serving ${t.ticketNumber} (${t.patientName}) · Notification sent!`);
      } else {
        this.showToast(`Now serving ${t.ticketNumber} (${t.patientName})`);
      }

      void this.activityLog.logActivity({
        userName: this.auth.user()?.displayName || 'Midwife on Duty',
        userRole: 'midwife',
        userEmail: this.auth.user()?.email || 'midwife@lyingincare.ph',
        targetRecordId: t.id,
        activity: `Called in ticket ${t.ticketNumber} (${t.patientName})`,
      });
    } catch (err: any) {
      console.error('Error serving specific ticket:', err);
      this.showToast('Could not call ticket: ' + (err?.message || 'Error'));
    } finally {
      this.isProcessingAction.set(false);
    }
  }

  /**
   * 3. MARK COMPLETE:
   * Completes consultation, saves timestamp in Firestore, updates Finished table,
   * and automatically advances to the next waiting patient if available.
   */
  async completeCurrentServing(t: QueueTicket): Promise<void> {
    if (this.isProcessingAction()) return;
    this.isProcessingAction.set(true);
    const curTime = this.currentTimeString();

    try {
      // 1. Mark current ticket as completed in Firestore
      await setDoc(
        doc(db, 'queue_tickets', t.id),
        {
          status: 'completed',
          completedTime: curTime,
          completedTimestamp: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Complete appointment if associated
      if (t.appointmentId) {
        updateDoc(doc(db, 'appointments', t.appointmentId), {
          status: 'completed',
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      // Notify completed patient
      const completedPatientUid = await this.resolvePatientUid(t);
      if (completedPatientUid) {
        this.notifSvc.createNotification({
          title: 'Consultation Completed',
          message: 'Your consultation has been marked as completed. Thank you!',
          type: 'patient',
          targetRole: 'patient',
          targetUserId: completedPatientUid,
          patientUid: completedPatientUid,
          patientName: t.patientName,
          queueTicketNumber: t.ticketNumber,
          route: '/patient',
        }).catch(() => undefined);
      }

      // 3. Find next waiting patient to automatically advance
      const nextWaiting = this.waitingTickets().filter((item) => item.id !== t.id);
      let nextCalledTicket: QueueTicket | null = null;

      if (nextWaiting.length > 0) {
        nextCalledTicket = nextWaiting[0];
        const nextRoom = nextCalledTicket.station || 'Consultation Room 1';

        await setDoc(
          doc(db, 'queue_tickets', nextCalledTicket.id),
          {
            status: 'serving',
            servingStartTime: curTime,
            calledTime: curTime,
            calledTimestamp: serverTimestamp(),
            servingStartTimestamp: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Notify next patient
        const notified = await this.sendPatientNotification(nextCalledTicket);
        this.announceTicket(nextCalledTicket.ticketNumber, nextRoom);

        this.showToast(
          `Ticket ${t.ticketNumber} completed! Automatically calling next: ${nextCalledTicket.ticketNumber} (${nextCalledTicket.patientName})${notified ? ' · Notification sent' : ''}`
        );
      } else {
        this.showToast(`Ticket ${t.ticketNumber} (${t.patientName}) completed! Consultation room is now open.`);
      }

      // 4. Update local state
      const updated = this.queueList().map((item) => {
        if (item.id === t.id) {
          return {
            ...item,
            status: 'completed' as QueueStatus,
            completedTime: curTime,
          };
        }
        if (nextCalledTicket && item.id === nextCalledTicket.id) {
          return {
            ...item,
            status: 'serving' as QueueStatus,
            servingStartTime: curTime,
            calledTime: curTime,
          };
        }
        return item;
      });
      this.queueList.set(updated);
      this.saveQueueLocal(updated);

      void this.activityLog.logActivity({
        userName: this.auth.user()?.displayName || 'Midwife on Duty',
        userRole: 'midwife',
        userEmail: this.auth.user()?.email || 'midwife@lyingincare.ph',
        targetRecordId: t.id,
        activity: `Completed consultation for ticket ${t.ticketNumber} (${t.patientName})`,
      });
    } catch (err: any) {
      console.error('Error completing ticket:', err);
      this.showToast('Could not mark complete: ' + (err?.message || 'Error'));
    } finally {
      this.isProcessingAction.set(false);
    }
  }

  /**
   * 4. SKIP / HOLD:
   * Moves patient to hold status in Firestore without deleting record.
   */
  async skipTicket(t: QueueTicket): Promise<void> {
    if (this.isProcessingAction()) return;
    this.isProcessingAction.set(true);

    try {
      await setDoc(
        doc(db, 'queue_tickets', t.id),
        {
          status: 'skipped',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Notify patient of queue update (placed on hold)
      const patientUid = await this.resolvePatientUid(t);
      if (patientUid) {
        this.notifSvc.createNotification({
          title: 'Queue Update',
          message: 'Your consultation has been placed on hold. Please wait for further instructions from your midwife.',
          type: 'patient',
          targetRole: 'patient',
          targetUserId: patientUid,
          patientUid,
          patientName: t.patientName,
          queueTicketNumber: t.ticketNumber,
          route: '/patient',
        }).catch(() => undefined);
      }

      const updated = this.queueList().map((item) => {
        if (item.id === t.id) {
          return { ...item, status: 'skipped' as QueueStatus };
        }
        return item;
      });
      this.queueList.set(updated);
      this.saveQueueLocal(updated);
      this.showToast(`Ticket ${t.ticketNumber} (${t.patientName}) placed on hold. Room is now open.`);
    } catch (err: any) {
      console.error('Error skipping ticket:', err);
      this.showToast('Could not place ticket on hold');
    } finally {
      this.isProcessingAction.set(false);
    }
  }

  /**
   * 5. REMOVE TICKET FROM ACTIVE LINE:
   * Marks as cancelled in Firestore, preserving record history.
   */
  async removeTicket(id: string): Promise<void> {
    try {
      await setDoc(
        doc(db, 'queue_tickets', id),
        {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const updated = this.queueList().map((t) => (t.id === id ? { ...t, status: 'cancelled' as QueueStatus } : t));
      this.queueList.set(updated);
      this.saveQueueLocal(updated);
      this.showToast('Ticket removed from active queue.');
    } catch (err: any) {
      console.error('Error removing ticket:', err);
      this.showToast('Could not remove ticket');
    }
  }

  /**
   * 6. CLEAR QUEUE (WITH CONFIRMATION & HISTORICAL PRESERVATION):
   * Cancels waiting/serving tickets while keeping all completed tickets safely preserved.
   */
  clearAllQueue(): void {
    this.showClearConfirmModal.set(true);
  }

  async confirmClearQueue(): Promise<void> {
    this.showClearConfirmModal.set(false);
    const active = this.queueList().filter((t) => t.status === 'waiting' || t.status === 'serving' || t.status === 'called' || t.status === 'skipped');

    try {
      const batch = writeBatch(db);
      for (const t of active) {
        batch.update(doc(db, 'queue_tickets', t.id), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();

      const updated = this.queueList().map((t) => {
        if (t.status === 'waiting' || t.status === 'serving' || t.status === 'called' || t.status === 'skipped') {
          return { ...t, status: 'cancelled' as QueueStatus };
        }
        return t;
      });
      this.queueList.set(updated);
      this.saveQueueLocal(updated);

      this.showToast('Active queue cleared. Completed consultation records are preserved.');
    } catch (err: any) {
      console.error('Error clearing queue:', err);
      this.showToast('Could not clear queue: ' + (err?.message || 'Error'));
    }
  }

  // ========================================================
  // CHECK-IN & TICKET ISSUANCE
  // ========================================================

  /**
   * Fast check-in from today's booked appointment.
   */
  async checkInFromAppointment(a: Appointment): Promise<void> {
    const nextNum = this.nextTicketNumber();
    const docRef = doc(collection(db, 'queue_tickets'));

    let pUid: string | null = null;
    if (a.patientId && a.patientId.length > 20) {
      pUid = a.patientId;
    } else {
      const p = this.registeredPatients().find((item) => item.id === a.patientId || item.fullName === a.patientName);
      if (p?.uid) pUid = p.uid;
      else if (p && p.id && p.id.length > 20) pUid = p.id;
    }

    const currentUid = auth.currentUser?.uid || this.auth.user()?.uid || null;

    const newTicket: QueueTicket = {
      id: docRef.id,
      ticketNumber: nextNum,
      patientId: a.patientId || null,
      patientUid: pUid,
      patientName: a.patientName,
      visitType: a.type || 'Prenatal Checkup',
      priority: 'Regular',
      status: 'waiting',
      checkInTime: this.currentTimeString(),
      station: 'Consultation Room 1',
      notes: a.notes || '',
      appointmentId: a.id,
      date: this.today,
      midwifeId: currentUid,
      assignedMidwifeId: currentUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(docRef, newTicket);
      this.queueList.update((curr) => [...curr, newTicket]);
      this.saveQueueLocal(this.queueList());
      this.showToast(`Ticket ${nextNum} issued for ${a.patientName}!`);

      // 1. Notify patient about check-in
      if (newTicket.patientUid) {
        this.notifSvc.createNotification({
          title: "You're Checked In!",
          message: `Your check-in was successful. Your queue number is ${newTicket.ticketNumber}. Please wait for your turn.`,
          type: 'patient',
          targetRole: 'patient',
          targetUserId: newTicket.patientUid,
          patientUid: newTicket.patientUid,
          patientName: newTicket.patientName,
          queueTicketNumber: newTicket.ticketNumber,
          route: '/patient',
        }).catch(() => undefined);
      }

      // 2. Notify midwife
      if (currentUid) {
        this.notifSvc.createNotification({
          title: `Patient Checked In: ${newTicket.patientName}`,
          message: `${newTicket.patientName} has checked in (${newTicket.ticketNumber}) for ${newTicket.visitType}.`,
          type: 'patient',
          targetRole: 'midwife',
          targetUserId: currentUid,
          patientUid: newTicket.patientUid || undefined,
          patientName: newTicket.patientName,
          queueTicketNumber: newTicket.ticketNumber,
          route: '/midwife/queue',
        }).catch(() => undefined);
      }
    } catch (err: any) {
      console.error('Error checking in appointment:', err);
      this.showToast('Could not generate ticket');
    }
  }

  // Check-In Modal Operations
  openCheckInModal(): void {
    this.checkInMode = 'registered';
    this.selectedPatientId = '';
    this.walkinName = '';
    this.walkinPhone = '';
    this.checkInService = 'Prenatal Checkup';
    this.checkInPriority = 'Regular';
    this.checkInStation = 'Consultation Room 1';
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

  async submitCheckIn(): Promise<void> {
    let name = '';
    let phone = '';
    let pId: string | null = null;
    let pUid: string | null = null;

    if (this.checkInMode === 'registered') {
      const p = this.registeredPatients().find((item) => item.id === this.selectedPatientId);
      if (!p) return;
      name = p.fullName;
      phone = p.contactNumber || '';
      pId = p.id;
      pUid = p.uid || (p.id.length > 20 ? p.id : null);
    } else {
      name = this.walkinName.trim();
      phone = this.walkinPhone.trim();
    }

    const currentUid = auth.currentUser?.uid || this.auth.user()?.uid || null;
    const nextNum = this.nextTicketNumber();
    const docRef = doc(collection(db, 'queue_tickets'));
    const newTicket: QueueTicket = {
      id: docRef.id,
      ticketNumber: nextNum,
      patientId: pId,
      patientUid: pUid,
      patientName: name,
      contactNumber: phone,
      visitType: this.checkInService,
      priority: this.checkInPriority,
      status: 'waiting',
      checkInTime: this.currentTimeString(),
      station: this.checkInStation || 'Consultation Room 1',
      bp: this.triageBp || '110/70',
      weight: this.triageWeight || '58 kg',
      date: this.today,
      midwifeId: currentUid,
      assignedMidwifeId: currentUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(docRef, newTicket);
      this.queueList.update((curr) => [...curr, newTicket]);
      this.saveQueueLocal(this.queueList());
      this.closeCheckInModal();
      this.showToast(`Ticket ${nextNum} issued for ${name}!`);

      // 1. Notify patient about check-in
      if (newTicket.patientUid) {
        this.notifSvc.createNotification({
          title: "You're Checked In!",
          message: `Your check-in was successful. Your queue number is ${newTicket.ticketNumber}. Please wait for your turn.`,
          type: 'patient',
          targetRole: 'patient',
          targetUserId: newTicket.patientUid,
          patientUid: newTicket.patientUid,
          patientName: newTicket.patientName,
          queueTicketNumber: newTicket.ticketNumber,
          route: '/patient',
        }).catch(() => undefined);
      }

      // 2. Notify midwife
      if (currentUid) {
        this.notifSvc.createNotification({
          title: `Patient Checked In: ${name}`,
          message: `${name} has checked in with ticket ${newTicket.ticketNumber} for ${newTicket.visitType}.`,
          type: 'patient',
          targetRole: 'midwife',
          targetUserId: currentUid,
          patientUid: newTicket.patientUid || undefined,
          patientName: name,
          queueTicketNumber: newTicket.ticketNumber,
          route: '/midwife/queue',
        }).catch(() => undefined);
      }
    } catch (err: any) {
      console.error('Error submitting check-in:', err);
      this.showToast('Could not issue ticket');
    }
  }

  /**
   * Generates sequential ticket numbers (e.g. Q-101, Q-102, Q-103) preventing duplicates.
   */
  private nextTicketNumber(): string {
    const existingNumbers = this.queueList()
      .map((t) => {
        const match = (t.ticketNumber || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => n > 0);

    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 100;
    const next = maxNum >= 100 ? maxNum + 1 : 101;
    return `Q-${String(next).padStart(3, '0')}`;
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
      case 'High Risk':
        return 'high-risk';
      case 'Emergency':
        return 'emergency';
      case 'Senior/PWD':
        return 'senior';
      default:
        return 'regular';
    }
  }

  private showToast(msg: string): void {
    this.actionFeedback.set(msg);
    setTimeout(() => this.actionFeedback.set(''), 4500);
  }
}
