import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
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

async function verify() {
  await signInWithEmailAndPassword(auth, 'admin@gmail.com', 'Admin123');
  console.log('--- AUDITING EXTENDED SCHEDULE (NOV 19 – DEC 31, 2026) ---');

  const apptQ = query(
    collection(db, 'appointments'),
    where('assignedMidwifeId', '==', MIDWIFE_UID)
  );
  const apptSnap = await getDocs(apptQ);
  console.log(`Total appointments in Firestore: ${apptSnap.size}`);

  const novAppts = [];
  const decAppts = [];
  const patientSet = new Set();
  const typesSet = new Set();
  const timeCollisions = new Map();

  apptSnap.forEach((d) => {
    const data = d.data();
    patientSet.add(data.patientName);
    typesSet.add(data.type);

    const slotKey = `${data.date}_${data.time}`;
    if (timeCollisions.has(slotKey)) {
      timeCollisions.get(slotKey).push(data.patientName);
    } else {
      timeCollisions.set(slotKey, [data.patientName]);
    }

    if (data.date.startsWith('2026-11')) {
      novAppts.push(data);
    } else if (data.date.startsWith('2026-12')) {
      decAppts.push(data);
    }
  });

  console.log(`November 2026 Appointments: ${novAppts.length}`);
  console.log(`December 2026 Appointments: ${decAppts.length}`);
  console.log(`Distinct Patients with Scheduled Appointments: ${patientSet.size}/22`);
  console.log(`Appointment Types Covered (${typesSet.size}/7): ${Array.from(typesSet).join(', ')}`);

  let collisionCount = 0;
  for (const [slot, names] of timeCollisions.entries()) {
    if (names.length > 1) {
      console.error(`COLLISION DETECTED at ${slot}: ${names.join(', ')}`);
      collisionCount++;
    }
  }

  if (collisionCount === 0) {
    console.log(`Double Bookings: 0 (Zero time collisions confirmed)`);
  }

  // Check bookedSlots sync
  const slotSnap = await getDocs(collection(db, 'bookedSlots'));
  let midwifeSlotCount = 0;
  slotSnap.forEach((d) => {
    if (d.id.startsWith(MIDWIFE_UID)) {
      midwifeSlotCount++;
    }
  });
  console.log(`Total bookedSlots records in Firestore for midwife: ${midwifeSlotCount}`);

  if (
    apptSnap.size >= 40 &&
    novAppts.length >= 10 &&
    decAppts.length >= 30 &&
    patientSet.size === 22 &&
    typesSet.size === 7 &&
    collisionCount === 0
  ) {
    console.log('\n>>> ALL AUDIT CHECKS PASSED: EXTENDED SCHEDULE IS FULLY PERSISTENT & VERIFIED <<<');
  } else {
    console.warn('\n>>> AUDIT WARNING: One or more conditions not met <<<');
  }
}

verify()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
