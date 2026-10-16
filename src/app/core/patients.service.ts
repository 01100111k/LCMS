import { Injectable } from '@angular/core';
import { createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db, secondaryAuth } from './firebase';

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
  /**
   * Creates the patient's login + profile, then emails an invitation so the patient
   * sets their own password. The midwife stays signed in, and nobody ever sees a password.
   */
  async register(profile: PatientProfile): Promise<{ id: string; invited: boolean }> {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, profile.email, generatePassword());
    const uid = cred.user.uid;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), { role: 'patient', email: profile.email });
      batch.set(doc(db, 'patients', uid), {
        ...profile,
        status: profile.status || 'Active',
        riskLevel: profile.riskLevel || 'Low risk',
        gravidaPara: profile.gravidaPara || 'G1P0',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid ?? null,
      });
      await batch.commit();
    } catch (e) {
      // Remove the half-created login so the email can be used again.
      await deleteUser(cred.user).catch(() => undefined);
      throw e;
    } finally {
      await signOut(secondaryAuth).catch(() => undefined);
    }

    let invited = true;
    try {
      await this.sendInvite(profile.email);
    } catch {
      invited = false;
    }
    return { id: uid, invited };
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

  async list(): Promise<Patient[]> {
    try {
      const snap = await getDocs(collection(db, 'patients'));
      return snap.docs
        .map((d) => this.toPatient(d.id, d.data()))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    } catch {
      return [];
    }
  }

  async get(id: string): Promise<Patient | null> {
    try {
      const snap = await getDoc(doc(db, 'patients', id));
      if (snap.exists()) return this.toPatient(snap.id, snap.data());
      return null;
    } catch {
      return null;
    }
  }

  async update(id: string, profile: PatientProfile): Promise<void> {
    const changes: Partial<PatientProfile> = { ...profile };
    delete changes.email;
    await updateDoc(doc(db, 'patients', id), { ...changes, updatedAt: serverTimestamp() });
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
      fullName: s('fullName'),
      email: s('email'),
      birthDate: s('birthDate'),
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
    };
  }

  errorMessage(e: unknown): string {
    const code = (e as { code?: string }).code ?? '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not turned on in Firebase Authentication.';
      case 'auth/too-many-requests':
        return 'Too many emails sent. Please wait a few minutes and try again.';
      case 'auth/network-request-failed':
        return 'No connection. Check your internet and try again.';
      case 'permission-denied':
        return "You don't have permission to do this. Check your Firestore rules.";
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}