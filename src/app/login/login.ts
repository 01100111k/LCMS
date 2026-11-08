import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, ProofOfIdentityFile } from '../core/auth.service';
import { PendingApprovalApplication } from '../admin/models/admin.models';

/** All supported authentication views */
export type AuthView =
  | 'login'
  | 'role-select'
  | 'signup-midwife'
  | 'signup-patient'
  | 'pending-approval'
  | 'check-status'
  | 'start';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit, OnDestroy {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Which screen to show first */
  readonly start = input<AuthView>('login');
  readonly closed = output<void>();

  readonly view = signal<AuthView>('login');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly info = signal('');

  // Password visibility toggles
  readonly showLoginPassword = signal(false);
  readonly showSignupPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  // File Upload State for Proof of Identity
  readonly attachedProofFiles = signal<ProofOfIdentityFile[]>([]);
  readonly fileError = signal('');

  // Pending Approval confirmation state
  readonly pendingEmail = signal('');
  readonly pendingRole = signal<'midwife' | 'patient'>('midwife');
  readonly pendingName = signal('');

  // Status check state
  readonly statusEmail = signal('');
  readonly statusResult = signal<PendingApprovalApplication | null>(null);
  readonly statusSearched = signal(false);
  readonly checkingStatus = signal(false);

  // Login Form
  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  // Unified Sign Up Form
  readonly signupForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    roleExtra: ['', [Validators.required]], // PRC license (midwife) or Contact Number (patient)
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  constructor() {
    document.body.style.overflow = 'hidden'; // stop page behind from scrolling
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
    this.fileError.set('');
    this.showLoginPassword.set(false);
    this.showSignupPassword.set(false);
    this.showConfirmPassword.set(false);
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

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.fileError.set('');

    const current = this.attachedProofFiles();
    const newFiles = Array.from(input.files);

    if (current.length + newFiles.length > 2) {
      this.fileError.set('You can upload a maximum of 2 files.');
      input.value = '';
      return;
    }

    for (const file of newFiles) {
      // Validate file size: max 400 KB (409,600 bytes)
      if (file.size > 400 * 1024) {
        this.fileError.set(`"${file.name}" exceeds 400 KB (${Math.round(file.size / 1024)} KB). Please choose a smaller photo or PDF.`);
        input.value = '';
        return;
      }

      // Read file as base64 data URL
      try {
        const dataUrl = await this.readFileAsDataUrl(file);
        this.attachedProofFiles.update((prev) => [
          ...prev,
          {
            name: file.name,
            size: Math.round(file.size / 1024),
            type: file.type || 'image/jpeg',
            dataUrl,
          },
        ]);
      } catch {
        this.fileError.set(`Could not read file "${file.name}".`);
      }
    }
    input.value = '';
  }

  removeFile(index: number): void {
    this.attachedProofFiles.update((files) => files.filter((_, i) => i !== index));
    this.fileError.set('');
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async submitLogin(): Promise<void> {
    this.error.set('');
    this.info.set('');
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const { email, password } = this.loginForm.getRawValue();
      const role = await this.auth.login(email.trim(), password);
      this.close();
      const targetRoute =
        role === 'admin' ? '/admin' : role === 'midwife' ? '/midwife' : '/patient';
      await this.router.navigateByUrl(targetRoute);
    } catch (e) {
      this.error.set(this.auth.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async submitSignup(targetRole: 'midwife' | 'patient'): Promise<void> {
    this.error.set('');
    this.info.set('');
    this.fileError.set('');

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      this.error.set('Please fill out all required fields properly.');
      return;
    }

    const val = this.signupForm.getRawValue();

    if (targetRole === 'midwife' && !val.roleExtra.trim()) {
      this.error.set('Please enter your PRC License / Midwife ID.');
      return;
    }

    if (targetRole === 'patient' && !val.roleExtra.trim()) {
      this.error.set('Please enter your contact number.');
      return;
    }

    if (val.password !== val.confirmPassword) {
      this.signupForm.controls.confirmPassword.setErrors({ mismatch: true });
      this.error.set('Passwords do not match. Please re-enter.');
      return;
    }

    if (val.password.length < 8) {
      this.error.set('Password must be at least 8 characters long.');
      return;
    }

    if (this.attachedProofFiles().length === 0) {
      this.fileError.set('Proof of identity is required. Please upload at least 1 ID photo (PRC or valid Gov ID).');
      return;
    }

    this.loading.set(true);
    try {
      if (targetRole === 'midwife') {
        await this.auth.signUpMidwife({
          firstName: val.firstName,
          lastName: val.lastName,
          email: val.email,
          password: val.password,
          prcLicense: val.roleExtra,
          proofOfIdentity: this.attachedProofFiles(),
        });
      } else {
        await this.auth.signUpPatient({
          firstName: val.firstName,
          lastName: val.lastName,
          email: val.email,
          password: val.password,
          contactNumber: val.roleExtra,
          proofOfIdentity: this.attachedProofFiles(),
        });
      }

      this.pendingEmail.set(val.email.trim());
      this.pendingRole.set(targetRole);
      this.pendingName.set(`${val.firstName.trim()} ${val.lastName.trim()}`);

      // Reset form and files
      this.signupForm.reset();
      this.attachedProofFiles.set([]);

      // Transition to pending approval state
      this.go('pending-approval');
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
      /* prevent email enumeration */
    }
    this.info.set('If that email has an account, a link to set a new password is on its way.');
  }

  async checkStatus(): Promise<void> {
    this.error.set('');
    this.statusResult.set(null);
    this.statusSearched.set(false);
    const email = this.statusEmail().trim();
    if (!email) {
      this.error.set('Please enter your registration email address.');
      return;
    }
    this.checkingStatus.set(true);
    try {
      const res = await this.auth.checkApprovalStatus(email);
      this.statusResult.set(res);
      this.statusSearched.set(true);
    } catch (e) {
      this.error.set(this.auth.errorMessage(e));
    } finally {
      this.checkingStatus.set(false);
    }
  }

  formatAppDate(dateVal: any): string {
    if (!dateVal) return 'Recently';
    try {
      let d: Date;
      if (typeof dateVal?.toDate === 'function') {
        d = dateVal.toDate();
      } else if (dateVal instanceof Date) {
        d = dateVal;
      } else if (dateVal.seconds) {
        d = new Date(dateVal.seconds * 1000);
      } else {
        d = new Date(dateVal);
      }
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  }

  // Escape closes window; Tab loops inside
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
    setTimeout(
      () => this.host.nativeElement.querySelector<HTMLElement>('[data-autofocus]')?.focus(),
      10,
    );
  }
}
