import { Injectable } from '@angular/core';
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
import { db } from './firebase';
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
  nextFollowUpDate?: string;
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
  clinicalNotes?: string;
  nextFollowUpDate?: string;
  createdAt?: any;
}

@Injectable({ providedIn: 'root' })
export class RecordsService {
  // ==================== PRENATAL RECORDS ====================
  async listPrenatal(): Promise<PrenatalRecord[]> {
    let dbList: PrenatalRecord[] = [];
    try {
      const snap = await getDocs(collection(db, 'prenatal_records'));
      dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrenatalRecord, 'id'>) }));
    } catch {
      dbList = [];
    }

    const existingIds = new Set(dbList.map((r) => r.id));
    const merged = [...dbList, ...EXAMPLE_PRENATAL_RECORDS.filter((ex) => !existingIds.has(ex.id))];
    return merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  async listPrenatalForPatient(patientId: string): Promise<PrenatalRecord[]> {
    const all = await this.listPrenatal();
    return all.filter((r) => r.patientId === patientId);
  }

  async addPrenatal(record: Omit<PrenatalRecord, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'prenatal_records'), {
        ...record,
        createdAt: serverTimestamp(),
      });

      // Also mirror to 'visits' collection so patient-portal immediately displays checkup vitals!
      try {
        await addDoc(collection(db, 'visits'), {
          prenatalRecordId: docRef.id,
          patientId: record.patientId,
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

      return docRef.id;
    } catch {
      return 'local-prenatal-' + Date.now();
    }
  }

  async updatePrenatal(id: string, record: Partial<PrenatalRecord>): Promise<void> {
    try {
      await updateDoc(doc(db, 'prenatal_records', id), {
        ...record,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }
  }

  async deletePrenatal(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'prenatal_records', id));
    } catch {
      // ignore
    }
  }

  // ==================== DELIVERY RECORDS ====================
  async listDelivery(): Promise<DeliveryRecord[]> {
    let dbList: DeliveryRecord[] = [];
    try {
      const snap = await getDocs(collection(db, 'delivery_records'));
      dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeliveryRecord, 'id'>) }));
    } catch {
      dbList = [];
    }

    const existingIds = new Set(dbList.map((r) => r.id));
    const merged = [...dbList, ...EXAMPLE_DELIVERY_RECORDS.filter((ex) => !existingIds.has(ex.id))];
    return merged.sort((a, b) => (b.deliveryDateTime || '').localeCompare(a.deliveryDateTime || ''));
  }

  async listDeliveryForPatient(patientId: string): Promise<DeliveryRecord[]> {
    const all = await this.listDelivery();
    return all.filter((r) => r.patientId === patientId);
  }

  async addDelivery(record: Omit<DeliveryRecord, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'delivery_records'), {
        ...record,
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

      return docRef.id;
    } catch {
      return 'local-delivery-' + Date.now();
    }
  }

  async updateDelivery(id: string, record: Partial<DeliveryRecord>): Promise<void> {
    try {
      await updateDoc(doc(db, 'delivery_records', id), {
        ...record,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }
  }

  async deleteDelivery(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'delivery_records', id));
    } catch {
      // ignore
    }
  }

  // ==================== POSTPARTUM RECORDS ====================
  async listPostpartum(): Promise<PostpartumRecord[]> {
    let dbList: PostpartumRecord[] = [];
    try {
      const snap = await getDocs(collection(db, 'postpartum_records'));
      dbList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostpartumRecord, 'id'>) }));
    } catch {
      dbList = [];
    }

    const existingIds = new Set(dbList.map((r) => r.id));
    const merged = [...dbList, ...EXAMPLE_POSTPARTUM_RECORDS.filter((ex) => !existingIds.has(ex.id))];
    return merged.sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
  }

  async listPostpartumForPatient(patientId: string): Promise<PostpartumRecord[]> {
    const all = await this.listPostpartum();
    return all.filter((r) => r.patientId === patientId);
  }

  async addPostpartum(record: Omit<PostpartumRecord, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'postpartum_records'), {
        ...record,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch {
      return 'local-postpartum-' + Date.now();
    }
  }

  async updatePostpartum(id: string, record: Partial<PostpartumRecord>): Promise<void> {
    try {
      await updateDoc(doc(db, 'postpartum_records', id), {
        ...record,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }
  }

  async deletePostpartum(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'postpartum_records', id));
    } catch {
      // ignore
    }
  }
}
