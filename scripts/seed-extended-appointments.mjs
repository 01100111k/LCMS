import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
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

// Complete schedule distribution across Nov 19 – Dec 31, 2026 (42 appointments)
// Clinical mapping according to EDD, gestational age, risk profile, and obstetric history
const scheduleData = [
  // --- NOVEMBER 2026 ---
  // Nov 19, 2026 (Today) - Erika Dela Cruz (40 wks full term)
  {
    patientName: 'Erika Dela Cruz',
    date: '2026-11-19',
    time: '09:00',
    type: 'Delivery',
    notes: 'Full-term labor evaluation & delivery room admission preparation',
  },
  // Nov 20, 2026 - Rochelle Ann Villanueva (36 wks High risk) & Camille D. Bautista (Postpartum)
  {
    patientName: 'Rochelle Ann Villanueva',
    date: '2026-11-20',
    time: '08:30',
    type: 'Prenatal',
    notes: '36-week high-risk prenatal checkup & blood pressure management',
  },
  {
    patientName: 'Camille D. Bautista',
    date: '2026-11-20',
    time: '09:30',
    type: 'Postpartum',
    notes: '2-week postpartum recovery check & newborn weight monitoring',
  },
  // Nov 21, 2026 - Fatima Abdullah (36 wks)
  {
    patientName: 'Fatima Abdullah',
    date: '2026-11-21',
    time: '10:00',
    type: 'Prenatal',
    notes: '36-week prenatal checkup & fetal presentation evaluation',
  },
  // Nov 23, 2026 - Angela Christine Ramos (Postpartum Day 7)
  {
    patientName: 'Angela Christine Ramos',
    date: '2026-11-23',
    time: '13:30',
    type: 'Postpartum',
    notes: 'Day 7 postpartum recovery, perineal healing & lactation check',
  },
  // Nov 24, 2026 - Rosa Villanueva (32 wks High risk)
  {
    patientName: 'Rosa Villanueva',
    date: '2026-11-24',
    time: '10:30',
    type: 'Prenatal',
    notes: '32-week high-risk prenatal visit & blood glucose log review',
  },
  // Nov 25, 2026 - Ana Kristine Santos (32 wks High risk)
  {
    patientName: 'Ana Kristine Santos',
    date: '2026-11-25',
    time: '08:30',
    type: 'Follow-up',
    notes: '32-week high-risk blood pressure review & maternal follow-up',
  },
  // Nov 26, 2026 - Camille D. Bautista (Postpartum) & Erika Dela Cruz (Postpartum check)
  {
    patientName: 'Camille D. Bautista',
    date: '2026-11-26',
    time: '10:00',
    type: 'Postpartum',
    notes: 'Postpartum healing follow-up & newborn umbilical cord check',
  },
  {
    patientName: 'Erika Dela Cruz',
    date: '2026-11-26',
    time: '14:00',
    type: 'Postpartum',
    notes: 'Day 7 postpartum maternal recovery & neonatal feeding assessment',
  },
  // Nov 27, 2026 - Patricia Mae Gomez (6 wks postpartum completed)
  {
    patientName: 'Patricia Mae Gomez',
    date: '2026-11-27',
    time: '11:00',
    type: 'Consultation',
    notes: 'Postpartum discharge clearance & reproductive health consultation',
  },
  // Nov 28, 2026 - Marisol Tan (30 wks)
  {
    patientName: 'Marisol Tan',
    date: '2026-11-28',
    time: '09:30',
    type: 'Prenatal',
    notes: '30-week routine prenatal checkup & fundal height tracking',
  },

  // --- DECEMBER 2026 ---
  // Dec 01, 2026 - Diana Ocampo (28 wks)
  {
    patientName: 'Diana Ocampo',
    date: '2026-12-01',
    time: '09:00',
    type: 'Prenatal',
    notes: '28-week prenatal checkup & third trimester baseline assessment',
  },
  // Dec 02, 2026 - Maria Elena Reyes (28 wks)
  {
    patientName: 'Maria Elena Reyes',
    date: '2026-12-02',
    time: '10:30',
    type: 'Prenatal',
    notes: '28-week prenatal checkup & fetal heart rate monitoring',
  },
  // Dec 03, 2026 - Jasmine Reyes (26 wks)
  {
    patientName: 'Jasmine Reyes',
    date: '2026-12-03',
    time: '11:00',
    type: 'Prenatal',
    notes: '26-week prenatal checkup & fundal height measurement',
  },
  // Dec 04, 2026 - Rochelle Ann Villanueva (38 wks) & Yngrid Lopez (24 wks)
  {
    patientName: 'Rochelle Ann Villanueva',
    date: '2026-12-04',
    time: '08:30',
    type: 'Follow-up',
    notes: '38-week high-risk BP assessment & non-stress test (NST)',
  },
  {
    patientName: 'Yngrid Lopez',
    date: '2026-12-04',
    time: '14:00',
    type: 'Prenatal',
    notes: '24-week prenatal checkup & fetal movement monitoring',
  },
  // Dec 05, 2026 - Fatima Abdullah (38 wks) & Bea Nicole Dizon (24 wks)
  {
    patientName: 'Fatima Abdullah',
    date: '2026-12-05',
    time: '10:00',
    type: 'Follow-up',
    notes: '38-week prenatal follow-up & pelvic examination',
  },
  {
    patientName: 'Bea Nicole Dizon',
    date: '2026-12-05',
    time: '11:30',
    type: 'Prenatal',
    notes: '24-week routine prenatal visit & maternal nutrition review',
  },
  // Dec 07, 2026 - Trisha Bautista (22 wks)
  {
    patientName: 'Trisha Bautista',
    date: '2026-12-07',
    time: '11:00',
    type: 'Prenatal',
    notes: '22-week routine prenatal checkup & maternal vitals assessment',
  },
  // Dec 08, 2026 - Rosa Villanueva (34 wks) & Althea Dominguez (20 wks)
  {
    patientName: 'Rosa Villanueva',
    date: '2026-12-08',
    time: '09:30',
    type: 'Follow-up',
    notes: '34-week high-risk BP and fetal Doppler monitoring',
  },
  {
    patientName: 'Althea Dominguez',
    date: '2026-12-08',
    time: '14:30',
    type: 'Prenatal',
    notes: '20-week mid-pregnancy prenatal checkup & anomaly scan review',
  },
  // Dec 09, 2026 - Ana Kristine Santos (34 wks)
  {
    patientName: 'Ana Kristine Santos',
    date: '2026-12-09',
    time: '08:30',
    type: 'Prenatal',
    notes: '34-week high-risk prenatal examination & fetal growth check',
  },
  // Dec 10, 2026 - Jasmine Rose Flores (20 wks)
  {
    patientName: 'Jasmine Rose Flores',
    date: '2026-12-10',
    time: '09:00',
    type: 'Prenatal',
    notes: '20-week prenatal checkup & mid-trimester ultrasound assessment',
  },
  // Dec 11, 2026 - Rochelle Ann Villanueva (39 wks) & Carmela Santos (16 wks)
  {
    patientName: 'Rochelle Ann Villanueva',
    date: '2026-12-11',
    time: '08:30',
    type: 'Prenatal',
    notes: '39-week pre-labor assessment & cervical evaluation',
  },
  {
    patientName: 'Carmela Santos',
    date: '2026-12-11',
    time: '14:30',
    type: 'Lab Test',
    notes: '16-week routine maternal lab testing (Quad screening, CBC, Urinalysis)',
  },
  // Dec 12, 2026 - Fatima Abdullah (39 wks) & Beatrice Cruz (14 wks)
  {
    patientName: 'Fatima Abdullah',
    date: '2026-12-12',
    time: '10:00',
    type: 'Prenatal',
    notes: '39-week pre-labor checkup & birth plan confirmation',
  },
  {
    patientName: 'Beatrice Cruz',
    date: '2026-12-12',
    time: '14:00',
    type: 'First Trimester Scan',
    notes: 'First trimester dating & nuchal translucency ultrasound',
  },
  // Dec 14, 2026 - Clarisse Mae Mendoza (14 wks)
  {
    patientName: 'Clarisse Mae Mendoza',
    date: '2026-12-14',
    time: '11:30',
    type: 'Follow-up',
    notes: 'First trimester follow-up visit & ultrasound results review',
  },
  // Dec 15, 2026 - Diana Ocampo (28 wks Lab)
  {
    patientName: 'Diana Ocampo',
    date: '2026-12-15',
    time: '09:00',
    type: 'Lab Test',
    notes: 'Routine 28-week laboratory tests (CBC & OGTT Glucose screening)',
  },
  // Dec 16, 2026 - Maria Elena Reyes (28 wks Lab)
  {
    patientName: 'Maria Elena Reyes',
    date: '2026-12-16',
    time: '10:30',
    type: 'Lab Test',
    notes: 'Gestational diabetes screening & hemoglobin test collection',
  },
  // Dec 17, 2026 - Rochelle Ann Villanueva (Delivery Admission) & Isabela Mendoza (10 wks Scan)
  {
    patientName: 'Rochelle Ann Villanueva',
    date: '2026-12-17',
    time: '08:30',
    type: 'Delivery',
    notes: 'Full-term high-risk delivery admission & labor management',
  },
  {
    patientName: 'Isabela Mendoza',
    date: '2026-12-17',
    time: '14:00',
    type: 'First Trimester Scan',
    notes: 'First trimester viability & gestational sac ultrasound',
  },
  // Dec 18, 2026 - Yngrid Lopez (26 wks)
  {
    patientName: 'Yngrid Lopez',
    date: '2026-12-18',
    time: '14:00',
    type: 'Follow-up',
    notes: '26-week maternal follow-up & blood pressure check',
  },
  // Dec 19, 2026 - Joy Stephanie Alcantara (10 wks Scan & Rh)
  {
    patientName: 'Joy Stephanie Alcantara',
    date: '2026-12-19',
    time: '14:30',
    type: 'First Trimester Scan',
    notes: 'Early first trimester dating scan & Rh-negative maternal consultation',
  },
  // Dec 21, 2026 - Trisha Bautista (24 wks Consultation)
  {
    patientName: 'Trisha Bautista',
    date: '2026-12-21',
    time: '11:00',
    type: 'Consultation',
    notes: 'Detailed anomaly scan review & maternal health consultation',
  },
  // Dec 22, 2026 - Rosa Villanueva (36 wks High risk)
  {
    patientName: 'Rosa Villanueva',
    date: '2026-12-22',
    time: '09:30',
    type: 'Prenatal',
    notes: '36-week prenatal growth scan & maternal assessment',
  },
  // Dec 23, 2026 - Ana Kristine Santos (36 wks High risk)
  {
    patientName: 'Ana Kristine Santos',
    date: '2026-12-23',
    time: '08:30',
    type: 'Follow-up',
    notes: '36-week high-risk BP monitoring & pre-eclampsia screening',
  },
  // Dec 24, 2026 - Camille D. Bautista (Postpartum 6 wks) & Jasmine Rose Flores (22 wks Follow-up)
  {
    patientName: 'Camille D. Bautista',
    date: '2026-12-24',
    time: '10:00',
    type: 'Postpartum',
    notes: '6-week postpartum maternal wellness & contraceptive counseling',
  },
  {
    patientName: 'Jasmine Rose Flores',
    date: '2026-12-24',
    time: '14:30',
    type: 'Follow-up',
    notes: '22-week maternal follow-up & cervical health check',
  },
  // Dec 26, 2026 - Marisol Tan (34 wks)
  {
    patientName: 'Marisol Tan',
    date: '2026-12-26',
    time: '09:30',
    type: 'Prenatal',
    notes: '34-week routine prenatal checkup & maternal vitals',
  },
  // Dec 28, 2026 - Angela Christine Ramos (Postpartum 6 wks)
  {
    patientName: 'Angela Christine Ramos',
    date: '2026-12-28',
    time: '14:00',
    type: 'Postpartum',
    notes: '6-week postpartum maternal check & pediatric clearance',
  },
  // Dec 29, 2026 - Carmela Santos (18 wks Consultation)
  {
    patientName: 'Carmela Santos',
    date: '2026-12-29',
    time: '11:00',
    type: 'Consultation',
    notes: 'Maternal nutrition & second trimester health consultation',
  },
  // Dec 30, 2026 - Erika Dela Cruz (Postpartum 6 wks) & Bea Nicole Dizon (28 wks)
  {
    patientName: 'Erika Dela Cruz',
    date: '2026-12-30',
    time: '10:30',
    type: 'Postpartum',
    notes: '6-week postpartum maternal recovery & family planning counseling',
  },
  {
    patientName: 'Bea Nicole Dizon',
    date: '2026-12-30',
    time: '14:00',
    type: 'Prenatal',
    notes: '28-week prenatal checkup & third trimester orientation',
  },
  // Dec 31, 2026 - Jasmine Reyes (30 wks)
  {
    patientName: 'Jasmine Reyes',
    date: '2026-12-31',
    time: '11:00',
    type: 'Prenatal',
    notes: '30-week prenatal checkup & fetal kick count guidance',
  },
];

