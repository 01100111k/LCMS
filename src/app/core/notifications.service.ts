import { Injectable, computed, inject, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export interface ClinicNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  route?: string;
  type?: 'approval' | 'appointment' | 'alert' | 'system' | 'patient';
  targetUserId?: string | null;
  targetRole?: 'admin' | 'midwife' | 'patient' | 'all';
  createdAt?: any;
}

const DEFAULT_ADMIN_NOTIFS: ClinicNotification[] = [
  {
    id: 'admin-1',
    title: 'Pending Staff Verification',
    message: '1 midwife registration submitted credentials awaiting admin review.',
    time: '15m ago',
    read: false,
    route: '/admin/pending-approvals',
    type: 'approval',
    targetRole: 'admin',
  },
  {
    id: 'admin-2',
    title: 'Facility System Security',
    message: 'Tier 1 Administrative governance verified & active.',
    time: '2h ago',
    read: false,
    route: '/admin/settings',
    type: 'system',
    targetRole: 'admin',
  },
];

const DEFAULT_MIDWIFE_NOTIFS: ClinicNotification[] = [
  {
    id: 'midwife-1',
    title: 'Upcoming Prenatal Checkup',
    message: 'Althea Dominguez is scheduled for 24 wks prenatal check today at 9:00 AM.',
    time: '10m ago',
    read: false,
    route: '/midwife/appointments',
    type: 'appointment',
    targetRole: 'midwife',
  },
  {
    id: 'midwife-2',
    title: 'Postpartum Follow-up Alert',
    message: 'Marisol Tan has a glucose screening result overdue by 2 days.',
    time: '1h ago',
    read: false,
    route: '/midwife/postpartum',
    type: 'alert',
    targetRole: 'midwife',
  },
  {
    id: 'midwife-3',
    title: 'New Patient Record',
    message: 'Fatima Abdullah prenatal profile updated with blood type O+.',
    time: '3h ago',
    read: true,
    route: '/midwife/patients',
    type: 'patient',
    targetRole: 'midwife',
  },
];

const DEFAULT_PATIENT_NOTIFS: ClinicNotification[] = [
  {
    id: 'patient-1',
    title: 'Upcoming Prenatal Appointment',
    message: 'Your next prenatal checkup is scheduled for this coming week.',
    time: '2h ago',
    read: false,
    type: 'appointment',
    targetRole: 'patient',
  },
  {
    id: 'patient-2',
    title: 'Health Tip & Hydration',
    message: 'Remember to track your daily fetal movement kick counts and stay well hydrated.',
    time: '1d ago',
    read: true,
    type: 'alert',
    targetRole: 'patient',
  },
];

function formatTimeAgo(timestamp: any): string {
  if (!timestamp) return 'Just now';
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    return 'Just now';
  }

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function loadFromStorage(key: string, defaults: ClinicNotification[]): ClinicNotification[] {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return defaults;
    }
    return JSON.parse(raw);
  } catch {
    return defaults;
  }
}

