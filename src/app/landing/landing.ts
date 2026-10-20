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
        'Midwives and clinic staff can easily book appointments for registered patients via the interactive calendar. Patients can also coordinate their schedules through the patient portal. The system prevents double bookings and manages clinic working hours automatically.',
    },
    {
      question: 'Can expecting mothers access the portal on their smartphones?',
      answer:
        'Yes! The system is fully responsive across mobile phones, tablets, and desktops. Expecting mothers can log in from any web browser to view upcoming appointments, visit history, and clinic updates without downloading an external app.',
    },
    {
      question: 'How are appointment statuses (Scheduled, Confirmed, Cancelled, Completed) managed?',
      answer:
        'Midwives can click any patient on the calendar to open an appointment status card. Statuses can be updated in real time between Requested, Scheduled, Confirmed, Completed, or Cancelled with automatic synchronization to Firebase.',
    },
    {
      question: 'Can midwives track medical history and prenatal milestones?',
      answer:
        'Yes. Each patient has a dedicated profile that records gestational milestones, obstetrical history (Gravida, Para), Estimated Date of Delivery (EDD), vital signs, and personalized visit notes for every stage of pregnancy.',
    },
    {
      question: 'Is patient medical data secure and confidential?',
      answer:
        'Your health records are stored in secure cloud infrastructure with enterprise-level encryption, role-based access rules, and authenticated credentials so only authorized healthcare personnel and the patient can view records.',
    },
    {
      question: 'What user roles are available in the system?',
      answer:
        'The system features two tailored portals: the Midwife Portal with clinical management tools, calendar controls, and patient registration, and the Patient Portal designed for mothers to view their care schedule.',
    },
  ];

  readonly contact = {
    email: 'lyingincare@system.com',
    phone: '+63 912 345 6789',
    address: 'Lying-In Care Center, Philippines',
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
    if (this.auth.user() && this.auth.role()) {
      void this.router.navigateByUrl(this.auth.homeRoute());
      return;
    }
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