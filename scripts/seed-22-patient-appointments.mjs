import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  deleteDoc,
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
const db = getFirestore(app);

const MIDWIFE_UID = 'bTHiMlndLCWH08gG97Sd55NK1bc2';
const MIDWIFE_NAME = 'Licensed Midwife';

const defaultWeeklyHours = [
  { dayName: 'Sunday', dayIndex: 0, enabled: false, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
  { dayName: 'Monday', dayIndex: 1, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
  { dayName: 'Tuesday', dayIndex: 2, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
  { dayName: 'Wednesday', dayIndex: 3, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
  { dayName: 'Thursday', dayIndex: 4, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
  { dayName: 'Friday', dayIndex: 5, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
  { dayName: 'Saturday', dayIndex: 6, enabled: true, startTime: '08:00 AM', endTime: '05:00 PM', slotDuration: '30 min' },
];

// Schedule slots distribution across future dates (Nov 20 to Nov 25, 2026) - exactly 22 distinct slots
const appointmentSlots = [
  // Friday Nov 20, 2026 (5 slots)
  { date: '2026-11-20', time: '08:30' },
  { date: '2026-11-20', time: '09:30' },
  { date: '2026-11-20', time: '10:30' },
  { date: '2026-11-20', time: '14:00' },
  { date: '2026-11-20', time: '15:00' },

  // Saturday Nov 21, 2026 (4 slots)
  { date: '2026-11-21', time: '09:00' },
  { date: '2026-11-21', time: '10:00' },
  { date: '2026-11-21', time: '11:00' },
  { date: '2026-11-21', time: '14:30' },

  // Monday Nov 23, 2026 (5 slots)
  { date: '2026-11-23', time: '08:30' },
  { date: '2026-11-23', time: '09:30' },
  { date: '2026-11-23', time: '11:00' },
  { date: '2026-11-23', time: '13:30' },
  { date: '2026-11-23', time: '15:30' },

  // Tuesday Nov 24, 2026 (4 slots)
  { date: '2026-11-24', time: '09:00' },
  { date: '2026-11-24', time: '10:30' },
  { date: '2026-11-24', time: '14:00' },
  { date: '2026-11-24', time: '16:00' },

  // Wednesday Nov 25, 2026 (4 slots)
  { date: '2026-11-25', time: '08:30' },
  { date: '2026-11-25', time: '10:00' },
  { date: '2026-11-25', time: '11:30' },
  { date: '2026-11-25', time: '15:00' },
];

// Clinical mapping function for the 22 patients
function getAppointmentDetails(patient) {
  const name = (patient.fullName || '').toLowerCase();
  const email = (patient.email || '').toLowerCase();

  if (name.includes('camille') || email.includes('camille')) {
    return { type: 'Postpartum', notes: 'Day 7 postpartum recovery & newborn checkup' };
  }
  if (name.includes('angela') || email.includes('angela')) {
    return { type: 'Postpartum', notes: 'Immediate postpartum care & lactation assessment' };
  }
  if (name.includes('erika') || email.includes('erika')) {
    return { type: 'Delivery', notes: 'Full-term labor evaluation & delivery admission preparation' };
  }
  if (name.includes('beatrice') || email.includes('beatrice')) {
    return { type: 'First Trimester Scan', notes: 'First trimester viability & dating ultrasound' };
  }
  if (name.includes('isabela') || email.includes('isabela')) {
    return { type: 'First Trimester Scan', notes: 'Early first trimester dating scan' };
  }
  if (name.includes('alcantara') || email.includes('alcantara') || email.includes('joy')) {
    return { type: 'First Trimester Scan', notes: 'First trimester dating & anatomy ultrasound' };
  }
  if (name.includes('carmela') || email.includes('carmela')) {
    return { type: 'Lab Test', notes: 'Routine prenatal laboratory tests (CBC, OGTT, Urinalysis)' };
  }
  if (name.includes('ana kristine') || email.includes('ana.santos')) {
    return { type: 'Follow-up', notes: 'High-risk blood pressure review & maternal follow-up' };
  }
  if (name.includes('clarisse') || email.includes('clarisse')) {
    return { type: 'Follow-up', notes: 'Follow-up visit for prenatal ultrasound results' };
  }
  if (name.includes('patricia') || email.includes('patricia')) {
    return { type: 'Consultation', notes: 'General maternal health & nutrition consultation' };
  }
  if (name.includes('rochelle') || email.includes('rochelle')) {
    return { type: 'Prenatal', notes: 'High-risk 3rd trimester prenatal checkup' };
  }
  if (name.includes('rosa') || email.includes('rosa')) {
    return { type: 'Prenatal', notes: 'High-risk prenatal BP and fetal monitoring' };
  }
  return { type: 'Prenatal', notes: 'Routine prenatal visit & fetal growth monitoring' };
}

async function main() {
  console.log('--- 1. Setting up Midwife Availability in Firestore ---');
  const availRef = doc(db, 'midwife_availability', MIDWIFE_UID);
  await setDoc(
    availRef,
    {
      midwifeId: MIDWIFE_UID,
      midwifeName: MIDWIFE_NAME,
      weeklyHours: defaultWeeklyHours,
      blockedDates: [],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  console.log('Updated midwife_availability document.');

  console.log('\n--- 2. Fetching the 22 registered patients for midwife ---');
  const pQ = query(collection(db, 'patients'), where('assignedMidwifeId', '==', MIDWIFE_UID));
  const pSnap = await getDocs(pQ);

  // Exclude any generic "patient@gmail.com" account if present
  const patients = pSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.email && p.email.toLowerCase() !== 'patient@gmail.com');

  console.log(`Found ${patients.length} distinct maternal patients assigned to midwife ${MIDWIFE_UID}.`);

  console.log('\n--- 3. Clearing old appointments for midwife to ensure clean slate ---');
  const apptQ = query(collection(db, 'appointments'), where('assignedMidwifeId', '==', MIDWIFE_UID));
  const apptSnap = await getDocs(apptQ);
  for (const d of apptSnap.docs) {
    const data = d.data();
    const slotKeyVal = `${MIDWIFE_UID}_${data.date}_${String(data.time).replace(':', '')}`;
    await deleteDoc(doc(db, 'bookedSlots', slotKeyVal)).catch(() => {});
    await deleteDoc(d.ref).catch(() => {});
  }
  console.log(`Cleared previous ${apptSnap.size} appointment records.`);

  console.log('\n--- 4. Creating fresh scheduled appointments for all 22 patients ---');
  let idx = 0;
  for (const patient of patients) {
    if (idx >= appointmentSlots.length) break;
    const slot = appointmentSlots[idx];
    const details = getAppointmentDetails(patient);
    const patientName = patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
    const apptId = `appt_${MIDWIFE_UID.substring(0, 5)}_${patient.id.substring(0, 5)}_${slot.date.replace(/-/g, '')}_${slot.time.replace(':', '')}`;

    const apptDoc = {
      patientId: patient.id,
      patientName,
      date: slot.date,
      time: slot.time,
      type: details.type,
      notes: details.notes,
      status: 'scheduled',
      assignedMidwifeId: MIDWIFE_UID,
      midwifeId: MIDWIFE_UID,
      midwifeName: MIDWIFE_NAME,
      createdAt: serverTimestamp(),
      createdBy: MIDWIFE_UID,
    };

    // Save appointment
    await setDoc(doc(db, 'appointments', apptId), apptDoc);

    // Lock booked slot
    const slotKeyVal = `${MIDWIFE_UID}_${slot.date}_${slot.time.replace(':', '')}`;
    await setDoc(doc(db, 'bookedSlots', slotKeyVal), {
      appointmentId: apptId,
      midwifeId: MIDWIFE_UID,
      date: slot.date,
      time: slot.time,
    });

    console.log(`[${idx + 1}/22] Booked ${patientName} (${patient.email}) -> ${slot.date} ${slot.time} (${details.type})`);
    idx++;
  }

  console.log('\n--- 5. Verification: Counting appointments ---');
  const verifySnap = await getDocs(query(collection(db, 'appointments'), where('assignedMidwifeId', '==', MIDWIFE_UID)));
  console.log(`Successfully verified ${verifySnap.size} appointments for midwife ${MIDWIFE_UID}!`);

  const bookedSlotsSnap = await getDocs(collection(db, 'bookedSlots'));
  console.log(`Current bookedSlots count: ${bookedSlotsSnap.size}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Error running seed script:', err);
  process.exit(1);
});
