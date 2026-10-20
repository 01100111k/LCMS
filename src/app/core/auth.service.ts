import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { auth, db } from './firebase';

export type Role = 'admin' | 'midwife' | 'patient';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly role = signal<Role | null>(null);
  /** Resolves once Firebase has told us whether someone is already logged in. */
  readonly ready: Promise<void>;
  private version = 0;

  constructor() {
    this.ready = new Promise((resolve) => {
      onAuthStateChanged(auth, async (u) => {
        const v = ++this.version;
        const role = u ? await this.fetchRole(u.uid).catch(() => null) : null;
        if (v !== this.version) return; // a newer sign-in/out happened meanwhile
        this.user.set(u);
        this.role.set(role);
        resolve();
      });
    });
  }

  // The role always comes from the database (written by an admin, midwife or in the Firebase console)
  private async readUserDoc(uid: string): Promise<{ exists: boolean; role: unknown }> {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists() && snap.data()?.['role']) {
      return { exists: true, role: snap.data()?.['role'] };
    }

    // Fallback: check if the user is listed in the 'admin' collection
    try {
      const adminSnap = await getDoc(doc(db, 'admin', uid));
      if (adminSnap.exists()) {
        return { exists: true, role: adminSnap.data()?.['role'] || 'admin' };
      }
    } catch {
      // ignore
    }

    return { exists: snap.exists(), role: snap.data()?.['role'] };
  }

  private toRole(value: unknown): Role | null {
    return value === 'admin' || value === 'midwife' || value === 'patient' ? value : null;
  }

  private async fetchRole(uid: string): Promise<Role | null> {
    return this.toRole((await this.readUserDoc(uid)).role);
  }

  homeRoute(): string {
    const r = this.role();
    return r === 'admin' ? '/admin' : r === 'midwife' ? '/midwife' : r === 'patient' ? '/patient' : '/login';
  }

  async login(email: string, password: string): Promise<Role> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const found = await this.readUserDoc(cred.user.uid);
    const role = this.toRole(found.role);
    if (!role) {
      await signOut(auth);
      // The details end up in the message so you can compare them with the Firebase console.
      throw new Error(`no-role|${cred.user.uid}|${found.exists}|${String(found.role)}`);
    }
    this.user.set(cred.user);
    this.role.set(role);
    return role;
  }

  async signUpMidwife(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    prcLicense?: string;
  }): Promise<Role> {
    const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    await updateProfile(cred.user, { displayName: fullName }).catch(() => {});

    await setDoc(doc(db, 'users', cred.user.uid), {
      role: 'midwife',
      email: data.email.trim(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      displayName: fullName,
      prcLicense: (data.prcLicense || '').trim(),
      createdAt: serverTimestamp(),
    });

    this.user.set(cred.user);
    this.role.set('midwife');
    return 'midwife';
  }

  async signUpPatient(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    contactNumber?: string;
  }): Promise<Role> {
    const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    await updateProfile(cred.user, { displayName: fullName }).catch(() => {});

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', cred.user.uid), {
      role: 'patient',
      email: data.email.trim(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      displayName: fullName,
      contactNumber: (data.contactNumber || '').trim(),
      createdAt: serverTimestamp(),
    });

    batch.set(doc(db, 'patients', cred.user.uid), {
      fullName,
      email: data.email.trim(),
      contactNumber: (data.contactNumber || '').trim(),
      birthDate: '',
      address: '',
      emergencyContactName: '',
      emergencyContactNumber: '',
      bloodType: '',
      lmp: '',
      edd: '',
      status: 'Active',
      riskLevel: 'Low risk',
      gravidaPara: 'G1P0',
      createdAt: serverTimestamp(),
      createdBy: cred.user.uid,
    });

    await batch.commit();

    this.user.set(cred.user);
    this.role.set('patient');
    return 'patient';
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  async logout(): Promise<void> {
    await signOut(auth);
    this.user.set(null);
    this.role.set(null);
    await this.router.navigateByUrl('/');
  }

  errorMessage(e: unknown): string {
    const code = (e as { code?: string }).code ?? (e as Error).message;
    if (code.startsWith('no-role')) {
      const [, uid = '', exists = '', role = ''] = code.split('|');
      return (
        `Password accepted, but no usable role was found. ` +
        `Project: ${environment.firebase.projectId} | Looking for: users/${uid} | ` +
        `Document found: ${exists === 'true' ? 'yes' : 'NO'} | role value: ${exists === 'true' ? `"${role}"` : '-'} ` +
        `(it must be "admin", "midwife", or "patient").`
      );
    }
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Try logging in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a few minutes and try again.';
      case 'auth/network-request-failed':
        return 'No connection. Check your internet and try again.';
      case 'permission-denied':
        return 'The database blocked this request. Publish the Firestore rules, then try again.';
      default:
        return `Something went wrong (${code}). Please try again.`;
    }
  }
}
