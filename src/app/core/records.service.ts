import { Injectable, inject } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ActivityLogService } from './activity-log.service';
import { AuthService } from './auth.service';
import {
  EXAMPLE_PRENATAL_RECORDS,
  EXAMPLE_DELIVERY_RECORDS,
  EXAMPLE_POSTPARTUM_RECORDS,
} from './example-data';

export interface PrenatalRecord {
  id?: string;
  patientId: string;
  patientName: string;
  patientContact?: string;
  date: string; // YYYY-MM-DD
  time?: string;
  gestationalAge: string; // e.g. "28 weeks"
  gestationalWeeksNum: number;
  trimester: '1st Trimester' | '2nd Trimester' | '3rd Trimester';
  bp: string; // e.g. "110/70"
  weightKg: number;
  fundalHeightCm: number;
  fetalHeartRateBpm: number;
  fetalPresentation: string; // "Cephalic", "Breech", "Transverse", "Not palpable"
  fetalMovement: string; // "Active / Good", "Decreased", "Not yet felt"
  urinalysisProtein: string; // "Negative", "Trace", "+1", "+2"
  urinalysisGlucose: string; // "Negative", "+1", "+2"
  hemoglobin?: string; // e.g. "12.0 g/dL"
  edema: string; // "None", "Mild (Feet/Ankles)", "Moderate", "Severe"
  riskLevel: 'Low risk' | 'Medium risk' | 'High risk';
  supplementsGiven: string[]; // ["Ferrous Sulfate + Folic Acid", "Calcium Carbonate", "Toxoid TT3"]
  complaintsRiskNotes?: string;
  attendingMidwife: string;
  assignedMidwifeId?: string | null;
  midwifeId?: string | null;
  createdBy?: string | null;
  nextFollowUpDate?: string;
  isArchived?: boolean;
  archivedAt?: any;
  createdAt?: any;
}

export interface DeliveryRecord {
  id?: string;
  patientId: string;
  patientName: string;
  admissionDateTime: string; // YYYY-MM-DDTHH:mm
  deliveryDateTime: string; // YYYY-MM-DDTHH:mm
  deliveryType: 'Normal Spontaneous Vaginal Delivery (NSVD)' | 'Assisted Vaginal Delivery' | 'Emergency Transfer';
  gravidaPara?: string; // e.g. "G2P1"
  gestationalAgeAtDelivery: string; // e.g. "39 weeks"
  onsetOfLabor?: string;
  ruptureOfMembranes: string; // "Spontaneous - Clear amniotic fluid", "Artificial (AROM)", "Meconium-stained"
  perineumStatus: 'Intact' | '1st Degree Laceration' | '2nd Degree Laceration' | 'Episiotomy' | 'Repaired';
  placentaStatus: 'Complete & intact' | 'Manual extraction' | 'Incomplete';
  estimatedBloodLossMl: number;
  attendingMidwife: string;
  assistantMidwife?: string;
  assignedMidwifeId?: string | null;
  midwifeId?: string | null;
  createdBy?: string | null;
  maternalComplications?: string;
  // Newborn Information
  babySex: 'Female' | 'Male';
  birthWeightGrams: number;
  birthLengthCm: number;
  headCircumferenceCm?: number;
  chestCircumferenceCm?: number;
  apgar1Min: number;
  apgar5Min: number;
  eincImmediateDrying: boolean;
  eincSkinToSkin: boolean;
  eincDelayedCordClamping: boolean;
  eincEarlyBreastfeeding: boolean;
  vitaminKGiven: boolean;
  eyeProphylaxisGiven: boolean;
  hepatitisBGiven: boolean;
  bcgGiven: boolean;
  newbornNotes?: string;
  isArchived?: boolean;
  archivedAt?: any;
  createdAt?: any;
}

