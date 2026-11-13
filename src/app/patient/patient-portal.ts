import { DatePipe, NgClass } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
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
import { ClinicNotification, NotificationsService } from '../core/notifications.service';
import { ActivityLogService } from '../core/activity-log.service';
import { HealthArticle, HEALTH_ARTICLES, HEALTH_CATEGORIES } from '../core/health-library.data';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../core/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export type PatientTab =
  | 'dashboard'
  | 'profile'
  | 'appointments'
  | 'tracker'
  | 'records'
  | 'guide'
  | 'notifications'
  | 'followups'
  | 'contact'
  | 'settings';

export function getTrimesterByAge(ga?: string): string {
  if (!ga) return '1st Trimester';
  const match = ga.match(/\d+/);
  const weeks = match ? Number(match[0]) : 4;
  if (weeks <= 13) return '1st Trimester';
  if (weeks <= 27) return '2nd Trimester';
  return '3rd Trimester';
}

export function calculateNextFollowUp(dateIso?: string): string {
  if (!dateIso) return '2026-12-11';
  try {
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return '2026-12-11';
    d.setDate(d.getDate() + 28);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return '2026-12-11';
  }
}

export interface PrenatalVisitLog {
  id: string;
  date: string;
  gestationalAge: string;
  trimester?: string;
  bp: string;
  weightKg: number;
  fundalHeightCm: number;
  fetalPresentation?: string;
  fetalHeartRateBpm: number;
  fetalMovement?: string;
  riskLevel?: string;
  urinalysisProtein?: string;
  urinalysisGlucose?: string;
  hemoglobin?: string;
  edema?: string;
  supplementsGiven?: string[];
  nextFollowUpDate?: string;
  midwifeName: string;
  notes: string;
  complaintsRiskNotes?: string;
  attendingMidwife?: string;
  raw?: any;
}

export interface PrenatalModalRecord {
  patientName: string;
  date: string;
  gestationalAge: string;
  trimester: string;
  bp: string;
  weightKg: number | string;
  fundalHeightCm: number | string;
  fetalPresentation: string;
  fetalHeartRateBpm: number | string;
  fetalMovement: string;
  riskLevel: string;
  urinalysisProtein: string;
  urinalysisGlucose: string;
  hemoglobin: string;
  edema: string;
  supplementsGiven: string[];
  nextFollowUpDate?: string;
  complaintsRiskNotes: string;
  attendingMidwife: string;
}

export interface DeliveryModalRecord {
  patientName: string;
  deliveryDate: string;
  deliveryTime?: string;
  deliveryType: string;
  gestationalAge: string;
  babySex: string;
  birthWeight: string | number;
  birthLength?: string | number;
  apgarScore: string;
  attendingMidwife: string;
  assistantMidwife?: string;
  perineumStatus: string;
  bloodLoss: string | number;
  eincImmediateDrying: boolean;
  eincSkinToSkin: boolean;
  eincDelayedCordClamping: boolean;
  eincEarlyBreastfeeding: boolean;
  vitaminKGiven: boolean;
  eyeProphylaxisGiven: boolean;
  hepatitisBGiven: boolean;
  bcgGiven: boolean;
  notes?: string;
}

export interface PostpartumModalRecord {
  patientName: string;
  visitDate: string;
  visitStage: string;
  maternalBp: string;
  maternalTemp: string;
  maternalPulse: string;
  fundalFirmness: string;
  lochiaType: string;
  lochiaAmount: string;
  perineumHealing: string;
  breastCondition: string;
  feedingMethod: string;
  maternalMentalState: string;
  babyWeightKg: number | string;
  cordStumpStatus: string;
  jaundiceStatus: string;
  familyPlanning: string;
  attendingMidwife: string;
  clinicalNotes?: string;
  nextFollowUpDate?: string;
}

export interface CareRecordItem {
  id: string;
  type: 'prenatal' | 'delivery' | 'postpartum';
  typeLabel: string;
  date: string;
  summary: string;
  midwife: string;
  raw: any;
}

export interface FollowUpItem {
  id: string;
  patientName: string;
  task: string;
  dueLabel: string;
  dueDate?: string;
  status: 'upcoming' | 'completed' | 'overdue';
  category: 'appointment' | 'prenatal' | 'postpartum' | 'screening';
  midwife?: string;
  canBook?: boolean;
}

export interface PatientInquiry {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  midwifeId?: string | null;
  midwifeName?: string | null;
  category: string;
  subject: string;
  message: string;
  status: 'Sent' | 'Read' | 'Replied';
  reply?: string;
  createdAt?: any;
  dateFormatted?: string;
}

