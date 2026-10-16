import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AuthView, Login } from '../login/login';

interface Service { title: string; text: string; icon: 'user' | 'calendar' | 'folderheart' | 'users' | 'chart'; tone: 'green' | 'lavender' | 'peach'; }

@Component({
  selector: 'app-landing',
  imports: [Login],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements OnInit, OnDestroy {
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
    { id: 'services', label: 'Services' },
    { id: 'contact', label: 'Contact' },
  ];

  readonly services: Service[] = [
    { title: 'Patient registration', text: 'A simple start to your care journey, with organized patient profiles.', icon: 'user', tone: 'green' },
    { title: 'Appointment scheduling', text: 'Book, reschedule, and keep track of upcoming appointments.', icon: 'calendar', tone: 'lavender' },
    { title: 'Maternal care records', text: 'Connected records from prenatal visits to postpartum care.', icon: 'folderheart', tone: 'peach' },
    { title: 'Patient portal', text: 'Your profile, appointments, and permitted care records in one place.', icon: 'users', tone: 'lavender' },
    { title: 'Reports & insights', text: 'Meaningful summaries that support informed care coordination.', icon: 'chart', tone: 'green' },
  ];

  // Replace these with your facility's real details.
  readonly contact = {
    email: 'lyingincare@system.com',
    phone: '+63 912 345 6789',
    address: 'Lying-In Care Center, Philippines',
  };

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    // The /login address opens the page with the log in window already showing.
    const initial = this.route.snapshot.data['auth'] as AuthView | undefined;
    if (initial) this.authView.set(initial);

    // Highlight the nav link of the section currently in view.
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) this.active.set(e.target.id);
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    this.links.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) this.observer!.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  openAuth(view: AuthView): void {
    this.menuOpen.set(false);
    if (this.auth.user() && this.auth.role()) {
      void this.router.navigateByUrl(this.auth.homeRoute()); // already logged in
      return;
    }
    this.opener = document.activeElement as HTMLElement | null;
    this.authView.set(view);
  }

  closeAuth(): void {
    this.authView.set(null);
    if (this.router.url.startsWith('/login')) void this.router.navigateByUrl('/');
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

  @HostListener('window:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }
}