export interface PostpartumRecord {
  id?: string;
  patientId: string;
  patientName: string;
  deliveryDate?: string;
  visitStage: '24 Hours Post-delivery' | 'Day 3 - 7 (1st Week)' | 'Week 2 Checkup' | 'Week 6 Postnatal Visit';
  visitDate: string; // YYYY-MM-DD
  maternalBp: string;
  maternalTemp: string; // e.g. "36.6 °C"
  maternalPulse: string; // e.g. "76 bpm"
  fundalFirmness: 'Firm and contracted' | 'Moderately firm' | 'Soft / Boggy';
  fundalPosition: string; // e.g. "2 fingerbreadths below umbilicus"
  lochiaType: 'Lochia Rubra (Red)' | 'Lochia Serosa (Pink/Brown)' | 'Lochia Alba (Yellowish/White)';
  lochiaAmount: 'Scant' | 'Light' | 'Moderate' | 'Heavy / Excessive';
  lochiaOdor: 'Normal / Fleshy' | 'Foul-smelling';
  perineumHealing: 'Intact / No tear' | 'Healing well / Sutures intact' | 'Mild redness/edema' | 'Infection signs';
  breastCondition: 'Soft, colostrum present' | 'Engorged' | 'Cracked nipples' | 'Mature milk flowing';
  feedingMethod: 'Exclusive Breastfeeding' | 'Mixed Feeding' | 'Formula Feeding';
  maternalMentalState: 'Positive & bonding well' | 'Mild baby blues / Fatigued' | 'Severe anxiety / Needs evaluation';
  familyPlanningCounseling: string; // e.g. "LAM Method", "Progestin Only Pills", "Implanon Scheduled", "Condoms"
  // Newborn Follow-up
  babyWeightKg: number;
  cordStumpStatus: 'Clean & dry' | 'Sloughed off completely' | 'Moist / Red';
  jaundiceStatus: 'None' | 'Mild facial jaundice' | 'Moderate' | 'Referred to pediatrician';
  attendingMidwife: string;
  assignedMidwifeId?: string | null;
  midwifeId?: string | null;
  createdBy?: string | null;
  clinicalNotes?: string;
  nextFollowUpDate?: string;
  isArchived?: boolean;
  archivedAt?: any;
  createdAt?: any;
}

@Injectable({ providedIn: 'root' })
export class RecordsService {
  private activityLog = inject(ActivityLogService);
  private auth = inject(AuthService);
  private archivedPrenatalIds = new Set<string>(this.loadArchivedIds('prenatal'));
  private archivedDeliveryIds = new Set<string>(this.loadArchivedIds('delivery'));
  private archivedPostpartumIds = new Set<string>(this.loadArchivedIds('postpartum'));

  private loadArchivedIds(category: string): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`lcms_archived_${category}_ids`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persistArchivedId(category: 'prenatal' | 'delivery' | 'postpartum', id: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const set = category === 'prenatal' ? this.archivedPrenatalIds : category === 'delivery' ? this.archivedDeliveryIds : this.archivedPostpartumIds;
      set.add(id);
      localStorage.setItem(`lcms_archived_${category}_ids`, JSON.stringify(Array.from(set)));
    } catch {}
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

