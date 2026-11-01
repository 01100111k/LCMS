import { ProofOfIdentityFile, Role } from '../core/auth.service';

export interface SystemUser {
  id: string;
  email: string;
  displayName?: string;
  role: Role;
  prcLicense?: string;
  contactNumber?: string;
  proofOfIdentity?: ProofOfIdentityFile[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  status?: 'active' | 'inactive';
  createdAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  actor: string;
  actorRole: string;
  target?: string;
  timestamp: string;
  type: 'approval' | 'rejection' | 'role_change' | 'create_user' | 'system' | 'settings' | 'archive';
  details?: string;
}

export interface ArchiveRecord {
  id: string;
  originalId: string;
  name: string;
  category: 'patient' | 'user' | 'midwife';
  identifier: string; // email, prc, or blood type
  archivedAt: string;
  reason: string;
  archivedBy: string;
  data: any;
}

export interface PendingApprovalApplication {
  id: string; // Document ID (applicationId)
  applicationId?: string;
  fullName: string;
  email: string;
  contactNumber: string;
  requestedRole: 'midwife' | 'patient';
  prcLicense?: string;
  proofOfIdentity?: ProofOfIdentityFile[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectionReason?: string;
  approvedUid?: string;
}

export interface FacilitySettings {
  facilityName: string;
  licenseNumber: string;
  contactNumber: string;
  emergencyHotline: string;
  address: string;
  operatingHours: string;
  referralHospital: string;
  autoApproveVerifiedMidwives: boolean;
  emailAlertsEnabled: boolean;
}

export interface AccountIntegrityItem {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  hasUsersDoc: boolean;
  hasProfileDoc: boolean;
  profileCollection: 'midwives' | 'patients' | 'admin';
  status: 'healthy' | 'missing_documents' | 'incomplete_profile';
  sourceRecord: 'pending_approval' | 'registered_user' | 'system_user';
  isApproved: boolean;
  details: string;
  rawApp?: PendingApprovalApplication;
}

export function parseTimestamp(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof (val as any)?.toMillis === 'function') return (val as any).toMillis();
  if (typeof (val as any)?.toDate === 'function') return (val as any).toDate().getTime();
  if ((val as any)?.seconds) {
    const s = Number((val as any).seconds);
    const ns = Number((val as any).nanoseconds || 0);
    return s * 1000 + Math.floor(ns / 1000000);
  }
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

