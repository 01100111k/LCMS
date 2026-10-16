import {
  Component, ElementRef, HostListener, OnDestroy, OnInit, inject, input, output, signal,
} from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

/** 'login' = the log in form, 'start' = how accounts are created. */
export type AuthView = 'login' | 'start';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit, OnDestroy {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Which screen to show first. */
  readonly start = input<AuthView>('login');
  readonly closed = output<void>();

  readonly view = signal<AuthView>('login');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly showPassword = signal(false);

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    document.body.style.overflow = 'hidden'; // stop the page behind from scrolling
  }

  ngOnInit(): void {
    this.view.set(this.start());
    this.focusSoon();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  go(view: AuthView): void {
    this.view.set(view);
    this.error.set('');
    this.info.set('');
    this.showPassword.set(false);
    this.focusSoon();
  }

  close(): void {
    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  bad(c: AbstractControl): boolean {
    return c.touched && c.invalid;
  }

  async submitLogin(): Promise<void> {
    this.error.set('');
    this.info.set('');
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.error.set('Enter your email and password.');
      return;
    }
    this.loading.set(true);
    try {
      const { email, password } = this.loginForm.getRawValue();
      const role = await this.auth.login(email.trim(), password);
      this.close();
      await this.router.navigateByUrl(role === 'midwife' ? '/midwife' : '/patient');
    } catch (e) {
      this.error.set(this.auth.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async forgot(): Promise<void> {
    this.error.set('');
    this.info.set('');
    const email = this.loginForm.controls.email;
    if (email.invalid) {
      email.markAsTouched();
      this.error.set('Enter your email above first, then select "Forgot password?".');
      return;
    }
    try {
      await this.auth.resetPassword(email.value.trim());
    } catch {
      /* same message either way, so we don't reveal which emails have accounts */
    }
    this.info.set('If that email has an account, a link to set a new password is on its way.');
  }

  // Escape closes the window; Tab stays inside it.
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const root = this.host.nativeElement;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
    ).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = !!active && root.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  private focusSoon(): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 0);
  }
}