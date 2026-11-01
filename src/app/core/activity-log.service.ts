import { Injectable, inject, signal } from '@angular/core';
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { parseTimestamp } from '../admin/admin.models';

export interface ActivityLogEntry {
  id?: string;
  userName: string;
  userRole: 'admin' | 'midwife' | 'patient';
  userEmail?: string;
  userId?: string;
  activity: string;
  timestamp?: any;
  createdAt?: any;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  readonly logs = signal<ActivityLogEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  private unsubscribe?: () => void;

  constructor() {
    this.initRealtimeListener();
  }

  private initRealtimeListener(): void {
    try {
      const logsCol = collection(db, 'activityLogs');
      this.unsubscribe = onSnapshot(
        logsCol,
        (snap) => {
          const list: ActivityLogEntry[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userName: data['userName'] || 'Unknown User',
              userRole: (data['userRole'] as 'admin' | 'midwife' | 'patient') || 'patient',
              userEmail: data['userEmail'] || '',
              userId: data['userId'] || '',
              activity: data['activity'] || '',
              timestamp: data['timestamp'] || data['createdAt'],
              createdAt: data['createdAt'] || data['timestamp'],
            };
          });

          // Sort descending: newest activities first
          list.sort((a, b) => {
            const timeA = parseTimestamp(a.timestamp);
            const timeB = parseTimestamp(b.timestamp);
            return timeB - timeA;
          });

          this.logs.set(list);
          this.loading.set(false);
          this.error.set('');
        },
        (err) => {
          console.warn('Activity logs realtime listener warning:', err);
          this.loading.set(false);
          this.error.set(err?.message || 'Could not load real-time activity logs');
        }
      );
    } catch (e: any) {
      console.warn('Could not initialize activity logs listener:', e);
      this.loading.set(false);
    }
  }

  /**
   * Automatically records an activity to Firestore 'activityLogs' collection.
   */
  async logActivity(entry: {
    userName: string;
    userRole: 'admin' | 'midwife' | 'patient';
    activity: string;
    userEmail?: string;
    userId?: string;
  }): Promise<void> {
    if (!entry.activity) return;

    const docData = {
      userName: entry.userName.trim(),
      userRole: entry.userRole,
      userEmail: entry.userEmail || '',
      userId: entry.userId || '',
      activity: entry.activity.trim(),
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'activityLogs'), docData);
    } catch (err) {
      console.warn('Could not write to activityLogs collection:', err);
      // Optimistic local update so user still sees it even offline
      const optimisticItem: ActivityLogEntry = {
        id: 'opt-' + Date.now(),
        ...docData,
        timestamp: new Date(),
      };
      this.logs.update((curr) => [optimisticItem, ...curr]);
    }
  }

  formatTimestamp(dateVal: any): string {
    if (!dateVal) return 'Just now';
    const ms = parseTimestamp(dateVal);
    if (!ms) return 'Just now';

    const d = new Date(ms);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

