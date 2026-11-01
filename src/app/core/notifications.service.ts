import { Injectable, computed, signal } from '@angular/core';

export interface ClinicNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  route?: string;
  type?: 'approval' | 'appointment' | 'alert' | 'system' | 'patient';
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
  },
  {
    id: 'admin-2',
    title: 'Facility System Security',
    message: 'Tier 1 Administrative governance verified & active.',
    time: '2h ago',
    read: false,
    route: '/admin/settings',
    type: 'system',
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
  },
  {
    id: 'midwife-2',
    title: 'Postpartum Follow-up Alert',
    message: 'Marisol Tan has a glucose screening result overdue by 2 days.',
    time: '1h ago',
    read: false,
    route: '/midwife/postpartum',
    type: 'alert',
  },
  {
    id: 'midwife-3',
    title: 'New Patient Record',
    message: 'Fatima Abdullah prenatal profile updated with blood type O+.',
    time: '3h ago',
    read: true,
    route: '/midwife/patients',
    type: 'patient',
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
  },
  {
    id: 'patient-2',
    title: 'Health Tip & Hydration',
    message: 'Remember to track your daily fetal movement kick counts and stay well hydrated.',
    time: '1d ago',
    read: true,
    type: 'alert',
  },
];

function loadFromStorage(key: string, defaults: ClinicNotification[]): ClinicNotification[] {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      localStorage.setItem(key, JSON.stringify(defaults));
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

  // ==================== ADMIN ACTIONS ====================
  markAllAdminRead(): void {
    this.adminNotifications.set([]);
    saveToStorage(this.adminStorageKey, []);
  }

  markAdminItemRead(id: string): void {
    this.adminNotifications.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...item, read: true } : item));
      saveToStorage(this.adminStorageKey, updated);
      return updated;
    });
  }

  // ==================== MIDWIFE ACTIONS ====================
  markAllMidwifeRead(): void {
    this.midwifeNotifications.set([]);
    saveToStorage(this.midwifeStorageKey, []);
  }

  markMidwifeItemRead(id: string): void {
    this.midwifeNotifications.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...item, read: true } : item));
      saveToStorage(this.midwifeStorageKey, updated);
      return updated;
    });
  }

  // ==================== PATIENT ACTIONS ====================
  markAllPatientRead(): void {
    this.patientNotifications.set([]);
    saveToStorage(this.patientStorageKey, []);
  }

  markPatientItemRead(id: string): void {
    this.patientNotifications.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...item, read: true } : item));
      saveToStorage(this.patientStorageKey, updated);
      return updated;
    });
  }
}

