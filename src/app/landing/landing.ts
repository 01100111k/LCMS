import { AfterViewInit, Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AuthView, Login } from '../login/login';

interface Feature {
  title: string;
  text: string;
  icon: 'user' | 'calendar' | 'folderheart' | 'users' | 'chart' | 'check';
  tone: 'green' | 'lavender' | 'peach';
}

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-landing',
  imports: [Login],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements OnInit, AfterViewInit, OnDestroy {
  readonly year = new Date().getFullYear();
  readonly menuOpen = signal(false);
  readonly active = signal('home');

  // Log in window
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  readonly authView = signal<AuthView | null>(null);
  private opener: HTMLElement | null = null;

  readonly links = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'features', label: 'Features' },
    { id: 'mission', label: 'Mission' },
    { id: 'faqs', label: 'FAQs' },
    { id: 'contact', label: 'Contact' },
  ];

  // 6 box-shaped features in a balanced 3x2 grid
  readonly features: Feature[] = [
    {
      title: 'Patient Registration & EDD',
      text: 'Fast, organized onboarding with auto-calculated Estimated Due Date (EDD) from LMP and complete maternal background.',
      icon: 'user',
      tone: 'green',
    },
    {
      title: 'Appointment Scheduling',
      text: 'Interactive calendar with Month & Week views, clinic working hours, open slot booking, and conflict prevention.',
      icon: 'calendar',
      tone: 'lavender',
    },
    {
      title: 'Maternal Health Records',
      text: 'Connected records from first trimester scans and routine prenatal visits to delivery preparation and postpartum care.',
      icon: 'folderheart',
      tone: 'peach',
    },
    {
      title: 'Dedicated Patient Portal',
      text: 'Convenient mobile-friendly access for expecting mothers to check appointment times, clinic schedules, and visit history.',
      icon: 'users',
      tone: 'lavender',
    },
    {
      title: 'Live Status Management',
      text: 'Instant status updates for every visit — Requested, Scheduled, Confirmed, Completed, or Cancelled with live sync.',
      icon: 'check',
      tone: 'green',
    },
    {
      title: 'Clinical Analytics & Insights',
      text: 'Meaningful summaries of monthly patient volume, care completion rates, and clinic activity for informed coordination.',
      icon: 'chart',
      tone: 'peach',
    },
  ];

  // Frequently Asked Questions
  readonly openFaqIndex = signal<number | null>(null);

  readonly faqs: FaqItem[] = [
    {
      question: 'How does appointment scheduling work for prenatal checkups?',
      answer:
        'Midwives and clinic staff can easily schedule checkups through an interactive calendar with conflict prevention that automatically locks booked slots to prevent double-booking. Expecting mothers can also book or request visits through the Patient Portal, and midwives can manage walk-ins and daily triage using the real-time Patient Queue.',
    },
    {
      question: 'Can expecting mothers access the portal on their smartphones?',
      answer:
        'Yes! The Patient Portal is fully responsive on all smartphones, tablets, and computers. Expecting mothers can securely sign in from any web browser to check their Estimated Due Date (EDD) countdown, review upcoming appointments, follow their week-by-week Pregnancy Journey, and view clinic emergency hotlines.',
    },
    {
      question: 'How are appointment statuses (Scheduled, Confirmed, Cancelled, Completed) managed?',
      answer:
        'Appointments transition dynamically in real time between Requested, Scheduled, Confirmed, Completed, and Cancelled. When an appointment is rescheduled or cancelled, the booking slot is immediately reopened for other patients. All updates synchronize with Cloud Firestore and are recorded in the clinic audit log.',
    },
    {
      question: 'Can midwives track medical history and prenatal milestones?',
      answer:
        'Yes. The system provides complete maternal care documentation across prenatal visits, delivery outcomes, and postpartum checkups. It automatically computes gestational age and EDD from the Last Menstrual Period (LMP), monitors vital signs and fetal heart rate (FHR), tracks obstetrical history (Gravida/Para), and powers an interactive Pregnancy Journey timeline.',
    },
    {
      question: 'Is patient medical data secure and confidential?',
      answer:
        'Yes. The system enforces strict Role-Based Access Control (RBAC) and patient data ownership via Firebase Authentication and Firestore Security Rules. Midwives can only access their assigned patients, patients can only access their own profile, data is protected by HTTPS and cloud encryption at rest, and an immutable audit log captures all clinical and administrative actions.',
    },
    {
      question: 'What user roles are available in the system?',
      answer:
        'The system features three distinct, secure portals: Administrator (manages staff accounts, reviews PRC midwife licenses and patient applications, audits activity logs, and manages clinic settings), Licensed Midwife (registers patients, documents prenatal/delivery/postpartum care, and manages calendars and queues), and Patient (tracks personal pregnancy progress and schedules visits).',
    },
    {
      question: 'How does registration and account approval work?',
      answer:
        'Midwives and expecting mothers can sign up online by entering their details and uploading required proof of identity (such as a PRC license for midwives or a valid ID for patients). Clinic administrators review each application before granting portal access, and applicants can check their verification progress at any time using the Check Registration Status feature.',
    },
  ];

  readonly contact = {
    email: 'info@lyingincare.ph',
    phone: '+63 917 882 9901',
    address: 'National Highway, Poblacion 2, Villanueva, Misamis Oriental',
  };

  private navObserver?: IntersectionObserver;
  private scrollRevealObserver?: IntersectionObserver;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
      window.scrollTo(0, 0);
    }
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
    const initial = this.route.snapshot.data['auth'] as AuthView | undefined;
    if (initial) this.authView.set(initial);
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }
    this.setupNavObserver();
    this.setupScrollReveal();
  }

  ngOnDestroy(): void {
    this.navObserver?.disconnect();
    this.scrollRevealObserver?.disconnect();
  }

  toggleFaq(index: number): void {
    this.openFaqIndex.update((curr) => (curr === index ? null : index));
  }

  private setupNavObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    this.navObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) this.active.set(e.target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    this.links.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) this.navObserver!.observe(el);
    });
  }

  private setupScrollReveal(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.scrollRevealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );

    setTimeout(() => {
      document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
        this.scrollRevealObserver?.observe(el);
      });
    }, 120);
  }

  openAuth(view: AuthView): void {
    this.menuOpen.set(false);
    this.opener = document.activeElement as HTMLElement | null;
    this.authView.set(view);
  }

  closeAuth(): void {
    this.authView.set(null);
    if (this.router.url.startsWith('/login') || this.router.url.startsWith('/signup')) void this.router.navigateByUrl('/');
    this.opener?.focus();
  }

  scrollTo(id: string, event?: Event): void {
    event?.preventDefault();
    this.menuOpen.set(false);
    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
    this.active.set(id);
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }

  @HostListener('window:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }
}