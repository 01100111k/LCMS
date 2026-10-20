import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';
import { DeliveryRecord, RecordsService } from '../core/records.service';

@Component({
  selector: 'app-delivery-records',
  imports: [DatePipe, FormsModule],
  template: `
    <div class="records-page-wrap">
      <!-- ============ TOP HEADER ============ -->
      <div class="records-header-row">
        <div>
          <h1>Labor & Delivery Clinical Records</h1>
          <p class="header-sub">
            Document child delivery logs, APGAR scores, Essential Intrapartum & Newborn Care (EINC), and maternal birth outcomes.
          </p>
        </div>

        <div class="header-action-group">
          <button type="button" class="btn-primary-action" (click)="openAddModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Register Delivery / Birth
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
            placeholder="Search mother's name, attending midwife, or baby notes..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>

        <div class="filter-selects-group">
          <select [ngModel]="filterType()" (ngModelChange)="filterType.set($event)">
            <option value="All">All Delivery Types</option>
            <option value="Normal Spontaneous Vaginal Delivery (NSVD)">NSVD (Normal)</option>
            <option value="Assisted Vaginal Delivery">Assisted Vaginal</option>
            <option value="Emergency Transfer">Hospital Transfer</option>
          </select>

          <select [ngModel]="filterSex()" (ngModelChange)="filterSex.set($event)">
            <option value="All">All Genders</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>
        </div>
      </div>

      <!-- ============ RECORDS TABLE & LIST ============ -->
      @if (loading()) {
        <div class="loading-state-card">
          <p>Loading labor and delivery records...</p>
        </div>
      } @else if (filteredRecords().length === 0) {
        <div class="empty-records-card">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <h3>No Delivery Records Logged Yet</h3>
          <p>Document birth deliveries, APGAR evaluations, and immediate newborn care protocols.</p>
          <button type="button" class="btn-primary-action" (click)="openAddModal()" style="margin-top: 10px;">
            Register Delivery / Birth
          </button>
        </div>
      } @else {
        <div class="table-container-card">
          <table class="clinical-table">
            <thead>
              <tr>
                <th>Delivery Date & Time</th>
                <th>Mother's Name</th>
                <th>Type of Delivery</th>
                <th>Baby Sex & Weight</th>
                <th>APGAR Score</th>
                <th>Perineum Status</th>
                <th>Attending Midwife</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredRecords(); track r.id) {
                <tr>
                  <td>
                    <strong>{{ r.deliveryDateTime | date: 'MMM d, y' }}</strong>
                    <div class="sub-label">{{ r.deliveryDateTime | date: 'shortTime' }}</div>
                  </td>
                  <td>
                    <strong class="patient-name-cell">{{ r.patientName }}</strong>
                    <div class="sub-label">{{ r.gestationalAgeAtDelivery }} · {{ r.gravidaPara || 'G1P1' }}</div>
                  </td>
                  <td>
                    <span class="delivery-type-pill">{{ r.deliveryType }}</span>
                  </td>
                  <td>
                    <div class="baby-info-cell">
                      <span class="gender-tag" [class.is-female]="r.babySex === 'Female'" [class.is-male]="r.babySex === 'Male'">
                        {{ r.babySex === 'Female' ? '♀ Girl' : '♂ Boy' }}
                      </span>
                      <strong>{{ r.birthWeightGrams }} g</strong>
                    </div>
                    <div class="sub-label">Length: {{ r.birthLengthCm }} cm</div>
                  </td>
                  <td>
                    <div class="apgar-badge" [class.is-good]="r.apgar5Min >= 8" [class.is-warning]="r.apgar5Min < 8">
                      1m: {{ r.apgar1Min }} · 5m: {{ r.apgar5Min }}
                    </div>
                  </td>
                  <td>
                    <div>{{ r.perineumStatus }}</div>
                    <div class="sub-label">EBL: {{ r.estimatedBloodLossMl }} ml</div>
                  </td>
                  <td>
                    <strong>{{ r.attendingMidwife }}</strong>
                  </td>
                  <td style="text-align: right;">
                    <div class="row-actions-group">
                      <button type="button" class="btn-row-action" (click)="viewRecord(r)" title="View Birth Registry">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button type="button" class="btn-row-action btn-danger" (click)="deleteRecord(r)" title="Delete Delivery Record">
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

      <!-- ==================== REGISTER DELIVERY MODAL ==================== -->
      @if (showAddModal()) {
        <div class="modal-backdrop" (click)="closeAddModal()">
          <div class="modal-dialog-card modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-row">
                <div class="modal-icon tone-purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                </div>
                <div>
                  <h2>Register Labor & Delivery Record</h2>
                  <p class="modal-subtitle">Record delivery details, newborn parameters, and EINC clinical execution.</p>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="closeAddModal()">✕</button>
            </div>

            <form (ngSubmit)="submitDeliveryRecord()" class="modal-body-scroll">
              <!-- Section 1: Mother Information -->
              <div class="form-section-title">1. Maternal Admission & Delivery Timestamp</div>
              <div class="form-row-2">
                <div class="form-field">
                  <label>Select Mother / Patient <span class="req">*</span></label>
                  <select [(ngModel)]="formPatientId" name="patientId" (change)="onPatientSelect()" required>
                    <option value="" disabled>-- Choose mother from registered patients --</option>
                    @for (p of patients(); track p.id) {
                      <option [value]="p.id">{{ p.fullName }} ({{ p.status || 'Active' }})</option>
                    }
                  </select>
                </div>

                <div class="form-field">
                  <label>Delivery Date & Time <span class="req">*</span></label>
                  <input type="datetime-local" [(ngModel)]="formDeliveryDateTime" name="formDeliveryDateTime" required />
                </div>
              </div>

              <div class="form-row-3">
                <div class="form-field">
                  <label>Admission Date & Time</label>
                  <input type="datetime-local" [(ngModel)]="formAdmissionDateTime" name="formAdmissionDateTime" />
                </div>

                <div class="form-field">
                  <label>Type of Delivery <span class="req">*</span></label>
                  <select [(ngModel)]="formDeliveryType" name="formDeliveryType" required>
                    <option value="Normal Spontaneous Vaginal Delivery (NSVD)">Normal Spontaneous Vaginal Delivery (NSVD)</option>
                    <option value="Assisted Vaginal Delivery">Assisted Vaginal Delivery</option>
                    <option value="Emergency Transfer">Emergency Transfer to Hospital</option>
                  </select>
                </div>

                <div class="form-field">
                  <label>Gestational Age at Birth</label>
                  <input type="text" [(ngModel)]="formGaAtDelivery" name="formGaAtDelivery" placeholder="39 weeks" />
                </div>
              </div>

              <!-- Section 2: Labor & Maternal Outcome -->
              <div class="form-section-title">2. Labor Progress, Perineum & Blood Loss</div>
              <div class="form-row-3">
                <div class="form-field">
                  <label>Rupture of Membranes</label>
                  <select [(ngModel)]="formRuptureMembranes" name="formRuptureMembranes">
                    <option value="Spontaneous - Clear amniotic fluid">Spontaneous - Clear fluid</option>
                    <option value="Artificial (AROM) - Clear">Artificial (AROM) - Clear</option>
                    <option value="Meconium-stained fluid">Meconium-stained</option>
                    <option value="Premature Rupture (PROM)">Premature Rupture (PROM)</option>
                  </select>
                </div>

                <div class="form-field">
                  <label>Perineum Status</label>
                  <select [(ngModel)]="formPerineumStatus" name="formPerineumStatus">
                    <option value="Intact">Intact (No laceration)</option>
                    <option value="1st Degree Laceration">1st Degree Laceration</option>
                    <option value="2nd Degree Laceration">2nd Degree Laceration</option>
                    <option value="Episiotomy">Episiotomy (Mediolateral)</option>
                    <option value="Repaired">Repaired with sutures</option>
                  </select>
                </div>

                <div class="form-field">
                  <label>Estimated Blood Loss (mL)</label>
                  <input type="number" [(ngModel)]="formBloodLossMl" name="formBloodLossMl" placeholder="250" />
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-field">
                  <label>Placenta Delivery</label>
                  <select [(ngModel)]="formPlacentaStatus" name="formPlacentaStatus">
                    <option value="Complete & intact">Complete & intact (Schultze / Duncan)</option>
                    <option value="Manual extraction">Manual extraction required</option>
                    <option value="Incomplete">Incomplete / Cotyledon retained</option>
                  </select>
                </div>

                <div class="form-field">
                  <label>Maternal Complications</label>
                  <input type="text" [(ngModel)]="formMaternalComplications" name="formMaternalComplications" placeholder="None / Stable" />
                </div>
              </div>

              <!-- Section 3: Newborn Clinical Assessment -->
              <div class="form-section-title">3. Newborn Assessment & APGAR Score</div>
              <div class="form-row-4">
                <div class="form-field">
                  <label>Baby Sex <span class="req">*</span></label>
                  <select [(ngModel)]="formBabySex" name="formBabySex" required>
                    <option value="Female">Female (Girl)</option>
                    <option value="Male">Male (Boy)</option>
                  </select>
                </div>

                <div class="form-field">
                  <label>Birth Weight (grams) <span class="req">*</span></label>
                  <input type="number" [(ngModel)]="formBirthWeightGrams" name="formBirthWeightGrams" placeholder="3200" required />
                </div>

                <div class="form-field">
                  <label>Birth Length (cm) <span class="req">*</span></label>
                  <input type="number" step="0.1" [(ngModel)]="formBirthLengthCm" name="formBirthLengthCm" placeholder="50" required />
                </div>

                <div class="form-field">
                  <label>Head Circumference (cm)</label>
                  <input type="number" step="0.1" [(ngModel)]="formHeadCircumferenceCm" name="formHeadCircumferenceCm" placeholder="34" />
                </div>
              </div>

              <div class="form-row-3">
                <div class="form-field">
                  <label>Chest Circumference (cm)</label>
                  <input type="number" step="0.1" [(ngModel)]="formChestCircumferenceCm" name="formChestCircumferenceCm" placeholder="33" />
                </div>

                <div class="form-field">
                  <label>APGAR Score at 1 Minute (0-10)</label>
                  <input type="number" min="0" max="10" [(ngModel)]="formApgar1Min" name="formApgar1Min" placeholder="9" />
                </div>

                <div class="form-field">
                  <label>APGAR Score at 5 Minutes (0-10)</label>
                  <input type="number" min="0" max="10" [(ngModel)]="formApgar5Min" name="formApgar5Min" placeholder="10" />
                </div>
              </div>

              <!-- Section 4: EINC Protocol & Newborn Prophylaxis -->
              <div class="form-section-title">4. Essential Intrapartum & Newborn Care (EINC) & Immunization</div>
              <div class="checks-cluster">
                <label class="check-box-item">
                  <input type="checkbox" [(ngModel)]="formEincDrying" name="formEincDrying" />
                  <strong>1. Immediate & thorough drying (30 seconds)</strong>
                </label>
                <label class="check-box-item">
                  <input type="checkbox" [(ngModel)]="formEincSkin" name="formEincSkin" />
                  <strong>2. Early skin-to-skin contact (at least 90 mins)</strong>
                </label>
                <label class="check-box-item">
                  <input type="checkbox" [(ngModel)]="formEincClamping" name="formEincClamping" />
                  <strong>3. Properly timed / delayed cord clamping</strong>
                </label>
                <label class="check-box-item">
                  <input type="checkbox" [(ngModel)]="formEincFeeding" name="formEincFeeding" />
                  <strong>4. Non-separation & initiation of breastfeeding</strong>
                </label>
              </div>

              <div class="checks-cluster" style="background:#eaf7f4; border-color:#bce5dc;">
                <span style="font-size:12px; font-weight:700; color:#0b6b58;">Newborn Prophylaxis Given:</span>
                <div style="display:flex; flex-wrap:wrap; gap:14px; margin-top:4px;">
                  <label class="check-box-item">
                    <input type="checkbox" [(ngModel)]="formVitaminK" name="formVitaminK" />
                    Vitamin K Injection
                  </label>
                  <label class="check-box-item">
                    <input type="checkbox" [(ngModel)]="formEyeProphylaxis" name="formEyeProphylaxis" />
                    Eye Prophylaxis (Erythromycin)
                  </label>
                  <label class="check-box-item">
                    <input type="checkbox" [(ngModel)]="formHepatitisB" name="formHepatitisB" />
                    Hepatitis B Birth Dose
                  </label>
                  <label class="check-box-item">
                    <input type="checkbox" [(ngModel)]="formBcg" name="formBcg" />
                    BCG Immunization
                  </label>
                </div>
              </div>

              <!-- Section 5: Staff & Delivery Notes -->
              <div class="form-section-title">5. Attending Team & Summary Notes</div>
              <div class="form-row-2">
                <div class="form-field">
                  <label>Attending Midwife <span class="req">*</span></label>
                  <input type="text" [(ngModel)]="formMidwife" name="formMidwife" required />
                </div>

                <div class="form-field">
                  <label>Assistant Midwife / Nurse</label>
                  <input type="text" [(ngModel)]="formAssistantMidwife" name="formAssistantMidwife" placeholder="Staff Midwife" />
                </div>
              </div>

              <div class="form-field">
                <label>Clinical Notes / Delivery Summary</label>
                <textarea [(ngModel)]="formNewbornNotes" name="formNewbornNotes" rows="2" placeholder="e.g. Delivered healthy baby girl via NSVD. Vigorous cry, good tone and color. Placenta expelled complete. Mother stable."></textarea>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-cancel" (click)="closeAddModal()">Cancel</button>
                <button type="submit" class="btn-submit" [disabled]="saving()">
                  {{ saving() ? 'Registering Delivery...' : 'Save Delivery Record' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ==================== VIEW DELIVERY SUMMARY MODAL ==================== -->
      @if (viewingRecord(); as r) {
        <div class="modal-backdrop" (click)="viewingRecord.set(null)">
          <div class="modal-dialog-card modal-view" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-row">
                <div class="modal-icon tone-purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                </div>
                <div>
                  <h2>Clinical Birth & Delivery Certificate Record</h2>
                  <p class="modal-subtitle">Mother: <strong>{{ r.patientName }}</strong> · Delivered on {{ r.deliveryDateTime | date: 'fullDate' }}</p>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="viewingRecord.set(null)">✕</button>
            </div>

            <div class="view-sheet-body">
              <div class="sheet-kpi-banner">
                <div class="sheet-kpi-item">
                  <span>Newborn Sex</span>
                  <strong style="color: #361759;">{{ r.babySex === 'Female' ? 'Baby Girl (Female)' : 'Baby Boy (Male)' }}</strong>
                  <small>{{ r.deliveryType }}</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>Birth Weight</span>
                  <strong>{{ r.birthWeightGrams }} grams</strong>
                  <small>Length: {{ r.birthLengthCm }} cm</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>APGAR Score</span>
                  <strong>1m: {{ r.apgar1Min }} · 5m: {{ r.apgar5Min }}</strong>
                  <small>{{ r.apgar5Min >= 8 ? 'Normal / Vigorous' : 'Monitored' }}</small>
                </div>
                <div class="sheet-kpi-item">
                  <span>Maternal Blood Loss</span>
                  <strong>{{ r.estimatedBloodLossMl }} mL</strong>
                  <small>Perineum: {{ r.perineumStatus }}</small>
                </div>
              </div>

              <div class="sheet-detail-grid">
                <div class="sheet-col">
                  <h4>Maternal & Labor Information</h4>
                  <ul class="detail-list">
                    <li><span>Gestational Age:</span> <strong>{{ r.gestationalAgeAtDelivery }}</strong></li>
                    <li><span>Gravida / Para:</span> <strong>{{ r.gravidaPara || 'G1P1' }}</strong></li>
                    <li><span>Membranes:</span> <strong>{{ r.ruptureOfMembranes }}</strong></li>
                    <li><span>Placenta:</span> <strong>{{ r.placentaStatus }}</strong></li>
                    <li><span>Complications:</span> <strong>{{ r.maternalComplications || 'None reported' }}</strong></li>
                  </ul>
                </div>

                <div class="sheet-col">
                  <h4>EINC & Prophylaxis Executed</h4>
                  <div class="supplements-tags">
                    @if (r.eincImmediateDrying) { <span class="supp-tag">✓ Immediate Drying (30s)</span> }
                    @if (r.eincSkinToSkin) { <span class="supp-tag">✓ Skin-to-skin Contact</span> }
                    @if (r.eincDelayedCordClamping) { <span class="supp-tag">✓ Delayed Cord Clamping</span> }
                    @if (r.eincEarlyBreastfeeding) { <span class="supp-tag">✓ Early Breastfeeding</span> }
                    @if (r.vitaminKGiven) { <span class="supp-tag">✓ Vitamin K Given</span> }
                    @if (r.eyeProphylaxisGiven) { <span class="supp-tag">✓ Eye Prophylaxis Administered</span> }
                    @if (r.hepatitisBGiven) { <span class="supp-tag">✓ Hepatitis B Birth Dose</span> }
                    @if (r.bcgGiven) { <span class="supp-tag">✓ BCG Immunization</span> }
                  </div>
                </div>
              </div>

              <div class="sheet-notes-box">
                <h4>Midwife Summary & Clinical Notes</h4>
                <p>{{ r.newbornNotes || 'Delivery completed smoothly. Mother and baby in stable, healthy condition.' }}</p>
                <div class="sheet-midwife-sign">
                  Attending Midwife: <strong>{{ r.attendingMidwife }}</strong>
                  @if (r.assistantMidwife) {
                    <span> · Assistant: {{ r.assistantMidwife }}</span>
                  }
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
    .kpi-icon-pill.tone-pink { background: #fce7f3; color: #be185d; }
    .kpi-icon-pill.tone-blue { background: #e0f2fe; color: #0369a1; }

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

    .delivery-type-pill {
      display: inline-block;
      padding: 3px 8px;
      background: #f3effa;
      color: #361759;
      font-size: 11.5px;
      font-weight: 700;
      border-radius: 6px;
    }

    .baby-info-cell {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .gender-tag {
      font-size: 11px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .gender-tag.is-female { background: #fce7f3; color: #be185d; }
    .gender-tag.is-male { background: #e0f2fe; color: #0369a1; }

    .apgar-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
    }

    .apgar-badge.is-good { background: #e6f7f3; color: #0d8a72; }
    .apgar-badge.is-warning { background: #fff4e5; color: #b76e00; }

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

    .modal-dialog-card.modal-lg { max-width: 840px; }

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
    .form-row-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }

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

    .checks-cluster {
      background: #fbf9fd;
      border: 1px solid #ece4f5;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .check-box-item {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12.5px;
      color: #271442;
      cursor: pointer;
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
    .sheet-kpi-item strong { font-size: 16px; color: #361759; font-weight: 800; }
    .sheet-kpi-item small { font-size: 11.5px; color: #0d8a72; font-weight: 600; }

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

    .supplements-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .supp-tag {
      background: #e6f7f3;
      color: #0b6b58;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

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
      .form-row-2, .form-row-3, .form-row-4, .sheet-detail-grid, .sheet-kpi-banner { grid-template-columns: 1fr; }
    }
  `],
})
export class DeliveryRecords implements OnInit {
  private readonly recordsSvc = inject(RecordsService);
  private readonly patientsSvc = inject(PatientsService);
  private readonly auth = inject(AuthService);

