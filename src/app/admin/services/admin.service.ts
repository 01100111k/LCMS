import { Injectable, computed, inject, signal } from '@angular/core';
import { createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { AuthService, Role } from '../../core/auth.service';
import { auth, db, secondaryApp, secondaryAuth, secondaryDb } from '../../core/firebase';
import { Patient, PatientsService, PatientProfile, PatientStatus, RiskLevel } from '../../core/patients.service';
import { AccountIntegrityItem, ActivityLog, ArchiveRecord, FacilitySettings, PendingApprovalApplication, SystemUser, parseTimestamp } from '../models/admin.models';
import { ActivityLogService } from '../../core/activity-log.service';

export const DEFAULT_MIDWIVES: SystemUser[] = [
  {
    id: 'mw-1',
    email: 'maria.santos@gmail.com',
    displayName: 'Midwife Maria Santos, RM',
    role: 'midwife',
    prcLicense: '0045892',
    contactNumber: '0917-555-0192',
    approvalStatus: 'approved',
    status: 'active',
  },
  {
    id: 'mw-2',
    email: 'joy.cruz@gmail.com',
    displayName: 'Midwife Joy Cruz, RM',
    role: 'midwife',
    prcLicense: '0048120',
    contactNumber: '0918-555-0341',
    approvalStatus: 'approved',
    status: 'active',
  },
  {
    id: 'mw-3',
    email: 'elena.bautista@gmail.com',
    displayName: 'Midwife Elena Bautista, RM',
    role: 'midwife',
    prcLicense: '0039211',
    contactNumber: '0922-555-0819',
    approvalStatus: 'approved',
    status: 'active',
  },
  {
    id: 'mw-4',
    email: 'corazon.ramos@gmail.com',
    displayName: 'Midwife Corazon Ramos, RM',
    role: 'midwife',
    prcLicense: '0041280',
    contactNumber: '0919-555-0928',
    approvalStatus: 'approved',
    status: 'active',
  },
];

export const DEFAULT_PENDING_USERS: SystemUser[] = [
  {
    id: 'pending-mk-reyes',
    displayName: 'Maria Kristina Reyes, RM',
    email: 'kristina.reyes@gmail.com',
    role: 'midwife',
    prcLicense: '0051284',
    contactNumber: '0917-889-4321',
    approvalStatus: 'pending',
    status: 'active',
    proofOfIdentity: [
      {
        name: 'PRC_Midwife_License_Reyes.jpg',
        type: 'image/jpeg',
        dataUrl: '/images/midwife-portrait.jpg',
        size: 245000,
      },
      {
        name: 'Certificate_Board_Rating.pdf',
        type: 'application/pdf',
        dataUrl: '/images/midwife-portrait.jpg',
        size: 180000,
      },
    ],
  },
];

export type { LocalApprovalRecord, LocalPendingRegistration } from '../../core/local-approvals';
export {
  LOCAL_APPROVALS_KEY,
  getLocalApprovalDecisions,
  saveLocalApprovalDecision,
  LOCAL_PENDINGS_KEY,
  getLocalPendingRegistrations,
  saveLocalPendingRegistration,
} from '../../core/local-approvals';
import type { LocalApprovalRecord, LocalPendingRegistration } from '../../core/local-approvals';
import {
  LOCAL_APPROVALS_KEY,
  getLocalApprovalDecisions,
  saveLocalApprovalDecision,
  getLocalPendingRegistrations,
  saveLocalPendingRegistration,
} from '../../core/local-approvals';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private auth = inject(AuthService);
  private patientsSvc = inject(PatientsService);
  private activityLogSvc = inject(ActivityLogService);

  readonly users = signal<SystemUser[]>([]);
  readonly patients = signal<Patient[]>([]);
  readonly pendingApprovals = signal<PendingApprovalApplication[]>([]);
  readonly archives = signal<ArchiveRecord[]>([
    {
      id: 'arch-1',
      originalId: 'pat-arch-1',
      name: 'Diana Rose Aquino',
      category: 'patient',
      identifier: 'diana.aquino@gmail.com',
      archivedAt: 'Oct 24, 2026',
      reason: 'Postpartum care completed & discharged in good health',
      archivedBy: 'System Administrator',
      data: { bloodType: 'B+', gravidaPara: 'G2P2', contactNumber: '0917-331-4482' },
    },
    {
      id: 'arch-2',
      originalId: 'mw-arch-1',
      name: 'Midwife Teresa Morales, RM',
      category: 'midwife',
      identifier: 'PRC #0031849',
      archivedAt: 'Sep 15, 2026',
      reason: 'Relocated to overseas maternity clinic',
      archivedBy: 'System Administrator',
      data: { email: 'teresa.morales@gmail.com', contactNumber: '0918-222-9011' },
    },
  ]);

  readonly facilitySettings = signal<FacilitySettings>({
    facilityName: 'Lying-In Care Birthing Center & Maternity Clinic',
    licenseNumber: 'DOH-X-2026-0841',
    contactNumber: '0917-882-9901',
    emergencyHotline: '088-567-1234',
    address: 'National Highway, Brgy. Poblacion 2, Villanueva, Misamis Oriental',
    operatingHours: '24 Hours Daily / 7 Days a Week (Walk-ins & Emergencies Welcome)',
    referralHospital: 'Northern Mindanao Medical Center (NMMC) / Misamis Oriental Provincial Hospital',
    autoApproveVerifiedMidwives: false,
    emailAlertsEnabled: true,
  });

  readonly activityLogs = signal<ActivityLog[]>([
    {
      id: 'log-1',
      action: 'Verified PRC credential and approved midwife account for Midwife Maria Santos',
      actor: 'System Administrator',
      actorRole: 'admin',
      target: 'maria.santos@gmail.com',
      timestamp: 'Today at 08:30 AM',
      type: 'approval',
    },
    {
      id: 'log-2',
      action: 'Logged into Admin Dashboard and inspected facility registrations',
      actor: 'System Administrator',
      actorRole: 'admin',
      timestamp: 'Today at 08:15 AM',
      type: 'system',
    },
    {
      id: 'log-3',
      action: 'Updated facility referral hospital to Rizal Provincial General Hospital',
      actor: 'System Administrator',
      actorRole: 'admin',
      timestamp: 'Yesterday at 04:45 PM',
      type: 'settings',
    },
    {
      id: 'log-4',
      action: 'Archived discharged postpartum patient record: Diana Rose Aquino',
      actor: 'System Administrator',
      actorRole: 'admin',
      timestamp: 'Oct 24, 2026',
      type: 'archive',
    },
  ]);

  readonly loading = signal(false);
  readonly feedback = signal('');
  readonly feedbackError = signal(false);

  // Identity computed
  readonly adminDisplayName = computed(() => {
    const profile = this.auth.userProfile();
    let name = profile?.displayName ? String(profile.displayName).trim() : '';
    if (!name && (profile?.firstName || profile?.lastName)) {
      name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    }
    if (!name) {
      const authName = this.auth.userFullName();
      if (authName && authName !== 'Admin' && authName !== 'Midwife' && authName !== 'Patient') {
        name = authName;
      }
    }
    if (!name) {
      const email = this.auth.user()?.email;
      if (email) {
        const prefix = email.split('@')[0];
        name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }
    }
    // In admin portal, sanitize any "Midwife" / "Midwife Admin" labels to "Admin"
    if (!name || name.toLowerCase().includes('midwife')) {
      return 'Admin';
    }
    return name;
  });

  readonly adminInitial = computed(() => 'A');

  // Key Counts
  readonly pendingCount = computed(() => {
    return this.pendingApprovals().filter((u) => u.status === 'pending').length;
  });

  readonly midwifeCount = computed(() => {
    return this.users().filter((u) => u.role === 'midwife' && u.approvalStatus !== 'rejected').length;
  });

  readonly patientCount = computed(() => {
    return this.patients().length;
  });

  readonly archiveCount = computed(() => {
    return this.archives().length;
  });

  constructor() {
    this.initDefaultData();
    this.loadAll();
  }

  private initDefaultData(): void {
    const localDecisions = getLocalApprovalDecisions();

    const patientUsers: SystemUser[] = (this.patients() || []).map((p) => ({
      id: p.id,
      displayName: p.fullName,
      email: p.email,
      role: 'patient' as Role,
      contactNumber: p.contactNumber,
      approvalStatus: 'approved' as const,
      status: 'active' as const,
    }));

    const adminUser: SystemUser = {
      id: 'admin-root',
      displayName: 'Administrator',
      email: 'admin@lyingincare.ph',
      role: 'admin',
      contactNumber: '0917-882-9901',
      approvalStatus: 'approved',
      status: 'active',
    };

    const initialPendingUsers: SystemUser[] = DEFAULT_PENDING_USERS.map((pu) => {
      const email = pu.email.toLowerCase();
      const dec = localDecisions[email] || localDecisions[pu.id];
      if (dec) {
        return {
          ...pu,
          id: dec.approvedUid || pu.id,
          approvalStatus: dec.status,
          reviewedBy: dec.reviewedBy,
          rejectionReason: dec.rejectionReason,
        };
      }
      return { ...pu };
    });

    const localPendings = getLocalPendingRegistrations();
    const registeredPendingUsers: SystemUser[] = localPendings.map((lp) => {
      const email = lp.email.toLowerCase();
      const dec = localDecisions[email] || localDecisions[lp.id];
      return {
        id: dec?.approvedUid || lp.authUid || lp.id,
        displayName: lp.fullName,
        email: lp.email,
        role: lp.requestedRole,
        prcLicense: lp.prcLicense,
        contactNumber: lp.contactNumber,
        approvalStatus: dec ? dec.status : lp.status,
        status: 'active',
        proofOfIdentity: lp.proofOfIdentity,
        reviewedBy: dec?.reviewedBy || lp.reviewedBy,
        rejectionReason: dec?.rejectionReason || lp.rejectionReason,
      };
    });

    this.users.set([adminUser, ...registeredPendingUsers, ...initialPendingUsers, ...DEFAULT_MIDWIVES, ...patientUsers]);

    const registeredPendingApps: PendingApprovalApplication[] = localPendings.map((lp) => {
      const email = lp.email.toLowerCase();
      const dec = localDecisions[email] || localDecisions[lp.id];
      return {
        id: lp.id,
        applicationId: lp.applicationId || lp.id,
        fullName: lp.fullName,
        email: lp.email,
        contactNumber: lp.contactNumber,
        requestedRole: lp.requestedRole,
        prcLicense: lp.prcLicense,
        proofOfIdentity: lp.proofOfIdentity || [],
        status: dec ? dec.status : lp.status,
        approvedUid: dec?.approvedUid || lp.authUid,
        reviewedBy: dec?.reviewedBy || lp.reviewedBy,
        rejectionReason: dec?.rejectionReason || lp.rejectionReason,
        submittedAt: lp.submittedAt ? new Date(lp.submittedAt) : new Date(),
      };
    });

    const initialPending: PendingApprovalApplication[] = DEFAULT_PENDING_USERS.map((pu) => {
      const email = pu.email.toLowerCase();
      const dec = localDecisions[email] || localDecisions[pu.id];
      return {
        id: pu.id,
        applicationId: pu.id,
        fullName: pu.displayName || 'Maria Kristina Reyes, RM',
        email: pu.email,
        contactNumber: pu.contactNumber || '0917-889-4321',
        requestedRole: (pu.role as 'midwife' | 'patient') || 'midwife',
        prcLicense: pu.prcLicense,
        proofOfIdentity: pu.proofOfIdentity || [],
        status: dec ? dec.status : (pu.approvalStatus || 'pending'),
        approvedUid: dec?.approvedUid,
        reviewedBy: dec?.reviewedBy,
        rejectionReason: dec?.rejectionReason,
        submittedAt: new Date('2026-10-14T13:22:00'),
      };
    });
    this.pendingApprovals.set([...registeredPendingApps, ...initialPending]);
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [userSnap, adminSnap, patientList, pendingSnap, settingsSnap, archivesSnap] = await Promise.all([
        getDocs(collection(db, 'users')).catch(() => null),
        getDocs(collection(db, 'admin')).catch(() => null),
        this.patientsSvc.list().catch(() => []),
        getDocs(collection(db, 'pendingApprovals')).catch(() => null),
        getDoc(doc(db, 'facility_settings', 'main')).catch(() => null),
        getDocs(collection(db, 'archives')).catch(() => null),
      ]);

      if (settingsSnap && settingsSnap.exists()) {
        this.facilitySettings.set({
          ...this.facilitySettings(),
          ...(settingsSnap.data() as FacilitySettings),
        });
      }

      if (archivesSnap && !archivesSnap.empty) {
        const dbArchives: ArchiveRecord[] = archivesSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ArchiveRecord, 'id'>),
        }));
        this.archives.set(dbArchives);
      }

      const currentPatients = patientList || [];
      this.patients.set(currentPatients);

      const localDecisions = getLocalApprovalDecisions();

      // Index users collection by email for fast cross-reference
      const userStatusByEmail = new Map<string, { status: 'approved' | 'rejected' | 'pending'; uid: string; reviewedBy?: string }>();
      userSnap?.forEach((d) => {
        const data = d.data();
        const email = (data['email'] || '').toLowerCase();
        if (email) {
          userStatusByEmail.set(email, {
            status: data['approvalStatus'] || 'approved',
            uid: d.id,
            reviewedBy: data['reviewedBy'],
          });
        }
      });

      // Process pendingApprovals
      const appList: PendingApprovalApplication[] = [];
      const seenAppEmails = new Set<string>();

      pendingSnap?.forEach((d) => {
        const data = d.data();
        const email = (data['email'] || '').toLowerCase();
        const local = email ? localDecisions[email] || localDecisions[d.id] : localDecisions[d.id];
        const userSync = email ? userStatusByEmail.get(email) : undefined;

        let status = data['status'] || 'pending';
        let approvedUid = data['approvedUid'];
        let reviewedBy = data['reviewedBy'];

        if (local) {
          status = local.status;
          if (local.approvedUid) approvedUid = local.approvedUid;
          if (local.reviewedBy) reviewedBy = local.reviewedBy;
        } else if (userSync && (userSync.status === 'approved' || userSync.status === 'rejected')) {
          status = userSync.status;
          approvedUid = userSync.uid;
          reviewedBy = userSync.reviewedBy;
        }

        appList.push({
          id: d.id,
          applicationId: data['applicationId'] || d.id,
          fullName: data['fullName'] || '',
          email: data['email'] || '',
          contactNumber: data['contactNumber'] || '',
          requestedRole: data['requestedRole'] || 'patient',
          prcLicense: data['prcLicense'],
          proofOfIdentity: data['proofOfIdentity'] || [],
          status,
          submittedAt: data['submittedAt'],
          reviewedAt: data['reviewedAt'],
          reviewedBy,
          rejectionReason: data['rejectionReason'] || local?.rejectionReason,
          approvedUid,
        });
        if (email) seenAppEmails.add(email);
      });

      // For DEFAULT_PENDING_USERS:
      for (const pu of DEFAULT_PENDING_USERS) {
        const email = pu.email.toLowerCase();
        const local = localDecisions[email] || localDecisions[pu.id];
        const userSync = userStatusByEmail.get(email);

        if (!seenAppEmails.has(email)) {
          let status: 'pending' | 'approved' | 'rejected' = pu.approvalStatus || 'pending';
          let approvedUid: string | undefined = undefined;
          let reviewedBy: string | undefined = undefined;

          if (local) {
            status = local.status;
            approvedUid = local.approvedUid;
            reviewedBy = local.reviewedBy;
          } else if (userSync && (userSync.status === 'approved' || userSync.status === 'rejected')) {
            status = userSync.status;
            approvedUid = userSync.uid;
            reviewedBy = userSync.reviewedBy;
          }

          appList.push({
            id: pu.id,
            applicationId: pu.id,
            fullName: pu.displayName || 'Maria Kristina Reyes, RM',
            email: pu.email,
            contactNumber: pu.contactNumber || '0917-889-4321',
            requestedRole: (pu.role as 'midwife' | 'patient') || 'midwife',
            prcLicense: pu.prcLicense,
            proofOfIdentity: pu.proofOfIdentity || [],
            status,
            approvedUid,
            reviewedBy,
            submittedAt: new Date('2026-10-14T13:22:00'),
          });
          seenAppEmails.add(email);
        }
      }

      // Merge registered applicants from local storage queue
      for (const reg of getLocalPendingRegistrations()) {
        const email = reg.email.toLowerCase();
        const local = localDecisions[email] || localDecisions[reg.id];
        let status: 'pending' | 'approved' | 'rejected' = reg.status || 'pending';
        let approvedUid = reg.authUid;
        let reviewedBy: string | undefined = undefined;
        let rejectionReason: string | undefined = undefined;

        if (local) {
          status = local.status;
          approvedUid = local.approvedUid || approvedUid;
          reviewedBy = local.reviewedBy;
          rejectionReason = local.rejectionReason;
        }

        const existingIdx = appList.findIndex(
          (a) => a.email.toLowerCase() === email || a.id === reg.id
        );
        if (existingIdx >= 0) {
          appList[existingIdx] = {
            ...appList[existingIdx],
            status,
            approvedUid,
            reviewedBy,
            rejectionReason,
            prcLicense: reg.prcLicense || appList[existingIdx].prcLicense,
            proofOfIdentity: (reg.proofOfIdentity && reg.proofOfIdentity.length > 0) ? reg.proofOfIdentity : appList[existingIdx].proofOfIdentity,
          };
        } else {
          appList.unshift({
            id: reg.id,
            applicationId: reg.applicationId || reg.id,
            fullName: reg.fullName,
            email: reg.email,
            contactNumber: reg.contactNumber,
            requestedRole: reg.requestedRole,
            prcLicense: reg.prcLicense,
            proofOfIdentity: reg.proofOfIdentity || [],
            status,
            approvedUid,
            reviewedBy,
            rejectionReason,
            submittedAt: reg.submittedAt ? new Date(reg.submittedAt) : new Date(),
          });
        }
        seenAppEmails.add(email);
      }

      // Sort appList: newest reviewed/approved accounts at the very top, followed by newest submitted
      appList.sort((a, b) => {
        const getAppTime = (item: PendingApprovalApplication): number => {
          const tRev = parseTimestamp(item.reviewedAt);
          const tSub = parseTimestamp(item.submittedAt);
          return Math.max(tRev, tSub);
        };
        const timeA = getAppTime(a);
        const timeB = getAppTime(b);
        return timeB - timeA;
      });

      this.pendingApprovals.set(appList);

      const list: SystemUser[] = [];
      const seenEmails = new Set<string>();
      const seenIds = new Set<string>();

      // 1. Current Administrator
      const adminName = this.adminDisplayName();
      const adminEmail = this.auth.user()?.email || 'admin@lyingincare.ph';
      const adminUid = this.auth.user()?.uid || 'admin-root';
      list.push({
        id: adminUid,
        email: adminEmail,
        displayName: adminName,
        role: 'admin',
        contactNumber: '0917-882-9901',
        approvalStatus: 'approved',
        status: 'active',
      });
      seenEmails.add(adminEmail.toLowerCase());
      seenIds.add(adminUid);

      // 2. Firestore users
      userSnap?.forEach((d) => {
        const data = d.data();
        const email = (data['email'] || '').toLowerCase();
        const local = email ? localDecisions[email] || localDecisions[d.id] : localDecisions[d.id];
        let appStatus = data['approvalStatus'] || 'approved';
        let revBy = data['reviewedBy'];
        if (local) {
          appStatus = local.status;
          if (local.reviewedBy) revBy = local.reviewedBy;
        }

        if (!seenIds.has(d.id) && (!email || !seenEmails.has(email))) {
          list.push({
            id: d.id,
            email: data['email'] || '',
            displayName: data['displayName'] || '',
            role: data['role'] || 'patient',
            prcLicense: data['prcLicense'],
            contactNumber: data['contactNumber'],
            proofOfIdentity: data['proofOfIdentity'] || [],
            approvalStatus: appStatus,
            rejectionReason: data['rejectionReason'] || local?.rejectionReason,
            status: data['status'] || 'active',
            createdAt: data['createdAt'],
            reviewedAt: data['reviewedAt'],
            reviewedBy: revBy,
          });
          if (email) seenEmails.add(email);
          seenIds.add(d.id);
        }
      });

      // 3. Firestore admins
      adminSnap?.forEach((d) => {
        const data = d.data();
        const email = (data['email'] || '').toLowerCase();
        if (!seenIds.has(d.id) && (!email || !seenEmails.has(email))) {
          list.push({
            id: d.id,
            email: data['email'] || '',
            displayName: data['displayName'] || 'Administrator',
            role: (data['role'] as Role) || 'admin',
            prcLicense: data['prcLicense'],
            contactNumber: data['contactNumber'],
            proofOfIdentity: data['proofOfIdentity'] || [],
            approvalStatus: 'approved',
            status: 'active',
            createdAt: data['createdAt'],
          });
          if (email) seenEmails.add(email);
          seenIds.add(d.id);
        }
      });

      // 4. Default midwives fallback
      for (const mw of DEFAULT_MIDWIVES) {
        if (!seenEmails.has(mw.email.toLowerCase()) && !seenIds.has(mw.id)) {
          list.push({ ...mw });
          seenEmails.add(mw.email.toLowerCase());
          seenIds.add(mw.id);
        }
      }

      // 5. Default pending fallback for user list
      for (const pu of DEFAULT_PENDING_USERS) {
        const email = pu.email.toLowerCase();
        const local = localDecisions[email] || localDecisions[pu.id];
        const userSync = userStatusByEmail.get(email);
        const appRecord = appList.find((a) => a.email.toLowerCase() === email);

        if (!seenEmails.has(email) && !seenIds.has(pu.id)) {
          let approvalStatus = pu.approvalStatus || 'pending';
          let uid = pu.id;
          let reviewedBy: string | undefined = undefined;

          if (local) {
            approvalStatus = local.status;
            if (local.approvedUid) uid = local.approvedUid;
            reviewedBy = local.reviewedBy;
          } else if (userSync) {
            approvalStatus = userSync.status;
            uid = userSync.uid;
            reviewedBy = userSync.reviewedBy;
          } else if (appRecord) {
            approvalStatus = appRecord.status;
            if (appRecord.approvedUid) uid = appRecord.approvedUid;
            reviewedBy = appRecord.reviewedBy;
          }

          list.push({
            ...pu,
            id: uid,
            approvalStatus,
            reviewedBy,
          });
          seenEmails.add(email);
          seenIds.add(uid);
        }
      }

      // 5.5. Locally registered applicants for user list
      for (const reg of getLocalPendingRegistrations()) {
        const email = reg.email.toLowerCase();
        const local = localDecisions[email] || localDecisions[reg.id];
        let approvalStatus = reg.status || 'pending';
        let uid = reg.authUid || reg.id;
        let reviewedBy: string | undefined = undefined;
        let rejectionReason: string | undefined = undefined;

        if (local) {
          approvalStatus = local.status;
          if (local.approvedUid) uid = local.approvedUid;
          reviewedBy = local.reviewedBy;
          rejectionReason = local.rejectionReason;
        }

        if (!seenEmails.has(email) && !seenIds.has(reg.id) && !seenIds.has(uid)) {
          list.push({
            id: uid,
            displayName: reg.fullName,
            email: reg.email,
            role: reg.requestedRole,
            prcLicense: reg.prcLicense,
            contactNumber: reg.contactNumber,
            proofOfIdentity: reg.proofOfIdentity || [],
            approvalStatus,
            rejectionReason,
            reviewedBy,
            status: 'active',
          });
          seenEmails.add(email);
          seenIds.add(uid);
        }
      }

      // 6. Connected clinical patients
      for (const p of currentPatients) {
        const pEmail = (p.email || `${p.id}@patient.lyingincare.ph`).toLowerCase();
        if (!seenEmails.has(pEmail) && !seenIds.has(p.id)) {
          list.push({
            id: p.id,
            displayName: p.fullName,
            email: p.email,
            role: 'patient',
            contactNumber: p.contactNumber,
            approvalStatus: 'approved',
            status: 'active',
          });
          seenEmails.add(pEmail);
          seenIds.add(p.id);
        }
      }

      list.sort((a, b) => {
        if (a.approvalStatus === 'pending' && b.approvalStatus !== 'pending') return -1;
        if (b.approvalStatus === 'pending' && a.approvalStatus !== 'pending') return 1;

        const getUsrTime = (item: SystemUser): number => {
          const tRev = parseTimestamp(item.reviewedAt);
          const tUpd = parseTimestamp((item as any).updatedAt);
          const tCre = parseTimestamp(item.createdAt);
          return Math.max(tRev, tUpd, tCre);
        };
        const revA = getUsrTime(a);
        const revB = getUsrTime(b);
        if (revA || revB) return revB - revA;

        return (a.displayName || a.email).localeCompare(b.displayName || b.email);
      });

      this.users.set(list);
    } catch {
      // Offline fallback
    } finally {
      this.loading.set(false);
    }
  }

  // ==================== ACTIONS ====================
  async approveApplication(app: PendingApprovalApplication, initialPassword = 'User@2026!'): Promise<void> {
    const adminName = this.adminDisplayName();
    const adminUid = this.auth.user()?.uid || 'admin-root';
    const email = (app.email || '').trim().toLowerCase();
    const fullName = (app.fullName || '').trim();
    const requestedRole = app.requestedRole || 'patient';
    const roleCollection = requestedRole === 'midwife' ? 'midwives' : 'patients';

    // STEP 1: Verify Admin Authorization
    console.log(`[APPROVAL STEP 1/8] Verifying administrator authorization...`);
    if (this.auth.role() !== 'admin') {
      const err = 'Admin authorization failed: Current session does not have administrative privileges.';
      console.error('[STEP 1 FAILED]', err);
      this.notify(err, true);
      throw new Error(err);
    }
    console.log(`[APPROVAL STEP 1/8] Admin verified: ${adminName} (${adminUid})`);

    // STEP 2: Retrieve and Validate Pending Application
    console.log(`[APPROVAL STEP 2/8] Retrieving pending application: ${app.id} (${email})...`);
    if (!email || !fullName) {
      const err = 'Invalid application: Full legal name and email address are required.';
      console.error('[STEP 2 FAILED]', err);
      this.notify(err, true);
      throw new Error(err);
    }
    console.log(`[APPROVAL STEP 2/8] Retrieved application: ${fullName} (${email}), requested role: ${requestedRole}`);

    // STEP 3: Create or Retrieve Firebase Authentication Account
    console.log(`[APPROVAL STEP 3/8] Creating or retrieving Firebase Authentication account for ${email}...`);
    let uid = app.approvedUid || '';
    let cred: any = null;

    try {
      cred = await createUserWithEmailAndPassword(secondaryAuth, email, initialPassword);
      uid = cred.user.uid;
      console.log(`[APPROVAL STEP 3/8] Created new Firebase Authentication account for ${email}.`);
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/email-already-in-use') {
        console.log(`[APPROVAL STEP 3/8] Account ${email} already exists in Firebase Auth. Retrieving existing UID...`);
        if (app.approvedUid) {
          uid = app.approvedUid;
        }
        if (!uid) {
          try {
            const signinCred = await signInWithEmailAndPassword(secondaryAuth, email, initialPassword);
            uid = signinCred.user.uid;
            cred = signinCred;
          } catch {}
        }
        if (!uid) {
          try {
            const usersSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
            if (!usersSnap.empty) {
              uid = usersSnap.docs[0].id;
            }
          } catch {}
        }
        if (!uid) {
          const localMatch = getLocalPendingRegistrations().find((lp) => lp.email.toLowerCase() === email);
          if (localMatch?.authUid) {
            uid = localMatch.authUid;
          }
        }
      }
      if (!uid) {
        const authErr = `Authentication account setup failed for ${email}: [${code}] ${e.message}`;
        console.error('[STEP 3/4 FAILED]', authErr, e);
        this.notify(authErr, true);
        throw new Error(authErr);
      }
    }

    // STEP 4: Authentication UID Obtained
    console.log(`[APPROVAL STEP 4/8] Obtained Authentication UID: ${uid}`);

    // Prepare Document Schemas (Exclude raw base64 data to avoid document size limit errors)
    const sanitizedProofOfIdentity = (app.proofOfIdentity || []).map((p) => ({
      name: p.name,
      size: p.size,
      type: p.type,
    }));

    const userDocData = {
      uid,
      fullName,
      displayName: fullName,
      email,
      role: requestedRole,
      accountStatus: 'active',
      status: 'active',
      approvalStatus: 'approved',
      contactNumber: app.contactNumber || '',
      prcLicense: app.prcLicense || '',
      proofOfIdentity: sanitizedProofOfIdentity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
      reviewedBy: adminName,
    };

    const midwifeDocData = {
      midwifeId: uid,
      uid,
      fullName,
      displayName: fullName,
      email,
      contactNumber: app.contactNumber || '',
      prcLicense: app.prcLicense || '',
      accountStatus: 'active',
      status: 'active',
      approvalStatus: 'approved',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const patientDocData = {
      id: uid,
      patientId: uid,
      uid,
      fullName,
      displayName: fullName,
      email,
      contactNumber: app.contactNumber || '',
      status: 'Active',
      riskLevel: 'Low risk',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: adminUid,
    };

    const roleDocData = requestedRole === 'midwife' ? midwifeDocData : patientDocData;

    // STEP 5: Create Firestore users Document
    console.log(`[APPROVAL STEP 5/8] Creating Firestore document: users/${uid}...`);
    let usersDocWritten = false;
    let usersWriteError: any = null;

    try {
      await setDoc(doc(db, 'users', uid), userDocData, { merge: true });
      usersDocWritten = true;
      console.log(`[APPROVAL STEP 5/8] Successfully created users/${uid}`);
    } catch (uErr: any) {
      usersWriteError = uErr;
      console.warn(`[APPROVAL STEP 5/8] Primary write to users/${uid} failed (${uErr.code}): ${uErr.message}. Trying secondaryDb...`);
      try {
        await setDoc(doc(secondaryDb, 'users', uid), userDocData, { merge: true });
        usersDocWritten = true;
        console.log(`[APPROVAL STEP 5/8] Successfully created users/${uid} via secondaryDb`);
      } catch (secErr: any) {
        usersWriteError = secErr;
      }
    }

    if (!usersDocWritten) {
      const errCode = usersWriteError?.code || 'permission-denied';
      const errMsg = usersWriteError?.message || 'Missing or insufficient permissions.';
      const detailed = `[STEP 5 FAILED] Firestore document creation blocked for users/${uid}: [${errCode}] ${errMsg}`;
      console.error(detailed, usersWriteError);
      this.notify(detailed, true);
      await signOut(secondaryAuth).catch(() => undefined);
      throw new Error(detailed);
    }

    // STEP 6: Create Firestore role-specific Document (midwives or patients)
    console.log(`[APPROVAL STEP 6/8] Creating Firestore document: ${roleCollection}/${uid}...`);
    let roleDocWritten = false;
    let roleWriteError: any = null;

    try {
      await setDoc(doc(db, roleCollection, uid), roleDocData, { merge: true });
      roleDocWritten = true;
      console.log(`[APPROVAL STEP 6/8] Successfully created ${roleCollection}/${uid}`);
    } catch (rErr: any) {
      roleWriteError = rErr;
      console.warn(`[APPROVAL STEP 6/8] Primary write to ${roleCollection}/${uid} failed (${rErr.code}): ${rErr.message}. Trying secondaryDb...`);
      try {
        await setDoc(doc(secondaryDb, roleCollection, uid), roleDocData, { merge: true });
        roleDocWritten = true;
        console.log(`[APPROVAL STEP 6/8] Successfully created ${roleCollection}/${uid} via secondaryDb`);
      } catch (secErr: any) {
        roleWriteError = secErr;
      }
    }

    if (!roleDocWritten) {
      const errCode = roleWriteError?.code || 'permission-denied';
      const errMsg = roleWriteError?.message || 'Missing or insufficient permissions.';
      const detailed = `[STEP 6 FAILED] Firestore document creation blocked for ${roleCollection}/${uid}: [${errCode}] ${errMsg}`;
      console.error(detailed, roleWriteError);
      this.notify(detailed, true);
      await signOut(secondaryAuth).catch(() => undefined);
      throw new Error(detailed);
    }

    // STEP 7: Verify Created Documents in Cloud Firestore
    console.log(`[APPROVAL STEP 7/8] Verifying created Firestore documents in Cloud Firestore...`);
    let userDocExists = false;
    let roleDocExists = false;

    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      userDocExists = uSnap.exists();
    } catch {}

    try {
      const rSnap = await getDoc(doc(db, roleCollection, uid));
      roleDocExists = rSnap.exists();
    } catch {}

    await signOut(secondaryAuth).catch(() => undefined);

    if (!userDocExists || !roleDocExists) {
      const verifyErr = `[STEP 7 FAILED] Firestore document verification failed: users/${uid} exists: ${userDocExists}, ${roleCollection}/${uid} exists: ${roleDocExists}. Documents were not saved in Cloud Firestore.`;
      console.error(verifyErr);
      this.notify(verifyErr, true);
      throw new Error(verifyErr);
    }
    console.log(`[APPROVAL STEP 7/8] Verified! Both users/${uid} and ${roleCollection}/${uid} exist in Cloud Firestore.`);

    // STEP 8: Application Approval Status Updated
    console.log(`[APPROVAL STEP 8/8] Updating application approval status...`);
    const pendingDocData = {
      id: app.id,
      applicationId: app.applicationId || app.id,
      fullName,
      email,
      contactNumber: app.contactNumber || '',
      requestedRole,
      prcLicense: app.prcLicense || '',
      status: 'approved',
      approvedUid: uid,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminName,
    };

    try {
      await setDoc(doc(db, 'pendingApprovals', app.id), pendingDocData, { merge: true });
      if (app.applicationId && app.applicationId !== app.id) {
        await setDoc(doc(db, 'pendingApprovals', app.applicationId), pendingDocData, { merge: true }).catch(() => undefined);
      }
    } catch (pErr) {
      console.warn('Could not update pendingApprovals doc in Firestore:', pErr);
    }

    // Send password reset / welcome email
    await sendPasswordResetEmail(auth, email).catch(() => undefined);

    // Save persistent local decision
    saveLocalApprovalDecision(email, app.id, 'approved', uid, adminName, undefined, requestedRole);
    saveLocalPendingRegistration({
      id: app.id,
      applicationId: app.applicationId || app.id,
      fullName: app.fullName,
      email: app.email,
      contactNumber: app.contactNumber,
      requestedRole: app.requestedRole,
      prcLicense: app.prcLicense,
      proofOfIdentity: app.proofOfIdentity,
      status: 'approved',
      authUid: uid,
      submittedAt: app.submittedAt,
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminName,
    });

    // Update pendingApprovals signal - place newly approved account AT THE VERY TOP
    this.pendingApprovals.update((list) => {
      const match = list.find((item) => item.id === app.id || item.email.toLowerCase() === email);
      const rest = list.filter((item) => item.id !== app.id && item.email.toLowerCase() !== email);
      const updatedMatch: PendingApprovalApplication = match
        ? {
            ...match,
            status: 'approved',
            approvedUid: uid,
            reviewedAt: new Date(),
            reviewedBy: adminName,
          }
        : {
            id: app.id,
            applicationId: app.applicationId || app.id,
            fullName,
            email,
            contactNumber: app.contactNumber || '',
            requestedRole,
            prcLicense: app.prcLicense || '',
            status: 'approved',
            approvedUid: uid,
            reviewedAt: new Date(),
            reviewedBy: adminName,
            submittedAt: app.submittedAt || new Date(),
          };
      return [updatedMatch, ...rest];
    });

    // Update users signal - place newly approved user AT THE VERY TOP
    this.users.update((curr) => {
      const existing = curr.find((u) => u.email.toLowerCase() === email || u.id === app.id || u.id === uid);
      const rest = curr.filter((u) => u.email.toLowerCase() !== email && u.id !== app.id && u.id !== uid);
      const updatedUser: SystemUser = existing
        ? {
            ...existing,
            id: uid,
            displayName: fullName,
            approvalStatus: 'approved' as const,
            status: 'active' as const,
            reviewedBy: adminName,
            reviewedAt: new Date(),
          }
        : {
            id: uid,
            displayName: fullName,
            email,
            role: requestedRole,
            contactNumber: app.contactNumber,
            prcLicense: app.prcLicense,
            approvalStatus: 'approved',
            status: 'active',
            reviewedBy: adminName,
            reviewedAt: new Date(),
          };
      return [updatedUser, ...rest];
    });

    if (requestedRole === 'patient') {
      const newPat: Patient = {
        id: uid,
        fullName,
        email,
        contactNumber: app.contactNumber || '',
        birthDate: '',
        address: '',
        emergencyContactName: '',
        emergencyContactNumber: '',
        bloodType: 'O+',
        lmp: '',
        edd: '',
        status: 'Active',
        riskLevel: 'Low risk',
        gravidaPara: 'G1P0',
        gestationalAge: '24 weeks',
      };
      this.patients.update((curr) => {
        const hasPat = curr.some((p) => p.id === uid || p.email.toLowerCase() === email);
        return hasPat ? curr : [newPat, ...curr];
      });
    }

    this.addActivityLog(
      `Registration approved for ${fullName} (${requestedRole})`,
      'approval',
      email,
    );

    this.notify(`Application for ${fullName} approved and verified in Cloud Firestore!`);
  }

  async rejectApplication(app: PendingApprovalApplication, reason = 'Did not meet facility clinical verification requirements'): Promise<void> {
    const adminName = this.adminDisplayName();
    const email = app.email.trim().toLowerCase();

    saveLocalApprovalDecision(email, app.id, 'rejected', undefined, adminName, reason);
    saveLocalPendingRegistration({
      id: app.id,
      applicationId: app.applicationId || app.id,
      fullName: app.fullName,
      email: app.email,
      contactNumber: app.contactNumber,
      requestedRole: app.requestedRole,
      prcLicense: app.prcLicense,
      proofOfIdentity: app.proofOfIdentity,
      status: 'rejected',
      rejectionReason: reason,
      submittedAt: app.submittedAt,
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminName,
    });

    const pendingDocData = {
      id: app.id,
      applicationId: app.applicationId || app.id,
      fullName: app.fullName,
      email: app.email,
      contactNumber: app.contactNumber || '',
      requestedRole: app.requestedRole,
      prcLicense: app.prcLicense || '',
      proofOfIdentity: app.proofOfIdentity || [],
      status: 'rejected',
      rejectionReason: reason,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminName,
    };

    try {
      await setDoc(doc(db, 'pendingApprovals', app.id), pendingDocData, { merge: true });
    } catch {}

    this.pendingApprovals.update((list) =>
      list.map((item) =>
        item.id === app.id || item.email.toLowerCase() === email
          ? { ...item, status: 'rejected', rejectionReason: reason, reviewedAt: new Date(), reviewedBy: adminName }
          : item,
      ),
    );

    this.users.update((curr) =>
      curr.map((u) =>
        u.email.toLowerCase() === email || u.id === app.id
          ? { ...u, approvalStatus: 'rejected', rejectionReason: reason, reviewedBy: adminName }
          : u,
      ),
    );

    this.addActivityLog(
      `Registration rejected for ${app.fullName} (${app.requestedRole})`,
      'rejection',
      app.email,
    );
    this.notify(`Application for ${app.fullName} has been rejected.`);
  }

  async approveUser(u: SystemUser): Promise<void> {
    let matchingApp = this.pendingApprovals().find((a) => a.email.toLowerCase() === u.email.toLowerCase() || a.id === u.id);
    if (!matchingApp) {
      matchingApp = {
        id: u.id,
        applicationId: u.id,
        fullName: u.displayName || u.email,
        email: u.email,
        contactNumber: u.contactNumber || '',
        requestedRole: (u.role as 'midwife' | 'patient') || 'midwife',
        prcLicense: u.prcLicense,
        proofOfIdentity: u.proofOfIdentity || [],
        status: 'pending',
      };
    }
    await this.approveApplication(matchingApp);
  }

  async rejectUser(u: SystemUser, reason = 'Did not meet facility clinical verification requirements'): Promise<void> {
    const matchingApp = this.pendingApprovals().find((a) => a.email.toLowerCase() === u.email.toLowerCase() || a.id === u.id);
    if (matchingApp) {
      await this.rejectApplication(matchingApp, reason);
      return;
    }

    const adminName = this.adminDisplayName();
    saveLocalApprovalDecision(u.email, u.id, 'rejected', undefined, adminName, reason, u.role);

    try {
      await setDoc(doc(db, 'users', u.id), {
        approvalStatus: 'rejected',
        rejectionReason: reason,
        reviewedAt: serverTimestamp(),
        reviewedBy: adminName,
      }, { merge: true });
    } catch {}

    this.users.update((curr) =>
      curr.map((item) =>
        item.id === u.id || item.email.toLowerCase() === u.email.toLowerCase()
          ? { ...item, approvalStatus: 'rejected', rejectionReason: reason, reviewedBy: adminName }
          : item,
      ),
    );

    this.addActivityLog(
      `Rejected account application for ${u.displayName || u.email}`,
      'rejection',
      u.email,
    );
    this.notify(`Application for ${u.displayName || u.email} has been rejected.`);
  }

  // ==================== ACCOUNT INTEGRITY & REPAIR ====================
  async auditAccountIntegrity(): Promise<AccountIntegrityItem[]> {
    const reports: AccountIntegrityItem[] = [];
    const seenEmails = new Set<string>();

    // 1. Audit pendingApprovals collection & registrations
    const approvals = this.pendingApprovals();
    for (const app of approvals) {
      const email = (app.email || '').toLowerCase().trim();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      const uid = app.approvedUid || (app.id && !app.id.startsWith('pending-') ? app.id : '');
      const role = app.requestedRole || 'patient';
      let hasUsersDoc = false;
      let hasProfileDoc = false;

      if (uid) {
        try {
          const uSnap = await getDoc(doc(db, 'users', uid));
          hasUsersDoc = uSnap.exists();
        } catch {}

        try {
          if (role === 'midwife') {
            const mSnap = await getDoc(doc(db, 'midwives', uid));
            hasProfileDoc = mSnap.exists();
          } else {
            const pSnap = await getDoc(doc(db, 'patients', uid));
            hasProfileDoc = pSnap.exists();
          }
        } catch {}
      }

      let status: 'healthy' | 'missing_documents' | 'incomplete_profile' = 'healthy';
      let details = 'All required Firestore documents exist and are linked by identical UID.';

      if (!hasUsersDoc && !hasProfileDoc) {
        status = 'missing_documents';
        details = `Missing users/${uid || 'NO-UID'} and ${role === 'midwife' ? 'midwives' : 'patients'}/${uid || 'NO-UID'}.`;
      } else if (!hasProfileDoc) {
        status = 'incomplete_profile';
        details = `users/${uid} exists, but role profile ${role === 'midwife' ? 'midwives' : 'patients'}/${uid} is missing.`;
      } else if (!hasUsersDoc) {
        status = 'incomplete_profile';
        details = `Role profile exists, but core users/${uid} record is missing.`;
      }

      reports.push({
        id: app.id,
        uid: uid || 'Not assigned',
        email: app.email,
        displayName: app.fullName,
        role,
        hasUsersDoc,
        hasProfileDoc,
        profileCollection: role === 'midwife' ? 'midwives' : 'patients',
        status,
        sourceRecord: 'pending_approval',
        isApproved: app.status === 'approved',
        details,
        rawApp: app,
      });
    }

    // 2. Audit other users in system registry
    for (const u of this.users()) {
      const email = (u.email || '').toLowerCase().trim();
      if (!email || seenEmails.has(email) || u.role === 'admin') continue;
      seenEmails.add(email);

      const uid = u.id;
      const role = u.role || 'patient';
      let hasUsersDoc = false;
      let hasProfileDoc = false;

      if (uid && !uid.startsWith('mw-') && !uid.startsWith('pending-')) {
        try {
          const uSnap = await getDoc(doc(db, 'users', uid));
          hasUsersDoc = uSnap.exists();
        } catch {}

        try {
          if (role === 'midwife') {
            const mSnap = await getDoc(doc(db, 'midwives', uid));
            hasProfileDoc = mSnap.exists();
          } else {
            const pSnap = await getDoc(doc(db, 'patients', uid));
            hasProfileDoc = pSnap.exists();
          }
        } catch {}
      }

      let status: 'healthy' | 'missing_documents' | 'incomplete_profile' = 'healthy';
      let details = 'All required Firestore documents exist and are linked by identical UID.';

      if (!hasUsersDoc && !hasProfileDoc) {
        status = 'missing_documents';
        details = `Missing users/${uid} and ${role === 'midwife' ? 'midwives' : 'patients'}/${uid}.`;
      } else if (!hasProfileDoc) {
        status = 'incomplete_profile';
        details = `users/${uid} exists, but role profile ${role === 'midwife' ? 'midwives' : 'patients'}/${uid} is missing.`;
      } else if (!hasUsersDoc) {
        status = 'incomplete_profile';
        details = `Role profile exists, but core users/${uid} record is missing.`;
      }

      reports.push({
        id: u.id,
        uid: uid,
        email: u.email,
        displayName: u.displayName || u.email,
        role,
        hasUsersDoc,
        hasProfileDoc,
        profileCollection: role === 'midwife' ? 'midwives' : 'patients',
        status,
        sourceRecord: 'registered_user',
        isApproved: u.approvalStatus === 'approved',
        details,
      });
    }

    return reports;
  }

  async repairAccount(item: AccountIntegrityItem): Promise<boolean> {
    if (this.auth.role() !== 'admin') {
      throw new Error('Unauthorized: Only administrators can repair Firestore account records.');
    }

    const adminName = this.adminDisplayName();
    const adminUid = this.auth.user()?.uid || 'admin-root';
    const email = item.email.trim().toLowerCase();
    const fullName = item.displayName.trim();
    const role = item.role;
    let uid = item.uid && item.uid !== 'Not assigned' && !item.uid.startsWith('pending-') ? item.uid : '';

    // Retrieve verified UID if not present
    if (!uid && item.rawApp?.approvedUid) {
      uid = item.rawApp.approvedUid;
    }

    if (!uid) {
      try {
        const uSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
        if (!uSnap.empty) {
          uid = uSnap.docs[0].id;
        }
      } catch {}
    }

    if (!uid) {
      // Attempt sign-in with secondaryAuth to find exact Auth UID
      try {
        const signin = await signInWithEmailAndPassword(secondaryAuth, email, 'User@2026!');
        uid = signin.user.uid;
      } catch {} finally {
        await signOut(secondaryAuth).catch(() => undefined);
      }
    }

    if (!uid) {
      uid = item.id.startsWith('pending-') ? doc(collection(db, 'users')).id : item.id;
    }

    const userDocData = {
      uid,
      email,
      fullName,
      displayName: fullName,
      role,
      contactNumber: item.rawApp?.contactNumber || '',
      prcLicense: item.rawApp?.prcLicense || '',
      proofOfIdentity: item.rawApp?.proofOfIdentity || [],
      approvalStatus: 'approved',
      status: 'active',
      accountStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
      reviewedBy: adminName,
    };

    const midwifeDocData = {
      midwifeId: uid,
      uid,
      fullName,
      displayName: fullName,
      email,
      prcLicense: item.rawApp?.prcLicense || '',
      contactNumber: item.rawApp?.contactNumber || '',
      accountStatus: 'active',
      status: 'active',
      approvalStatus: 'approved',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const patientDocData = {
      id: uid,
      patientId: uid,
      uid,
      fullName,
      displayName: fullName,
      email,
      contactNumber: item.rawApp?.contactNumber || '',
      status: 'Active',
      riskLevel: 'Low risk',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: adminUid,
    };

    const sanitizedProof = (item.rawApp?.proofOfIdentity || []).map((p) => ({
      name: p.name,
      size: p.size,
      type: p.type,
    }));
    (userDocData as any).proofOfIdentity = sanitizedProof;

    let repaired = false;
    let repairErr: any = null;

    try {
      await setDoc(doc(db, 'users', uid), userDocData, { merge: true });
      if (role === 'midwife') {
        await setDoc(doc(db, 'midwives', uid), midwifeDocData, { merge: true });
      } else {
        await setDoc(doc(db, 'patients', uid), patientDocData, { merge: true });
      }
      if (item.rawApp?.id) {
        await setDoc(doc(db, 'pendingApprovals', item.rawApp.id), {
          status: 'approved',
          approvedUid: uid,
          reviewedAt: serverTimestamp(),
          reviewedBy: adminName,
        }, { merge: true }).catch(() => undefined);
      }
      repaired = true;
    } catch (err: any) {
      repairErr = err;
      console.warn('[REPAIR] Primary db write failed, trying secondaryDb:', err);
      try {
        await setDoc(doc(secondaryDb, 'users', uid), userDocData, { merge: true });
        if (role === 'midwife') {
          await setDoc(doc(secondaryDb, 'midwives', uid), midwifeDocData, { merge: true });
        } else {
          await setDoc(doc(secondaryDb, 'patients', uid), patientDocData, { merge: true });
        }
        repaired = true;
      } catch (secErr: any) {
        repairErr = secErr;
      }
    }

    if (!repaired) {
      const code = repairErr?.code || 'permission-denied';
      const msg = `Repair failed for ${email}: [${code}] ${repairErr?.message || 'Firestore write rejected'}.`;
      console.error(msg, repairErr);
      this.notify(msg, true);
      throw new Error(msg);
    }

    saveLocalApprovalDecision(email, item.id, 'approved', uid, adminName, undefined, role);
    this.addActivityLog(
      `Repaired and verified Firestore documents for ${fullName} (${email}) [UID: ${uid}]`,
      'approval',
      email
    );
    this.notify(`Repaired and synchronized Firestore records for ${fullName}!`);
    return repaired;
  }

  async repairAllAccounts(items: AccountIntegrityItem[]): Promise<{ repaired: number; failed: number }> {
    let repaired = 0;
    let failed = 0;
    for (const item of items) {
      if (item.status !== 'healthy') {
        try {
          const ok = await this.repairAccount(item);
          if (ok) repaired++;
          else failed++;
        } catch {
          failed++;
        }
      }
    }
    return { repaired, failed };
  }

  async toggleUserStatus(u: SystemUser): Promise<void> {
    const nextStatus = u.status === 'inactive' ? 'active' : 'inactive';
    try {
      if (!u.id.startsWith('mw-') && !u.id.startsWith('pending-')) {
        await updateDoc(doc(db, 'users', u.id), { status: nextStatus });
      }
    } catch {
      // local
    }

    this.users.update((curr) =>
      curr.map((item) => (item.id === u.id ? { ...item, status: nextStatus } : item)),
    );

    this.addActivityLog(
      `${nextStatus === 'active' ? 'Activated' : 'Deactivated'} account for ${u.displayName || u.email}`,
      'role_change',
      u.email,
    );
    this.notify(`Account status for ${u.displayName || u.email} set to ${nextStatus}.`);
  }

  async changeUserRole(u: SystemUser, newRole: Role): Promise<void> {
    try {
      if (!u.id.startsWith('mw-') && !u.id.startsWith('pending-')) {
        await updateDoc(doc(db, 'users', u.id), { role: newRole });
      }
    } catch {
      // local
    }

    this.users.update((curr) =>
      curr.map((item) => (item.id === u.id ? { ...item, role: newRole } : item)),
    );

    this.addActivityLog(
      `Changed system role for ${u.displayName || u.email} to ${newRole.toUpperCase()}`,
      'role_change',
      u.email,
    );
    this.notify(`Role for ${u.displayName || u.email} updated to ${newRole.toUpperCase()}.`);
  }

  async addMidwife(midwife: { name: string; email: string; prc: string; phone: string; password?: string }): Promise<SystemUser> {
    const email = midwife.email.trim().toLowerCase();
    const name = midwife.name.trim();
    const prc = midwife.prc.trim();
    const phone = midwife.phone.trim();
    const password = midwife.password?.trim() || 'Midwife@2026!';

    if (!name || !email || !prc) {
      throw new Error('Please fill in legal name, professional email, and PRC license.');
    }

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    } catch (err: any) {
      await signOut(secondaryAuth).catch(() => undefined);
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        throw new Error('An account with this email address already exists in Firebase Authentication.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (code === 'auth/weak-password') {
        throw new Error('Password must be at least 6 characters long.');
      }
      throw err;
    }

    const uid = cred.user.uid;

    try {
      const batch = writeBatch(db);

      // 1. users collection doc
      batch.set(doc(db, 'users', uid), {
        uid,
        email,
        displayName: name,
        fullName: name,
        role: 'midwife',
        prcLicense: prc,
        contactNumber: phone,
        approvalStatus: 'approved',
        status: 'active',
        accountStatus: 'active',
        createdAt: serverTimestamp(),
        reviewedAt: serverTimestamp(),
        reviewedBy: this.adminDisplayName(),
      });

      // 2. midwives collection doc
      batch.set(doc(db, 'midwives', uid), {
        midwifeId: uid,
        uid,
        fullName: name,
        displayName: name,
        email,
        prcLicense: prc,
        contactNumber: phone,
        accountStatus: 'active',
        status: 'active',
        approvalStatus: 'approved',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      await deleteUser(cred.user).catch(() => undefined);
      throw err;
    } finally {
      await signOut(secondaryAuth).catch(() => undefined);
    }

    const newStaff: SystemUser = {
      id: uid,
      displayName: name,
      email,
      role: 'midwife',
      prcLicense: prc,
      contactNumber: phone,
      approvalStatus: 'approved',
      status: 'active',
    };

    this.users.update((curr) => [newStaff, ...curr]);
    this.addActivityLog(
      `Registered licensed midwife: ${name} (PRC: ${prc})`,
      'create_user',
      email,
    );
    this.notify(`Midwife account for ${name} registered successfully!`);
    return newStaff;
  }

  async addPatient(p: PatientProfile, initialPassword?: string): Promise<Patient> {
    const res = await this.patientsSvc.register(p, initialPassword);
    const newPat: Patient = {
      ...p,
      id: res.id,
      status: p.status || 'Active',
      riskLevel: p.riskLevel || 'Low risk',
      gravidaPara: p.gravidaPara || 'G1P0',
      gestationalAge: p.gestationalAge || '24 weeks',
    };

    this.patients.update((curr) => [newPat, ...curr]);

    if (p.email) {
      const newUser: SystemUser = {
        id: res.id,
        displayName: p.fullName,
        email: p.email.toLowerCase(),
        role: 'patient',
        contactNumber: p.contactNumber,
        approvalStatus: 'approved',
        status: 'active',
      };
      this.users.update((curr) => [newUser, ...curr]);
    }

    this.addActivityLog(`Enrolled patient record: ${p.fullName}`, 'create_user', p.email);
    this.notify(`Patient ${p.fullName} registered successfully!`);
    return newPat;
  }

  async updatePatient(p: Patient): Promise<void> {
    try {
      await setDoc(doc(db, 'patients', p.id), { ...p, updatedAt: serverTimestamp() }, { merge: true });
    } catch {
      // local
    }
    this.patientsSvc.saveLocalEdit(p.id, p);
    this.patients.update((list) => list.map((item) => (item.id === p.id ? p : item)));
    this.addActivityLog(`Updated clinical record for patient ${p.fullName}`, 'system', p.email);
    this.notify(`Patient record for ${p.fullName} updated!`);
  }

  async archivePatient(patient: Patient, reason = 'Discharged & completed maternal care'): Promise<void> {
    const archiveItem: ArchiveRecord = {
      id: 'arch-' + Date.now(),
      originalId: patient.id,
      name: patient.fullName,
      category: 'patient',
      identifier: patient.email || patient.contactNumber,
      archivedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      reason,
      archivedBy: this.adminDisplayName(),
      data: { ...patient },
    };

    this.patients.update((list) => list.filter((p) => p.id !== patient.id));
    this.archives.update((curr) => [archiveItem, ...curr]);

    try {
      await setDoc(doc(db, 'archives', archiveItem.id), archiveItem);
      await updateDoc(doc(db, 'patients', patient.id), { isArchived: true, archivedAt: serverTimestamp() }).catch(() => {});
    } catch (e) {
      console.warn('Failed to persist archive in Firestore:', e);
    }

    this.addActivityLog(`Archived patient record: ${patient.fullName}`, 'archive', patient.email);
    this.notify(`Patient ${patient.fullName} has been moved to Archives.`);
  }

  async restorePatient(archived: ArchiveRecord): Promise<void> {
    if (archived.category === 'patient' && archived.data) {
      const restored = archived.data as Patient;
      this.patients.update((list) => [restored, ...list]);
      try {
        await updateDoc(doc(db, 'patients', archived.originalId), { isArchived: false, updatedAt: serverTimestamp() }).catch(() => {});
      } catch {}
    }
    this.archives.update((list) => list.filter((a) => a.id !== archived.id));
    try {
      await deleteDoc(doc(db, 'archives', archived.id)).catch(() => {});
    } catch {}

    this.addActivityLog(`Restored archived patient record: ${archived.name}`, 'archive', archived.identifier);
    this.notify(`Record for ${archived.name} restored to active directory.`);
  }

  async archiveUser(user: SystemUser, reason = 'Deactivated staff / member'): Promise<void> {
    const archiveItem: ArchiveRecord = {
      id: 'arch-' + Date.now(),
      originalId: user.id,
      name: user.displayName || user.email,
      category: user.role === 'midwife' ? 'midwife' : 'user',
      identifier: user.prcLicense ? `PRC #${user.prcLicense}` : user.email,
      archivedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      reason,
      archivedBy: this.adminDisplayName(),
      data: { ...user },
    };

    this.users.update((list) => list.filter((u) => u.id !== user.id));
    this.archives.update((curr) => [archiveItem, ...curr]);

    try {
      await setDoc(doc(db, 'archives', archiveItem.id), archiveItem);
      await updateDoc(doc(db, 'users', user.id), { status: 'suspended', isArchived: true, updatedAt: serverTimestamp() }).catch(() => {});
    } catch (e) {
      console.warn('Failed to persist archive in Firestore:', e);
    }

    this.addActivityLog(`Archived user account: ${archiveItem.name}`, 'archive', user.email);
    this.notify(`Account for ${archiveItem.name} has been archived.`);
  }

  async restoreUser(archived: ArchiveRecord): Promise<void> {
    if (archived.data) {
      const restored = archived.data as SystemUser;
      this.users.update((list) => [restored, ...list]);
      try {
        await updateDoc(doc(db, 'users', archived.originalId), { status: 'active', isArchived: false, updatedAt: serverTimestamp() }).catch(() => {});
      } catch {}
    }
    this.archives.update((list) => list.filter((a) => a.id !== archived.id));
    try {
      await deleteDoc(doc(db, 'archives', archived.id)).catch(() => {});
    } catch {}

    this.addActivityLog(`Restored user account: ${archived.name}`, 'archive', archived.identifier);
    this.notify(`Account for ${archived.name} restored to active directory.`);
  }

  async deleteArchivePermanently(id: string): Promise<void> {
    const found = this.archives().find((a) => a.id === id);
    this.archives.update((list) => list.filter((a) => a.id !== id));
    try {
      await deleteDoc(doc(db, 'archives', id)).catch(() => {});
    } catch {}

    if (found) {
      this.addActivityLog(`Permanently purged archive record: ${found.name}`, 'archive');
      this.notify(`Archive record for ${found.name} permanently deleted.`);
    }
  }

  async updateSettings(settings: FacilitySettings): Promise<void> {
    this.facilitySettings.set({ ...settings });
    try {
      await setDoc(doc(db, 'facility_settings', 'main'), settings, { merge: true });
    } catch (e) {
      console.warn('Failed to save facility settings to Firestore:', e);
    }
    this.addActivityLog('Updated facility information and clinic operational settings', 'settings');
    this.notify('Facility settings saved successfully!');
  }

  addActivityLog(action: string, type: ActivityLog['type'], target?: string): void {
    const actorName = this.adminDisplayName();
    const newLog: ActivityLog = {
      id: 'log-' + Date.now(),
      action,
      actor: actorName,
      actorRole: 'admin',
      target,
      timestamp: 'Just now',
      type,
    };
    this.activityLogs.update((curr) => [newLog, ...curr]);

    // Persist to Cloud Firestore activityLogs collection
    this.activityLogSvc.logActivity({
      userName: actorName,
      userRole: 'admin',
      userEmail: target,
      targetRecordId: target,
      activity: action,
    }).catch(() => undefined);
  }

  notify(msg: string, isError = false): void {
    this.feedback.set(msg);
    this.feedbackError.set(isError);
    setTimeout(() => {
      if (this.feedback() === msg) {
        this.feedback.set('');
      }
    }, 4500);
  }
}

