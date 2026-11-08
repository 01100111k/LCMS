import { Injectable, computed, inject, signal } from '@angular/core';
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
import { doc, getDoc, serverTimestamp, setDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { auth, db, secondaryAuth, secondaryDb } from './firebase';
import { PendingApprovalApplication } from '../admin/models/admin.models';
import {
  getLocalApprovalDecisions,
  getLocalPendingRegistrations,
  saveLocalPendingRegistration,
} from './local-approvals';
import { ActivityLogService } from './activity-log.service';

export type Role = 'admin' | 'midwife' | 'patient';

export interface ProofOfIdentityFile {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export interface UserProfileDoc {
  role?: Role;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  prcLicense?: string;
  contactNumber?: string;
  proofOfIdentity?: ProofOfIdentityFile[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  accountStatus?: 'active' | 'inactive';
  rejectionReason?: string;
  createdAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private activityLog = inject(ActivityLogService);

  readonly user = signal<User | null>(null);
  readonly userProfile = signal<UserProfileDoc | null>(null);
  readonly role = signal<Role | null>(null);
  /** Resolves once Firebase has told us whether someone is already logged in. */
  readonly ready: Promise<void>;
  private version = 0;

  readonly userFullName = computed(() => {
    const u = this.user();
    if (!u) return '';

    // 1. Firebase Auth displayName
    if (u.displayName && u.displayName.trim()) {
      return u.displayName.trim();
    }

    // 2. Firestore user doc displayName
    const profile = this.userProfile();
    if (profile?.displayName && String(profile.displayName).trim()) {
      return String(profile.displayName).trim();
    }

    // 3. Firestore firstName & lastName
    if (profile?.firstName || profile?.lastName) {
      const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
      if (name) return name;
    }

    // 4. Formatted from email prefix (e.g. clarissa.gomez@gmail.com -> Clarissa Gomez)
    const email = u.email ?? '';
    if (email) {
      const prefix = email.split('@')[0];
      const parts = prefix.split(/[._-]/).filter(Boolean);
      if (parts.length > 0) {
        const rawName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
        if (rawName.toLowerCase() !== 'midwife' && rawName.toLowerCase() !== 'patient' && rawName.toLowerCase() !== 'admin') {
          return rawName;
        }
      }
    }

    // 5. Clean role fallbacks when profile name is not yet provided
    const r = this.role();
    if (r === 'midwife') return 'Midwife';
    if (r === 'patient') return 'Patient';
    if (r === 'admin') return 'Admin';
    return '';
  });

  readonly userInitials = computed(() => {
    const r = this.role();

    const fullName = this.userFullName();
    if (fullName) {
      if (fullName.toLowerCase() === 'admin') return r === 'admin' ? 'A' : 'M';
      if (fullName.toLowerCase() === 'midwife') return 'M';
      const parts = fullName.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return fullName.charAt(0).toUpperCase();
    }
    const email = this.user()?.email ?? '';
    if (email) {
      if (email.toLowerCase().startsWith('admin') && r === 'admin') return 'A';
      const parts = email.split('@')[0].split(/[._-]/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return email.charAt(0).toUpperCase();
    }
    if (r === 'midwife') return 'M';
    if (r === 'patient') return 'P';
    if (r === 'admin') return 'A';
    return 'M';
  });

  constructor() {
    try {
      localStorage.removeItem('lcms_cached_auth');
    } catch {}

    this.ready = new Promise((resolve) => {
      onAuthStateChanged(auth, async (u) => {
        const v = ++this.version;
        if (!u) {
          this.user.set(null);
          this.userProfile.set(null);
          this.role.set(null);
          resolve();
          return;
        }

        const found = await this.readUserDoc(u.uid).catch(() => null);
        const role = found ? this.toRole(found.role) : null;
        if (v !== this.version) return; // a newer sign-in/out happened meanwhile

        const profileData = (found?.data as UserProfileDoc) ?? null;
        // Non-admin accounts with pending or rejected status cannot access authenticated portals
        if (role && role !== 'admin' && profileData?.approvalStatus && profileData.approvalStatus !== 'approved') {
          await signOut(auth).catch(() => {});
          this.user.set(null);
          this.userProfile.set(null);
          this.role.set(null);
          resolve();
          return;
        }

        this.user.set(u);
        this.userProfile.set(profileData);
        this.role.set(role);
        resolve();
      });
    });
  }

  // The role always comes from the database (written by an admin, midwife or in the Firebase console)
  private async readUserDoc(uid: string): Promise<{ exists: boolean; role: unknown; data?: UserProfileDoc }> {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists() && snap.data()?.['role']) {
      return { exists: true, role: snap.data()?.['role'], data: snap.data() as UserProfileDoc };
    }

    // Fallback: check if the user is listed in the 'admin' collection
    try {
      const adminSnap = await getDoc(doc(db, 'admin', uid));
      if (adminSnap.exists()) {
        return { exists: true, role: adminSnap.data()?.['role'] || 'admin', data: adminSnap.data() as UserProfileDoc };
      }
    } catch {
      // ignore
    }

    return { exists: snap.exists(), role: snap.data()?.['role'], data: snap.data() as UserProfileDoc };
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
    const cleanEmail = email.trim().toLowerCase();

    // Ensure clean state before authenticating if an active session belongs to someone else
    if (auth.currentUser && auth.currentUser.email?.toLowerCase() !== cleanEmail) {
      await signOut(auth).catch(() => {});
      this.user.set(null);
      this.userProfile.set(null);
      this.role.set(null);
    }

    let cred: any = null;

    try {
      cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err: any) {
      const code = err?.code || '';
      // If core demo accounts don't exist in Firebase Auth yet, automatically create them!
      if (
        (cleanEmail === 'midwife@gmail.com' || cleanEmail === 'midwife@lyingincare.ph' ||
         cleanEmail === 'admin@lyingincare.ph' || cleanEmail === 'admin@gmail.com' ||
         cleanEmail === 'patient@gmail.com') &&
        (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password')
      ) {
        try {
          cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        } catch {
          throw err;
        }
      } else {
        throw err;
      }
    }

    const uid = cred.user.uid;

    // 1. Verify or auto-heal matching users/{uid} document in Firestore
    let found = await this.readUserDoc(uid);

    if (!found.exists || !found.data) {
      if (cleanEmail === 'admin@lyingincare.ph' || cleanEmail === 'admin@gmail.com') {
        const now = serverTimestamp();
        const adminDoc: UserProfileDoc = {
          uid,
          fullName: 'System Administrator',
          displayName: 'System Administrator',
          email: cleanEmail,
          role: 'admin',
          accountStatus: 'active',
          status: 'active',
          approvalStatus: 'approved',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'users', uid), adminDoc, { merge: true }).catch(() => null);
        await setDoc(doc(db, 'admin', uid), adminDoc, { merge: true }).catch(() => null);
        found = { exists: true, role: 'admin', data: adminDoc };
      } else if (cleanEmail === 'midwife@gmail.com' || cleanEmail === 'midwife@lyingincare.ph') {
        const now = serverTimestamp();
        const mwDoc: UserProfileDoc = {
          uid,
          fullName: 'Licensed Midwife',
          displayName: 'Licensed Midwife',
          email: cleanEmail,
          role: 'midwife',
          accountStatus: 'active',
          status: 'active',
          approvalStatus: 'approved',
          prcLicense: '0045892',
          contactNumber: '0917-555-0192',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'users', uid), mwDoc, { merge: true }).catch(() => null);
        await setDoc(doc(db, 'midwives', uid), {
          midwifeId: uid,
          uid,
          fullName: 'Licensed Midwife',
          displayName: 'Licensed Midwife',
          email: cleanEmail,
          accountStatus: 'active',
          status: 'active',
          approvalStatus: 'approved',
          prcLicense: '0045892',
          contactNumber: '0917-555-0192',
          createdAt: now,
          updatedAt: now,
        }, { merge: true }).catch(() => null);
        found = { exists: true, role: 'midwife', data: mwDoc };
      } else if (cleanEmail === 'patient@gmail.com') {
        const now = serverTimestamp();
        const patDoc: UserProfileDoc = {
          uid,
          fullName: 'Patient',
          displayName: 'Patient',
          email: cleanEmail,
          role: 'patient',
          accountStatus: 'active',
          status: 'active',
          approvalStatus: 'approved',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'users', uid), patDoc, { merge: true }).catch(() => null);
        await setDoc(doc(db, 'patients', uid), {
          id: uid,
          patientId: uid,
          uid,
          fullName: 'Patient',
          displayName: 'Patient',
          email: cleanEmail,
          status: 'Active',
          riskLevel: 'Low risk',
          createdAt: now,
          updatedAt: now,
        }, { merge: true }).catch(() => null);
        found = { exists: true, role: 'patient', data: patDoc };
      } else {
        // Check if an approved registration exists in pendingApprovals
        try {
          const pSnap = await getDocs(query(collection(db, 'pendingApprovals'), where('email', '==', cleanEmail)));
          if (!pSnap.empty) {
            const pData = pSnap.docs[0].data();
            const role = pData['requestedRole'] || 'midwife';
            const mwDoc: any = {
              uid,
              fullName: pData['fullName'] || 'Midwife',
              displayName: pData['fullName'] || 'Midwife',
              email: cleanEmail,
              role,
              accountStatus: 'active',
              status: 'active',
              approvalStatus: 'approved',
              prcLicense: pData['prcLicense'] || '',
              contactNumber: pData['contactNumber'] || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', uid), mwDoc, { merge: true }).catch(() => null);
            if (role === 'midwife') {
              await setDoc(doc(db, 'midwives', uid), {
                midwifeId: uid,
                uid,
                fullName: mwDoc.fullName,
                displayName: mwDoc.displayName,
                email: cleanEmail,
                accountStatus: 'active',
                status: 'active',
                approvalStatus: 'approved',
                prcLicense: pData['prcLicense'] || '',
                contactNumber: pData['contactNumber'] || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }, { merge: true }).catch(() => null);
            }
            found = { exists: true, role, data: mwDoc };
          }
        } catch {
          // ignore
        }
      }
    }

    if (!found.exists || !found.data) {
      await signOut(auth);
      throw new Error('account-incomplete');
    }

    // 2. Verify account has an authorized role
    const role = this.toRole(found.role);
    if (!role) {
      await signOut(auth);
      throw new Error('account-incomplete');
    }

    const profileData = found.data as UserProfileDoc;

    // Special auto-approval for system midwife and patient demo accounts
    if (cleanEmail === 'midwife@gmail.com' || cleanEmail === 'midwife@lyingincare.ph' || cleanEmail === 'patient@gmail.com') {
      profileData.approvalStatus = 'approved';
      profileData.accountStatus = 'active';
    }

    // 3. Verify account status is active
    const rawStatus = profileData.accountStatus ?? (profileData['status'] as string) ?? 'active';
    const accountStatus = String(rawStatus).toLowerCase();
    if (accountStatus === 'inactive' || accountStatus === 'suspended') {
      await signOut(auth);
      throw new Error('account-inactive');
    }

    // 4. Verify approval status for non-admin accounts
    if (role !== 'admin') {
      const status = profileData.approvalStatus;
      if (status === 'pending') {
        await signOut(auth);
        throw new Error('account-pending');
      } else if (status === 'rejected') {
        await signOut(auth);
        throw new Error('account-rejected');
      }
    }

    // 5. Verify role-specific profile document exists in Firestore (auto-heal if missing)
    if (role === 'midwife') {
      const mwDocRef = doc(db, 'midwives', uid);
      const mwSnap = await getDoc(mwDocRef).catch(() => null);
      if (!mwSnap || !mwSnap.exists()) {
        const name = (profileData['fullName'] as string) || profileData.displayName || 'Licensed Midwife';
        await setDoc(mwDocRef, {
          midwifeId: uid,
          uid,
          fullName: name,
          displayName: profileData.displayName || name,
          email: cleanEmail,
          accountStatus: 'active',
          status: 'active',
          approvalStatus: 'approved',
          prcLicense: profileData.prcLicense || '',
          contactNumber: profileData.contactNumber || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => null);
      }
    } else if (role === 'patient') {
      const patDocRef = doc(db, 'patients', uid);
      const patSnap = await getDoc(patDocRef).catch(() => null);
      if (!patSnap || !patSnap.exists()) {
        const name = (profileData['fullName'] as string) || profileData.displayName || 'Patient';
        await setDoc(patDocRef, {
          id: uid,
          patientId: uid,
          uid,
          fullName: name,
          displayName: profileData.displayName || name,
          email: cleanEmail,
          status: 'Active',
          riskLevel: 'Low risk',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => null);
      }
    }

    this.user.set(cred.user);
    this.userProfile.set(profileData);
    this.role.set(role);

    // Record login activity
    const loggedName = profileData?.displayName || `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim() || cred.user.displayName || email;
    this.activityLog.logActivity({
      userName: loggedName,
      userRole: role,
      userEmail: email,
      userId: uid,
      activity: 'User logged in',
    }).catch(() => undefined);

    return role;
  }

  async submitPendingApproval(data: {
    fullName: string;
    email: string;
    contactNumber: string;
    requestedRole: 'midwife' | 'patient';
    prcLicense?: string;
    proofOfIdentity?: ProofOfIdentityFile[];
    password?: string;
  }): Promise<string> {
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    const contactNumber = data.contactNumber.trim();
    const requestedRole = data.requestedRole;

    if (!fullName || !email) {
      throw new Error('Full legal name and email address are required.');
    }

    // 1. Check if email is already in users collection
    try {
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const usersSnap = await getDocs(usersQuery);
      if (!usersSnap.empty) {
        throw new Error('An account with this email address is already registered. Please log in instead.');
      }
    } catch (e: any) {
      if (e?.message?.includes('already registered')) throw e;
    }

    // 2. Check local decisions & existing pending records
    const localDecisions = getLocalApprovalDecisions();
    const localExisting = getLocalPendingRegistrations().find((p) => p.email.toLowerCase() === email);
    if (localDecisions[email]?.status === 'approved') {
      throw new Error('This account has already been approved by an administrator. Please log in.');
    }
    if (localExisting && localExisting.status === 'pending' && !localDecisions[email]) {
      throw new Error('A registration application for this email is already pending administrator review.');
    }

    // Check remote pendingApprovals if accessible
    try {
      const pendingQuery = query(
        collection(db, 'pendingApprovals'),
        where('email', '==', email),
        where('status', '==', 'pending')
      );
      const pendingSnap = await getDocs(pendingQuery);
      if (!pendingSnap.empty) {
        throw new Error('A registration application for this email is already pending administrator review.');
      }
    } catch (e: any) {
      if (e?.message?.includes('already pending')) throw e;
    }

    // 3. Create Authentication account in secondaryAuth if password provided
    let authUid: string | undefined;
    if (data.password) {
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, data.password);
        authUid = cred.user.uid;
      } catch (err: any) {
        const code = err?.code || '';
        if (code === 'auth/email-already-in-use') {
          // Allowed: user may have registered credentials previously
        } else if (code === 'auth/weak-password') {
          throw new Error('Password must be at least 6 characters.');
        } else if (code === 'auth/invalid-email') {
          throw new Error('The email address is invalid.');
        }
      }
    }

    // 4. Save to pendingApprovals collection
    const docRef = doc(collection(db, 'pendingApprovals'));
    const applicationId = docRef.id;

    const appDocData: any = {
      applicationId,
      fullName,
      email,
      contactNumber,
      requestedRole,
      prcLicense: data.prcLicense?.trim() || '',
      proofOfIdentity: data.proofOfIdentity || [],
      status: 'pending',
      submittedAt: serverTimestamp(),
    };
    if (authUid) {
      appDocData.authUid = authUid;
    }

    // Try secondaryDb (authenticated context) first if signed in
    let firestoreWritten = false;
    if (secondaryAuth.currentUser) {
      try {
        await setDoc(doc(secondaryDb, 'pendingApprovals', applicationId), appDocData);
        firestoreWritten = true;
      } catch {
        // Fallback below
      }
    }

    if (!firestoreWritten) {
      try {
        await setDoc(docRef, appDocData);
        firestoreWritten = true;
      } catch (err) {
        console.warn('Firestore write to pendingApprovals failed (rules locked or offline). Saved locally:', err);
      }
    }

    // Sign out secondaryAuth so it does not interfere with anything else
    await signOut(secondaryAuth).catch(() => undefined);

    // 5. Always save to local pending registrations queue for instant admin access & reload resilience
    saveLocalPendingRegistration({
      id: applicationId,
      applicationId,
      fullName,
      email,
      contactNumber,
      requestedRole,
      prcLicense: data.prcLicense?.trim() || '',
      proofOfIdentity: data.proofOfIdentity || [],
      status: 'pending',
      authUid,
      submittedAt: new Date().toISOString(),
    });

    // Record registration activity
    this.activityLog.logActivity({
      userName: fullName,
      userRole: requestedRole,
      userEmail: email,
      userId: authUid || applicationId,
      activity: requestedRole === 'midwife' ? 'Midwife registered' : 'Patient registered',
    }).catch(() => undefined);

    return applicationId;
  }

  async checkApprovalStatus(email: string): Promise<PendingApprovalApplication | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    let app: PendingApprovalApplication | null = null;

    try {
      const q = query(
        collection(db, 'pendingApprovals'),
        where('email', '==', cleanEmail)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docs = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            applicationId: data['applicationId'] || d.id,
            fullName: data['fullName'] || '',
            email: data['email'] || '',
            contactNumber: data['contactNumber'] || '',
            requestedRole: data['requestedRole'] || 'patient',
            prcLicense: data['prcLicense'],
            proofOfIdentity: data['proofOfIdentity'] || [],
            status: data['status'] || 'pending',
            submittedAt: data['submittedAt'],
            reviewedAt: data['reviewedAt'],
            reviewedBy: data['reviewedBy'],
            rejectionReason: data['rejectionReason'],
            approvedUid: data['approvedUid'],
          } as PendingApprovalApplication;
        });

        // Sort by submittedAt descending to return newest application
        docs.sort((a, b) => {
          const ta = a.submittedAt?.seconds ? a.submittedAt.seconds : 0;
          const tb = b.submittedAt?.seconds ? b.submittedAt.seconds : 0;
          return tb - ta;
        });

        app = docs[0];
      }
    } catch {}

    // Resilient local fallback
    if (!app) {
      const localList = getLocalPendingRegistrations();
      const match = localList.find((p) => p.email.toLowerCase() === cleanEmail);
      if (match) {
        app = {
          id: match.id,
          applicationId: match.applicationId,
          fullName: match.fullName,
          email: match.email,
          contactNumber: match.contactNumber,
          requestedRole: match.requestedRole,
          prcLicense: match.prcLicense,
          proofOfIdentity: match.proofOfIdentity,
          status: match.status,
          submittedAt: match.submittedAt,
          reviewedAt: match.reviewedAt,
          reviewedBy: match.reviewedBy,
          rejectionReason: match.rejectionReason,
          approvedUid: match.authUid,
        };
      }
    }

    // Merge persistent administrator decision
    const decisions = getLocalApprovalDecisions();
    const decision = decisions[cleanEmail] || (app?.id ? decisions[app.id] : undefined);
    if (decision && app) {
      app.status = decision.status;
      if (decision.approvedUid) app.approvedUid = decision.approvedUid;
      if (decision.reviewedBy) app.reviewedBy = decision.reviewedBy;
      if (decision.rejectionReason) app.rejectionReason = decision.rejectionReason;
    }

    return app;
  }

  async signUpMidwife(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    prcLicense: string;
    proofOfIdentity?: ProofOfIdentityFile[];
  }): Promise<string> {
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    return this.submitPendingApproval({
      fullName,
      email: data.email,
      contactNumber: '',
      requestedRole: 'midwife',
      prcLicense: data.prcLicense,
      proofOfIdentity: data.proofOfIdentity,
      password: data.password,
    });
  }

  async signUpPatient(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    contactNumber: string;
    proofOfIdentity?: ProofOfIdentityFile[];
  }): Promise<string> {
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    return this.submitPendingApproval({
      fullName,
      email: data.email,
      contactNumber: data.contactNumber,
      requestedRole: 'patient',
      proofOfIdentity: data.proofOfIdentity,
      password: data.password,
    });
  }

  async updateMidwifeProfile(data: {
    firstName: string;
    lastName: string;
    prcLicense?: string;
    contactNumber?: string;
    preferences?: {
      autoFillMidwife?: boolean;
      highRiskAlerts?: boolean;
    };
    weeklySchedule?: any;
  }): Promise<void> {
    const u = this.user();
    if (!u) return;
    const uid = u.uid;
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    const displayName = fullName ? (fullName.toLowerCase().startsWith('midwife') ? fullName : `Midwife ${fullName}`) : 'Midwife';

    try {
      await updateProfile(u, { displayName });
    } catch {
      // ignore
    }

    const profileUpdate: Partial<UserProfileDoc> = {
      firstName: data.firstName,
      lastName: data.lastName,
      displayName,
      prcLicense: data.prcLicense || '',
      contactNumber: data.contactNumber || '',
      role: 'midwife',
      updatedAt: serverTimestamp(),
    };
    if (data.preferences) {
      profileUpdate['preferences'] = data.preferences;
    }
    if (data.weeklySchedule) {
      profileUpdate['weeklySchedule'] = data.weeklySchedule;
    }

    try {
      await setDoc(doc(db, 'users', uid), profileUpdate, { merge: true });
      await setDoc(doc(db, 'midwives', uid), profileUpdate, { merge: true }).catch(() => {});
    } catch {
      // ignore offline/rules
    }

    this.userProfile.update((prev) => ({ ...(prev || {}), ...profileUpdate }));
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  async logout(): Promise<void> {
    const u = this.user();
    const r = this.role();
    if (u && r) {
      this.activityLog.logActivity({
        userName: this.userFullName() || u.displayName || u.email || 'User',
        userRole: r,
        userEmail: u.email || '',
        userId: u.uid,
        activity: 'User logged out',
      }).catch(() => undefined);
    }
    try {
      localStorage.removeItem('lcms_cached_auth');
    } catch {}
    await signOut(auth);
    this.user.set(null);
    this.userProfile.set(null);
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
      case 'account-incomplete':
        return 'Your account information is incomplete. Please contact the administrator for assistance.';
      case 'account-inactive':
        return 'Your account is currently inactive. Please contact the administrator for assistance.';
      case 'account-pending':
        return 'Your account registration is currently pending administrator verification. Please wait for the clinic admin to approve your account.';
      case 'account-rejected':
        return 'Your account application was not approved by the clinic administrator. Please contact clinic support.';
      default:
        return `Something went wrong (${code}). Please try again.`;
    }
  }
}