  // ==================== PRENATAL RECORDS ====================
  async listPrenatal(): Promise<PrenatalRecord[]> {
    const currentUid = auth.currentUser?.uid;
    const role = this.getCurrentRole();
    let dbList: PrenatalRecord[] = [];

    try {
      if (role === 'admin') {
        const snap = await getDocs(collection(db, 'prenatal_records'));
        dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrenatalRecord, 'id'>) }));
      } else if (currentUid) {
        // Midwife: query records assigned to this midwife UID
        const q = query(collection(db, 'prenatal_records'), where('assignedMidwifeId', '==', currentUid));
        const snap = await getDocs(q);
        dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrenatalRecord, 'id'>) }));
      }
    } catch (e) {
      console.warn('RecordsService.listPrenatal error:', e);
      dbList = [];
    }

    let combined = dbList;
    if (this.isMidwifeDemoUser()) {
      const existingIds = new Set(dbList.map((r) => r.id));
      const examples = EXAMPLE_PRENATAL_RECORDS.filter((r) => !existingIds.has(r.id));
      combined = [...dbList, ...examples];
    }

    return combined
      .filter((r) => !r.isArchived && !this.archivedPrenatalIds.has(r.id!))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  async listPrenatalForPatient(patientId: string): Promise<PrenatalRecord[]> {
    try {
      const q = query(collection(db, 'prenatal_records'), where('patientId', '==', patientId));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<PrenatalRecord, 'id'>) }))
        .filter((r) => !r.isArchived && !this.archivedPrenatalIds.has(r.id!))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch {
      const all = await this.listPrenatal();
      return all.filter((r) => r.patientId === patientId);
    }
  }

  async addPrenatal(record: Omit<PrenatalRecord, 'id' | 'createdAt'>): Promise<string> {
    try {
      const currentUid = auth.currentUser?.uid ?? null;
      const assignedMidwifeId = record.assignedMidwifeId || record.midwifeId || currentUid;

      const docRef = await addDoc(collection(db, 'prenatal_records'), {
        ...record,
        assignedMidwifeId,
        midwifeId: assignedMidwifeId,
        createdBy: currentUid,
        createdAt: serverTimestamp(),
      });

      // Also mirror to 'visits' collection so patient-portal immediately displays checkup vitals!
      try {
        await addDoc(collection(db, 'visits'), {
          prenatalRecordId: docRef.id,
          patientId: record.patientId,
          assignedMidwifeId,
          midwifeId: assignedMidwifeId,
          date: record.date,
          gestationalAge: record.gestationalAge,
          bp: record.bp,
          weightKg: record.weightKg,
          fundalHeightCm: record.fundalHeightCm,
          fetalHeartRateBpm: record.fetalHeartRateBpm,
          midwifeName: record.attendingMidwife,
          notes: record.complaintsRiskNotes || `Routine prenatal checkup. Vitals: BP ${record.bp}, FHR ${record.fetalHeartRateBpm} bpm.`,
          createdAt: serverTimestamp(),
        });
      } catch {
        // ignore mirror failure
      }

      this.activityLog.logActivity({
        userName: record.attendingMidwife || 'Midwife',
        userRole: 'midwife',
        targetRecordId: docRef.id,
        activity: `Maternal care record added (Prenatal: ${record.patientName})`,
      }).catch(() => undefined);

      return docRef.id;
    } catch (err) {
      if (this.isMidwifeDemoUser()) {
        return 'local-prenatal-' + Date.now();
      }
      throw err;
    }
  }

  async updatePrenatal(id: string, record: Partial<PrenatalRecord>): Promise<void> {
    try {
      await updateDoc(doc(db, 'prenatal_records', id), {
        ...record,
        updatedAt: serverTimestamp(),
      });
      this.activityLog.logActivity({
        userName: record.attendingMidwife || 'Midwife',
        userRole: 'midwife',
        targetRecordId: id,
        activity: `Maternal care record updated (Prenatal: ${record.patientName || id})`,
      }).catch(() => undefined);
    } catch (err) {
      if (!this.isMidwifeDemoUser()) {
        throw err;
      }
    }
  }

  async archivePrenatal(id: string): Promise<void> {
    this.persistArchivedId('prenatal', id);
    try {
      await updateDoc(doc(db, 'prenatal_records', id), {
        isArchived: true,
        archivedAt: serverTimestamp(),
      });
    } catch {
      try {
        await deleteDoc(doc(db, 'prenatal_records', id));
      } catch {
        // ignore
      }
    }
  }

  async deletePrenatal(id: string): Promise<void> {
    this.persistArchivedId('prenatal', id);
    try {
      await deleteDoc(doc(db, 'prenatal_records', id));
    } catch {
      // ignore
    }
  }

  // ==================== DELIVERY RECORDS ====================
  async listDelivery(): Promise<DeliveryRecord[]> {
    const currentUid = auth.currentUser?.uid;
    const role = this.getCurrentRole();
    let dbList: DeliveryRecord[] = [];

    try {
      if (role === 'admin') {
        const snap = await getDocs(collection(db, 'delivery_records'));
        dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeliveryRecord, 'id'>) }));
      } else if (currentUid) {
        // Midwife: query records assigned to this midwife UID
        const q = query(collection(db, 'delivery_records'), where('assignedMidwifeId', '==', currentUid));
        const snap = await getDocs(q);
        dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeliveryRecord, 'id'>) }));
      }
    } catch (e) {
      console.warn('RecordsService.listDelivery error:', e);
      dbList = [];
    }

    let combined = dbList;
    if (this.isMidwifeDemoUser()) {
      const existingIds = new Set(dbList.map((r) => r.id));
      const examples = EXAMPLE_DELIVERY_RECORDS.filter((r) => !existingIds.has(r.id));
      combined = [...dbList, ...examples];
    }

    return combined
      .filter((r) => !r.isArchived && !this.archivedDeliveryIds.has(r.id!))
      .sort((a, b) => (b.deliveryDateTime || '').localeCompare(a.deliveryDateTime || ''));
  }

  async listDeliveryForPatient(patientId: string): Promise<DeliveryRecord[]> {
    try {
      const q = query(collection(db, 'delivery_records'), where('patientId', '==', patientId));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<DeliveryRecord, 'id'>) }))
        .filter((r) => !r.isArchived && !this.archivedDeliveryIds.has(r.id!))
        .sort((a, b) => (b.deliveryDateTime || '').localeCompare(a.deliveryDateTime || ''));
    } catch {
      const all = await this.listDelivery();
      return all.filter((r) => r.patientId === patientId);
    }
  }

  async archiveDelivery(id: string): Promise<void> {
    this.persistArchivedId('delivery', id);
    try {
      await updateDoc(doc(db, 'delivery_records', id), {
        isArchived: true,
        archivedAt: serverTimestamp(),
      });
    } catch {
      try {
        await deleteDoc(doc(db, 'delivery_records', id));
      } catch {
        // ignore
      }
    }
  }

  async deleteDelivery(id: string): Promise<void> {
    this.persistArchivedId('delivery', id);
    try {
      await deleteDoc(doc(db, 'delivery_records', id));
    } catch {
      // ignore
    }
  }

  async addDelivery(record: Omit<DeliveryRecord, 'id' | 'createdAt'>): Promise<string> {
    try {
      const currentUid = auth.currentUser?.uid ?? null;
      const assignedMidwifeId = record.assignedMidwifeId || record.midwifeId || currentUid;

      const docRef = await addDoc(collection(db, 'delivery_records'), {
        ...record,
        assignedMidwifeId,
        midwifeId: assignedMidwifeId,
        createdBy: currentUid,
        createdAt: serverTimestamp(),
      });

      // Update patient status to 'Postpartum' in patients collection
      try {
        await updateDoc(doc(db, 'patients', record.patientId), {
          status: 'Postpartum',
          lastDeliveryDate: record.deliveryDateTime,
        });
      } catch {
        // ignore
      }

      this.activityLog.logActivity({
        userName: record.attendingMidwife || 'Midwife',
        userRole: 'midwife',
        targetRecordId: docRef.id,
        activity: `Maternal care record added (Delivery: ${record.patientName})`,
      }).catch(() => undefined);

      return docRef.id;
    } catch (err) {
      if (this.isMidwifeDemoUser()) {
        return 'local-delivery-' + Date.now();
      }
      throw err;
    }
  }

  async updateDelivery(id: string, record: Partial<DeliveryRecord>): Promise<void> {
    try {
      await updateDoc(doc(db, 'delivery_records', id), {
        ...record,
        updatedAt: serverTimestamp(),
      });
      this.activityLog.logActivity({
        userName: record.attendingMidwife || 'Midwife',
        userRole: 'midwife',
        targetRecordId: id,
        activity: `Maternal care record updated (Delivery: ${record.patientName || id})`,
      }).catch(() => undefined);
    } catch (err) {
      if (!this.isMidwifeDemoUser()) {
        throw err;
      }
    }
  }

  // ==================== POSTPARTUM RECORDS ====================
  async listPostpartum(): Promise<PostpartumRecord[]> {
    const currentUid = auth.currentUser?.uid;
    const role = this.getCurrentRole();
    let dbList: PostpartumRecord[] = [];

    try {
      if (role === 'admin') {
        const snap = await getDocs(collection(db, 'postpartum_records'));
        dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostpartumRecord, 'id'>) }));
      } else if (currentUid) {
        // Midwife: query records assigned to this midwife UID
        const q = query(collection(db, 'postpartum_records'), where('assignedMidwifeId', '==', currentUid));
        const snap = await getDocs(q);
        dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostpartumRecord, 'id'>) }));
      }
    } catch (e) {
      console.warn('RecordsService.listPostpartum error:', e);
      dbList = [];
    }

    let combined = dbList;
    if (this.isMidwifeDemoUser()) {
      const existingIds = new Set(dbList.map((r) => r.id));
      const examples = EXAMPLE_POSTPARTUM_RECORDS.filter((r) => !existingIds.has(r.id));
      combined = [...dbList, ...examples];
    }

    return combined
      .filter((r) => !r.isArchived && !this.archivedPostpartumIds.has(r.id!))
      .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
  }

  async listPostpartumForPatient(patientId: string): Promise<PostpartumRecord[]> {
    try {
      const q = query(collection(db, 'postpartum_records'), where('patientId', '==', patientId));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<PostpartumRecord, 'id'>) }))
        .filter((r) => !r.isArchived && !this.archivedPostpartumIds.has(r.id!))
        .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
    } catch {
      const all = await this.listPostpartum();
      return all.filter((r) => r.patientId === patientId);
    }
  }

  async addPostpartum(record: Omit<PostpartumRecord, 'id' | 'createdAt'>): Promise<string> {
    try {
      const currentUid = auth.currentUser?.uid ?? null;
      const assignedMidwifeId = record.assignedMidwifeId || record.midwifeId || currentUid;

      const docRef = await addDoc(collection(db, 'postpartum_records'), {
        ...record,
        assignedMidwifeId,
        midwifeId: assignedMidwifeId,
        createdBy: currentUid,
        createdAt: serverTimestamp(),
      });
      this.activityLog.logActivity({
        userName: record.attendingMidwife || 'Midwife',
        userRole: 'midwife',
        targetRecordId: docRef.id,
        activity: `Maternal care record added (Postpartum: ${record.patientName})`,
      }).catch(() => undefined);

      return docRef.id;
    } catch (err) {
      if (this.isMidwifeDemoUser()) {
        return 'local-postpartum-' + Date.now();
      }
      throw err;
    }
  }

  async updatePostpartum(id: string, record: Partial<PostpartumRecord>): Promise<void> {
    try {
      await updateDoc(doc(db, 'postpartum_records', id), {
        ...record,
        updatedAt: serverTimestamp(),
      });
      this.activityLog.logActivity({
        userName: record.attendingMidwife || 'Midwife',
        userRole: 'midwife',
        targetRecordId: id,
        activity: `Maternal care record updated (Postpartum: ${record.patientName || id})`,
      }).catch(() => undefined);
    } catch (err) {
      if (!this.isMidwifeDemoUser()) {
        throw err;
      }
    }
  }

  async archivePostpartum(id: string): Promise<void> {
    this.persistArchivedId('postpartum', id);
    try {
      await updateDoc(doc(db, 'postpartum_records', id), {
        isArchived: true,
        archivedAt: serverTimestamp(),
      });
    } catch {
      try {
        await deleteDoc(doc(db, 'postpartum_records', id));
      } catch {
        // ignore
      }
    }
  }

  async deletePostpartum(id: string): Promise<void> {
    this.persistArchivedId('postpartum', id);
    try {
      await deleteDoc(doc(db, 'postpartum_records', id));
    } catch {
      // ignore
    }
  }
}
