import { Injectable, inject } from '@angular/core';
import {
  collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ActivityLogService } from './activity-log.service';
import { AuthService } from './auth.service';
import { EXAMPLE_APPOINTMENTS } from './example-data';

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

// ---------- small date/time helpers (all in local time) ----------
const pad = (n: number) => String(n).padStart(2, '0');
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(): string {
  return toIso(new Date());
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
  const d = parseIso(date);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime() <= Date.now();
}

export const slotKey = (date: string, time: string) => `${date}_${time.replace(':', '')}`;

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private activityLog = inject(ActivityLogService);
  private auth = inject(AuthService);

  private getLocalEdits(): Record<string, Partial<Appointment>> {
    try {
      const raw = localStorage.getItem('lcms_example_appts_edits');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveLocalEdit(id: string, partial: Partial<Appointment>): void {
    try {
      const edits = this.getLocalEdits();
      edits[id] = { ...(edits[id] || {}), ...partial };
      localStorage.setItem('lcms_example_appts_edits', JSON.stringify(edits));
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

  async list(): Promise<Appointment[]> {
    const currentUid = auth.currentUser?.uid;
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
        const q = query(collection(db, 'appointments'), where('assignedMidwifeId', '==', currentUid));
        const snap = await getDocs(q);
        dbAppts = snap.docs.map((d) => this.toAppointment(d.id, d.data()));
      }
    } catch (e) {
      console.warn('AppointmentsService.list error:', e);
      dbAppts = [];
    }

    if (this.isMidwifeDemoUser()) {
      const localEdits = this.getLocalEdits();
      const existingIds = new Set(dbAppts.map((a) => a.id));
      const examples = EXAMPLE_APPOINTMENTS.map((a) => ({ ...a, ...(localEdits[a.id] || {}) })).filter(
        (a) => !existingIds.has(a.id),
      );
      return this.sorted([...dbAppts, ...examples]);
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
      if (snap.exists()) return this.toAppointment(snap.id, snap.data());
    } catch {
      // fallback
    }

    if (this.isMidwifeDemoUser()) {
      const found = EXAMPLE_APPOINTMENTS.find((a) => a.id === id);
      if (found) {
        const edits = this.getLocalEdits();
        return { ...found, ...(edits[id] || {}) };
      }
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
   * Books a time. Each time has a "lock" document, so two people can never
   * take the same time, even if they click at the same moment.
   */
  async book(b: Booking): Promise<string> {
    const slotRef = doc(db, 'bookedSlots', slotKey(b.date, b.time));
    const apptRef = doc(collection(db, 'appointments'));

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

    await runTransaction(db, async (tx) => {
      if ((await tx.get(slotRef)).exists()) throw new Error('slot-taken');
      tx.set(slotRef, { appointmentId: apptRef.id, date: b.date, time: b.time });
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

    return apptRef.id;
  }

  /** Reschedules and/or edits the details of a scheduled appointment. */
  async update(id: string, change: { date: string; time: string; type: string; notes: string }): Promise<void> {
    let patientName = '';
    await runTransaction(db, async (tx) => {
      const apptRef = doc(db, 'appointments', id);
      const appt = await tx.get(apptRef);
      if (!appt.exists()) throw new Error('not-found');
      if (appt.data()['status'] === 'cancelled') throw new Error('not-scheduled');
      patientName = appt.data()['patientName'] || '';

      const oldKey = slotKey(String(appt.data()['date']), String(appt.data()['time']));
      const newKey = slotKey(change.date, change.time);
      if (newKey !== oldKey) {
        const newRef = doc(db, 'bookedSlots', newKey);
        if ((await tx.get(newRef)).exists()) throw new Error('slot-taken');
        tx.delete(doc(db, 'bookedSlots', oldKey));
        tx.set(newRef, { appointmentId: id, date: change.date, time: change.time });
      }
      tx.update(apptRef, { ...change, updatedAt: serverTimestamp() });
    });

    this.activityLog.logActivity({
      userName: patientName || 'Patient',
      userRole: 'midwife',
      targetRecordId: id,
      activity: `Appointment rescheduled to ${change.date} at ${change.time}${patientName ? ' (' + patientName + ')' : ''}`,
    }).catch(() => undefined);
  }

  /** Change appointment status with bookedSlots synchronization */
  async setStatus(id: string, newStatus: AppointmentStatus): Promise<void> {
    let patientName = '';
    try {
      const apptRef = doc(db, 'appointments', id);
      const snap = await getDoc(apptRef);
      if (snap.exists()) {
        const data = snap.data();
        patientName = data['patientName'] || '';
        const curStatus = (data['status'] as AppointmentStatus) || 'scheduled';
        const key = slotKey(String(data['date']), String(data['time']));
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
            tx.set(slotRef, { appointmentId: id, date: data['date'], time: data['time'] });
            tx.update(apptRef, { status: newStatus, updatedAt: serverTimestamp() });
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

    // Always record the status in local edits so example appointments and offline work immediately
    this.saveLocalEdit(id, { status: newStatus });
  }

  async cancel(id: string): Promise<void> {
    return this.setStatus(id, 'cancelled');
  }

  async complete(id: string): Promise<void> {
    return this.setStatus(id, 'completed');
  }

  private sorted(list: Appointment[]): Appointment[] {
    return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  private toAppointment(id: string, d: Record<string, unknown>): Appointment {
    const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
    const validStatuses: AppointmentStatus[] = ['scheduled', 'confirmed', 'requested', 'completed', 'cancelled'];
    const rawStatus = s('status') as AppointmentStatus;
    const status: AppointmentStatus = validStatuses.includes(rawStatus) ? rawStatus : 'scheduled';
    return {
      id,
      patientId: s('patientId'),
      patientName: s('patientName'),
      date: s('date'),
      time: s('time'),
      type: s('type'),
      notes: s('notes'),
      status,
      assignedMidwifeId: s('assignedMidwifeId') || s('midwifeId') || null,
      midwifeId: s('midwifeId') || s('assignedMidwifeId') || null,
      createdBy: s('createdBy') || null,
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