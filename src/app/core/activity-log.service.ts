import { Injectable, signal } from '@angular/core';
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { parseTimestamp } from '../admin/models/admin.models';

export interface ActivityLogEntry {
  id?: string;
  userName: string;
  userRole: 'admin' | 'midwife' | 'patient';
  userEmail?: string;
  userId?: string;
  activity: string;
  targetRecordId?: string;
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

  initRealtimeListener(): void {
    if (this.unsubscribe) return;
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
              targetRecordId: data['targetRecordId'] || '',
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
          this.loading.set(false);
          if (err?.code !== 'permission-denied') {
            this.error.set(err?.message || 'Could not load real-time activity logs');
          }
        }
      );
    } catch {
      this.loading.set(false);
    }
  }

  stopRealtimeListener(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  /**
   * Automatically records an activity to Firestore 'activityLogs' collection.
   * Ensures User ID, User Name, User Role, Activity, Date/Time, and Target Record ID are saved.
   */
  async logActivity(entry: {
    userName: string;
    userRole: 'admin' | 'midwife' | 'patient';
    activity: string;
    userEmail?: string;
    userId?: string;
    targetRecordId?: string;
  }): Promise<void> {
    if (!entry.activity) return;

    const currentUid = auth.currentUser?.uid;
    const currentEmail = auth.currentUser?.email;

    const docData: any = {
      userName: entry.userName.trim(),
      userRole: entry.userRole,
      userEmail: entry.userEmail || currentEmail || '',
      userId: entry.userId || currentUid || '',
      activity: entry.activity.trim(),
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    };
    if (entry.targetRecordId) {
      docData.targetRecordId = entry.targetRecordId;
    }

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