@Component({
  selector: 'app-patient-portal',
  imports: [DatePipe, NgClass, FormsModule],
  templateUrl: './patient-portal.html',
  styleUrl: './patient-portal.css',
})
export class PatientPortal implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private patients = inject(PatientsService);
  private appointments = inject(AppointmentsService);
  private recordsSvc = inject(RecordsService);
  private notifSvc = inject(NotificationsService);
  private activityLog = inject(ActivityLogService);

  readonly todayIso = todayIso();
  readonly activeTab = signal<PatientTab>('dashboard');

  // Mobile sidebar drawer state
  readonly mobileSidebarOpen = signal(false);

  // Search query in top bar
  readonly searchQuery = signal('');

  // Notifications State
  readonly notificationsOpen = signal(false);
  readonly notifications = this.notifSvc.patientNotifications;
  readonly unreadCount = this.notifSvc.patientUnreadCount;
  readonly notificationFilter = signal<'all' | 'unread' | 'read'>('all');
  readonly viewingNotification = signal<ClinicNotification | null>(null);

  // User menu dropdown state in top bar
  readonly userMenuOpen = signal(false);
  readonly isDarkMode = signal(false);

  // Patient profile state
  readonly profile = signal<Patient | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  // Assigned Midwife State
  readonly assignedMidwife = signal<{
    name: string;
    email: string;
    phone: string;
    license: string;
    clinicHours: string;
    clinicAddress: string;
  }>({
    name: 'Primary Clinic Midwife',
    email: 'midwife@lyingincare.ph',
    phone: '(02) 8123-4567',
    license: 'Registered Midwife (RM)',
    clinicHours: 'Monday – Saturday: 8:00 AM – 5:00 PM',
    clinicAddress: 'LCMS Maternal Clinic, Main Wing',
  });

  // Appointments state
  readonly allAppts = signal<Appointment[]>([]);
  readonly appointmentFilter = signal<'all' | 'upcoming' | 'pending' | 'completed' | 'cancelled'>('all');
  readonly viewingApptDetails = signal<Appointment | null>(null);

  // Appointment Rescheduling State
  readonly showRescheduleModal = signal(false);
  readonly reschedulingAppt = signal<Appointment | null>(null);
  readonly rescheduleDate = signal('');
  readonly rescheduleTime = signal('');
  readonly rescheduleReason = signal('');
  readonly rescheduleSlots = signal<string[]>([]);
  readonly submittingReschedule = signal(false);
  readonly rescheduleError = signal('');
  readonly rescheduleSuccess = signal(false);

  // Appointment Cancellation State
  readonly showCancelModal = signal(false);
  readonly cancellingAppt = signal<Appointment | null>(null);
  readonly cancelReason = signal('Personal / Schedule Conflict');
  readonly cancelNotes = signal('');
  readonly submittingCancel = signal(false);
  readonly cancelError = signal('');

  // Clinical records / visits
  readonly visitsList = signal<PrenatalVisitLog[]>([]);
  readonly deliveryRecords = signal<DeliveryRecord[]>([]);
  readonly postpartumRecords = signal<PostpartumRecord[]>([]);
  readonly recordCategoryFilter = signal<'all' | 'prenatal' | 'delivery' | 'postpartum'>('all');

  // Dedicated Clinical View Modals
  readonly viewingPrenatalRecord = signal<PrenatalModalRecord | null>(null);
  readonly viewingDeliveryRecord = signal<DeliveryModalRecord | null>(null);
  readonly viewingPostpartumRecord = signal<PostpartumModalRecord | null>(null);

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

  // Profile Edit Modal State (Editable Info)
  readonly showProfileModal = signal(false);
  editFullName = '';
  editPhone = '';
  editAddress = '';
  editBirthDate = '';
  editEmgName = '';
  editEmgPhone = '';
  editEmgRelationship = '';
  editLmp = '';
  editEdd = '';
  readonly savingProfile = signal(false);
  readonly profileMsg = signal('');
  readonly profileOk = signal(true);

  // Profile Clinical Correction Request Modal (Non-editable official data)
  readonly showCorrectionModal = signal(false);
  readonly correctionField = signal('Blood Type');
  readonly correctionRequestedValue = signal('');
  readonly correctionReason = signal('');
  readonly submittingCorrection = signal(false);
  readonly correctionSuccess = signal(false);
  readonly correctionError = signal('');

  // Sign out confirmation modal
  readonly showSignOutModal = signal(false);

  // Contact Midwife Inquiry Form & Inquiries State
  inquiryCategory = 'Prenatal Guidance';
  inquirySubject = '';
  inquiryMessage = '';
  readonly inquirySending = signal(false);
  readonly inquirySuccess = signal(false);
  readonly inquiryError = signal('');
  readonly inquiriesList = signal<PatientInquiry[]>([]);
  readonly loadingInquiries = signal(false);

  // Follow-ups Filter State
  readonly followUpFilter = signal<'all' | 'upcoming' | 'completed'>('upcoming');

  // Settings State & Preferences
  readonly notifPrefEmail = signal(true);
  readonly notifPrefSms = signal(true);
  readonly notifPrefAppointments = signal(true);
  readonly notifPrefRecords = signal(true);
  readonly notifPrefTips = signal(true);
  readonly savingSettings = signal(false);
  readonly settingsMsg = signal('');
  readonly passwordResetLoading = signal(false);
  readonly passwordResetSuccess = signal(false);
  readonly passwordResetError = signal('');

  // Tab Titles map
  private readonly tabTitles: Record<PatientTab, string> = {
    dashboard: 'Dashboard',
    profile: 'My Profile',
    appointments: 'My Appointments',
    tracker: 'Pregnancy Tracker',
    records: 'My Care Records',
    guide: 'Health Library',
    notifications: 'Notifications',
    followups: 'Follow-ups',
    contact: 'Contact My Midwife',
    settings: 'Settings',
  };

  // Health Information & Library State
  readonly librarySearchQuery = signal('');
  readonly librarySelectedCategory = signal('All Topics');
  readonly librarySelectedArticle = signal<HealthArticle | null>(null);
  readonly libraryCategories = HEALTH_CATEGORIES;
  readonly libraryArticles = HEALTH_ARTICLES;

  readonly filteredLibraryArticles = computed(() => {
    const q = this.librarySearchQuery().trim().toLowerCase();
    const cat = this.librarySelectedCategory();

    return this.libraryArticles.filter((art) => {
      const matchCat = cat === 'All Topics' || art.category === cat;
      const matchQ =
        !q ||
        art.title.toLowerCase().includes(q) ||
        art.summary.toLowerCase().includes(q) ||
        art.keyPoints.some((k) => k.toLowerCase().includes(q)) ||
        art.category.toLowerCase().includes(q);

      return matchCat && matchQ;
    });
  });

  viewLibraryArticle(art: HealthArticle): void {
    this.librarySelectedArticle.set(art);
  }

  closeLibraryArticleModal(): void {
    this.librarySelectedArticle.set(null);
  }

  resetLibraryFilters(): void {
    this.librarySearchQuery.set('');
    this.librarySelectedCategory.set('All Topics');
  }

  openQuickLibraryProto(type: 'einc' | 'pph' | 'danger'): void {
    if (type === 'einc') {
      const art = this.libraryArticles.find((a) => a.id === 'einc-protocol');
      if (art) this.viewLibraryArticle(art);
    } else if (type === 'pph') {
      const art = this.libraryArticles.find((a) => a.id === 'pph-management');
      if (art) this.viewLibraryArticle(art);
    } else if (type === 'danger') {
      const art = this.libraryArticles.find((a) => a.id === 'preeclampsia-screening');
      if (art) this.viewLibraryArticle(art);
    }
  }

  printLibraryArticle(): void {
    window.print();
  }

  readonly pageTitle = computed(() => this.tabTitles[this.activeTab()] || 'Dashboard');

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly todayFormatted = computed(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  });

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

  readonly userInitials = computed(() => {
    const name = this.patientName();
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'PT';
  });

  readonly patientEmail = computed(() => this.auth.user()?.email || this.profile()?.email || '');

  // Gestational Age in weeks
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
    return 0;
  });

  readonly trimesterName = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) return 'LMP not set';
    if (w <= 13) return '1st Trimester';
    if (w <= 27) return '2nd Trimester';
    return '3rd Trimester';
  });

  readonly progressPercent = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) return 0;
    return Math.min(100, Math.max(5, Math.round((w / 40) * 100)));
  });

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

  readonly latestBp = computed(() => {
    const list = this.visitsList();
    if (!list || list.length === 0) return null;
    const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0]?.bp || null;
  });

  readonly babySize = computed(() => {
    const w = this.gestationalWeek();
    if (w <= 0) {
      return {
        name: 'Awaiting Assessment',
        icon: '🌱',
        desc: 'Gestational age and fetal growth milestones will display after logging your LMP or first prenatal checkup.',
        sizeCm: '—',
        weightG: '—',
      };
    }
    if (w <= 8) {
      return {
        name: 'Raspberry',
        icon: '🫐',
        desc: 'Heart is beating at 150-160 bpm. Tiny webbed fingers, eyelids, and limb buds are forming.',
        sizeCm: '1.6 cm',
        weightG: '1 g',
      };
    }
    if (w <= 12) {
      return {
        name: 'Lime',
        icon: '🍋',
        desc: 'All vital organs are structurally formed; baby begins reflexive swallowing and thumb sucking.',
        sizeCm: '5.4 cm',
        weightG: '14 g',
      };
    }
    if (w <= 16) {
      return {
        name: 'Avocado',
        icon: '🥑',
        desc: 'Facial muscles practice moving, eyes react to gentle light, and tiny fingernails form.',
        sizeCm: '11.6 cm',
        weightG: '100 g',
      };
    }
    if (w <= 20) {
      return {
        name: 'Banana',
        icon: '🍌',
        desc: 'Halfway mark! Protective vernix caseosa coats delicate baby skin; active flutters/kicks felt by mom.',
        sizeCm: '25.6 cm',
        weightG: '300 g',
      };
    }
    if (w <= 24) {
      return {
        name: 'Ear of Corn',
        icon: '🌽',
        desc: 'Inner ear structures are complete; baby hears mom’s voice and familiar sounds clearly.',
        sizeCm: '30.0 cm',
        weightG: '600 g',
      };
    }
    if (w <= 28) {
      return {
        name: 'Eggplant',
        icon: '🍆',
        desc: 'Third trimester begins! Eyelids open; brain develops rhythmic sleep cycles and REM periods.',
        sizeCm: '37.6 cm',
        weightG: '1,000 g',
      };
    }
    if (w <= 32) {
      return {
        name: 'Butternut Squash',
        icon: '🎃',
        desc: 'Fat layers form under the skin for temperature regulation; practicing rhythmic breathing motions.',
        sizeCm: '42.4 cm',
        weightG: '1,700 g',
      };
    }
    if (w <= 36) {
      return {
        name: 'Papaya',
        icon: '🍈',
        desc: 'Lungs near full maturation; baby begins descending into the pelvic inlet (lightening).',
        sizeCm: '47.4 cm',
        weightG: '2,600 g',
      };
    }
    return {
      name: 'Watermelon',
      icon: '🍉',
      desc: 'Full term gestation! Baby is prepared for spontaneous delivery and immediate skin-to-skin transition.',
      sizeCm: '51.2 cm',
      weightG: '3,300 g',
    };
  });

  readonly babyLengthWeight = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) return 'Update your LMP in Profile';
    if (w <= 8) return 'Approx. 1.6 cm · 1g';
    if (w <= 12) return 'Approx. 5.4 cm · 14g';
    if (w <= 16) return 'Approx. 11.6 cm · 100g';
    if (w <= 20) return 'Approx. 25.6 cm · 300g';
    if (w <= 24) return 'Approx. 30.0 cm · 600g';
    if (w <= 28) return 'Approx. 37.6 cm · 1,000g';
    if (w <= 32) return 'Approx. 42.4 cm · 1,700g';
    if (w <= 36) return 'Approx. 47.4 cm · 2,600g';
    return 'Approx. 51.2 cm · 3,400g';
  });

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

  readonly weeklyDevelopmentNote = computed(() => {
    const w = this.gestationalWeek();
    if (w === 0) {
      return 'Please update your Last Menstrual Period (LMP) or Expected Due Date (EDD) to calculate developmental milestones.';
    }
    if (w <= 13) {
      return 'Baby is forming major organs, tiny facial features, and little fingers. Your placenta is actively nourishing your little one.';
    }
    if (w <= 27) {
      return 'Baby can hear your voice and heartbeat! Facial muscles are practicing smiling, and taste buds are developing rapidly.';
    }
    return 'Baby is gaining weight steadily, building healthy fat layers for temperature regulation after birth, and practicing breathing movements.';
  });

  readonly selectedMilestoneTab = signal<'1st' | '2nd' | '3rd' | 'postpartum'>('1st');

  readonly activeMilestones = computed(() => {
    const tab = this.selectedMilestoneTab();
    const weeks = this.gestationalWeek();
    const hasPrenatal = this.visitsList().length > 0;
    const hasDelivery = this.deliveryRecords().length > 0;
    const hasPostpartum = this.postpartumRecords().length > 0;

    if (tab === '1st') {
      return [
        {
          title: 'Initial Dating Ultrasound Scan',
          category: 'Ultrasound',
          description: 'Establish accurate gestational age, confirm heartbeat, and verify intrauterine sac.',
          timing: 'Weeks 6 – 10',
          completed: weeks > 10,
          required: true,
        },
        {
          title: 'Baseline Blood Typing & Rh Factor',
          category: 'Laboratory',
          description: 'Determine maternal blood group and screen for Rh isoimmunization risks.',
          timing: 'Weeks 8 – 12',
          completed: !!this.profile()?.bloodType || hasPrenatal,
          required: true,
        },
        {
          title: 'Complete Blood Count (CBC) & Urinalysis',
          category: 'Laboratory',
          description: 'Screen for maternal iron deficiency anemia and asymptomatic urinary tract infection.',
          timing: 'First Prenatal Visit',
          completed: hasPrenatal,
          required: true,
        },
        {
          title: 'Folic Acid + Iron Prophylaxis Initiation',
          category: 'Supplements',
          description: 'Daily micronutrients to prevent neural tube defects and build maternal blood volume.',
          timing: 'From Week 4 onward',
          completed: weeks >= 4,
          required: true,
        },
      ];
    }

    if (tab === '2nd') {
      return [
        {
          title: 'Congenital Anomaly Scan (CAS)',
          category: 'Ultrasound',
          description: 'Comprehensive anatomical survey checking brain, heart, spine, kidneys, and placenta.',
          timing: 'Weeks 18 – 22',
          completed: weeks >= 22,
          required: true,
        },
        {
          title: 'Tetanus Toxoid (TT / Td) Immunization',
          category: 'Vaccination',
          description: 'Maternal tetanus vaccine series to protect newborn against neonatal tetanus.',
          timing: 'Weeks 16 – 24',
          completed: hasPrenatal && weeks >= 20,
          required: true,
        },
        {
          title: 'Oral Glucose Tolerance Test (OGTT)',
          category: 'Laboratory',
          description: '75g 2-hour fasting blood glucose screening for Gestational Diabetes Mellitus (GDM).',
          timing: 'Weeks 24 – 28',
          completed: weeks >= 26,
          required: true,
        },
        {
          title: 'Quickening Tracking & Fundal Height',
          category: 'Obstetric Assessment',
          description: 'Log maternal perception of fetal movement and correlate abdominal fundal measurement.',
          timing: 'Weeks 20 – 24',
          completed: weeks >= 20,
          required: true,
        },
      ];
    }

    if (tab === '3rd') {
      return [
        {
          title: 'Fetal Presentation & Lie Evaluation',
          category: 'Obstetric Assessment',
          description: 'Midwife palpation (Leopold maneuvers) confirming baby is in cephalic (head-down) position.',
          timing: 'Weeks 32 – 36',
          completed: weeks >= 34,
          required: true,
        },
        {
          title: 'Birthing Kit & PhilHealth Preparation',
          category: 'Delivery Prep',
          description: 'Assemble newborn clothing, receiving blankets, maternity pads, and PhilHealth documents.',
          timing: 'Weeks 32 – 34',
          completed: weeks >= 32,
          required: true,
        },
        {
          title: 'Weekly Maternal Blood Pressure & Fetal Monitoring',
          category: 'Prenatal Care',
          description: 'Weekly clinical checkups to evaluate blood pressure, fetal heart tones, and cervical changes.',
          timing: 'Weeks 36 – 40',
          completed: weeks >= 38,
          required: true,
        },
        {
          title: 'Emergency Delivery Plan & Transport Briefing',
          category: 'Emergency Prep',
          description: 'Confirm emergency companion, lying-in 24/7 hotline, and backup hospital referral route.',
          timing: 'Weeks 34 – 38',
          completed: weeks >= 36,
          required: true,
        },
      ];
    }

    return [
      {
        title: 'Essential Intrapartum and Newborn Care (EINC)',
        category: 'Labor & Delivery',
        description: 'Immediate drying, uninterrupted skin-to-skin contact, delayed cord clamping, and early latching.',
        timing: 'During Delivery',
        completed: hasDelivery,
        required: true,
      },
      {
        title: 'Newborn Screening (NBS) & Hearing Test',
        category: 'Newborn Care',
        description: 'Heel-prick dried blood spot test screening for congenital metabolic disorders within 48–72 hours.',
        timing: '24–72 Hours Post-birth',
        completed: hasDelivery,
        required: true,
      },
      {
        title: 'Postpartum Maternal Recovery & Lochia Check',
        category: 'Postpartum Care',
        description: 'Vitals check, uterine involution massage, bleeding evaluation, and perineal healing review.',
        timing: 'Days 3 – 7',
        completed: hasPostpartum,
        required: true,
      },
      {
        title: 'Postpartum Family Planning (PPFP) Consultation',
        category: 'Family Planning',
        description: 'LAM counseling, progestin-only pills, Depo injections, or subdermal implant guidance.',
        timing: 'Week 6 Checkup',
        completed: hasPostpartum,
        required: true,
      },
    ];
  });

  // Real Appointments categorization for the logged-in patient
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

  readonly pendingApptsCount = computed(() => {
    return this.upcomingAppts().filter((a) => (a.status as string) === 'pending' || a.status === 'requested').length;
  });

  readonly completedApptsCount = computed(() => {
    return this.allAppts().filter((a) => a.status === 'completed').length;
  });

  readonly cancelledApptsCount = computed(() => {
    return this.allAppts().filter((a) => a.status === 'cancelled').length;
  });

  readonly filteredAppointments = computed(() => {
    const f = this.appointmentFilter();
    const q = this.searchQuery().trim().toLowerCase();
    let list = this.allAppts();

    if (f === 'upcoming') {
      list = this.upcomingAppts();
    } else if (f === 'pending') {
      list = list.filter((a) => (a.status as string) === 'pending' || a.status === 'requested');
    } else if (f === 'completed') {
      list = list.filter((a) => a.status === 'completed');
    } else if (f === 'cancelled') {
      list = list.filter((a) => a.status === 'cancelled');
    } else {
      list = list.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    }

    if (q) {
      list = list.filter(
        (a) =>
          a.type.toLowerCase().includes(q) ||
          a.date.includes(q) ||
          (a.notes && a.notes.toLowerCase().includes(q)) ||
          a.status.toLowerCase().includes(q),
      );
    }

    return list;
  });

  // Total maternal care records count
  readonly totalCareRecords = computed(() => {
    return this.visitsList().length + this.deliveryRecords().length + this.postpartumRecords().length;
  });

  // Combined care records list for display
  readonly allCareRecordsCombined = computed<CareRecordItem[]>(() => {
    const combined: CareRecordItem[] = [];

    for (const v of this.visitsList()) {
      combined.push({
        id: v.id,
        type: 'prenatal',
        typeLabel: 'Prenatal Checkup',
        date: v.date,
        summary: `GA: ${v.gestationalAge} · BP: ${v.bp} · FHR: ${v.fetalHeartRateBpm} bpm`,
        midwife: v.midwifeName,
        raw: v,
      });
    }

    for (const d of this.deliveryRecords()) {
      const dd = d as any;
      combined.push({
        id: d.id || ('deliv-' + (dd.deliveryDate || dd.date || Math.random())),
        type: 'delivery',
        typeLabel: 'Delivery Record',
        date: dd.deliveryDateTime || dd.deliveryDate || dd.date || this.todayIso,
        summary: `Type: ${dd.deliveryType || 'NSVD'} · Baby: ${dd.babySex || dd.babyGender || dd.sex || 'Infant'} (${dd.birthWeightGrams ? dd.birthWeightGrams + 'g' : 'Normal'})`,
        midwife: dd.attendingMidwife || this.assignedMidwife().name,
        raw: d,
      });
    }

    for (const p of this.postpartumRecords()) {
      const pp = p as any;
      combined.push({
        id: p.id || ('postp-' + (pp.visitDate || pp.date || Math.random())),
        type: 'postpartum',
        typeLabel: 'Postpartum Checkup',
        date: pp.visitDate || pp.date || this.todayIso,
        summary: `Stage: ${pp.visitStage || 'Postnatal'} · BP: ${pp.maternalBp || pp.bp || '110/70'} · Lochia: ${pp.lochiaType || 'Normal'}`,
        midwife: pp.attendingMidwife || this.assignedMidwife().name,
        raw: p,
      });
    }

    return combined.sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly filteredCareRecords = computed(() => {
    const cat = this.recordCategoryFilter();
    const q = this.searchQuery().trim().toLowerCase();
    let records = this.allCareRecordsCombined();

    if (cat !== 'all') {
      records = records.filter((r) => r.type === cat);
    }

    if (q) {
      records = records.filter(
        (r) =>
          r.typeLabel.toLowerCase().includes(q) ||
          r.date.includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.midwife.toLowerCase().includes(q),
      );
    }

    return records;
  });

  // Follow-ups list derived from patient's actual upcoming visits & milestones
  readonly followUpsList = computed<FollowUpItem[]>(() => {
    const list: FollowUpItem[] = [];

    // 1. Next upcoming appointments as follow-ups
    for (const a of this.upcomingAppts()) {
      const isToday = a.date === this.todayIso;
      const isPastDue = a.date < this.todayIso;
      list.push({
        id: a.id,
        patientName: a.type || 'Clinic Consultation',
        task: a.notes || `Scheduled appointment at ${formatTime(a.time)}`,
        dueLabel: isToday ? 'Due today' : `Scheduled for ${a.date}`,
        dueDate: a.date,
        status: isPastDue ? 'overdue' : 'upcoming',
        category: 'appointment',
        midwife: this.assignedMidwife().name,
        canBook: false,
      });
    }

    // 2. Next follow-up dates from prenatal records
    for (const v of this.visitsList()) {
      if (v.nextFollowUpDate && v.nextFollowUpDate >= this.todayIso) {
        const isAlreadyBooked = this.upcomingAppts().some((a) => a.date === v.nextFollowUpDate);
        if (!isAlreadyBooked) {
          list.push({
            id: `prenatal-fu-${v.id}`,
            patientName: 'Routine Prenatal Follow-up',
            task: `Recommended re-evaluation after visit on ${v.date}`,
            dueLabel: `Recommended: ${v.nextFollowUpDate}`,
            dueDate: v.nextFollowUpDate,
            status: 'upcoming',
            category: 'prenatal',
            midwife: v.midwifeName,
            canBook: true,
          });
        }
      }
    }

    // 3. Stage-based clinical follow-ups if pregnant
    const week = this.gestationalWeek();
    if (week > 0) {
      if (week >= 36) {
        list.push({
          id: 'fu-late',
          patientName: 'Weekly Late-Term Assessment',
          task: 'Weekly fetal position check and cervical readiness review',
          dueLabel: 'Due this week',
          status: 'upcoming',
          category: 'screening',
          midwife: this.assignedMidwife().name,
          canBook: true,
        });
      } else if (week >= 24 && week <= 28) {
        list.push({
          id: 'fu-ogtt',
          patientName: 'Glucose Screening (OGTT)',
          task: 'Routine gestational diabetes lab screening',
          dueLabel: 'Recommended between weeks 24–28',
          status: 'upcoming',
          category: 'screening',
          midwife: this.assignedMidwife().name,
          canBook: true,
        });
      }
    }

    // 4. Completed checkups
    for (const c of this.allAppts().filter((a) => a.status === 'completed')) {
      list.push({
        id: `comp-${c.id}`,
        patientName: c.type,
        task: c.notes || 'Consultation completed and documented',
        dueLabel: `Completed on ${c.date}`,
        dueDate: c.date,
        status: 'completed',
        category: 'appointment',
        midwife: this.assignedMidwife().name,
        canBook: false,
      });
    }

    return list;
  });

  readonly filteredFollowUps = computed(() => {
    const f = this.followUpFilter();
    const all = this.followUpsList();
    if (f === 'upcoming') {
      return all.filter((i) => i.status === 'upcoming' || i.status === 'overdue');
    }
    if (f === 'completed') {
      return all.filter((i) => i.status === 'completed');
    }
    return all;
  });

  readonly followUpsCount = computed(() => this.followUpsList().filter((i) => i.status !== 'completed').length);

  // Filtered Notifications
  readonly filteredNotifications = computed(() => {
    const list = this.notifications();
    const f = this.notificationFilter();
    if (f === 'unread') return list.filter((n) => !n.read);
    if (f === 'read') return list.filter((n) => n.read);
    return list;
  });

  // Navigation handlers
  switchTab(tab: PatientTab): void {
    this.activeTab.set(tab);
    this.mobileSidebarOpen.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  toggleDarkMode(): void {
    const next = !this.isDarkMode();
    this.setTheme(next);
  }

  setTheme(dark: boolean): void {
    this.isDarkMode.set(dark);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lcms_dark_mode', String(dark));
    }
    this.applyTheme(dark);

    // Persist to patient Firestore doc asynchronously
    const uid = this.auth.user()?.uid;
    if (uid) {
      setDoc(
        doc(db, 'patients', uid),
        { themePreference: dark ? 'dark' : 'light', updatedAt: serverTimestamp() },
        { merge: true },
      ).catch(() => {});
    }
  }

  private applyTheme(dark: boolean): void {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.body.classList.add('dark-mode');
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.add('dark-theme');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.body.classList.remove('dark-mode');
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.classList.remove('dark-theme');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }

  // Notifications Handlers
  toggleNotifications(): void {
    this.notificationsOpen.update((v) => !v);
  }

  markAllRead(): void {
    this.notifSvc.markAllPatientRead();
  }

  markSingleNotificationRead(n: ClinicNotification, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.notifSvc.markPatientItemRead(n.id);
  }

  onNotificationClick(n: ClinicNotification): void {
    this.notifSvc.markPatientItemRead(n.id);
    this.notificationsOpen.set(false);
    this.viewingNotification.set(n);
  }

  closeNotificationModal(): void {
    this.viewingNotification.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notifications-wrapper')) {
      this.notificationsOpen.set(false);
    }
    if (!target.closest('.user-menu-wrapper')) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.viewingPrenatalRecord()) {
      this.closeRecordDetails();
    } else if (this.viewingDeliveryRecord()) {
      this.closeRecordDetails();
    } else if (this.viewingPostpartumRecord()) {
      this.closeRecordDetails();
    } else if (this.viewingApptDetails()) {
      this.closeApptDetails();
    } else if (this.showRescheduleModal()) {
      this.closeRescheduleModal();
    } else if (this.showCancelModal()) {
      this.closeCancelModal();
    } else if (this.showCorrectionModal()) {
      this.closeCorrectionModal();
    } else if (this.viewingNotification()) {
      this.closeNotificationModal();
    } else if (this.showProfileModal()) {
      this.closeProfileModal();
    } else if (this.showBookingModal()) {
      this.closeBookingModal();
    } else if (this.showSignOutModal()) {
      this.closeSignOutModal();
    } else if (this.librarySelectedArticle()) {
      this.closeLibraryArticleModal();
    }
  }

  // Lifecycle
  async ngOnInit(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      const savedDark = localStorage.getItem('lcms_dark_mode') === 'true';
      this.isDarkMode.set(savedDark);
      this.applyTheme(savedDark);
    }
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

      // 1. Fetch Profile for authenticated patient
      const prof = await this.patients.get(uid);
      if (prof) {
        this.profile.set(prof);
        const anyProf = prof as any;
        if (anyProf.themePreference) {
          const isDark = anyProf.themePreference === 'dark';
          this.isDarkMode.set(isDark);
          this.applyTheme(isDark);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lcms_dark_mode', String(isDark));
          }
        }
        // Load preferences if present
        if (anyProf.notificationPreferences) {
          const np = anyProf.notificationPreferences;
          if (typeof np.email === 'boolean') this.notifPrefEmail.set(np.email);
          if (typeof np.sms === 'boolean') this.notifPrefSms.set(np.sms);
          if (typeof np.appointments === 'boolean') this.notifPrefAppointments.set(np.appointments);
          if (typeof np.records === 'boolean') this.notifPrefRecords.set(np.records);
          if (typeof np.wellnessTips === 'boolean') this.notifPrefTips.set(np.wellnessTips);
        }
      } else {
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

        try {
          await setDoc(doc(db, 'patients', uid), {
            ...initialProfile,
            createdAt: serverTimestamp(),
          });
        } catch {
          // ignore
        }
      }

      // Load Assigned Midwife info
      const activeProf = this.profile();
      const mwId = activeProf?.assignedMidwifeId || activeProf?.midwifeId || (activeProf as any)?.createdBy;
      if (mwId) {
        try {
          const mwSnap = await getDoc(doc(db, 'users', mwId));
          if (mwSnap.exists()) {
            const d = mwSnap.data();
            const mwName = (d['displayName'] || `${d['firstName'] || ''} ${d['lastName'] || ''}`).trim() || 'Midwife';
            this.assignedMidwife.set({
              name: mwName.toLowerCase().startsWith('midwife') ? mwName : `Midwife ${mwName}`,
              email: d['email'] || 'midwife@lyingincare.ph',
              phone: d['contactNumber'] || '(02) 8123-4567',
              license: d['prcLicense'] ? `PRC #${d['prcLicense']}` : 'Registered Midwife (RM)',
              clinicHours: d['clinicHours'] || 'Monday – Saturday: 8:00 AM – 5:00 PM',
              clinicAddress: d['clinicAddress'] || 'LCMS Maternal Care Wing',
            });
          }
        } catch {
          // keep clinic defaults
        }
      }

      // 2. Fetch Appointments for authenticated patient only
      const appts = await this.appointments.listForPatient(uid);
      this.allAppts.set(appts);

      // 3. Fetch Clinical Visits for authenticated patient only
      await this.loadClinicalVisits(uid);

      // 4. Fetch Delivery & Postpartum Records for authenticated patient only
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

      // 5. Fetch Inquiries for authenticated patient
      await this.loadInquiries(uid);
    } catch (e) {
      this.error.set(this.patients.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async loadClinicalVisits(uid: string): Promise<void> {
    try {
      const visitMap = new Map<string, any>();

      // 1. Check prenatal_records collection
      try {
        const prenatalList = await this.recordsSvc.listPrenatalForPatient(uid);
        for (const p of prenatalList) {
          if (p.id) visitMap.set(p.id, p);
        }
      } catch {
        // ignore
      }

      // 2. Check visits collection
      try {
        const snap = await getDocs(query(collection(db, 'visits'), where('patientId', '==', uid)));
        if (!snap.empty) {
          snap.forEach((d) => {
            const v = d.data();
            const key = v['prenatalRecordId'] || d.id;
            if (!visitMap.has(key)) {
              visitMap.set(key, { id: d.id, ...v });
            } else {
              visitMap.set(key, { ...v, ...visitMap.get(key) });
            }
          });
        }
      } catch {
        // ignore
      }

      if (visitMap.size > 0) {
        const list: PrenatalVisitLog[] = [];
        visitMap.forEach((v) => {
          const ga = v['gestationalAge'] || '4 weeks';
          const visitDate = v['date'] || todayIso();
          list.push({
            id: v.id,
            date: visitDate,
            gestationalAge: ga,
            trimester: v['trimester'] || getTrimesterByAge(ga),
            bp: v['bp'] || '110/70',
            weightKg: Number(v['weightKg']) || 58,
            fundalHeightCm: Number(v['fundalHeightCm']) || 12,
            fetalPresentation: v['fetalPresentation'] || 'Cephalic',
            fetalHeartRateBpm: Number(v['fetalHeartRateBpm']) || 142,
            fetalMovement: v['fetalMovement'] || 'Active / Good',
            riskLevel: v['riskLevel'] || 'Low risk',
            urinalysisProtein: v['urinalysisProtein'] || 'Negative',
            urinalysisGlucose: v['urinalysisGlucose'] || 'Negative',
            hemoglobin: v['hemoglobin'] || '12.0 g/dL',
            edema: v['edema'] || 'None',
            supplementsGiven: Array.isArray(v['supplementsGiven']) && v['supplementsGiven'].length
              ? v['supplementsGiven']
              : ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate', 'Tetanus Toxoid (TT)'],
            nextFollowUpDate: v['nextFollowUpDate'] || calculateNextFollowUp(visitDate),
            midwifeName: v['attendingMidwife'] || v['midwifeName'] || this.assignedMidwife().name,
            attendingMidwife: v['attendingMidwife'] || v['midwifeName'] || this.assignedMidwife().name,
            notes: v['complaintsRiskNotes'] || v['notes'] || 'Normal maternal progression',
            complaintsRiskNotes: v['complaintsRiskNotes'] || v['notes'] || 'Normal maternal progression',
            raw: v,
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

  async loadInquiries(uid: string): Promise<void> {
    this.loadingInquiries.set(true);
    try {
      const q = query(collection(db, 'inquiries'), where('patientId', '==', uid));
      const snap = await getDocs(q);
      const list: PatientInquiry[] = snap.docs.map((d) => {
        const data = d.data();
        let dateFormatted = 'Recently';
        if (data['createdAt']?.seconds) {
          dateFormatted = new Date(data['createdAt'].seconds * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
        }
        return {
          id: d.id,
          patientId: data['patientId'] || uid,
          patientName: data['patientName'] || this.patientName(),
          patientEmail: data['patientEmail'] || this.patientEmail(),
          midwifeId: data['midwifeId'] || null,
          midwifeName: data['midwifeName'] || this.assignedMidwife().name,
          category: data['category'] || 'General Guidance',
          subject: data['subject'] || 'Inquiry',
          message: data['message'] || '',
          status: data['status'] || 'Sent',
          reply: data['reply'] || '',
          createdAt: data['createdAt'],
          dateFormatted,
        };
      });
      list.sort((a, b) => {
        const aT = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const bT = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return bT - aT;
      });
      this.inquiriesList.set(list);
    } catch {
      // ignore
    } finally {
      this.loadingInquiries.set(false);
    }
  }

  formatSlotTime(t: string): string {
    return formatTime(t);
  }

  getInitials(name: string): string {
    if (!name) return 'PT';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'PT';
  }

  getStatusPillClass(status: string | undefined): string {
    const s = (status || 'scheduled').toLowerCase();
    if (s === 'confirmed') return 'status-confirmed';
    if (s === 'pending' || s === 'requested') return 'status-pending';
    if (s === 'completed') return 'status-completed';
    if (s === 'cancelled') return 'status-cancelled';
    return 'status-scheduled';
  }

  getStatusPillLabel(status: string | undefined): string {
    const s = status || 'Scheduled';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ============ RECORD DETAILS MODAL ============
  openRecordDetails(item: CareRecordItem): void {
    const raw = item.raw || {};
    if (item.type === 'prenatal') {
      const pName = this.patientName() || this.profile()?.fullName || 'Patient';
      const visitDate = raw.date || item.date || '2026-11-13';
      const ga = raw.gestationalAge || '4 weeks';
      const trim = raw.trimester || getTrimesterByAge(ga);
      const followUp = raw.nextFollowUpDate || calculateNextFollowUp(visitDate);
      const supps = (Array.isArray(raw.supplementsGiven) && raw.supplementsGiven.length)
        ? raw.supplementsGiven
        : ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate', 'Tetanus Toxoid (TT)'];

      this.viewingPrenatalRecord.set({
        patientName: pName,
        date: visitDate,
        gestationalAge: ga,
        trimester: trim,
        bp: raw.bp || '110/70',
        weightKg: raw.weightKg || 58,
        fundalHeightCm: raw.fundalHeightCm || 12,
        fetalPresentation: raw.fetalPresentation || 'Cephalic',
        fetalHeartRateBpm: raw.fetalHeartRateBpm || 142,
        fetalMovement: raw.fetalMovement || 'Active / Good',
        riskLevel: raw.riskLevel || 'Low risk',
        urinalysisProtein: raw.urinalysisProtein || 'Negative',
        urinalysisGlucose: raw.urinalysisGlucose || 'Negative',
        hemoglobin: raw.hemoglobin || '12.0 g/dL',
        edema: raw.edema || 'None',
        supplementsGiven: supps,
        nextFollowUpDate: followUp,
        complaintsRiskNotes: raw.complaintsRiskNotes || raw.notes || 'Normal maternal progression',
        attendingMidwife: raw.attendingMidwife || raw.midwifeName || item.midwife || 'Licensed Midwife, RM',
      });
      return;
    }

    if (item.type === 'delivery') {
      const dd = raw;
      this.viewingDeliveryRecord.set({
        patientName: this.patientName(),
        deliveryDate: dd.deliveryDateTime || dd.deliveryDate || dd.date || this.todayIso,
        deliveryTime: dd.deliveryTime || '',
        deliveryType: dd.deliveryType || 'Normal Spontaneous Vaginal Delivery (NSVD)',
        gestationalAge: dd.gestationalAgeAtDelivery || '39 weeks',
        babySex: dd.babySex || dd.babyGender || dd.sex || 'Female',
        birthWeight: dd.birthWeightGrams ? `${dd.birthWeightGrams} g` : '3,200 g',
        birthLength: dd.birthLengthCm ? `${dd.birthLengthCm} cm` : '50 cm',
        apgarScore: dd.apgar5Min ? `${dd.apgar1Min || 8} / ${dd.apgar5Min} (1 & 5 min)` : '9 / 10',
        attendingMidwife: dd.attendingMidwife || item.midwife || this.assignedMidwife().name,
        assistantMidwife: dd.assistantMidwife || 'Clinic Staff Midwife, RM',
        perineumStatus: dd.perineumStatus || 'Intact / 1st Degree (Repaired)',
        bloodLoss: dd.estimatedBloodLossMl ? `${dd.estimatedBloodLossMl} mL` : '250 mL',
        eincImmediateDrying: dd.eincImmediateDrying !== false,
        eincSkinToSkin: dd.eincSkinToSkin !== false,
        eincDelayedCordClamping: dd.eincDelayedCordClamping !== false,
        eincEarlyBreastfeeding: dd.eincEarlyBreastfeeding !== false,
        vitaminKGiven: dd.vitaminKGiven !== false,
        eyeProphylaxisGiven: dd.eyeProphylaxisGiven !== false,
        hepatitisBGiven: dd.hepatitisBGiven !== false,
        bcgGiven: dd.bcgGiven !== false,
        notes: dd.maternalComplications || dd.newbornNotes || dd.notes || 'Safe spontaneous delivery completed with immediate EINC protocol compliance. Mother and newborn stable.',
      });
      return;
    }

    if (item.type === 'postpartum') {
      const pp = raw;
      this.viewingPostpartumRecord.set({
        patientName: this.patientName(),
        visitDate: pp.visitDate || pp.date || this.todayIso,
        visitStage: pp.visitStage || 'Day 3 - 7 (1st Week)',
        maternalBp: pp.maternalBp || pp.bp || '110/70',
        maternalTemp: pp.maternalTemp || '36.5 °C',
        maternalPulse: pp.maternalPulse || '76 bpm',
        fundalFirmness: pp.fundalFirmness || 'Firm and contracted',
        lochiaType: pp.lochiaType || 'Lochia Rubra (Red)',
        lochiaAmount: pp.lochiaAmount || 'Light to Moderate',
        perineumHealing: pp.perineumHealing || 'Healing well / Sutures intact',
        breastCondition: pp.breastCondition || 'Soft, mature colostrum/milk present',
        feedingMethod: pp.feedingMethod || 'Exclusive Breastfeeding',
        maternalMentalState: pp.maternalMentalState || 'Positive & bonding well',
        babyWeightKg: pp.babyWeightKg || 3.3,
        cordStumpStatus: pp.cordStumpStatus || 'Clean & dry',
        jaundiceStatus: pp.jaundiceStatus || 'None / Clear sclera',
        familyPlanning: pp.familyPlanningCounseling || 'Lactational Amenorrhea Method (LAM)',
        attendingMidwife: pp.attendingMidwife || item.midwife || this.assignedMidwife().name,
        clinicalNotes: pp.clinicalNotes || pp.notes || 'Postpartum recovery progressing normally. Maternal vitals stable and infant feeding well.',
        nextFollowUpDate: pp.nextFollowUpDate || calculateNextFollowUp(pp.visitDate),
      });
    }
  }

  closeRecordDetails(): void {
    this.viewingPrenatalRecord.set(null);
    this.viewingDeliveryRecord.set(null);
    this.viewingPostpartumRecord.set(null);
  }

  // ============ APPOINTMENT BOOKING MODAL ============
  openBookingModal(preselectedType?: string, preselectedDate?: string): void {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const tmrwIso = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
    this.bookingDate = preselectedDate || tmrwIso;
    this.bookingType = preselectedType || 'Prenatal Checkup';
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

    if (this.bookingDate < this.todayIso) {
      this.bookingError.set('Cannot book appointments for past dates.');
      return;
    }

    // Check duplicate
    const isDuplicate = this.allAppts().some(
      (a) => a.date === this.bookingDate && a.time === this.bookingTime && a.status !== 'cancelled',
    );
    if (isDuplicate) {
      this.bookingError.set('You already have an appointment booked for this exact date and time.');
      return;
    }

    this.submittingBooking.set(true);
    this.bookingError.set('');

    try {
      const uid = this.auth.user()?.uid;
      if (!uid) throw new Error('Not logged in');

      const prof = this.profile();
      const midwifeId = prof?.assignedMidwifeId || prof?.midwifeId || null;

      await this.appointments.book({
        patientId: uid,
        patientName: this.patientName(),
        date: this.bookingDate,
        time: this.bookingTime,
        type: this.bookingType,
        notes: this.bookingNotes.trim(),
        status: 'scheduled',
        midwifeId: midwifeId,
      });

      // Create notification for midwife
      if (midwifeId) {
        await this.notifSvc.createNotification({
          title: `New Appointment: ${this.patientName()}`,
          message: `${this.bookingType} scheduled on ${this.bookingDate} at ${formatTime(this.bookingTime)}`,
          type: 'appointment',
          targetUserId: midwifeId,
          targetRole: 'midwife',
          route: '/midwife/appointments',
        });
      }

      this.scheduledDate.set(this.bookingDate);
      this.scheduledTime.set(this.bookingTime);
      this.bookingSuccess.set(true);

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

  // ============ APPOINTMENT VIEW DETAILS ============
  openApptDetails(appt: Appointment): void {
    this.viewingApptDetails.set(appt);
  }

  closeApptDetails(): void {
    this.viewingApptDetails.set(null);
  }

  // ============ APPOINTMENT RESCHEDULING ============
  openRescheduleModal(appt: Appointment): void {
    this.reschedulingAppt.set(appt);
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const tmrwIso = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
    this.rescheduleDate.set(appt.date >= this.todayIso ? appt.date : tmrwIso);
    this.computeRescheduleSlots(this.rescheduleDate());
    this.rescheduleReason.set('');
    this.rescheduleError.set('');
    this.rescheduleSuccess.set(false);
    this.showRescheduleModal.set(true);
  }

  closeRescheduleModal(): void {
    this.showRescheduleModal.set(false);
    this.reschedulingAppt.set(null);
  }

  onRescheduleDateChange(): void {
    this.computeRescheduleSlots(this.rescheduleDate());
  }

  computeRescheduleSlots(date: string): void {
    const clinicSlots = slotsFor(date);
    const currentAppt = this.reschedulingAppt();
    const bookedTimes = new Set(
      this.allAppts()
        .filter((a) => a.date === date && a.status !== 'cancelled' && a.id !== currentAppt?.id)
        .map((a) => a.time),
    );
    const avail = (clinicSlots.length ? clinicSlots : ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'])
      .filter((s) => !bookedTimes.has(s));
    this.rescheduleSlots.set(avail);
    this.rescheduleTime.set(avail[0] || '09:00');
  }

  async submitReschedule(): Promise<void> {
    const appt = this.reschedulingAppt();
    if (!appt) return;

    const newDate = this.rescheduleDate();
    const newTime = this.rescheduleTime();
    if (!newDate || !newTime) {
      this.rescheduleError.set('Please select both a new date and time.');
      return;
    }

    if (newDate < this.todayIso) {
      this.rescheduleError.set('Cannot reschedule to a past date.');
      return;
    }

    this.submittingReschedule.set(true);
    this.rescheduleError.set('');

    try {
      const reason = this.rescheduleReason().trim() || 'Patient schedule adjustment';
      await this.appointments.update(appt.id, {
        date: newDate,
        time: newTime,
        type: appt.type,
        notes: (appt.notes ? appt.notes + ' · ' : '') + `Rescheduled (Reason: ${reason})`,
      });

      // Notify midwife
      const mwId = appt.assignedMidwifeId || appt.midwifeId;
      if (mwId) {
        await this.notifSvc.createNotification({
          title: `Appointment Rescheduled: ${appt.patientName}`,
          message: `${appt.type} moved to ${newDate} at ${formatTime(newTime)}. Reason: ${reason}`,
          type: 'appointment',
          targetUserId: mwId,
          targetRole: 'midwife',
        });
      }

      this.rescheduleSuccess.set(true);
      const uid = this.auth.user()?.uid;
      if (uid) {
        const updated = await this.appointments.listForPatient(uid);
        this.allAppts.set(updated);
      }
      setTimeout(() => this.closeRescheduleModal(), 1500);
    } catch (e: any) {
      this.rescheduleError.set(this.appointments.errorMessage(e));
    } finally {
      this.submittingReschedule.set(false);
    }
  }

  // ============ APPOINTMENT CANCELLATION ============
  openCancelModal(appt: Appointment): void {
    this.cancellingAppt.set(appt);
    this.cancelReason.set('Personal / Schedule Conflict');
    this.cancelNotes.set('');
    this.cancelError.set('');
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
    this.cancellingAppt.set(null);
  }

  async submitCancel(): Promise<void> {
    const appt = this.cancellingAppt();
    if (!appt) return;

    this.submittingCancel.set(true);
    this.cancelError.set('');

    try {
      await this.appointments.cancel(appt.id);

      // Record cancellation reason
      try {
        await updateDoc(doc(db, 'appointments', appt.id), {
          cancellationReason: this.cancelReason(),
          cancellationNotes: this.cancelNotes().trim(),
          cancelledBy: 'patient',
          cancelledAt: serverTimestamp(),
        });
      } catch {}

      // Notify midwife
      const mwId = appt.assignedMidwifeId || appt.midwifeId;
      if (mwId) {
        await this.notifSvc.createNotification({
          title: `Appointment Cancelled: ${appt.patientName}`,
          message: `${appt.type} on ${appt.date} was cancelled. Reason: ${this.cancelReason()}`,
          type: 'appointment',
          targetUserId: mwId,
          targetRole: 'midwife',
        });
      }

      this.allAppts.update((list) =>
        list.map((item) => (item.id === appt.id ? { ...item, status: 'cancelled' } : item)),
      );

      this.closeCancelModal();
    } catch {
      this.cancelError.set('Could not cancel appointment. Please contact the clinic directly.');
    } finally {
      this.submittingCancel.set(false);
    }
  }

  // Legacy quick cancel
  async cancelAppointment(a: Appointment): Promise<void> {
    this.openCancelModal(a);
  }

  // ============ PROFILE EDIT MODAL ============
  openProfileModal(): void {
    const p = this.profile();
    this.editFullName = p?.fullName || '';
    this.editPhone = p?.contactNumber || '';
    this.editAddress = p?.address || '';
    this.editBirthDate = p?.birthDate || '';
    this.editEmgName = p?.emergencyContactName || '';
    this.editEmgPhone = p?.emergencyContactNumber || '';
    this.editEmgRelationship = p?.emergencyContactRelationship || '';
    this.editLmp = p?.lmp || '';
    this.editEdd = p?.edd || '';
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

      let calculatedEdd = this.editEdd;
      if (this.editLmp && !calculatedEdd) {
        const lmpDate = new Date(this.editLmp);
        lmpDate.setDate(lmpDate.getDate() + 280);
        calculatedEdd = `${lmpDate.getFullYear()}-${String(lmpDate.getMonth() + 1).padStart(2, '0')}-${String(lmpDate.getDate()).padStart(2, '0')}`;
      }

      const updated: any = {
        ...current,
        fullName: this.editFullName.trim() || current?.fullName || 'Patient',
        contactNumber: this.editPhone.trim(),
        address: this.editAddress.trim(),
        birthDate: this.editBirthDate || current?.birthDate || '',
        emergencyContactName: this.editEmgName.trim(),
        emergencyContactNumber: this.editEmgPhone.trim(),
        emergencyContactRelationship: this.editEmgRelationship.trim(),
        lmp: this.editLmp,
        edd: calculatedEdd,
      };

      await this.patients.update(uid, updated);
      this.profile.set(updated);
      this.profileOk.set(true);
      this.profileMsg.set('Profile information updated successfully!');
      setTimeout(() => this.closeProfileModal(), 1200);
    } catch {
      this.profileOk.set(false);
      this.profileMsg.set('Failed to update details. Please try again.');
    } finally {
      this.savingProfile.set(false);
    }
  }

  // ============ CLINICAL CORRECTION REQUEST MODAL ============
  openCorrectionModal(): void {
    this.correctionField.set('Blood Type');
    this.correctionRequestedValue.set('');
    this.correctionReason.set('');
    this.correctionError.set('');
    this.correctionSuccess.set(false);
    this.showCorrectionModal.set(true);
  }

  closeCorrectionModal(): void {
    this.showCorrectionModal.set(false);
  }

  async submitClinicalCorrectionRequest(): Promise<void> {
    const reason = this.correctionReason().trim();
    if (!reason) {
      this.correctionError.set('Please provide a reason for the clinical correction request.');
      return;
    }

    const uid = this.auth.user()?.uid;
    if (!uid) return;

    this.submittingCorrection.set(true);
    this.correctionError.set('');
    this.correctionSuccess.set(false);

    try {
      const pName = this.patientName();
      const pEmail = this.patientEmail();
      const prof = this.profile();
      const mwId = prof?.assignedMidwifeId || prof?.midwifeId || null;

      await addDoc(collection(db, 'inquiries'), {
        patientId: uid,
        patientName: pName,
        patientEmail: pEmail,
        midwifeId: mwId,
        midwifeName: this.assignedMidwife().name,
        category: 'Clinical Record Correction',
        subject: `Update Request: ${this.correctionField()}`,
        message: `Field: ${this.correctionField()}\nRequested Value: ${this.correctionRequestedValue()}\nReason: ${reason}`,
        status: 'Sent',
        createdAt: serverTimestamp(),
      });

      if (mwId) {
        await this.notifSvc.createNotification({
          title: `Clinical Correction Request: ${pName}`,
          message: `Requested correction for ${this.correctionField()}: "${this.correctionRequestedValue()}"`,
          type: 'patient',
          targetUserId: mwId,
          targetRole: 'midwife',
        });
      }

      await this.activityLog.logActivity({
        userName: pName,
        userRole: 'patient',
        userEmail: pEmail,
        userId: uid,
        activity: `Submitted profile clinical correction request for ${this.correctionField()}`,
      });

      this.correctionSuccess.set(true);
      await this.loadInquiries(uid);
      setTimeout(() => this.closeCorrectionModal(), 1800);
    } catch {
      this.correctionError.set('Could not submit request. Please try again or talk to your midwife directly.');
    } finally {
      this.submittingCorrection.set(false);
    }
  }

  // ============ INQUIRY / CONTACT MIDWIFE ============
  async sendMidwifeInquiry(): Promise<void> {
    const msg = this.inquiryMessage.trim();
    if (!msg) {
      this.inquiryError.set('Please write a message or question for your midwife.');
      return;
    }

    const uid = this.auth.user()?.uid;
    if (!uid) {
      this.inquiryError.set('You must be logged in to submit an inquiry.');
      return;
    }

    this.inquirySending.set(true);
    this.inquiryError.set('');
    this.inquirySuccess.set(false);

    try {
      const pName = this.patientName();
      const pEmail = this.patientEmail();
      const mw = this.assignedMidwife();
      const prof = this.profile();
      const mwId = prof?.assignedMidwifeId || prof?.midwifeId || null;

      const inquiryData = {
        patientId: uid,
        patientName: pName,
        patientEmail: pEmail,
        midwifeId: mwId,
        midwifeName: mw.name,
        category: this.inquiryCategory,
        subject: this.inquirySubject.trim() || `${this.inquiryCategory} Question`,
        message: msg,
        status: 'Sent',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'inquiries'), inquiryData);

      // Create notification for midwife
      if (mwId) {
        await this.notifSvc.createNotification({
          title: `New Inquiry from ${pName}`,
          message: `Category: ${this.inquiryCategory} · "${this.inquirySubject || msg.slice(0, 50)}..."`,
          type: 'patient',
          targetUserId: mwId,
          targetRole: 'midwife',
          route: '/midwife/patients',
        });
      }

      await this.activityLog.logActivity({
        userName: pName,
        userRole: 'patient',
        userEmail: pEmail,
        userId: uid,
        activity: `Sent inquiry to midwife (${this.inquiryCategory}): "${this.inquirySubject || 'General Question'}"`,
      });

      this.inquirySuccess.set(true);
      this.inquirySubject = '';
      this.inquiryMessage = '';

      await this.loadInquiries(uid);
    } catch (err: any) {
      this.inquiryError.set('Could not send message at this moment. For urgent concerns, please call the clinic hotline.');
    } finally {
      this.inquirySending.set(false);
    }
  }

  // ============ SETTINGS PREFERENCES ============
  async saveNotificationPreferences(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;

    this.savingSettings.set(true);
    this.settingsMsg.set('');

    try {
      const prefs = {
        email: this.notifPrefEmail(),
        sms: this.notifPrefSms(),
        appointments: this.notifPrefAppointments(),
        records: this.notifPrefRecords(),
        wellnessTips: this.notifPrefTips(),
      };

      await setDoc(
        doc(db, 'patients', uid),
        {
          notificationPreferences: prefs,
          themePreference: this.isDarkMode() ? 'dark' : 'light',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      this.settingsMsg.set('Notification preferences saved successfully!');
      setTimeout(() => this.settingsMsg.set(''), 3000);
    } catch {
      this.settingsMsg.set('Failed to save preferences.');
    } finally {
      this.savingSettings.set(false);
    }
  }

  // ============ SETTINGS PASSWORD RESET ============
  async triggerPasswordReset(): Promise<void> {
    const email = this.patientEmail();
    if (!email) {
      this.passwordResetError.set('No registered email found for this account.');
      return;
    }

    this.passwordResetLoading.set(true);
    this.passwordResetError.set('');
    this.passwordResetSuccess.set(false);

    try {
      await sendPasswordResetEmail(auth, email);
      this.passwordResetSuccess.set(true);
    } catch (e: any) {
      this.passwordResetError.set(e?.message || 'Failed to send password reset email.');
    } finally {
      this.passwordResetLoading.set(false);
    }
  }

  // ============ SIGN OUT MODAL ============
  openSignOutModal(): void {
    this.showSignOutModal.set(true);
    this.userMenuOpen.set(false);
  }

  closeSignOutModal(): void {
    this.showSignOutModal.set(false);
  }

  async confirmSignOut(): Promise<void> {
    this.closeSignOutModal();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode', 'dark-theme');
      document.documentElement.removeAttribute('data-theme');
    }
    await this.auth.logout();
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode', 'dark-theme');
      document.documentElement.removeAttribute('data-theme');
    }
  }
}
