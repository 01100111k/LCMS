import { Injectable, inject } from '@angular/core';
import {
  collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ActivityLogService } from './activity-log.service';
import { AuthService } from './auth.service';
import { NotificationsService } from './notifications.service';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'requested' | 'completed' | 'cancelled';

export const APPOINTMENT_TYPES = [
  'Prenatal',
  'Postpartum',
  'Delivery',
  'Consultation',
  'Follow-up',
  'First Trimester Scan',
  'Lab Test',
  'Newborn check',
  'Other',
];

export interface BlockedDate {
  date: string; // YYYY-MM-DD
  reason: string;
  createdAt?: any;
}

export interface WeekDaySetting {
  dayName: string;
  dayIndex: number; // 0=Sun..6=Sat
  enabled: boolean;
  startTime: string; // "08:00 AM"
  endTime: string;   // "05:00 PM"
  slotDuration: string; // "30 min"
  breakStart?: string;
  breakEnd?: string;
}

export interface MidwifeAvailability {
  midwifeId: string;
  midwifeName?: string;
  weeklyHours: WeekDaySetting[];
  blockedDates: BlockedDate[];
  updatedAt?: any;
}

export function defaultWeeklyHours(): WeekDaySetting[] {
  return [
    { dayName: 'Sunday', dayIndex: 0, enabled: false, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Monday', dayIndex: 1, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Tuesday', dayIndex: 2, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Wednesday', dayIndex: 3, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Thursday', dayIndex: 4, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Friday', dayIndex: 5, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
    { dayName: 'Saturday', dayIndex: 6, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
  ];
}

/** Clinic hours. Change these to match your facility. Days: 0 = Sunday ... 6 = Saturday. */
export const CLINIC = {
  openDays: [1, 2, 3, 4, 5, 6],
  start: '08:00',
  end: '17:00',
  slotMinutes: 30,
  breakStart: '12:00',
  breakEnd: '13:00',
};

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: string;
  notes: string;
  status: AppointmentStatus;
  service?: string;
  midwifeName?: string;
  assignedMidwifeId?: string | null;
  midwifeId?: string | null;
  createdBy?: string | null;
  completedAt?: any;
  cancelledAt?: any;
  timeStatus?: 'completed' | 'cancelled' | 'ongoing' | 'upcoming' | 'overdue';
}

export interface Booking {
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  type: string;
  notes: string;
  status?: AppointmentStatus;
  service?: string;
  midwifeName?: string;
  assignedMidwifeId?: string | null;
  midwifeId?: string | null;
}

// ---------- Asia/Manila date/time helpers ----------
const pad = (n: number) => String(n).padStart(2, '0');
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export function getManilaDate(date: Date = new Date()): { year: string; month: string; day: string; hours: string; minutes: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) partMap[p.type] = p.value;
    return {
      year: partMap['year'] || '2026',
      month: partMap['month'] || '11',
      day: partMap['day'] || '19',
      hours: partMap['hour'] || '08',
      minutes: partMap['minute'] || '00',
    };
  } catch {
    return {
      year: String(date.getFullYear()),
      month: pad(date.getMonth() + 1),
      day: pad(date.getDate()),
      hours: pad(date.getHours()),
      minutes: pad(date.getMinutes()),
    };
  }
}

export function toIso(d: Date): string {
  const m = getManilaDate(d);
  return `${m.year}-${m.month}-${m.day}`;
}

export function todayIso(): string {
  const m = getManilaDate();
  return `${m.year}-${m.month}-${m.day}`;
}

export function currentManilaTime(): string {
  const m = getManilaDate();
  return `${m.hours}:${m.minutes}`;
}

