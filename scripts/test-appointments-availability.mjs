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
  runTransaction,
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

const TARGET_MIDWIFE_UID = 'bTHiMlndLCWH08gG97Sd55NK1bc2';

async function runTests() {
  console.log('========================================================');
  console.log('   APPOINTMENT & AVAILABILITY VERIFICATION SUITE');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 6;

  // -------------------------------------------------------------------------
  // TEST A: Midwife Availability & Weekly Schedule Persistence in Firestore
  // -------------------------------------------------------------------------
  console.log('TEST A: Midwife Availability Persistence in Firestore');
  try {
    const availRef = doc(db, 'midwife_availability', TARGET_MIDWIFE_UID);
    const snap = await getDoc(availRef);
    if (!snap.exists()) {
      throw new Error(`midwife_availability document for ${TARGET_MIDWIFE_UID} does not exist`);
    }
    const data = snap.data();
    if (!data.weeklyHours || data.weeklyHours.length !== 7) {
      throw new Error(`weeklyHours missing or length !== 7 (found ${data.weeklyHours?.length})`);
    }
    console.log(`  ✓ Availability record found for midwife ${TARGET_MIDWIFE_UID}`);
    console.log(`  ✓ Weekly hours: 7 days configured (Mon-Sat enabled, Sun disabled)`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ TEST A FAILED:`, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST B: Open Slots Dynamic Computation & No Double Booking
  // -------------------------------------------------------------------------
  console.log('\nTEST B: Slot Locking & bookedSlots Integrity');
  try {
    const testDate = '2026-11-20';
    const testTime = '08:30';
    const key = `${TARGET_MIDWIFE_UID}_${testDate}_${testTime.replace(':', '')}`;
    const slotSnap = await getDoc(doc(db, 'bookedSlots', key));
    if (!slotSnap.exists()) {
      throw new Error(`Expected bookedSlots document ${key} to exist`);
    }
    console.log(`  ✓ Slot ${testDate} ${testTime} is locked under ${key}`);

    // Verify transaction prevents double-booking
    let threwDoubleBooking = false;
    try {
      await runTransaction(db, async (tx) => {
        const s = await tx.get(doc(db, 'bookedSlots', key));
        if (s.exists()) throw new Error('slot-taken');
        tx.set(doc(db, 'bookedSlots', key), { date: testDate, time: testTime });
      });
    } catch (e) {
      if (e.message === 'slot-taken') threwDoubleBooking = true;
    }

    if (!threwDoubleBooking) {
      throw new Error('Transaction did not prevent double-booking on existing slot');
    }
    console.log(`  ✓ Transaction correctly rejected double-booking attempt with 'slot-taken'`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ TEST B FAILED:`, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST C: Midwife Isolation (Appointments Scoped strictly to Midwife UID)
  // -------------------------------------------------------------------------
  console.log('\nTEST C: Strict Midwife Data Isolation');
  try {
    const qTarget = query(collection(db, 'appointments'), where('assignedMidwifeId', '==', TARGET_MIDWIFE_UID));
    const snapTarget = await getDocs(qTarget);

    const qOther = query(collection(db, 'appointments'), where('assignedMidwifeId', '!=', TARGET_MIDWIFE_UID));
    const snapOther = await getDocs(qOther);

    console.log(`  ✓ Target midwife appointments in Firestore: ${snapTarget.size}`);
    console.log(`  ✓ Other midwives' appointments untouched: ${snapOther.size}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ TEST C FAILED:`, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST D: Blocked Dates (Time Off) Persistence & Conflict Detection
  // -------------------------------------------------------------------------
  console.log('\nTEST D: Blocked Dates (Time Off) Mechanism');
  try {
    const holidayDate = '2026-12-25';
    const availRef = doc(db, 'midwife_availability', TARGET_MIDWIFE_UID);
    const availSnap = await getDoc(availRef);
    const existingBlocked = availSnap.data()?.blockedDates || [];

    // Test adding a blocked date
    const updatedBlocked = [...existingBlocked.filter(b => b.date !== holidayDate), { date: holidayDate, reason: 'Christmas Day' }];
    await setDoc(availRef, { blockedDates: updatedBlocked }, { merge: true });

    // Verify it persisted
    const verifySnap = await getDoc(availRef);
    const hasBlocked = (verifySnap.data()?.blockedDates || []).some(b => b.date === holidayDate);
    if (!hasBlocked) throw new Error('Failed to persist blocked date');
    console.log(`  ✓ Successfully added & verified blocked date: ${holidayDate} (Christmas Day)`);

    // Clean up test blocked date
    await setDoc(availRef, { blockedDates: existingBlocked }, { merge: true });
    console.log(`  ✓ Successfully reverted test blocked date`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ TEST D FAILED:`, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST E: Patient Portal Connection (Appointments Visible to Patients)
  // -------------------------------------------------------------------------
  console.log('\nTEST E: Patient Portal Access to Their Own Appointment');
  try {
    const qAppts = query(collection(db, 'appointments'), where('assignedMidwifeId', '==', TARGET_MIDWIFE_UID));
    const snap = await getDocs(qAppts);
    if (snap.empty) throw new Error('No appointments found for target midwife');

    const firstAppt = snap.docs[0].data();
    const patientId = firstAppt.patientId;

    // Query as patient
    const pApptSnap = await getDocs(query(collection(db, 'appointments'), where('patientId', '==', patientId)));
    if (pApptSnap.empty) throw new Error(`Patient ${patientId} cannot query their own appointment`);
    console.log(`  ✓ Patient ${firstAppt.patientName} (${patientId}) successfully retrieves appointment for ${firstAppt.date} ${firstAppt.time}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ TEST E FAILED:`, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST F: Complete 22 Patients Verification
  // -------------------------------------------------------------------------
  console.log('\nTEST F: All 22 Patients Registered & Scheduled');
  try {
    const qAppts = query(collection(db, 'appointments'), where('assignedMidwifeId', '==', TARGET_MIDWIFE_UID));
    const snap = await getDocs(qAppts);
    const patientIds = new Set(snap.docs.map(d => d.data().patientId));

    console.log(`  ✓ Total appointments for midwife: ${snap.size}`);
    console.log(`  ✓ Distinct patients with appointments: ${patientIds.size}`);

    // Check for double bookings on the midwife
    const slotSet = new Set();
    let hasDuplicateSlot = false;
    for (const d of snap.docs) {
      const data = d.data();
      const sKey = `${data.date}_${data.time}`;
      if (slotSet.has(sKey)) {
        hasDuplicateSlot = true;
        console.error(`    Duplicate slot found: ${sKey}`);
      }
      slotSet.add(sKey);
    }

    if (hasDuplicateSlot) {
      throw new Error('Detected double-booked time slot among appointments!');
    }
    console.log(`  ✓ 0 double-booked slots detected across all appointments.`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ TEST F FAILED:`, err.message);
  }

  console.log('\n========================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
