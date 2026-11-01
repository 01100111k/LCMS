import { Injectable, inject } from '@angular/core';
import { createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, secondaryAuth } from './firebase';
import { ActivityLogService } from './activity-log.service';
import { AuthService } from './auth.service';
import { EXAMPLE_PATIENTS } from './example-data';

export type PatientStatus = 'Active' | 'Postpartum' | 'Completed' | 'Inactive';
export type RiskLevel = 'Low risk' | 'Medium risk' | 'High risk';

export interface PatientProfile {
  fullName: string;
  email: string;
  birthDate: string; // YYYY-MM-DD
  contactNumber: string;
  address: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  bloodType: string;
  lmp: string; // last menstrual period, YYYY-MM-DD
  edd: string; // expected due date, YYYY-MM-DD
  status?: PatientStatus;
  riskLevel?: RiskLevel;
  gravidaPara?: string;
  gestationalAge?: string;
  assignedMidwifeId?: string | null;
  midwifeId?: string | null;
  createdBy?: string | null;
}

export interface Patient extends PatientProfile {
  id: string;
}

// No look-alike characters (0/O, 1/l/I) so it is easy to read out loud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generatePassword(length = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private activityLog = inject(ActivityLogService);
  private auth = inject(AuthService);

  /**
   * Registers a patient with full Firestore persistence.
   * Automatically sets the logged-in Midwife's UID as assignedMidwifeId and midwifeId.
   */
  async register(profile: PatientProfile, initialPassword?: string): Promise<{ id: string; invited: boolean }> {
    const email = (profile.email || '').trim().toLowerCase();
    const fullName = (profile.fullName || '').trim();

    if (!fullName) {
      throw new Error('Patient full legal name is required.');
    }

    const midwifeUid = profile.assignedMidwifeId || profile.midwifeId || auth.currentUser?.uid || null;

    if (email) {
      const password = initialPassword?.trim() || generatePassword();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = cred.user.uid;

      try {
        const batch = writeBatch(db);

        // 1. users collection doc
        batch.set(doc(db, 'users', uid), {
          uid,
          fullName,
          displayName: fullName,
          email,
          role: 'patient',
          accountStatus: 'active',
          approvalStatus: 'approved',
          status: 'active',
          contactNumber: profile.contactNumber || '',
          assignedMidwifeId: midwifeUid,
          midwifeId: midwifeUid,
          createdBy: auth.currentUser?.uid ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. patients collection doc
        batch.set(doc(db, 'patients', uid), {
          id: uid,
          patientId: uid,
          uid,
          fullName,
          displayName: fullName,
          email,
          birthDate: profile.birthDate || '',
          dateOfBirth: profile.birthDate || '',
          contactNumber: profile.contactNumber || '',
          address: profile.address || '',
          emergencyContactName: profile.emergencyContactName || '',
          emergencyContactNumber: profile.emergencyContactNumber || '',
          bloodType: profile.bloodType || 'O+',
          lmp: profile.lmp || '',
          edd: profile.edd || '',
          status: profile.status || 'Active',
          riskLevel: profile.riskLevel || 'Low risk',
          gravidaPara: profile.gravidaPara || 'G1P0',
          gestationalAge: profile.gestationalAge || '24 weeks',
          assignedMidwifeId: midwifeUid,
          midwifeId: midwifeUid,
          createdBy: auth.currentUser?.uid ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
      } catch (e) {
        // Remove the half-created login so the email can be used again.
        await deleteUser(cred.user).catch(() => undefined);
        throw e;
      } finally {
        await signOut(secondaryAuth).catch(() => undefined);
      }

      let invited = false;
      if (!initialPassword) {
        try {
          await this.sendInvite(email);
          invited = true;
        } catch {
          invited = false;
        }
      }

      this.activityLog.logActivity({
        userName: fullName,
        userRole: 'patient',
        userEmail: email,
        userId: uid,
        activity: `Patient registered: ${fullName}`,
      }).catch(() => undefined);

      return { id: uid, invited };
    } else {
      // Patient without login credentials (walk-in)
      const docRef = doc(collection(db, 'patients'));
      const patientId = docRef.id;

      await setDoc(docRef, {
        id: patientId,
        patientId,
        fullName,
        displayName: fullName,
        email: '',
        birthDate: profile.birthDate || '',
        dateOfBirth: profile.birthDate || '',
        contactNumber: profile.contactNumber || '',
        address: profile.address || '',
        emergencyContactName: profile.emergencyContactName || '',
        emergencyContactNumber: profile.emergencyContactNumber || '',
        bloodType: profile.bloodType || 'O+',
        lmp: profile.lmp || '',
        edd: profile.edd || '',
        status: profile.status || 'Active',
        riskLevel: profile.riskLevel || 'Low risk',
        gravidaPara: profile.gravidaPara || 'G1P0',
        gestationalAge: profile.gestationalAge || '24 weeks',
        assignedMidwifeId: midwifeUid,
        midwifeId: midwifeUid,
        createdBy: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      this.activityLog.logActivity({
        userName: fullName,
        userRole: 'patient',
        userEmail: '',
        userId: patientId,
        activity: `Patient registered: ${fullName}`,
      }).catch(() => undefined);

      return { id: patientId, invited: false };
    }
  }

  /** Sends the "set your password" email (Firebase's password reset email). */
  async sendInvite(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email, { url: `${location.origin}/login` });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/unauthorized-continue-uri' || code === 'auth/invalid-continue-uri') {
        await sendPasswordResetEmail(auth, email);
      } else {
        throw e;
      }
    }
  }

  private getLocalEdits(): Record<string, Patient> {
    try {
      const raw = localStorage.getItem('lcms_example_patients_edits');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveLocalEdit(id: string, updated: Patient): void {
    try {
      const edits = this.getLocalEdits();
      edits[id] = updated;
      localStorage.setItem('lcms_example_patients_edits', JSON.stringify(edits));
    } catch {
      // ignore
    }
  }

  isMidwifeDemoUser(): boolean {
    const email = auth.currentUser?.email?.toLowerCase();
    if (email) return email === 'midwife@gmail.com' || email === 'midwife@lyingincare.ph';
    try {
      const cached = localStorage.getItem('lcms_cached_auth');
      if (cached) {
        const parsed = JSON.parse(cached);
        const ce = parsed?.email?.toLowerCase();
        return ce === 'midwife@gmail.com' || ce === 'midwife@lyingincare.ph';
      }
    } catch {}
    return false;
  }

  getCurrentRole(): string {
    const r = this.auth.role();
    if (r) return r;
    try {
      const cached = localStorage.getItem('lcms_cached_auth');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.role) return parsed.role;
      }
    } catch {}
    const email = auth.currentUser?.email?.toLowerCase() || '';
    if (email.startsWith('admin@')) return 'admin';
    return 'midwife';
  }

  async list(): Promise<Patient[]> {
    const currentUid = auth.currentUser?.uid;
    const role = this.getCurrentRole();
    let dbPatients: Patient[] = [];

    try {
      if (role === 'admin') {
        // Admin sees all patients
        const snap = await getDocs(collection(db, 'patients'));
        dbPatients = snap.docs.map((d) => this.toPatient(d.id, d.data()));
      } else if (currentUid) {
        // Midwife: query ONLY patients assigned to this midwife's Firebase UID
        const q = query(collection(db, 'patients'), where('assignedMidwifeId', '==', currentUid));
        const snap = await getDocs(q);
        dbPatients = snap.docs.map((d) => this.toPatient(d.id, d.data()));
      }
    } catch (e) {
      console.warn('PatientsService.list query error:', e);
      dbPatients = [];
    }

    // Only the demo midwife account midwife@gmail.com sees the sample patients
    if (this.isMidwifeDemoUser()) {
      const localEdits = this.getLocalEdits();
      const existingIds = new Set(dbPatients.map((p) => p.id));
      const existingEmails = new Set(dbPatients.map((p) => p.email?.toLowerCase()).filter(Boolean));

      const examples = EXAMPLE_PATIENTS.map((p) => localEdits[p.id] || p).filter(
        (p) => !existingIds.has(p.id) && !existingEmails.has(p.email.toLowerCase()),
      );
      return [...dbPatients, ...examples].sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    return dbPatients.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async get(id: string): Promise<Patient | null> {
    try {
      const snap = await getDoc(doc(db, 'patients', id));
      if (snap.exists()) {
        const p = this.toPatient(snap.id, snap.data());
        const role = this.getCurrentRole();
        const currentUid = auth.currentUser?.uid;
        // If a midwife attempts to access a patient directly, ensure they own it
        if (role === 'midwife' && currentUid && !this.isMidwifeDemoUser()) {
          const ownerMidwife = p.assignedMidwifeId || p.midwifeId || p.createdBy;
          if (ownerMidwife && ownerMidwife !== currentUid) {
            return null; // Denied: patient belongs to another midwife
          }
        }
        return p;
      }
    } catch {
      // ignore
    }

    const edits = this.getLocalEdits();
    if (edits[id]) return edits[id];

    if (this.isMidwifeDemoUser()) {
      const found = EXAMPLE_PATIENTS.find((p) => p.id === id);
      if (found) return found;
    }

    return null;
  }

  async update(id: string, profile: PatientProfile): Promise<void> {
    const changes: Partial<PatientProfile> = { ...profile };
    delete changes.email;
    try {
      await updateDoc(doc(db, 'patients', id), { ...changes, updatedAt: serverTimestamp() });
    } catch {
      // ignore for example patients or offline
    }

    const current = await this.get(id);
    if (current) {
      const updated: Patient = {
        ...current,
        ...profile,
      };
      this.saveLocalEdit(id, updated);
    }

    this.activityLog.logActivity({
      userName: profile.fullName || current?.fullName || 'Patient',
      userRole: 'patient',
      userId: id,
      activity: `Patient information updated for ${profile.fullName || current?.fullName || id}`,
    }).catch(() => undefined);
  }

  private toPatient(id: string, d: Record<string, unknown>): Patient {
    const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
    const lmp = s('lmp');
    const edd = s('edd');

    let gestationalAge = s('gestationalAge');
    if (!gestationalAge && lmp) {
      const diffMs = Date.now() - new Date(lmp).getTime();
      const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      if (weeks > 0 && weeks < 45) {
        gestationalAge = `${weeks} weeks`;
      }
    }

    return {
      id,
      fullName: s('fullName') || s('displayName'),
      email: s('email'),
      birthDate: s('birthDate') || s('dateOfBirth'),
      contactNumber: s('contactNumber'),
      address: s('address'),
      emergencyContactName: s('emergencyContactName'),
      emergencyContactNumber: s('emergencyContactNumber'),
      bloodType: s('bloodType') || 'O+',
      lmp,
      edd,
      status: (s('status') as PatientStatus) || 'Active',
      riskLevel: (s('riskLevel') as RiskLevel) || 'Low risk',
      gravidaPara: s('gravidaPara') || 'G1P0',
      gestationalAge: gestationalAge || '24 weeks',
      assignedMidwifeId: s('assignedMidwifeId') || s('midwifeId') || s('createdBy') || null,
      midwifeId: s('midwifeId') || s('assignedMidwifeId') || s('createdBy') || null,
      createdBy: s('createdBy') || s('assignedMidwifeId') || s('midwifeId') || null,
    };
  }

  errorMessage(e: unknown): string {
    const code = (e as { code?: string }).code ?? '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not turned on in Firebase Authentication.';
      case 'auth/too-many-requests':
        return 'Too many emails sent. Please wait a few minutes and try again.';
      case 'auth/network-request-failed':
        return 'No connection. Check your internet and try again.';
      case 'permission-denied':
        return "You don't have permission to do this. Check your Firestore rules.";
      default:
        return (e as { message?: string })?.message || 'Something went wrong. Please try again.';
    }
  }
}