export function getAppointmentTimeStatus(
  date: string,
  time: string,
  status: AppointmentStatus
): 'completed' | 'cancelled' | 'ongoing' | 'upcoming' | 'overdue' {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';

  const today = todayIso();
  const nowTime = currentManilaTime();

  if (date < today) {
    return 'overdue';
  } else if (date > today) {
    return 'upcoming';
  } else {
    const [h, m] = time.split(':').map(Number);
    const startMinutes = (h || 0) * 60 + (m || 0);
    const endMinutes = startMinutes + 30;
    const [nowH, nowM] = nowTime.split(':').map(Number);
    const currentMinutes = (nowH || 0) * 60 + (nowM || 0);

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return 'ongoing';
    } else if (currentMinutes < startMinutes) {
      return 'upcoming';
    } else {
      return 'overdue';
    }
  }
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "14:30" -> "2:30 PM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Every bookable time on a date (empty when the clinic is closed that day). */
export function slotsFor(date: string): string[] {
  if (!CLINIC.openDays.includes(parseIso(date).getDay())) return [];
  const out: string[] = [];
  const end = toMinutes(CLINIC.end);
  for (let t = toMinutes(CLINIC.start); t + CLINIC.slotMinutes <= end; t += CLINIC.slotMinutes) {
    if (t >= toMinutes(CLINIC.breakStart) && t < toMinutes(CLINIC.breakEnd)) continue;
    out.push(fromMinutes(t));
  }
  return out;
}

export function isPast(date: string, time: string): boolean {
  const today = todayIso();
  const now = currentManilaTime();
  if (date < today) return true;
  if (date > today) return false;
  return toMinutes(time) < toMinutes(now);
}

