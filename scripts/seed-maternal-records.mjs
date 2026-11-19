import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAang81fMZatH0njfH02TqPWjLQmicI_DU',
  authDomain: 'lying-in-care-ms.firebaseapp.com',
  projectId: 'lying-in-care-ms',
  storageBucket: 'lying-in-care-ms.firebasestorage.app',
  messagingSenderId: '1002256541817',
  appId: '1:1002256541817:web:ae5695dd3d6b05e9718ca8',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MIDWIFE_UID = 'bTHiMlndLCWH08gG97Sd55NK1bc2';
const MIDWIFE_NAME = 'Midwife Maria Santos, RM';

async function seed() {
  await signInWithEmailAndPassword(auth, 'admin@gmail.com', 'Admin123');
  console.log('Logged in as Admin.');

  // 1. Update midwife user doc to display proper name
  await setDoc(
    doc(db, 'users', MIDWIFE_UID),
    {
      email: 'midwife@gmail.com',
      role: 'midwife',
      displayName: MIDWIFE_NAME,
      fullName: MIDWIFE_NAME,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  console.log('Updated midwife user doc to "Midwife Maria Santos, RM"');

  // 2. Remove old generic test patient doc EXVQjuV9Q5b65oZFX7EhasCQjtz2 if present
  try {
    await deleteDoc(doc(db, 'patients', 'EXVQjuV9Q5b65oZFX7EhasCQjtz2'));
    console.log('Removed old test patient EXVQjuV9Q5b65oZFX7EhasCQjtz2');
  } catch (e) {
    console.warn('Could not delete test patient:', e);
  }

  // Also remove test prenatal record rbGzKJdQ5j1bUs6f1mU0
  try {
    await deleteDoc(doc(db, 'prenatal_records', 'rbGzKJdQ5j1bUs6f1mU0'));
    console.log('Removed old test prenatal record rbGzKJdQ5j1bUs6f1mU0');
  } catch (e) {}

  // 3. Retrieve all 22 patients of this midwife
  const patientsSnap = await getDocs(
    query(collection(db, 'patients'), where('assignedMidwifeId', '==', MIDWIFE_UID))
  );
  const patientMap = new Map();
  patientsSnap.forEach((d) => {
    const data = d.data();
    if (data.email === 'patient@gmail.com') return;
    patientMap.set(data.email, { id: d.id, ...data });
  });
  console.log(`Found ${patientMap.size} patients assigned to midwife.`);

  // 4. PRENATAL RECORDS
  const prenatalData = [
    {
      email: 'rochelle.villanueva@gmail.com',
      date: '2026-11-12',
      gestationalAge: '35 weeks',
      gestationalWeeksNum: 35,
      trimester: '3rd Trimester',
      bp: '130/85',
      weightKg: 64.5,
      fundalHeightCm: 34,
      fetalHeartRateBpm: 142,
      fetalPresentation: 'Cephalic',
      fetalMovement: 'Active / Good',
      urinalysisProtein: 'Trace',
      urinalysisGlucose: 'Negative',
      edema: 'Mild (Feet/Ankles)',
      riskLevel: 'High risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate'],
      complaintsRiskNotes: 'BP slightly elevated at 130/85 mmHg. Patient advised on low-salt diet and left-lateral rest. Close monitoring.',
    },
    {
      email: 'ana.santos@gmail.com',
      date: '2026-11-11',
      gestationalAge: '31 weeks',
      gestationalWeeksNum: 31,
      trimester: '3rd Trimester',
      bp: '135/85',
      weightKg: 68.0,
      fundalHeightCm: 30,
      fetalHeartRateBpm: 144,
      fetalPresentation: 'Cephalic',
      fetalMovement: 'Active / Good',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'Mild (Feet/Ankles)',
      riskLevel: 'High risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate'],
      complaintsRiskNotes: 'Chronic HTN history. Advised on home BP log. Follow-up scheduled for BP titration and fetal wellness check.',
    },
    {
      email: 'rosa.villanueva@gmail.com',
      date: '2026-11-10',
      gestationalAge: '31 weeks',
      gestationalWeeksNum: 31,
      trimester: '3rd Trimester',
      bp: '120/80',
      weightKg: 71.0,
      fundalHeightCm: 31,
      fetalHeartRateBpm: 138,
      fetalPresentation: 'Cephalic',
      fetalMovement: 'Active / Good',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'None',
      riskLevel: 'High risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate'],
      complaintsRiskNotes: 'G3P2 grand multipara. FHR good at 138 bpm. Advised on danger signs of labor and maternal nutrition.',
    },
    {
      email: 'althea.dominguez@gmail.com',
      date: '2026-11-05',
      gestationalAge: '18 weeks',
      gestationalWeeksNum: 18,
      trimester: '2nd Trimester',
      bp: '110/70',
      weightKg: 56.0,
      fundalHeightCm: 18,
      fetalHeartRateBpm: 148,
      fetalPresentation: 'Not palpable',
      fetalMovement: 'Not yet felt',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'None',
      riskLevel: 'Low risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid'],
      complaintsRiskNotes: 'Routine 2nd trimester checkup. FHR audible via Doppler at 148 bpm. Maternal vitals stable.',
    },
    {
      email: 'fatima.abdullah@gmail.com',
      date: '2026-11-07',
      gestationalAge: '34 weeks',
      gestationalWeeksNum: 34,
      trimester: '3rd Trimester',
      bp: '120/75',
      weightKg: 66.0,
      fundalHeightCm: 33,
      fetalHeartRateBpm: 140,
      fetalPresentation: 'Cephalic',
      fetalMovement: 'Active / Good',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'None',
      riskLevel: 'Medium risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate'],
      complaintsRiskNotes: 'Previous C-section history. Cephalic presentation confirmed. Birth preparedness plan reviewed.',
    },
    {
      email: 'erika.delacruz@gmail.com',
      date: '2026-11-14',
      gestationalAge: '37 weeks',
      gestationalWeeksNum: 37,
      trimester: '3rd Trimester',
      bp: '120/80',
      weightKg: 63.0,
      fundalHeightCm: 36,
      fetalHeartRateBpm: 138,
      fetalPresentation: 'Cephalic',
      fetalMovement: 'Active / Good',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'None',
      riskLevel: 'Low risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate'],
      complaintsRiskNotes: 'Full-term monitoring. Head engaged in pelvis. Patient oriented on true labor signs and admission requirements.',
    },
    {
      email: 'diana.ocampo@gmail.com',
      date: '2026-11-03',
      gestationalAge: '26 weeks',
      gestationalWeeksNum: 26,
      trimester: '2nd Trimester',
      bp: '110/70',
      weightKg: 59.0,
      fundalHeightCm: 25,
      fetalHeartRateBpm: 146,
      fetalPresentation: 'Cephalic',
      fetalMovement: 'Active / Good',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'None',
      riskLevel: 'Low risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate'],
      complaintsRiskNotes: 'OGTT test scheduled for 28 weeks. Vitals normal. Good fetal kicks reported.',
    },
    {
      email: 'marisol.tan@gmail.com',
      date: '2026-11-06',
      gestationalAge: '28 weeks',
      gestationalWeeksNum: 28,
      trimester: '3rd Trimester',
      bp: '118/76',
      weightKg: 62.5,
      fundalHeightCm: 28,
      fetalHeartRateBpm: 142,
      fetalPresentation: 'Cephalic',
      fetalMovement: 'Active / Good',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'None',
      riskLevel: 'Low risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate'],
      complaintsRiskNotes: 'Third trimester orientation completed. Tetanus Toxoid TT3 administered.',
    },
    {
      email: 'carmela.santos@gmail.com',
      date: '2026-11-02',
      gestationalAge: '14 weeks',
      gestationalWeeksNum: 14,
      trimester: '2nd Trimester',
      bp: '110/70',
      weightKg: 54.0,
      fundalHeightCm: 14,
      fetalHeartRateBpm: 150,
      fetalPresentation: 'Not palpable',
      fetalMovement: 'Not yet felt',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'None',
      riskLevel: 'Low risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid'],
      complaintsRiskNotes: 'Routine 2nd trimester checkup. Hemoglobin and blood typing requested for next consultation.',
    },
    {
      email: 'jasmine.flores@gmail.com',
      date: '2026-11-08',
      gestationalAge: '24 weeks',
      gestationalWeeksNum: 24,
      trimester: '2nd Trimester',
      bp: '110/70',
      weightKg: 58.0,
      fundalHeightCm: 23,
      fetalHeartRateBpm: 144,
      fetalPresentation: 'Cephalic',
      fetalMovement: 'Active / Good',
      urinalysisProtein: 'Negative',
      urinalysisGlucose: 'Negative',
      edema: 'None',
      riskLevel: 'Low risk',
      supplementsGiven: ['Ferrous Sulfate + Folic Acid', 'Calcium Carbonate'],
      complaintsRiskNotes: 'Anomaly scan results reviewed: normal fetal anatomy. Patient advised to maintain adequate hydration.',
    },
  ];

  console.log('\n--- Seeding Prenatal Records ---');
  for (const pre of prenatalData) {
    const pt = patientMap.get(pre.email);
    if (!pt) {
      console.warn(`Patient not found for ${pre.email}`);
      continue;
    }
    const docId = `pre_${pt.id}_${pre.date.replace(/-/g, '')}`;
    await setDoc(doc(db, 'prenatal_records', docId), {
      patientId: pt.id,
      patientName: pt.fullName,
      patientContact: pt.contactNumber || '',
      date: pre.date,
      gestationalAge: pre.gestationalAge,
      gestationalWeeksNum: pre.gestationalWeeksNum,
      trimester: pre.trimester,
      bp: pre.bp,
      weightKg: pre.weightKg,
      fundalHeightCm: pre.fundalHeightCm,
      fetalHeartRateBpm: pre.fetalHeartRateBpm,
      fetalPresentation: pre.fetalPresentation,
      fetalMovement: pre.fetalMovement,
      urinalysisProtein: pre.urinalysisProtein,
      urinalysisGlucose: pre.urinalysisGlucose,
      edema: pre.edema,
      riskLevel: pre.riskLevel,
      supplementsGiven: pre.supplementsGiven,
      complaintsRiskNotes: pre.complaintsRiskNotes,
      attendingMidwife: MIDWIFE_NAME,
      assignedMidwifeId: MIDWIFE_UID,
      midwifeId: MIDWIFE_UID,
      createdBy: MIDWIFE_UID,
      createdAt: serverTimestamp(),
    });

    // Also mirror to visits
    const visitId = `visit_${pt.id}_${pre.date.replace(/-/g, '')}`;
    await setDoc(doc(db, 'visits', visitId), {
      prenatalRecordId: docId,
      patientId: pt.id,
      assignedMidwifeId: MIDWIFE_UID,
      midwifeId: MIDWIFE_UID,
      date: pre.date,
      gestationalAge: pre.gestationalAge,
      bp: pre.bp,
      weightKg: pre.weightKg,
      fundalHeightCm: pre.fundalHeightCm,
      fetalHeartRateBpm: pre.fetalHeartRateBpm,
      midwifeName: MIDWIFE_NAME,
      notes: pre.complaintsRiskNotes,
      createdAt: serverTimestamp(),
    });

    console.log(`✓ Seeded prenatal & visit for ${pt.fullName} on ${pre.date}`);
  }

  // 5. DELIVERY RECORDS (ONLY for delivered patients: Camille D. Bautista, Angela Christine Ramos, Patricia Mae Gomez)
  console.log('\n--- Seeding Delivery Records (Delivered Patients Only) ---');
  const deliveryData = [
    {
      email: 'camille.bautista@gmail.com',
      admissionDateTime: '2026-11-12T04:15',
      deliveryDateTime: '2026-11-12T07:42',
      deliveryType: 'Normal Spontaneous Vaginal Delivery (NSVD)',
      gravidaPara: 'G1P1',
      gestationalAgeAtDelivery: '39 weeks',
      ruptureOfMembranes: 'Spontaneous - Clear amniotic fluid',
      perineumStatus: 'Intact',
      placentaStatus: 'Complete & intact',
      estimatedBloodLossMl: 250,
      babySex: 'Male',
      birthWeightGrams: 3250,
      birthLengthCm: 50,
      headCircumferenceCm: 34,
      chestCircumferenceCm: 33,
      apgar1Min: 9,
      apgar5Min: 10,
      eincImmediateDrying: true,
      eincSkinToSkin: true,
      eincDelayedCordClamping: true,
      eincEarlyBreastfeeding: true,
      vitaminKGiven: true,
      eyeProphylaxisGiven: true,
      hepatitisBGiven: true,
      bcgGiven: true,
      newbornNotes: 'Healthy vigorous male infant delivered spontaneously. Cry lusty, good muscle tone, early latch within 45 mins.',
    },
    {
      email: 'angela.ramos@gmail.com',
      admissionDateTime: '2026-11-16T08:30',
      deliveryDateTime: '2026-11-16T11:15',
      deliveryType: 'Normal Spontaneous Vaginal Delivery (NSVD)',
      gravidaPara: 'G2P2',
      gestationalAgeAtDelivery: '39 weeks + 2 days',
      ruptureOfMembranes: 'Spontaneous - Clear amniotic fluid',
      perineumStatus: 'Intact',
      placentaStatus: 'Complete & intact',
      estimatedBloodLossMl: 220,
      babySex: 'Female',
      birthWeightGrams: 3100,
      birthLengthCm: 49,
      headCircumferenceCm: 33.5,
      chestCircumferenceCm: 32.5,
      apgar1Min: 9,
      apgar5Min: 10,
      eincImmediateDrying: true,
      eincSkinToSkin: true,
      eincDelayedCordClamping: true,
      eincEarlyBreastfeeding: true,
      vitaminKGiven: true,
      eyeProphylaxisGiven: true,
      hepatitisBGiven: true,
      bcgGiven: true,
      newbornNotes: 'Spontaneous delivery of a live baby girl. Immediate skin-to-skin contact maintained for 90 mins.',
    },
    {
      email: 'patricia.gomez@gmail.com',
      admissionDateTime: '2026-10-05T01:20',
      deliveryDateTime: '2026-10-05T03:55',
      deliveryType: 'Normal Spontaneous Vaginal Delivery (NSVD)',
      gravidaPara: 'G2P2',
      gestationalAgeAtDelivery: '40 weeks',
      ruptureOfMembranes: 'Spontaneous - Clear amniotic fluid',
      perineumStatus: 'Intact',
      placentaStatus: 'Complete & intact',
      estimatedBloodLossMl: 280,
      babySex: 'Female',
      birthWeightGrams: 3300,
      birthLengthCm: 50,
      headCircumferenceCm: 34,
      chestCircumferenceCm: 33,
      apgar1Min: 9,
      apgar5Min: 10,
      eincImmediateDrying: true,
      eincSkinToSkin: true,
      eincDelayedCordClamping: true,
      eincEarlyBreastfeeding: true,
      vitaminKGiven: true,
      eyeProphylaxisGiven: true,
      hepatitisBGiven: true,
      bcgGiven: true,
      newbornNotes: 'Normal delivery. Mother and newborn discharged in stable condition after 24-hr observation.',
    },
  ];

  for (const del of deliveryData) {
    const pt = patientMap.get(del.email);
    if (!pt) {
      console.warn(`Patient not found for ${del.email}`);
      continue;
    }
    const docId = `del_${pt.id}_${del.deliveryDateTime.substring(0, 10).replace(/-/g, '')}`;
    await setDoc(doc(db, 'delivery_records', docId), {
      ...del,
      patientId: pt.id,
      patientName: pt.fullName,
      attendingMidwife: MIDWIFE_NAME,
      assignedMidwifeId: MIDWIFE_UID,
      midwifeId: MIDWIFE_UID,
      createdBy: MIDWIFE_UID,
      createdAt: serverTimestamp(),
    });
    console.log(`✓ Seeded delivery record for ${pt.fullName} on ${del.deliveryDateTime}`);
  }

  // 6. POSTPARTUM RECORDS (ONLY for patients with postpartum follow-up)
  console.log('\n--- Seeding Postpartum Records ---');
  const postpartumData = [
    {
      email: 'camille.bautista@gmail.com',
      deliveryDate: '2026-11-12',
      visitStage: 'Day 3 - 7 (1st Week)',
      visitDate: '2026-11-15',
      maternalBp: '110/70',
      maternalTemp: '36.6 °C',
      maternalPulse: '76 bpm',
      fundalFirmness: 'Firm and contracted',
      fundalPosition: '2 fingerbreadths below umbilicus',
      lochiaType: 'Lochia Rubra (Red)',
      lochiaAmount: 'Moderate',
      lochiaOdor: 'Normal / Fleshy',
      perineumHealing: 'Intact / No tear',
      breastCondition: 'Mature milk flowing',
      feedingMethod: 'Exclusive Breastfeeding',
      maternalMentalState: 'Positive & bonding well',
      familyPlanningCounseling: 'Lactational Amenorrhea Method (LAM) oriented',
      babyWeightKg: 3.2,
      cordStumpStatus: 'Clean & dry',
      jaundiceStatus: 'None',
      clinicalNotes: 'Postpartum recovery smooth. Lochia normal, fundus well contracted, newborn latching properly.',
    },
    {
      email: 'angela.ramos@gmail.com',
      deliveryDate: '2026-11-16',
      visitStage: '24 Hours Post-delivery',
      visitDate: '2026-11-17',
      maternalBp: '112/74',
      maternalTemp: '36.5 °C',
      maternalPulse: '74 bpm',
      fundalFirmness: 'Firm and contracted',
      fundalPosition: 'At level of umbilicus',
      lochiaType: 'Lochia Rubra (Red)',
      lochiaAmount: 'Moderate',
      lochiaOdor: 'Normal / Fleshy',
      perineumHealing: 'Intact / No tear',
      breastCondition: 'Soft, colostrum present',
      feedingMethod: 'Exclusive Breastfeeding',
      maternalMentalState: 'Positive & bonding well',
      familyPlanningCounseling: 'Postpartum recovery and rest emphasized',
      babyWeightKg: 3.05,
      cordStumpStatus: 'Clean & dry',
      jaundiceStatus: 'None',
      clinicalNotes: 'Day 2 maternal check. Vital signs stable, bleeding within expected limits, newborn active.',
    },
    {
      email: 'patricia.gomez@gmail.com',
      deliveryDate: '2026-10-05',
      visitStage: 'Week 6 Postnatal Visit',
      visitDate: '2026-11-16',
      maternalBp: '110/70',
      maternalTemp: '36.6 °C',
      maternalPulse: '72 bpm',
      fundalFirmness: 'Firm and contracted',
      fundalPosition: 'Pelvic organ, non-palpable abdominally',
      lochiaType: 'Lochia Alba (Yellowish/White)',
      lochiaAmount: 'Scant',
      lochiaOdor: 'Normal / Fleshy',
      perineumHealing: 'Intact / No tear',
      breastCondition: 'Mature milk flowing',
      feedingMethod: 'Exclusive Breastfeeding',
      maternalMentalState: 'Positive & bonding well',
      familyPlanningCounseling: 'Progestin-Only Pill (POP) prescribed / LAM continued',
      babyWeightKg: 4.8,
      cordStumpStatus: 'Sloughed off completely',
      jaundiceStatus: 'None',
      clinicalNotes: 'Week 6 postnatal clearance visit. Full maternal involution achieved. Care cycle completed successfully.',
    },
  ];

  for (const post of postpartumData) {
    const pt = patientMap.get(post.email);
    if (!pt) {
      console.warn(`Patient not found for ${post.email}`);
      continue;
    }
    const docId = `post_${pt.id}_${post.visitDate.replace(/-/g, '')}`;
    await setDoc(doc(db, 'postpartum_records', docId), {
      ...post,
      patientId: pt.id,
      patientName: pt.fullName,
      attendingMidwife: MIDWIFE_NAME,
      assignedMidwifeId: MIDWIFE_UID,
      midwifeId: MIDWIFE_UID,
      createdBy: MIDWIFE_UID,
      createdAt: serverTimestamp(),
    });
    console.log(`✓ Seeded postpartum record for ${pt.fullName} on ${post.visitDate}`);
  }

  console.log('\n=== SEEDING COMPLETE ===');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