  readonly records = signal<DeliveryRecord[]>([]);
  readonly patients = signal<Patient[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly actionFeedback = signal('');

  // Filters
  readonly searchQuery = signal('');
  readonly filterType = signal('All');
  readonly filterSex = signal('All');

  // Modals
  readonly showAddModal = signal(false);
  readonly viewingRecord = signal<DeliveryRecord | null>(null);

  // Form Fields
  formPatientId = '';
  formDeliveryDateTime = new Date().toISOString().slice(0, 16);
  formAdmissionDateTime = new Date().toISOString().slice(0, 16);
  formDeliveryType: 'Normal Spontaneous Vaginal Delivery (NSVD)' | 'Assisted Vaginal Delivery' | 'Emergency Transfer' =
    'Normal Spontaneous Vaginal Delivery (NSVD)';
  formGaAtDelivery = '39 weeks';
  formGravidaPara = 'G1P1';
  formRuptureMembranes = 'Spontaneous - Clear amniotic fluid';
  formPerineumStatus: 'Intact' | '1st Degree Laceration' | '2nd Degree Laceration' | 'Episiotomy' | 'Repaired' = 'Intact';
  formBloodLossMl = 250;
  formPlacentaStatus: 'Complete & intact' | 'Manual extraction' | 'Incomplete' = 'Complete & intact';
  formMaternalComplications = 'None / Normal postpartum recovery';
  formBabySex: 'Female' | 'Male' = 'Female';
  formBirthWeightGrams = 3150;
  formBirthLengthCm = 49.5;
  formHeadCircumferenceCm = 34;
  formChestCircumferenceCm = 33;
  formApgar1Min = 9;
  formApgar5Min = 10;
  formEincDrying = true;
  formEincSkin = true;
  formEincClamping = true;
  formEincFeeding = true;
  formVitaminK = true;
  formEyeProphylaxis = true;
  formHepatitisB = true;
  formBcg = true;
  formMidwife = 'Midwife Maria Santos, RM';
  formAssistantMidwife = '';
  formNewbornNotes = '';

  readonly filteredRecords = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const type = this.filterType();
    const sex = this.filterSex();

    return this.records().filter((r) => {
      const matchQ =
        !q ||
        r.patientName.toLowerCase().includes(q) ||
        r.attendingMidwife.toLowerCase().includes(q) ||
        (r.newbornNotes || '').toLowerCase().includes(q);

      const matchType = type === 'All' || r.deliveryType === type;
      const matchSex = sex === 'All' || r.babySex === sex;

      return matchQ && matchType && matchSex;
    });
  });

  readonly countNsvd = computed(
    () => this.records().filter((r) => r.deliveryType === 'Normal Spontaneous Vaginal Delivery (NSVD)').length,
  );

  readonly countFemale = computed(() => this.records().filter((r) => r.babySex === 'Female').length);
  readonly countMale = computed(() => this.records().filter((r) => r.babySex === 'Male').length);

  async ngOnInit(): Promise<void> {
    const u = this.auth.user();
    if (u?.displayName) {
      this.formMidwife = `${u.displayName}, RM`;
    }
    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [recs, pts] = await Promise.all([this.recordsSvc.listDelivery(), this.patientsSvc.list()]);
      this.records.set(recs);
      this.patients.set(pts);
    } catch {
      // ignore
    } finally {
      this.loading.set(false);
    }
  }

  onPatientSelect(): void {
    const p = this.patients().find((x) => x.id === this.formPatientId);
    if (!p) return;
    if (p.gravidaPara) this.formGravidaPara = p.gravidaPara;
    if (p.gestationalAge) this.formGaAtDelivery = p.gestationalAge;
  }

  openAddModal(): void {
    this.formDeliveryDateTime = new Date().toISOString().slice(0, 16);
    this.formAdmissionDateTime = new Date().toISOString().slice(0, 16);
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  viewRecord(r: DeliveryRecord): void {
    this.viewingRecord.set(r);
  }

  async submitDeliveryRecord(): Promise<void> {
    if (!this.formPatientId) {
      alert('Please select a mother / patient.');
      return;
    }

    const patient = this.patients().find((p) => p.id === this.formPatientId);
    if (!patient) return;

    this.saving.set(true);
    try {
      await this.recordsSvc.addDelivery({
        patientId: patient.id,
        patientName: patient.fullName,
        deliveryDateTime: this.formDeliveryDateTime,
        admissionDateTime: this.formAdmissionDateTime,
        deliveryType: this.formDeliveryType,
        gestationalAgeAtDelivery: this.formGaAtDelivery,
        gravidaPara: this.formGravidaPara,
        ruptureOfMembranes: this.formRuptureMembranes,
        perineumStatus: this.formPerineumStatus,
        placentaStatus: this.formPlacentaStatus,
        estimatedBloodLossMl: Number(this.formBloodLossMl) || 250,
        maternalComplications: this.formMaternalComplications,
        babySex: this.formBabySex,
        birthWeightGrams: Number(this.formBirthWeightGrams) || 3000,
        birthLengthCm: Number(this.formBirthLengthCm) || 50,
        headCircumferenceCm: Number(this.formHeadCircumferenceCm) || 34,
        chestCircumferenceCm: Number(this.formChestCircumferenceCm) || 33,
        apgar1Min: Number(this.formApgar1Min) || 9,
        apgar5Min: Number(this.formApgar5Min) || 10,
        eincImmediateDrying: this.formEincDrying,
        eincSkinToSkin: this.formEincSkin,
        eincDelayedCordClamping: this.formEincClamping,
        eincEarlyBreastfeeding: this.formEincFeeding,
        vitaminKGiven: this.formVitaminK,
        eyeProphylaxisGiven: this.formEyeProphylaxis,
        hepatitisBGiven: this.formHepatitisB,
        bcgGiven: this.formBcg,
        attendingMidwife: this.formMidwife,
        assistantMidwife: this.formAssistantMidwife,
        newbornNotes: this.formNewbornNotes,
      });

      this.closeAddModal();
      this.triggerToast('Birth & delivery record logged successfully! Patient status updated to Postpartum.');
      await this.loadAll();
    } catch {
      alert('Failed to save delivery record. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteRecord(r: DeliveryRecord): Promise<void> {
    if (!r.id) return;
    if (!confirm(`Are you sure you want to delete delivery record for ${r.patientName}?`)) return;

    try {
      await this.recordsSvc.deleteDelivery(r.id);
      this.triggerToast('Delivery record deleted.');
      await this.loadAll();
    } catch {
      alert('Failed to delete delivery record.');
    }
  }

  private triggerToast(msg: string): void {
    this.actionFeedback.set(msg);
    setTimeout(() => this.actionFeedback.set(''), 3500);
  }
}