function saveToStorage(key: string, data: ClinicNotification[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly adminStorageKey = 'lcms_notifications_admin_v1';
  private readonly midwifeStorageKey = 'lcms_notifications_midwife_v1';
  private readonly patientStorageKey = 'lcms_notifications_patient_v1';

  readonly adminNotifications = signal<ClinicNotification[]>(
    loadFromStorage(this.adminStorageKey, DEFAULT_ADMIN_NOTIFS)
  );

  readonly midwifeNotifications = signal<ClinicNotification[]>(
    loadFromStorage(this.midwifeStorageKey, DEFAULT_MIDWIFE_NOTIFS)
  );

  readonly patientNotifications = signal<ClinicNotification[]>(
    loadFromStorage(this.patientStorageKey, DEFAULT_PATIENT_NOTIFS)
  );

  readonly adminUnreadCount = computed(
    () => this.adminNotifications().filter((n) => !n.read).length
  );

  readonly midwifeUnreadCount = computed(
    () => this.midwifeNotifications().filter((n) => !n.read).length
  );

  readonly patientUnreadCount = computed(
    () => this.patientNotifications().filter((n) => !n.read).length
  );

  private unsubscribe?: () => void;

  constructor() {
    this.initRealtimeListener();
  }

  initRealtimeListener(): void {
    if (this.unsubscribe) return;
    try {
      const notifsCol = collection(db, 'notifications');
      this.unsubscribe = onSnapshot(
        notifsCol,
        (snap) => {
          if (snap.empty) return;
          const currentUid = auth.currentUser?.uid;
          const currentEmail = auth.currentUser?.email?.toLowerCase() || '';
          const isAdmin = currentEmail.startsWith('admin@');

          const allDbNotifs: ClinicNotification[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data['title'] || 'Notification',
              message: data['message'] || '',
              time: formatTimeAgo(data['createdAt'] || data['timestamp']),
              read: !!data['read'],
              route: data['route'],
              type: data['type'] || 'system',
              targetUserId: data['targetUserId'],
              targetRole: data['targetRole'],
              createdAt: data['createdAt'],
            };
          });

          // Sort by newest
          allDbNotifs.sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
            return timeB - timeA;
          });

          // 1. Admin notifications
          const adminList = allDbNotifs.filter(
            (n) => n.targetRole === 'admin' || n.targetRole === 'all' || !n.targetRole
          );
          if (adminList.length > 0) {
            this.adminNotifications.set(adminList);
            saveToStorage(this.adminStorageKey, adminList);
          }

          // 2. Midwife notifications
          const midwifeList = allDbNotifs.filter((n) => {
            if (n.targetUserId && n.targetUserId === currentUid) return true;
            return n.targetRole === 'midwife' || n.targetRole === 'all';
          });
          if (midwifeList.length > 0) {
            this.midwifeNotifications.set(midwifeList);
            saveToStorage(this.midwifeStorageKey, midwifeList);
          }

          // 3. Patient notifications
          const patientList = allDbNotifs.filter((n) => {
            if (n.targetUserId && n.targetUserId === currentUid) return true;
            return n.targetRole === 'patient';
          });
          if (patientList.length > 0) {
            this.patientNotifications.set(patientList);
            saveToStorage(this.patientStorageKey, patientList);
          }
        },
        () => {
          // Fallback to storage silently if offline or rules block
        }
      );
    } catch {
      // offline fallback
    }
  }

  /**
   * Creates a new notification in Firestore.
   */
  async createNotification(notif: {
    title: string;
    message: string;
    type?: 'approval' | 'appointment' | 'alert' | 'system' | 'patient';
    route?: string;
    targetUserId?: string | null;
    targetRole?: 'admin' | 'midwife' | 'patient' | 'all';
  }): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...notif,
        read: false,
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
      });
      return docRef.id;
    } catch {
      return 'local-notif-' + Date.now();
    }
  }

  // ==================== ADMIN ACTIONS ====================
  markAllAdminRead(): void {
    const list = this.adminNotifications();
    const updated = list.map((item) => ({ ...item, read: true }));
    this.adminNotifications.set(updated);
    saveToStorage(this.adminStorageKey, updated);

    // Sync to Firestore
    try {
      const batch = writeBatch(db);
      for (const item of list) {
        if (!item.id.startsWith('admin-')) {
          batch.update(doc(db, 'notifications', item.id), { read: true, updatedAt: serverTimestamp() });
        }
      }
      batch.commit().catch(() => {});
    } catch {}
  }

  markAdminItemRead(id: string): void {
    this.adminNotifications.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...item, read: true } : item));
      saveToStorage(this.adminStorageKey, updated);
      return updated;
    });

    if (!id.startsWith('admin-')) {
      updateDoc(doc(db, 'notifications', id), { read: true, updatedAt: serverTimestamp() }).catch(() => {});
    }
  }

  // ==================== MIDWIFE ACTIONS ====================
  markAllMidwifeRead(): void {
    const list = this.midwifeNotifications();
    const updated = list.map((item) => ({ ...item, read: true }));
    this.midwifeNotifications.set(updated);
    saveToStorage(this.midwifeStorageKey, updated);

    try {
      const batch = writeBatch(db);
      for (const item of list) {
        if (!item.id.startsWith('midwife-')) {
          batch.update(doc(db, 'notifications', item.id), { read: true, updatedAt: serverTimestamp() });
        }
      }
      batch.commit().catch(() => {});
    } catch {}
  }

  markMidwifeItemRead(id: string): void {
    this.midwifeNotifications.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...item, read: true } : item));
      saveToStorage(this.midwifeStorageKey, updated);
      return updated;
    });

    if (!id.startsWith('midwife-')) {
      updateDoc(doc(db, 'notifications', id), { read: true, updatedAt: serverTimestamp() }).catch(() => {});
    }
  }

  // ==================== PATIENT ACTIONS ====================
  markAllPatientRead(): void {
    const list = this.patientNotifications();
    const updated = list.map((item) => ({ ...item, read: true }));
    this.patientNotifications.set(updated);
    saveToStorage(this.patientStorageKey, updated);

    try {
      const batch = writeBatch(db);
      for (const item of list) {
        if (!item.id.startsWith('patient-')) {
          batch.update(doc(db, 'notifications', item.id), { read: true, updatedAt: serverTimestamp() });
        }
      }
      batch.commit().catch(() => {});
    } catch {}
  }

  markPatientItemRead(id: string): void {
    this.patientNotifications.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...item, read: true } : item));
      saveToStorage(this.patientStorageKey, updated);
      return updated;
    });

    if (!id.startsWith('patient-')) {
      updateDoc(doc(db, 'notifications', id), { read: true, updatedAt: serverTimestamp() }).catch(() => {});
    }
  }
}
