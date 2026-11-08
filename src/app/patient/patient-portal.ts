import { DatePipe, NgClass } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
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
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
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
  isOverdue: boolean;
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

  // User menu dropdown state in top bar (Matches Midwife Layout)
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
  }>({
    name: 'Primary Clinic Midwife',
    email: 'midwife@lyingincare.ph',
    phone: '(02) 8123-4567',
    license: 'Registered Midwife',
  });

  // Appointments state
  readonly allAppts = signal<Appointment[]>([]);
  readonly appointmentFilter = signal<'all' | 'upcoming' | 'pending' | 'completed' | 'cancelled'>('all');

  // Clinical records / visits
  readonly visitsList = signal<PrenatalVisitLog[]>([]);
  readonly deliveryRecords = signal<DeliveryRecord[]>([]);
  readonly postpartumRecords = signal<PostpartumRecord[]>([]);
  readonly recordCategoryFilter = signal<'all' | 'prenatal' | 'delivery' | 'postpartum'>('all');

  // Selected Record Modal Details
  readonly selectedRecord = signal<{
    title: string;
    type: string;
    date: string;
    midwifeName: string;
    details: { label: string; value: string }[];
    notes?: string;
  } | null>(null);

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
  editFullName = '';
  editPhone = '';
  editAddress = '';
  editBloodType = 'O+';
  editBirthDate = '';
  editEmgName = '';
  editEmgPhone = '';
  editLmp = '';
  editEdd = '';
  readonly bloodTypeOptions = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  readonly savingProfile = signal(false);
  readonly profileMsg = signal('');
  readonly profileOk = signal(true);

  // Sign out confirmation modal
  readonly showSignOutModal = signal(false);

  // Contact Midwife Inquiry Form State
  inquiryCategory = 'Prenatal Guidance';
  inquirySubject = '';
  inquiryMessage = '';
  readonly inquirySending = signal(false);
  readonly inquirySuccess = signal(false);
  readonly inquiryError = signal('');

  // Settings Password Reset State
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

  // Greeting based on time of day
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

  // Computed patient display name from Firestore
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

  // User initials for circular avatar (e.g. "MS")
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

  // Pregnancy Tracker milestones tab state
  readonly selectedMilestoneTab = signal<'1st' | '2nd' | '3rd' | 'postpartum'>('1st');

  readonly babyFruitEmoji = computed(() => {
    const w = this.gestationalWeek();
    if (w <= 0) return '🌱';
    if (w <= 8) return '🫐';
    if (w <= 12) return '🍋';
    if (w <= 16) return '🥑';
    if (w <= 20) return '🍌';
    if (w <= 24) return '🌽';
    if (w <= 28) return '🍆';
    if (w <= 32) return '🎃';
    if (w <= 36) return '🍈';
    return '🍉';
  });

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
    const all = this.allAppts();
    if (f === 'upcoming') {
      return this.upcomingAppts();
    }
    if (f === 'pending') {
      return all.filter((a) => (a.status as string) === 'pending' || a.status === 'requested');
    }
    if (f === 'completed') {
      return all.filter((a) => a.status === 'completed');
    }
    if (f === 'cancelled') {
      return all.filter((a) => a.status === 'cancelled');
    }
    return all.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
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
        date: dd.deliveryDate || dd.date || this.todayIso,
        summary: `Type: ${dd.deliveryType || 'NSD'} · Baby: ${dd.babyGender || dd.sex || 'Infant'}`,
        midwife: dd.attendingMidwife || this.assignedMidwife().name,
        raw: d,
      });
    }

    for (const p of this.postpartumRecords()) {
      const pp = p as any;
      combined.push({
        id: p.id || ('postp-' + (pp.visitDate || pp.date || Math.random())),
        type: 'postpartum',
        typeLabel: 'Postpartum Care',
        date: pp.visitDate || pp.date || this.todayIso,
        summary: `BP: ${pp.bp || 'Normal'} · Lochia: ${pp.lochia || 'Normal'}`,
        midwife: pp.attendingMidwife || this.assignedMidwife().name,
        raw: p,
      });
    }

    return combined.sort((a, b) => b.date.localeCompare(a.date));
  });

  // Filtered care records
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

  // Follow-ups list derived from the patient's actual upcoming visits & milestones
  readonly followUpsList = computed<FollowUpItem[]>(() => {
    const list: FollowUpItem[] = [];

    // 1. Next upcoming appointments as follow-ups
    for (const a of this.upcomingAppts()) {
      const isToday = a.date === this.todayIso;
      list.push({
        id: a.id,
        patientName: a.type || 'Clinic Consultation',
        task: a.notes || `Scheduled appointment at ${formatTime(a.time)}`,
        dueLabel: isToday ? 'Due today' : `Scheduled for ${a.date}`,
        isOverdue: false,
      });
    }

    // 2. Stage-based clinical follow-ups if pregnant
    const week = this.gestationalWeek();
    if (week > 0) {
      if (week >= 36) {
        list.push({
          id: 'fu-late',
          patientName: 'Late-Term Assessment',
          task: 'Weekly fetal position check and cervical readiness review',
          dueLabel: 'Due today',
          isOverdue: false,
        });
      } else if (week >= 24 && week <= 28) {
        list.push({
          id: 'fu-ogtt',
          patientName: 'Glucose Screening (OGTT)',
          task: 'Routine gestational diabetes lab screening',
          dueLabel: 'Due this week',
          isOverdue: false,
        });
      } else {
        list.push({
          id: 'fu-routine',
          patientName: 'Routine Prenatal Review',
          task: 'Maternal blood pressure, fundal height, and kick count monitoring',
          dueLabel: 'In 2 weeks',
          isOverdue: false,
        });
      }
    }

    // 3. Postpartum follow-ups
    if (this.postpartumRecords().length > 0) {
      list.push({
        id: 'fu-pp',
        patientName: 'Postpartum Follow-up',
        task: 'Postnatal maternal wellness evaluation and infant feeding review',
        dueLabel: 'Due soon',
        isOverdue: false,
      });
    }

    return list;
  });

  readonly followUpsCount = computed(() => this.followUpsList().length);

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
    this.isDarkMode.set(next);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark-theme', next);
    }
  }

  // Notifications Handlers
  toggleNotifications(): void {
    this.notificationsOpen.update((v) => !v);
  }

  markAllRead(): void {
    this.notifSvc.markAllPatientRead();
  }

  onNotificationClick(n: ClinicNotification): void {
    this.notifSvc.markPatientItemRead(n.id);
    this.notificationsOpen.set(false);
    if (n.type === 'appointment') {
      this.switchTab('appointments');
    }
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

  // Lifecycle
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

      // 1. Fetch Profile for authenticated patient
      const prof = await this.patients.get(uid);
      if (prof) {
        this.profile.set(prof);
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
              license: d['prcLicense'] ? `PRC #${d['prcLicense']}` : 'Registered Midwife',
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
            midwifeName: v['midwifeName'] || this.assignedMidwife().name,
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
    const raw = item.raw;
    if (item.type === 'prenatal') {
      this.selectedRecord.set({
        title: `Prenatal Visit · ${item.date}`,
        type: 'Prenatal Checkup',
        date: item.date,
        midwifeName: item.midwife,
        details: [
          { label: 'Gestational Age', value: raw.gestationalAge || '—' },
          { label: 'Blood Pressure', value: raw.bp || '—' },
          { label: 'Weight', value: `${raw.weightKg || '—'} kg` },
          { label: 'Fundal Height', value: `${raw.fundalHeightCm || '—'} cm` },
          { label: 'Fetal Heart Rate', value: `${raw.fetalHeartRateBpm || '—'} bpm` },
        ],
        notes: raw.notes || 'Normal prenatal progress recorded.',
      });
    } else if (item.type === 'delivery') {
      this.selectedRecord.set({
        title: `Delivery Record · ${item.date}`,
        type: 'Delivery Record',
        date: item.date,
        midwifeName: item.midwife,
        details: [
          { label: 'Delivery Time', value: raw.deliveryTime || '—' },
          { label: 'Delivery Type', value: raw.deliveryType || 'Normal Spontaneous Delivery (NSD)' },
          { label: 'Baby Gender', value: raw.babyGender || raw.sex || '—' },
          { label: 'Birth Weight', value: raw.birthWeightGrams ? `${raw.birthWeightGrams} g` : '—' },
          { label: 'Apgar Score', value: raw.apgarScore || '9 / 10' },
        ],
        notes: raw.complications || raw.notes || 'Safe delivery recorded under professional midwife care.',
      });
    } else {
      this.selectedRecord.set({
        title: `Postpartum Record · ${item.date}`,
        type: 'Postpartum Follow-up',
        date: item.date,
        midwifeName: item.midwife,
        details: [
          { label: 'Days Postpartum', value: raw.daysPostpartum ? `${raw.daysPostpartum} days` : '—' },
          { label: 'Blood Pressure', value: raw.bp || 'Normal' },
          { label: 'Lochia Status', value: raw.lochia || 'Normal' },
          { label: 'Perineum / Wound', value: raw.perineum || 'Intact / Healing normally' },
          { label: 'Infant Feeding', value: raw.feeding || 'Exclusive Breastfeeding' },
        ],
        notes: raw.notes || 'Maternal vitals stable and infant feeding normally.',
      });
    }
  }

  closeRecordDetails(): void {
    this.selectedRecord.set(null);
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
      alert('Could not cancel appointment. Please contact the clinic directly.');
    }
  }

  // ============ PROFILE EDIT MODAL ============
  openProfileModal(): void {
    const p = this.profile();
    this.editFullName = p?.fullName || '';
    this.editPhone = p?.contactNumber || '';
    this.editAddress = p?.address || '';
    this.editBloodType = p?.bloodType || 'O+';
    this.editBirthDate = p?.birthDate || '';
    this.editEmgName = p?.emergencyContactName || '';
    this.editEmgPhone = p?.emergencyContactNumber || '';
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
        bloodType: this.editBloodType || current?.bloodType || 'O+',
        birthDate: this.editBirthDate || current?.birthDate || '',
        emergencyContactName: this.editEmgName.trim(),
        emergencyContactNumber: this.editEmgPhone.trim(),
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

  // ============ INQUIRY / CONTACT MIDWIFE ============
  async sendMidwifeInquiry(): Promise<void> {
    if (!this.inquiryMessage.trim()) {
      this.inquiryError.set('Please write a message or question for your midwife.');
      return;
    }

    this.inquirySending.set(true);
    this.inquiryError.set('');
    this.inquirySuccess.set(false);

    try {
      await this.activityLog.logActivity({
        userName: this.patientName(),
        userRole: 'patient',
        userEmail: this.patientEmail(),
        userId: this.auth.user()?.uid,
        activity: `Sent inquiry to midwife (${this.inquiryCategory}): "${this.inquirySubject || 'General Question'}"`,
      });

      this.inquirySuccess.set(true);
      this.inquirySubject = '';
      this.inquiryMessage = '';
    } catch (err: any) {
      this.inquiryError.set('Could not send message at this moment. For urgent concerns, please call the clinic hotline.');
    } finally {
      this.inquirySending.set(false);
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
    await this.auth.logout();
  }
}
