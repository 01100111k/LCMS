export interface LocalApprovalRecord {
  status: 'approved' | 'rejected';
  approvedUid?: string;
  role?: 'admin' | 'midwife' | 'patient';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export const LOCAL_APPROVALS_KEY = 'lcms_approval_decisions';
export const LOCAL_PENDINGS_KEY = 'lcms_pending_registrations';

export function getLocalApprovalDecisions(): Record<string, LocalApprovalRecord> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_APPROVALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalApprovalDecision(
  email: string,
  appId: string | undefined,
  status: 'approved' | 'rejected',
  approvedUid?: string,
  reviewedBy?: string,
  rejectionReason?: string,
  role?: 'admin' | 'midwife' | 'patient'
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const all = getLocalApprovalDecisions();
    const record: LocalApprovalRecord = {
      status,
      approvedUid,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      rejectionReason,
      role,
    };
    if (email) all[email.toLowerCase()] = record;
    if (appId) all[appId] = record;
    localStorage.setItem(LOCAL_APPROVALS_KEY, JSON.stringify(all));
  } catch {}
}

export interface LocalPendingRegistration {
  id: string;
  applicationId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  requestedRole: 'midwife' | 'patient';
  prcLicense?: string;
  proofOfIdentity?: any[];
  status: 'pending' | 'approved' | 'rejected';
  authUid?: string;
  submittedAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectionReason?: string;
}

export function getLocalPendingRegistrations(): LocalPendingRegistration[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PENDINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalPendingRegistration(app: LocalPendingRegistration): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const list = getLocalPendingRegistrations();
    const cleanEmail = (app.email || '').toLowerCase().trim();
    const existingIndex = list.findIndex(
      (a) => (a.email && a.email.toLowerCase().trim() === cleanEmail) || a.id === app.id
    );
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...app };
    } else {
      list.unshift(app);
    }
    localStorage.setItem(LOCAL_PENDINGS_KEY, JSON.stringify(list));
  } catch {}
}

