import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { Patient, PatientsService } from '../core/patients.service';
import {
  Appointment,
  AppointmentsService,
  formatTime,
  isPast,
  slotsFor,
  todayIso,
} from '../core/appointments.service';
import { DeliveryRecord, PostpartumRecord, RecordsService } from '../core/records.service';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../core/firebase';

export interface PrenatalVisitLog {
  id: string;
  date: string;
  gestationalAge: string;
  bp: string;
  weightKg: number;
  fundalHeightCm: number;
  fetalHeartRateBpm: number;
  midwifeName: string;
  notes: string;
}

@Component({
  selector: 'app-patient-portal',
  imports: [DatePipe, NgClass, FormsModule],
  templateUrl: './patient-portal.html',
  styleUrl: './patient-portal.css',
})
export class PatientPortal implements OnInit {
  auth = inject(AuthService);
  private patients = inject(PatientsService);
  private appointments = inject(AppointmentsService);
  private recordsSvc = inject(RecordsService);

  readonly todayIso = todayIso();
  readonly activeTab = signal<'overview' | 'appointments' | 'records' | 'guide' | 'profile'>('overview');

  // Patient profile state
  readonly profile = signal<Patient | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  // Appointments state
  readonly allAppts = signal<Appointment[]>([]);

  // Clinical records / visits
  readonly visitsList = signal<PrenatalVisitLog[]>([]);
  readonly deliveryRecords = signal<DeliveryRecord[]>([]);
  readonly postpartumRecords = signal<PostpartumRecord[]>([]);

  // Booking Modal State
  readonly showBookingModal = signal(false);
  bookingType = 'Prenatal Checkup';
  bookingDate = todayIso();
  bookingTime = '09:00';
  bookingNotes = '';
  readonly availableSlots = signal<string[]>([]);
  readonly submittingBooking = signal(false);
  readonly bookingError = signal('');
  readonly bookingSuccess = signal(false);
  readonly scheduledDate = signal('');
  readonly scheduledTime = signal('');

  // Profile Edit Modal State
  readonly showProfileModal = signal(false);
  editPhone = '';
  editAddress = '';
  editEmgName = '';
  editEmgPhone = '';
  readonly savingProfile = signal(false);
  readonly profileMsg = signal('');
  readonly profileOk = signal(true);

  // Computed patient display name
  readonly patientName = computed(() => {
    const p = this.profile();
    if (p?.fullName) return p.fullName;
    const u = this.auth.user();
    if (u?.displayName) return u.displayName;
    if (u?.email) {
      const prefix = u.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return 'Patient';
  });

  // User initials for avatar
  readonly userInitials = computed(() => {
    const name = this.patientName();
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  // Gestational Age in weeks (computed from LMP or EDD)
  readonly gestationalWeek = computed(() => {
    const p = this.profile();
    if (p?.lmp) {
      const diffMs = Date.now() - new Date(p.lmp).getTime();
      const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      if (weeks >= 1 && weeks <= 42) return weeks;
    }
    if (p?.edd) {
      const eddMs = new Date(p.edd).getTime();
      const remainingMs = eddMs - Date.now();
      const remainingWeeks = Math.floor(remainingMs / (7 * 24 * 60 * 60 * 1000));
      const currentWeek = 40 - remainingWeeks;
      if (currentWeek >= 1 && currentWeek <= 42) return currentWeek;
    }
    return 0; // Not calculated yet
  });

  // Trimester Name
  readonly trimesterName = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) return 'LMP not set';
    if (w <= 13) return '1st Trimester';
    if (w <= 27) return '2nd Trimester';
    return '3rd Trimester';
  });