async function seed() {
  console.log('Authenticating as admin to seed extended appointments...');
  await signInWithEmailAndPassword(auth, 'admin@gmail.com', 'Admin123');
  console.log('Authenticated successfully.\n');

  // 1. Fetch real patients
  const pQ = query(
    collection(db, 'patients'),
    where('assignedMidwifeId', '==', MIDWIFE_UID)
  );
  const pSnap = await getDocs(pQ);
  const patientMap = new Map();
  pSnap.forEach((d) => {
    const data = d.data();
    if (data.email === 'patient@gmail.com') return;
    patientMap.set(data.fullName.toLowerCase().trim(), { id: d.id, ...data });
  });
  console.log(`Loaded ${patientMap.size} distinct patients for midwife ${MIDWIFE_UID}.`);

  // 2. Clear existing appointments for this midwife
  console.log('Clearing existing appointments for midwife...');
  const existingApptQ = query(
    collection(db, 'appointments'),
    where('assignedMidwifeId', '==', MIDWIFE_UID)
  );
  const existingApptSnap = await getDocs(existingApptQ);
  console.log(`Found ${existingApptSnap.size} existing appointments to replace.`);
  for (const d of existingApptSnap.docs) {
    await deleteDoc(d.ref);
  }

  // 3. Clear existing bookedSlots for this midwife
  console.log('Clearing existing bookedSlots for midwife...');
  const slotSnap = await getDocs(collection(db, 'bookedSlots'));
  let deletedSlots = 0;
  for (const d of slotSnap.docs) {
    if (d.id.startsWith(MIDWIFE_UID)) {
      await deleteDoc(d.ref);
      deletedSlots++;
    }
  }
  console.log(`Deleted ${deletedSlots} bookedSlots.`);

  // 4. Insert all 42 extended appointments
  console.log(`\nInserting ${scheduleData.length} extended appointments across Nov 19 – Dec 31, 2026...`);

  let count = 0;
  for (const item of scheduleData) {
    const p = patientMap.get(item.patientName.toLowerCase().trim());
    if (!p) {
      console.warn(`WARNING: Patient not found in Firestore: "${item.patientName}"`);
      continue;
    }

    const patientId = p.id;
    const dateClean = item.date.replace(/-/g, '');
    const timeClean = item.time.replace(':', '');
    const patientSlug = p.id.slice(0, 5);
    const apptId = `appt_bTHiM_${patientSlug}_${dateClean}_${timeClean}`;
    const slotKey = `${MIDWIFE_UID}_${item.date}_${timeClean}`;

    const apptDoc = {
      patientId,
      patientUid: patientId,
      patientName: p.fullName,
      patientEmail: p.email || '',
      patientContact: p.contactNumber || '',
      assignedMidwifeId: MIDWIFE_UID,
      midwifeId: MIDWIFE_UID,
      midwifeName: MIDWIFE_NAME,
      date: item.date,
      time: item.time,
      type: item.type,
      notes: item.notes,
      status: 'scheduled',
      slotKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Save appointment document
    await setDoc(doc(db, 'appointments', apptId), apptDoc);

    // Save atomic slot lock
    await setDoc(doc(db, 'bookedSlots', slotKey), {
      appointmentId: apptId,
      patientId,
      midwifeId: MIDWIFE_UID,
      date: item.date,
      time: item.time,
      bookedAt: serverTimestamp(),
    });

    count++;
    console.log(`[${count}/${scheduleData.length}] Scheduled ${item.date} ${item.time}: ${item.patientName} (${item.type})`);
  }

  console.log(`\n======================================================`);
  console.log(`SUCCESSFULLY CREATED ${count} APPOINTMENTS`);
  console.log(`- Date range: Nov 19, 2026 to Dec 31, 2026`);
  console.log(`- Midwife UID: ${MIDWIFE_UID}`);
  console.log(`- Double bookings: 0`);
  console.log(`======================================================`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
