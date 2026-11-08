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
import { getLocalPendingRegistrations } from './local-approvals';

export type PatientStatus = 'Active' | 'Postpartum' | 'Completed' | 'Inactive';
export type RiskLevel = 'Low risk' | 'Medium risk' | 'High risk';
export type ExistingPatientStatus = 'available' | 'already-assigned-to-you' | 'assigned-to-other';

export interface ExistingPatientSearchResult {
  uid: string;
  fullName: string;
  email: string;
  contactNumber?: string;
  status: ExistingPatientStatus;
  currentMidwifeId?: string | null;
  applicationId?: string | null;
  alreadyInFirestorePatientDoc?: boolean;
  birthDate?: string;
  address?: string;
  bloodType?: string;
}

export interface PatientProfile {
  fullName: string;
  email: string;
  birthDate: string; // YYYY-MM-DD
  contactNumber: string;
  address: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  emergencyContactRelationship?: string;
  bloodType: string;
  lmp: string; // last menstrual period, YYYY-MM-DD
  edd: string; // expected due date, YYYY-MM-DD
  status?: PatientStatus;
  riskLevel?: RiskLevel;
  gravidaPara?: string;
  gestationalAge?: string;
  medicalHistory?: string;
  registrationDate?: string;
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
   * Automatically sets the logged-in Midwife's UID as assignedMidwifeId, midwifeId, and createdBy.
   */
  async register(profile: PatientProfile, initialPassword?: string): Promise<{ id: string; invited: boolean }> {
    const email = (profile.email || '').trim().toLowerCase();
    const fullName = (profile.fullName || '').trim();

    if (!fullName) {
      throw new Error('Patient full legal name is required.');
    }

    const midwifeUid = profile.assignedMidwifeId || profile.midwifeId || auth.currentUser?.uid || this.auth.user()?.uid || null;
    const nowIso = new Date().toISOString().split('T')[0];

    // Dynamically calculate gestational age from LMP if available
    let gestationalAge = profile.gestationalAge || '';
    if (!gestationalAge && profile.lmp) {
      const diffMs = Date.now() - new Date(profile.lmp).getTime();
      const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      if (weeks >= 0 && weeks <= 45) {
        gestationalAge = `${weeks} weeks`;
      }
    }
    if (!gestationalAge) {
      gestationalAge = 'Not recorded';
    }

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
          address: profile.address || '',
          birthDate: profile.birthDate || '',
          bloodType: profile.bloodType || 'O+',
          assignedMidwifeId: midwifeUid,
          midwifeId: midwifeUid,
          createdBy: midwifeUid,
          registrationDate: profile.registrationDate || nowIso,
          createdAt: serverTimestamp(),
          registeredAt: serverTimestamp(),
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
          emergencyContactRelationship: profile.emergencyContactRelationship || '',
          bloodType: profile.bloodType || 'O+',
          lmp: profile.lmp || '',
          edd: profile.edd || '',
          status: profile.status || 'Active',
          riskLevel: profile.riskLevel || 'Low risk',
          gravidaPara: profile.gravidaPara || 'G1P0',
          gestationalAge,
          medicalHistory: profile.medicalHistory || '',
          registrationDate: profile.registrationDate || nowIso,
          assignedMidwifeId: midwifeUid,
          midwifeId: midwifeUid,
          createdBy: midwifeUid,
          createdAt: serverTimestamp(),
          registeredAt: serverTimestamp(),
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
        targetRecordId: uid,
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
        uid: patientId,
        fullName,
        displayName: fullName,
        email: '',
        birthDate: profile.birthDate || '',
        dateOfBirth: profile.birthDate || '',
        contactNumber: profile.contactNumber || '',
        address: profile.address || '',
        emergencyContactName: profile.emergencyContactName || '',
        emergencyContactNumber: profile.emergencyContactNumber || '',
        emergencyContactRelationship: profile.emergencyContactRelationship || '',
        bloodType: profile.bloodType || 'O+',
        lmp: profile.lmp || '',
        edd: profile.edd || '',
        status: profile.status || 'Active',
        riskLevel: profile.riskLevel || 'Low risk',
        gravidaPara: profile.gravidaPara || 'G1P0',
        gestationalAge,
        medicalHistory: profile.medicalHistory || '',
        registrationDate: profile.registrationDate || nowIso,
        assignedMidwifeId: midwifeUid,
        midwifeId: midwifeUid,
        createdBy: midwifeUid,
        createdAt: serverTimestamp(),
        registeredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      this.activityLog.logActivity({
        userName: fullName,
        userRole: 'patient',
        userEmail: '',
        targetRecordId: patientId,
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

  saveLocalEdit(id: string, updated: Patient): void {
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
    return false;
  }

  getCurrentRole(): string {
    const r = this.auth.role();
    if (r) return r;
    const email = auth.currentUser?.email?.toLowerCase() || '';
    if (email.startsWith('admin@')) return 'admin';
    return '';
  }

  async list(): Promise<Patient[]> {
    const currentUid = auth.currentUser?.uid || this.auth.user()?.uid;
    const role = this.getCurrentRole();
    let dbPatients: Patient[] = [];

    try {
      if (role === 'admin') {
        // Admin sees all patients across the entire clinic
        const snap = await getDocs(collection(db, 'patients'));
        dbPatients = snap.docs.map((d) => this.toPatient(d.id, d.data()));
      } else if (currentUid) {
        // Midwife: query patients assigned to this midwife's Firebase UID
        const patientMap = new Map<string, Patient>();

        try {
          const q1 = query(collection(db, 'patients'), where('assignedMidwifeId', '==', currentUid));
          const snap1 = await getDocs(q1);
          snap1.docs.forEach((d) => patientMap.set(d.id, this.toPatient(d.id, d.data())));
        } catch (e1) {
          console.warn('PatientsService.list q1 error:', e1);
        }

        try {
          const q2 = query(collection(db, 'patients'), where('midwifeId', '==', currentUid));
          const snap2 = await getDocs(q2);
          snap2.docs.forEach((d) => {
            if (!patientMap.has(d.id)) {
              patientMap.set(d.id, this.toPatient(d.id, d.data()));
            }
          });
        } catch {
          // ignore index errors
        }

        dbPatients = Array.from(patientMap.values());
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
      await setDoc(
        doc(db, 'patients', id),
        {
          ...changes,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Also sync user document if applicable
      const userUpdates: any = { updatedAt: serverTimestamp() };
      if (changes.fullName) {
        userUpdates.fullName = changes.fullName;
        userUpdates.displayName = changes.fullName;
      }
      if (changes.contactNumber) {
        userUpdates.contactNumber = changes.contactNumber;
      }
      if (Object.keys(userUpdates).length > 1) {
        await setDoc(doc(db, 'users', id), userUpdates, { merge: true }).catch(() => {});
      }
    } catch (err) {
      if (!this.isMidwifeDemoUser()) {
        throw err;
      }
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
      userRole: this.getCurrentRole() === 'admin' ? 'admin' : this.getCurrentRole() === 'midwife' ? 'midwife' : 'patient',
      targetRecordId: id,
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
      emergencyContactRelationship: s('emergencyContactRelationship'),
      bloodType: s('bloodType') || 'O+',
      lmp,
      edd,
      status: (s('status') as PatientStatus) || 'Active',
      riskLevel: (s('riskLevel') as RiskLevel) || 'Low risk',
      gravidaPara: s('gravidaPara') || 'G1P0',
      gestationalAge: gestationalAge || 'Not recorded',
      medicalHistory: s('medicalHistory'),
      registrationDate: s('registrationDate'),
      assignedMidwifeId: s('assignedMidwifeId') || s('midwifeId') || s('createdBy') || null,
      midwifeId: s('midwifeId') || s('assignedMidwifeId') || s('createdBy') || null,
      createdBy: s('createdBy') || s('assignedMidwifeId') || s('midwifeId') || null,
    };
  }

  /**
   * Searches for an existing patient account registered through the Patient Sign Up portal.
   * Enforces role security: strictly prohibits searching for or adding Admin or Midwife accounts.
   */
  async findExistingPatientByEmail(email: string): Promise<ExistingPatientSearchResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    // Prohibit Admin accounts
    if (
      cleanEmail === 'admin@lyingincare.ph' ||
      cleanEmail === 'admin@gmail.com' ||
      cleanEmail.startsWith('admin@')
    ) {
      throw new Error('This email belongs to an Administrator account and cannot be added as a patient.');
    }

    // Prohibit Midwife accounts in midwives collection
    try {
      const mwQuery = query(collection(db, 'midwives'), where('email', '==', cleanEmail));
      const mwSnap = await getDocs(mwQuery);
      if (!mwSnap.empty) {
        throw new Error('This email belongs to a registered Midwife and cannot be added as a patient.');
      }
    } catch (e: any) {
      if (e?.message?.includes('Midwife') || e?.message?.includes('Administrator')) throw e;
    }

    const currentMidwifeUid = auth.currentUser?.uid || this.auth.user()?.uid;

    let userDocData: any = null;
    let userDocId: string | null = null;
    try {
      const uQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const uSnap = await getDocs(uQuery);
      for (const d of uSnap.docs) {
        const data = d.data();
        if (data['role'] === 'admin') {
          throw new Error('This email belongs to an Administrator account and cannot be added as a patient.');
        }
        if (data['role'] === 'midwife') {
          throw new Error('This email belongs to a Midwife account and cannot be added as a patient.');
        }
        if (data['role'] === 'patient') {
          userDocData = data;
          userDocId = d.id;
          break;
        }
      }
    } catch (e: any) {
      if (e?.message?.includes('cannot be added as a patient')) throw e;
    }

    let patientDocData: any = null;
    let patientDocId: string | null = null;
    try {
      const pQuery = query(collection(db, 'patients'), where('email', '==', cleanEmail));
      const pSnap = await getDocs(pQuery);
      if (!pSnap.empty) {
        patientDocData = pSnap.docs[0].data();
        patientDocId = pSnap.docs[0].id;
      }
    } catch {
      // Ignore if restricted
    }

    let pendingDocData: any = null;
    let pendingDocId: string | null = null;
    try {
      const pendQuery = query(collection(db, 'pendingApprovals'), where('email', '==', cleanEmail));
      const pendSnap = await getDocs(pendQuery);
      for (const d of pendSnap.docs) {
        const data = d.data();
        if (data['requestedRole'] === 'midwife') {
          throw new Error('This email belongs to a Midwife registration application and cannot be added as a patient.');
        }
        if (data['requestedRole'] === 'patient' || !data['requestedRole']) {
          pendingDocData = data;
          pendingDocId = d.id;
          break;
        }
      }
    } catch (e: any) {
      if (e?.message?.includes('cannot be added as a patient')) throw e;
    }

    // Local pending fallback if offline
    if (!userDocData && !patientDocData && !pendingDocData) {
      const localList = getLocalPendingRegistrations();
      const match = localList.find((p) => p.email.toLowerCase() === cleanEmail);
      if (match) {
        if (match.requestedRole === 'midwife') {
          throw new Error('This email belongs to a Midwife registration application and cannot be added as a patient.');
        }
        pendingDocData = match;
        pendingDocId = match.id || match.applicationId;
      }
    }

    // Check if account exists at all
    if (!userDocData && !patientDocData && !pendingDocData) {
      throw new Error('No registered patient account found with this email address. Please verify the email or register them as a new patient.');
    }

    const uid =
      userDocId ||
      patientDocId ||
      pendingDocData?.authUid ||
      pendingDocData?.id ||
      pendingDocId ||
      '';

    const fullName =
      userDocData?.fullName ||
      userDocData?.displayName ||
      patientDocData?.fullName ||
      patientDocData?.displayName ||
      pendingDocData?.fullName ||
      'Patient';

    const contactNumber =
      userDocData?.contactNumber ||
      patientDocData?.contactNumber ||
      pendingDocData?.contactNumber ||
      '';

    const assignedMidwifeId =
      patientDocData?.assignedMidwifeId ||
      patientDocData?.midwifeId ||
      userDocData?.assignedMidwifeId ||
      userDocData?.midwifeId ||
      pendingDocData?.assignedMidwifeId ||
      pendingDocData?.midwifeId ||
      null;

    let status: ExistingPatientStatus = 'available';
    if (assignedMidwifeId) {
      if (currentMidwifeUid && assignedMidwifeId === currentMidwifeUid) {
        status = 'already-assigned-to-you';
      } else {
        status = 'assigned-to-other';
      }
    }

    // Double check against current midwife's patient list
    if (status === 'available') {
      try {
        const currentList = await this.list();
        if (currentList.some((p) => (p.email && p.email.toLowerCase() === cleanEmail) || p.id === uid)) {
          status = 'already-assigned-to-you';
        }
      } catch {
        // ignore
      }
    }

    return {
      uid,
      fullName,
      email: cleanEmail,
      contactNumber,
      status,
      currentMidwifeId: assignedMidwifeId,
      applicationId: pendingDocId,
      alreadyInFirestorePatientDoc: !!patientDocId,
      birthDate: patientDocData?.birthDate || userDocData?.birthDate || '',
      address: patientDocData?.address || userDocData?.address || '',
      bloodType: patientDocData?.bloodType || userDocData?.bloodType || 'O+',
    };
  }

  /**
   * Links an existing registered patient to the currently logged-in Midwife.
   * Updates existing users/{uid} and patients/{uid} documents without creating duplicates.
   */
  async linkExistingPatient(result: ExistingPatientSearchResult): Promise<void> {
    const currentMidwifeUid = auth.currentUser?.uid || this.auth.user()?.uid;
    if (!currentMidwifeUid) {
      throw new Error('You must be signed in as a midwife to add patients.');
    }

    if (result.status !== 'available') {
      if (result.status === 'already-assigned-to-you') {
        throw new Error('This patient is already in your patient list.');
      }
      throw new Error('This patient is currently assigned to another midwife. To transfer this patient, please contact an Administrator.');
    }

    const uid = result.uid;
    const cleanEmail = result.email.trim().toLowerCase();
    const fullName = result.fullName.trim();
    const nowIso = new Date().toISOString().split('T')[0];

    const batch = writeBatch(db);

    // 1. Update / create users/{uid} document
    const userRef = doc(db, 'users', uid);
    batch.set(
      userRef,
      {
        uid,
        email: cleanEmail,
        fullName,
        displayName: fullName,
        role: 'patient',
        accountStatus: 'active',
        approvalStatus: 'approved',
        assignedMidwifeId: currentMidwifeUid,
        midwifeId: currentMidwifeUid,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // 2. Update / create patients/{uid} document
    const patRef = doc(db, 'patients', uid);
    const patData: any = {
      id: uid,
      patientId: uid,
      uid,
      fullName,
      displayName: fullName,
      email: cleanEmail,
      contactNumber: result.contactNumber || '',
      status: 'Active',
      riskLevel: 'Low risk',
      assignedMidwifeId: currentMidwifeUid,
      midwifeId: currentMidwifeUid,
      createdBy: currentMidwifeUid,
      updatedAt: serverTimestamp(),
    };
    if (result.birthDate) patData.birthDate = result.birthDate;
    if (result.address) patData.address = result.address;
    if (result.bloodType) patData.bloodType = result.bloodType;
    if (!result.alreadyInFirestorePatientDoc) {
      patData.registrationDate = nowIso;
      patData.createdAt = serverTimestamp();
      patData.gestationalAge = 'Not recorded';
      patData.gravidaPara = 'G1P0';
    }

    batch.set(patRef, patData, { merge: true });

    // 3. Update pendingApprovals document if present
    if (result.applicationId) {
      try {
        const pendRef = doc(db, 'pendingApprovals', result.applicationId);
        batch.set(
          pendRef,
          {
            status: 'approved',
            approvedUid: uid,
            assignedMidwifeId: currentMidwifeUid,
            midwifeId: currentMidwifeUid,
            reviewedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch {
        // ignore
      }
    }

    await batch.commit();

    // Log the link activity
    this.activityLog.logActivity({
      userName: fullName,
      userRole: 'patient',
      userEmail: cleanEmail,
      targetRecordId: uid,
      activity: `Existing patient linked to midwife care list: ${fullName}`,
    }).catch(() => undefined);
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