export const slotKey = (date: string, time: string, midwifeId?: string | null) =>
  midwifeId ? `${midwifeId}_${date}_${time.replace(':', '')}` : `${date}_${time.replace(':', '')}`;

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private activityLog = inject(ActivityLogService);
  private auth = inject(AuthService);
  private notifSvc = inject(NotificationsService);

  getCurrentRole(): string {
    const r = this.auth.role();
    if (r) return r;
    const email = auth.currentUser?.email?.toLowerCase() || '';
    if (email.startsWith('admin@')) return 'admin';
    return '';
  }

  async list(): Promise<Appointment[]> {
    const currentUid = auth.currentUser?.uid || this.auth.user()?.uid;
    const role = this.getCurrentRole();
    let dbAppts: Appointment[] = [];

    try {
      if (role === 'admin') {
        // Admin sees all clinic appointments
        const snap = await getDocs(collection(db, 'appointments'));
        dbAppts = snap.docs.map((d) => this.toAppointment(d.id, d.data()));
      } else if (role === 'patient' && currentUid) {
        // Patient only sees their own appointments
        const q = query(collection(db, 'appointments'), where('patientId', '==', currentUid));
        const snap = await getDocs(q);
        dbAppts = snap.docs.map((d) => this.toAppointment(d.id, d.data()));
      } else if (currentUid) {
        // Midwife only sees appointments assigned to her UID
        const apptMap = new Map<string, Appointment>();

        try {
          const q1 = query(collection(db, 'appointments'), where('assignedMidwifeId', '==', currentUid));
          const snap1 = await getDocs(q1);
          snap1.docs.forEach((d) => apptMap.set(d.id, this.toAppointment(d.id, d.data())));
        } catch (e1) {
          console.warn('AppointmentsService.list q1 error:', e1);
        }

        try {
          const q2 = query(collection(db, 'appointments'), where('midwifeId', '==', currentUid));
          const snap2 = await getDocs(q2);
          snap2.docs.forEach((d) => {
            if (!apptMap.has(d.id)) {
              apptMap.set(d.id, this.toAppointment(d.id, d.data()));
            }
          });
        } catch {
          // ignore
        }

        dbAppts = Array.from(apptMap.values());
      }
    } catch (e) {
      console.warn('AppointmentsService.list error:', e);
      dbAppts = [];
    }

    return this.sorted(dbAppts);
  }

  async listForDate(date: string): Promise<Appointment[]> {
    const all = await this.list();
    return all.filter((a) => a.date === date);
  }

  async listForPatient(patientId: string): Promise<Appointment[]> {
    try {
      const q = query(collection(db, 'appointments'), where('patientId', '==', patientId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => this.toAppointment(d.id, d.data()));
      return this.sorted(list);
    } catch {
      const all = await this.list();
      return all.filter((a) => a.patientId === patientId);
    }
  }

  async get(id: string): Promise<Appointment | null> {
    try {
      const snap = await getDoc(doc(db, 'appointments', id));
      if (snap.exists()) {
        const a = this.toAppointment(snap.id, snap.data());
        const role = this.getCurrentRole();
        const currentUid = auth.currentUser?.uid || this.auth.user()?.uid;
        if (role === 'midwife' && currentUid) {
          const ownerMidwife = a.assignedMidwifeId || a.midwifeId || a.createdBy;
          if (ownerMidwife && ownerMidwife !== currentUid) {
            return null; // Denied: appointment belongs to another midwife
          }
        }
        return a;
      }
    } catch {
      // fallback
    }

    return null;
  }

  /** Booked times between two dates: { date: { time: appointmentId } } */
  async bookedBetween(from: string, to: string): Promise<Record<string, Record<string, string>>> {
    const all = await this.list();
    const out: Record<string, Record<string, string>> = {};
    for (const a of all) {
      if (a.date >= from && a.date <= to && a.status !== 'cancelled') {
        (out[a.date] ??= {})[a.time] = a.id;
      }
    }
    return out;
  }

  /**
   * Books a time. Each time has a "lock" document scoped to the midwife,
   * so two patients can never take the same midwife's slot.
   */
  async book(b: Booking): Promise<string> {
    const currentUid = auth.currentUser?.uid ?? null;
    let assignedMidwifeId = b.assignedMidwifeId || b.midwifeId || null;
    if (!assignedMidwifeId) {
      if (this.getCurrentRole() === 'midwife') {
        assignedMidwifeId = currentUid;
      } else if (b.patientId) {
        try {
          const pSnap = await getDoc(doc(db, 'patients', b.patientId));
          if (pSnap.exists()) {
            const pData = pSnap.data();
            assignedMidwifeId = pData['assignedMidwifeId'] || pData['midwifeId'] || null;
          }
        } catch {}
      }
    }

    const slotKeyVal = slotKey(b.date, b.time, assignedMidwifeId);
    const slotRef = doc(db, 'bookedSlots', slotKeyVal);
    const apptRef = doc(collection(db, 'appointments'));

    await runTransaction(db, async (tx) => {
      if ((await tx.get(slotRef)).exists()) throw new Error('slot-taken');
      tx.set(slotRef, { appointmentId: apptRef.id, midwifeId: assignedMidwifeId, date: b.date, time: b.time });
      tx.set(apptRef, {
        ...b,
        assignedMidwifeId,
        midwifeId: assignedMidwifeId,
        status: b.status || 'scheduled',
        createdAt: serverTimestamp(),
        createdBy: currentUid,
      });
    });

    this.activityLog.logActivity({
      userName: b.patientName || 'Patient',
      userRole: 'patient',
      userId: b.patientId,
      targetRecordId: apptRef.id,
      activity: `Appointment booked for ${b.patientName} (${b.type}) on ${b.date} at ${b.time}`,
    }).catch(() => undefined);

    // Notify midwife about the new booking if made by patient
    if (assignedMidwifeId && currentUid !== assignedMidwifeId) {
      this.notifSvc.createNotification({
        title: `New Appointment: ${b.patientName}`,
        message: `${b.patientName} scheduled a ${b.type} on ${b.date} at ${formatTime(b.time)}.`,
        type: 'appointment',
        route: '/midwife/appointments',
        targetUserId: assignedMidwifeId,
        targetRole: 'midwife',
        patientUid: b.patientId,
        patientName: b.patientName,
      }).catch(() => undefined);
    }

    // Notify patient if appointment was created by midwife
    if (b.patientId && currentUid !== b.patientId) {
      this.notifSvc.createNotification({
        title: 'New Appointment Scheduled',
        message: 'Your midwife has scheduled an appointment for you. Please check your appointment details.',
        type: 'appointment',
        route: '/patient/portal',
        targetUserId: b.patientId,
        targetRole: 'patient',
        patientUid: b.patientId,
        patientName: b.patientName,
      }).catch(() => undefined);
    }

    return apptRef.id;
  }

  /** Reschedules and/or edits the details of a scheduled appointment. */
  async update(id: string, change: { date: string; time: string; type: string; notes: string }): Promise<void> {
    let patientName = '';
    let patientUid = '';
    await runTransaction(db, async (tx) => {
      const apptRef = doc(db, 'appointments', id);
      const appt = await tx.get(apptRef);
      if (!appt.exists()) throw new Error('not-found');
      if (appt.data()['status'] === 'cancelled') throw new Error('not-scheduled');
      patientName = appt.data()['patientName'] || '';
      patientUid = appt.data()['patientId'] || appt.data()['patientUid'] || '';
      const midwifeId = appt.data()['assignedMidwifeId'] || appt.data()['midwifeId'] || null;

      const oldKey = slotKey(String(appt.data()['date']), String(appt.data()['time']), midwifeId);
      const newKey = slotKey(change.date, change.time, midwifeId);
      if (newKey !== oldKey) {
        const newRef = doc(db, 'bookedSlots', newKey);
        if ((await tx.get(newRef)).exists()) throw new Error('slot-taken');
        tx.delete(doc(db, 'bookedSlots', oldKey));
        tx.set(newRef, { appointmentId: id, midwifeId, date: change.date, time: change.time });
      }
      tx.update(apptRef, { ...change, updatedAt: serverTimestamp() });
    });

    this.activityLog.logActivity({
      userName: patientName || 'Patient',
      userRole: 'midwife',
      targetRecordId: id,
      activity: `Appointment rescheduled to ${change.date} at ${change.time}${patientName ? ' (' + patientName + ')' : ''}`,
    }).catch(() => undefined);

    // Notify patient about rescheduled appointment
    if (patientUid) {
      this.notifSvc.createNotification({
        title: 'Appointment Updated',
        message: 'Your appointment schedule has been changed. Please review your updated appointment details.',
        type: 'appointment',
        route: '/patient/portal',
        targetUserId: patientUid,
        targetRole: 'patient',
        patientUid,
        patientName,
      }).catch(() => undefined);
    }
  }

  /** Change appointment status with bookedSlots synchronization */
  async setStatus(id: string, newStatus: AppointmentStatus): Promise<void> {
    let patientName = '';
    let patientUid = '';
    let apptDate = '';
    let apptTime = '';
    try {
      const apptRef = doc(db, 'appointments', id);
      const snap = await getDoc(apptRef);
      if (snap.exists()) {
        const data = snap.data();
        patientName = data['patientName'] || '';
        patientUid = data['patientId'] || data['patientUid'] || '';
        apptDate = String(data['date'] || '');
        apptTime = String(data['time'] || '');
        const curStatus = (data['status'] as AppointmentStatus) || 'scheduled';
        const midwifeId = data['assignedMidwifeId'] || data['midwifeId'] || null;
        const key = slotKey(apptDate, apptTime, midwifeId);
        const slotRef = doc(db, 'bookedSlots', key);

        if (newStatus === 'cancelled' && curStatus !== 'cancelled') {
          await runTransaction(db, async (tx) => {
            tx.delete(slotRef);
            tx.update(apptRef, { status: 'cancelled', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
          });
        } else if (newStatus !== 'cancelled' && curStatus === 'cancelled') {
          await runTransaction(db, async (tx) => {
            const slotSnap = await tx.get(slotRef);
            if (slotSnap.exists() && slotSnap.data()['appointmentId'] !== id) {
              throw new Error('slot-taken');
            }
            tx.set(slotRef, { appointmentId: id, midwifeId, date: apptDate, time: apptTime });
            tx.update(apptRef, { status: newStatus, updatedAt: serverTimestamp() });
          });
        } else if (newStatus === 'completed') {
          await updateDoc(apptRef, {
            status: 'completed',
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(apptRef, { status: newStatus, updatedAt: serverTimestamp() });
        }
      }
    } catch {
      // ignore
    }

    this.activityLog.logActivity({
      userName: patientName || 'Patient',
      userRole: this.getCurrentRole() === 'admin' ? 'admin' : this.getCurrentRole() === 'midwife' ? 'midwife' : 'patient',
      targetRecordId: id,
      activity: `Appointment status updated to ${newStatus}${patientName ? ' for ' + patientName : ''}`,
    }).catch(() => undefined);

    // Notify patient about status change
    if (patientUid) {
      let title = 'Appointment Updated';
      let message = `Your appointment on ${apptDate} at ${formatTime(apptTime)} is now ${newStatus}.`;

      if (newStatus === 'confirmed') {
        title = 'Appointment Confirmed';
        message = 'Your appointment has been confirmed.';
      } else if (newStatus === 'cancelled') {
        title = 'Appointment Cancelled';
        message = 'Your appointment has been cancelled. Please contact your midwife if you need assistance.';
      } else if (newStatus === 'completed') {
        title = 'Consultation Completed';
        message = 'Your consultation has been marked as completed. Thank you!';
      }

      this.notifSvc.createNotification({
        title,
        message,
        type: 'appointment',
        route: '/patient/portal',
        targetUserId: patientUid,
        targetRole: 'patient',
        patientUid,
        patientName,
      }).catch(() => undefined);
    }
  }

  async cancel(id: string): Promise<void> {
    return this.setStatus(id, 'cancelled');
  }

  async complete(id: string): Promise<void> {
    return this.setStatus(id, 'completed');
  }

  // ==================== AVAILABILITY & BLOCKED DATES ====================
  async getMidwifeAvailability(midwifeId: string): Promise<MidwifeAvailability> {
    try {
      const snap = await getDoc(doc(db, 'midwife_availability', midwifeId));
      if (snap.exists()) {
        const data = snap.data();
        return {
          midwifeId,
          midwifeName: data['midwifeName'] || 'Licensed Midwife',
          weeklyHours: data['weeklyHours'] || defaultWeeklyHours(),
          blockedDates: data['blockedDates'] || [],
          updatedAt: data['updatedAt'],
        };
      }
    } catch (e) {
      console.warn('getMidwifeAvailability error:', e);
    }
    return {
      midwifeId,
      midwifeName: 'Licensed Midwife',
      weeklyHours: defaultWeeklyHours(),
      blockedDates: [],
    };
  }

  async saveMidwifeAvailability(midwifeId: string, availability: Partial<MidwifeAvailability>): Promise<void> {
    const docRef = doc(db, 'midwife_availability', midwifeId);
    await setDoc(
      docRef,
      {
        ...availability,
        midwifeId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    this.activityLog.logActivity({
      userName: availability.midwifeName || 'Midwife',
      userRole: 'midwife',
      targetRecordId: midwifeId,
      activity: `Updated weekly availability and working hours schedule`,
    }).catch(() => undefined);
  }

  async getBlockedDates(midwifeId: string): Promise<BlockedDate[]> {
    const avail = await this.getMidwifeAvailability(midwifeId);
    return avail.blockedDates || [];
  }

  async addBlockedDate(midwifeId: string, date: string, reason: string): Promise<void> {
    const avail = await this.getMidwifeAvailability(midwifeId);
    const existing = avail.blockedDates || [];
    if (!existing.some((b) => b.date === date)) {
      const updated = [...existing, { date, reason: reason || 'Time off', createdAt: new Date().toISOString() }];
      updated.sort((a, b) => a.date.localeCompare(b.date));
      await this.saveMidwifeAvailability(midwifeId, { blockedDates: updated });
    }
  }

  async removeBlockedDate(midwifeId: string, date: string): Promise<void> {
    const avail = await this.getMidwifeAvailability(midwifeId);
    const updated = (avail.blockedDates || []).filter((b) => b.date !== date);
    await this.saveMidwifeAvailability(midwifeId, { blockedDates: updated });
  }

  async checkExistingAppointmentsOnDate(midwifeId: string, date: string): Promise<Appointment[]> {
    const q = query(
      collection(db, 'appointments'),
      where('assignedMidwifeId', '==', midwifeId),
      where('date', '==', date)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => this.toAppointment(d.id, d.data()))
      .filter((a) => a.status !== 'cancelled');
  }

  async getAvailableSlots(midwifeId: string, date: string): Promise<string[]> {
    const avail = await this.getMidwifeAvailability(midwifeId);

    // 1. If date is blocked, return no slots
    if ((avail.blockedDates || []).some((b) => b.date === date)) {
      return [];
    }

    // 2. Check day of week
    const dayOfWeek = parseIso(date).getDay();
    const daySetting = (avail.weeklyHours || []).find((w) => w.dayIndex === dayOfWeek);
    if (!daySetting || !daySetting.enabled) {
      return [];
    }

    // Parse start and end times
    const parseTimeStr = (t: string): number => {
      if (!t) return 0;
      const clean = t.trim();
      const isPm = /pm/i.test(clean);
      const isAm = /am/i.test(clean);
      const parts = clean.replace(/[^\d:]/g, '').split(':').map(Number);
      let h = parts[0] || 0;
      const m = parts[1] || 0;
      if (isPm && h < 12) h += 12;
      if (isAm && h === 12) h = 0;
      return h * 60 + m;
    };

    const padMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    const startMinutes = parseTimeStr(daySetting.startTime || '08:00 AM');
    const endMinutes = parseTimeStr(daySetting.endTime || '05:00 PM');
    const duration = parseInt(daySetting.slotDuration || '30', 10) || 30;

    const breakStart = daySetting.breakStart ? parseTimeStr(daySetting.breakStart) : 12 * 60;
    const breakEnd = daySetting.breakEnd ? parseTimeStr(daySetting.breakEnd) : 13 * 60;

    const slots: string[] = [];
    for (let t = startMinutes; t + duration <= endMinutes; t += duration) {
      if (t >= breakStart && t < breakEnd) continue;
      slots.push(padMinutes(t));
    }

    // 3. Filter out past slots if date is today
    const nowSlots = date === todayIso() ? slots.filter((s) => !isPast(date, s)) : slots;

    // 4. Query active appointments for this midwife on this date
    try {
      const q = query(
        collection(db, 'appointments'),
        where('assignedMidwifeId', '==', midwifeId),
        where('date', '==', date)
      );
      const snap = await getDocs(q);
      const bookedSet = new Set<string>();
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data['status'] !== 'cancelled') {
          bookedSet.add(data['time']);
        }
      });
      return nowSlots.filter((s) => !bookedSet.has(s));
    } catch {
      return nowSlots;
    }
  }

  private sorted(list: Appointment[]): Appointment[] {
    return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  private toAppointment(id: string, d: Record<string, unknown>): Appointment {
    const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
    const validStatuses: AppointmentStatus[] = ['scheduled', 'confirmed', 'requested', 'completed', 'cancelled'];
    const rawStatus = s('status') as AppointmentStatus;
    const status: AppointmentStatus = validStatuses.includes(rawStatus) ? rawStatus : 'scheduled';
    const date = s('date');
    const time = s('time');
    return {
      id,
      patientId: s('patientId'),
      patientName: s('patientName'),
      date,
      time,
      type: s('type'),
      notes: s('notes'),
      status,
      assignedMidwifeId: s('assignedMidwifeId') || s('midwifeId') || null,
      midwifeId: s('midwifeId') || s('assignedMidwifeId') || null,
      createdBy: s('createdBy') || null,
      completedAt: d['completedAt'] || null,
      cancelledAt: d['cancelledAt'] || null,
      timeStatus: getAppointmentTimeStatus(date, time, status),
    };
  }

  errorMessage(e: unknown): string {
    const code = (e as { code?: string }).code ?? (e as Error).message;
    switch (code) {
      case 'slot-taken':
        return 'That time was just booked. Please pick another time.';
      case 'not-found':
        return 'This appointment was not found.';
      case 'not-scheduled':
        return 'This appointment is already completed or cancelled.';
      case 'permission-denied':
        return "You don't have permission to do this. Check your Firestore rules.";
      case 'unavailable':
      case 'failed-precondition':
        return 'No connection. Check your internet and try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}