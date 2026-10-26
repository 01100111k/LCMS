import { Injectable } from '@angular/core';
import {
  collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
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
}

export interface Booking {
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  type: string;
  notes: string;
  status?: AppointmentStatus;
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

  async list(): Promise<Appointment[]> {
    let dbAppts: Appointment[] = [];
    try {
      const snap = await getDocs(collection(db, 'appointments'));
      dbAppts = snap.docs.map((d) => this.toAppointment(d.id, d.data()));
    } catch {
      dbAppts = [];
    }

    const localEdits = this.getLocalEdits();
    const existingIds = new Set(dbAppts.map((a) => a.id));

    const mergedExamples = EXAMPLE_APPOINTMENTS.map((ex) => {
      if (localEdits[ex.id]) {
        return { ...ex, ...localEdits[ex.id] };
      }
      return ex;
    }).filter((ex) => !existingIds.has(ex.id));

    return this.sorted([...dbAppts, ...mergedExamples]);
  }

  async listForDate(date: string): Promise<Appointment[]> {
    const all = await this.list();
    return all.filter((a) => a.date === date);
  }

  async listForPatient(patientId: string): Promise<Appointment[]> {
    const all = await this.list();
    return all.filter((a) => a.patientId === patientId);
  }

  async get(id: string): Promise<Appointment | null> {
    try {
      const snap = await getDoc(doc(db, 'appointments', id));
      if (snap.exists()) return this.toAppointment(snap.id, snap.data());
    } catch {
      // fallback
    }

    const all = await this.list();
    return all.find((a) => a.id === id) || null;
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
    await runTransaction(db, async (tx) => {
      if ((await tx.get(slotRef)).exists()) throw new Error('slot-taken');
      tx.set(slotRef, { appointmentId: apptRef.id, date: b.date, time: b.time });
      tx.set(apptRef, {
        ...b,
        status: b.status || 'scheduled',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid ?? null,
      });
    });
    return apptRef.id;
  }

  /** Reschedules and/or edits the details of a scheduled appointment. */
  async update(id: string, change: { date: string; time: string; type: string; notes: string }): Promise<void> {
    await runTransaction(db, async (tx) => {
      const apptRef = doc(db, 'appointments', id);
      const appt = await tx.get(apptRef);
      if (!appt.exists()) throw new Error('not-found');
      if (appt.data()['status'] === 'cancelled') throw new Error('not-scheduled');

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
  }

  /** Change appointment status with bookedSlots synchronization */
  async setStatus(id: string, newStatus: AppointmentStatus): Promise<void> {
    try {
      const apptRef = doc(db, 'appointments', id);
      const snap = await getDoc(apptRef);
      if (snap.exists()) {
        const data = snap.data();
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