  // Pregnancy Progress percentage (out of 40 weeks)
  readonly progressPercent = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) return 0;
    return Math.min(100, Math.max(5, Math.round((w / 40) * 100)));
  });

  // Baby fruit size metaphor
  readonly babyFruitSize = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) return 'Pending LMP';
    if (w <= 8) return 'Raspberry';
    if (w <= 12) return 'Plum';
    if (w <= 16) return 'Avocado';
    if (w <= 20) return 'Banana';
    if (w <= 24) return 'Ear of Corn';
    if (w <= 28) return 'Eggplant';
    if (w <= 32) return 'Butternut Squash';
    if (w <= 36) return 'Honeydew Melon';
    return 'Watermelon';
  });

  readonly babyLengthWeight = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) return 'Update your LMP in Profile';
    if (w <= 12) return 'Approx. 5.4 cm · 14g';
    if (w <= 20) return 'Approx. 25.6 cm · 300g';
    if (w <= 28) return 'Approx. 37.6 cm · 1,000g';
    if (w <= 36) return 'Approx. 47.4 cm · 2,600g';
    return 'Approx. 51.2 cm · 3,400g';
  });

  // Days remaining until EDD
  readonly daysRemaining = computed(() => {
    const p = this.profile();
    if (!p?.edd) return 0;
    const eddDate = new Date(p.edd);
    const diff = Math.ceil((eddDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return diff > 0 ? diff : 0;
  });

  readonly eddDisplay = computed(() => {
    const p = this.profile();
    if (p?.edd) {
      return new Date(p.edd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return 'Not set';
  });

  // Appointments categorization
  readonly upcomingAppts = computed(() =>
    this.allAppts()
      .filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && !isPast(a.date, a.time))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
  );

  readonly pastAppts = computed(() =>
    this.allAppts()
      .filter((a) => a.status === 'completed' || a.status === 'cancelled' || isPast(a.date, a.time))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
  );

  readonly nextAppt = computed(() => this.upcomingAppts()[0] || null);

  // Latest vitals computed from clinical records
  readonly latestVitals = computed(() => {
    const list = this.visitsList();
    if (list.length > 0) {
      const v = list[0];
      return {
        hasData: true,
        bp: v.bp || '—',
        weight: `${v.weightKg} kg`,
        fundalHeight: `${v.fundalHeightCm} cm`,
        fhr: `${v.fetalHeartRateBpm} bpm`,
      };
    }
    return {
      hasData: false,
      bp: '—',
      weight: '—',
      fundalHeight: '—',
      fhr: '—',
    };
  });

  // Weekly developmental note
  readonly weeklyDevelopmentNote = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) {
      return 'Please update your Last Menstrual Period (LMP) or Expected Due Date (EDD) in your profile to view weekly developmental insights.';
    }
    if (w <= 13) {
      return 'Baby is forming major organs, tiny facial features, and little fingers and toes. Your placenta is actively nourishing your little one.';
    }
    if (w <= 27) {
      return 'Baby can now hear your voice and heartbeat! Facial muscles are practicing smiling and frowning, and taste buds are developing rapidly.';
    }
    return 'Baby is gaining weight steadily, building healthy fat layers for temperature regulation after birth, and practicing breathing movements.';
  });

  async ngOnInit(): Promise<void> {
    await this.loadAllPatientData();
  }

  async loadAllPatientData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const uid = this.auth.user()?.uid;
      if (!uid) {
        this.error.set('No active session. Please log in.');
        return;
      }

      // 1. Fetch Profile
      const prof = await this.patients.get(uid);
      if (prof) {
        this.profile.set(prof);
      } else {
        // Fallback profile from auth user without any dummy data
        const u = this.auth.user();
        const initialProfile: Patient = {
          id: uid,
          fullName: u?.displayName || (u?.email ? u.email.split('@')[0] : 'Patient'),
          email: u?.email || '',
          birthDate: '',
          contactNumber: '',
          address: '',
          emergencyContactName: '',
          emergencyContactNumber: '',
          bloodType: '—',
          lmp: '',
          edd: '',
          status: 'Active',
          riskLevel: 'Low risk',
          gravidaPara: '',
          gestationalAge: '',
        };
        this.profile.set(initialProfile);

        // Persist minimal profile to Firestore
        try {
          await setDoc(doc(db, 'patients', uid), {
            ...initialProfile,
            createdAt: serverTimestamp(),
          });
        } catch {
          // ignore
        }
      }

      // 2. Fetch Appointments
      const appts = await this.appointments.listForPatient(uid);
      this.allAppts.set(appts);

      // 3. Fetch Clinical Visits
      await this.loadClinicalVisits(uid);

      // 4. Fetch Delivery & Postpartum Records
      try {
        const [deliv, postp] = await Promise.all([
          this.recordsSvc.listDeliveryForPatient(uid),
          this.recordsSvc.listPostpartumForPatient(uid),
        ]);
        this.deliveryRecords.set(deliv);
        this.postpartumRecords.set(postp);
      } catch {
        // ignore
      }
    } catch (e) {
      this.error.set(this.patients.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async loadClinicalVisits(uid: string): Promise<void> {
    try {
      const snap = await getDocs(query(collection(db, 'visits'), where('patientId', '==', uid)));
      if (!snap.empty) {
        const list: PrenatalVisitLog[] = [];
        snap.forEach((d) => {
          const v = d.data();
          list.push({
            id: d.id,
            date: v['date'] || todayIso(),
            gestationalAge: v['gestationalAge'] || '—',
            bp: v['bp'] || '—',
            weightKg: Number(v['weightKg']) || 0,
            fundalHeightCm: Number(v['fundalHeightCm']) || 0,
            fetalHeartRateBpm: Number(v['fetalHeartRateBpm']) || 0,
            midwifeName: v['midwifeName'] || 'Midwife',
            notes: v['notes'] || '',
          });
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        this.visitsList.set(list);
      } else {
        this.visitsList.set([]);
      }
    } catch {
      this.visitsList.set([]);
    }
  }

  formatSlotTime(t: string): string {
    return formatTime(t);
  }

  // ============ APPOINTMENT BOOKING MODAL ============
  openBookingModal(): void {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const tmrwIso = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
    this.bookingDate = tmrwIso;
    this.bookingType = 'Prenatal Checkup';
    this.bookingNotes = '';
    this.bookingError.set('');
    this.bookingSuccess.set(false);
    this.computeAvailableSlots(this.bookingDate);
    this.showBookingModal.set(true);
  }

  closeBookingModal(): void {
    this.showBookingModal.set(false);
  }

  onBookingDateChange(): void {
    this.computeAvailableSlots(this.bookingDate);
  }

  computeAvailableSlots(date: string): void {
    const clinicSlots = slotsFor(date);
    if (!clinicSlots.length) {
      this.availableSlots.set(['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']);
      this.bookingTime = '09:00';
      return;
    }

    // Exclude times already booked
    const bookedTimes = new Set(
      this.allAppts()
        .filter((a) => a.date === date && a.status !== 'cancelled')
        .map((a) => a.time),
    );

    const available = clinicSlots.filter((s) => !bookedTimes.has(s));
    this.availableSlots.set(available.length ? available : clinicSlots);
    this.bookingTime = this.availableSlots()[0] || '09:00';
  }

  async submitBooking(): Promise<void> {
    if (!this.bookingDate || !this.bookingTime) {
      this.bookingError.set('Please select both a date and time slot.');
      return;
    }

    this.submittingBooking.set(true);
    this.bookingError.set('');

    try {
      const uid = this.auth.user()?.uid;
      if (!uid) throw new Error('Not logged in');

      await this.appointments.book({
        patientId: uid,
        patientName: this.patientName(),
        date: this.bookingDate,
        time: this.bookingTime,
        type: this.bookingType,
        notes: this.bookingNotes.trim(),
        status: 'scheduled',
      });

      this.scheduledDate.set(this.bookingDate);
      this.scheduledTime.set(this.bookingTime);
      this.bookingSuccess.set(true);

      // Refresh appointments list so it immediately shows under Upcoming
      const updated = await this.appointments.listForPatient(uid);
      this.allAppts.set(updated);
    } catch (e: any) {
      if (e?.message === 'slot-taken') {
        this.bookingError.set('That time slot was just booked by someone else. Please choose another slot.');
      } else {
        this.bookingError.set(e?.message || 'Unable to schedule appointment. Please try again.');
      }
    } finally {
      this.submittingBooking.set(false);
    }
  }

  async cancelAppointment(a: Appointment): Promise<void> {
    if (!confirm(`Are you sure you want to cancel your ${a.type} appointment on ${a.date}?`)) {
      return;
    }

    try {
      await this.appointments.setStatus(a.id, 'cancelled');
      this.allAppts.update((list) =>
        list.map((item) => (item.id === a.id ? { ...item, status: 'cancelled' } : item)),
      );
    } catch {
      alert('Could not cancel appointment. Please contact the clinic.');
    }
  }

  // ============ PROFILE EDIT MODAL ============
  openProfileModal(): void {
    const p = this.profile();
    this.editPhone = p?.contactNumber || '';
    this.editAddress = p?.address || '';
    this.editEmgName = p?.emergencyContactName || '';
    this.editEmgPhone = p?.emergencyContactNumber || '';
    this.profileMsg.set('');
    this.showProfileModal.set(true);
  }

  closeProfileModal(): void {
    this.showProfileModal.set(false);
  }

  async saveProfileChanges(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;

    this.savingProfile.set(true);
    this.profileMsg.set('');

    try {
      const current = this.profile();
      const updated: any = {
        ...current,
        contactNumber: this.editPhone.trim(),
        address: this.editAddress.trim(),
        emergencyContactName: this.editEmgName.trim(),
        emergencyContactNumber: this.editEmgPhone.trim(),
      };

      await this.patients.update(uid, updated);
      this.profile.set(updated);
      this.profileOk.set(true);
      this.profileMsg.set('Profile successfully updated and synced with your midwife!');
      setTimeout(() => this.closeProfileModal(), 1200);
    } catch {
      this.profileOk.set(false);
      this.profileMsg.set('Failed to update details. Please try again.');
    } finally {
      this.savingProfile.set(false);
    }
  }
}
