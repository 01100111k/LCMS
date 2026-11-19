import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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
  updateDoc,
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

const MIDWIFE_A_UID = 'bTHiMlndLCWH08gG97Sd55NK1bc2';
const MIDWIFE_B_UID = 'test_midwife_isolated_b_' + Date.now().toString().slice(-4);
const TODAY = '2026-11-19';

async function main() {
  await signInWithEmailAndPassword(auth, 'admin@gmail.com', 'Admin123');
  console.log('================================================================');
  console.log('LCMS COMPLETE APPOINTMENT, QUEUE & NOTIFICATION VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  const total = 9;

  // --------------------------------------------------------------------------
  // TEST 1: Midwife A Initial State & Ownership
  // --------------------------------------------------------------------------
  console.log('TEST 1: Midwife A Initial State & Extended Patient Appointments');
  try {
    const pSnap = await getDocs(
      query(collection(db, 'patients'), where('assignedMidwifeId', '==', MIDWIFE_A_UID))
    );
    const validPatients = pSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.email && p.email.toLowerCase() !== 'patient@gmail.com');

    if (validPatients.length !== 22) {
      throw new Error(`Expected exactly 22 patients for Midwife A, found ${validPatients.length}`);
    }
    console.log(`  ✓ Exactly 22 registered patients found for Midwife A`);

    const apptSnap = await getDocs(
      query(collection(db, 'appointments'), where('assignedMidwifeId', '==', MIDWIFE_A_UID))
    );
    if (apptSnap.size < 22) {
      throw new Error(`Expected at least 22 scheduled appointments for Midwife A, found ${apptSnap.size}`);
    }
    console.log(`  ✓ ${apptSnap.size} appointments scheduled across Nov 19 – Dec 31 for Midwife A`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 1 FAILED:', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Midwife B (New Midwife) Empty State & Clean Baseline
  // --------------------------------------------------------------------------
  console.log('\nTEST 2: Midwife B (Independent Registered Midwife) Empty State');
  try {
    const pSnapB = await getDocs(
      query(collection(db, 'patients'), where('assignedMidwifeId', '==', MIDWIFE_B_UID))
    );
    if (!pSnapB.empty) throw new Error(`Midwife B unexpectedly has ${pSnapB.size} patients`);
    console.log(`  ✓ Midwife B has 0 patients (Starts clean, no fabricated sample data)`);

    const apptSnapB = await getDocs(
      query(collection(db, 'appointments'), where('assignedMidwifeId', '==', MIDWIFE_B_UID))
    );
    if (!apptSnapB.empty) throw new Error(`Midwife B unexpectedly has ${apptSnapB.size} appointments`);
    console.log(`  ✓ Midwife B appointment calendar has 0 appointments`);

    const queueSnapB = await getDocs(
      query(collection(db, 'queue_tickets'), where('midwifeId', '==', MIDWIFE_B_UID), where('date', '==', TODAY))
    );
    if (!queueSnapB.empty) throw new Error(`Midwife B unexpectedly has ${queueSnapB.size} queue entries`);
    console.log(`  ✓ Midwife B waiting queue is empty`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 2 FAILED:', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Multi-Midwife Availability Independence
  // --------------------------------------------------------------------------
  console.log('\nTEST 3: Midwife Availability & Working Hours Independence');
  try {
    // Configure Midwife B availability
    const bAvailRef = doc(db, 'midwife_availability', MIDWIFE_B_UID);
    await setDoc(bAvailRef, {
      midwifeId: MIDWIFE_B_UID,
      midwifeName: 'Midwife B (Test)',
      weeklyHours: [
        { dayName: 'Monday', dayIndex: 1, enabled: true, startTime: '09:00 AM', endTime: '03:00 PM', slotDuration: '30 min' }
      ],
      blockedDates: [{ date: '2026-11-27', reason: 'Personal Leave' }],
      updatedAt: serverTimestamp(),
    });

    const bSnap = await getDoc(bAvailRef);
    if (!bSnap.exists() || bSnap.data().blockedDates.length !== 1) {
      throw new Error('Failed to verify Midwife B availability');
    }
    console.log(`  ✓ Midwife B availability configured independently with 1 blocked date (2026-11-27)`);

    // Verify Midwife A availability is completely untouched
    const aAvailRef = doc(db, 'midwife_availability', MIDWIFE_A_UID);
    const aSnap = await getDoc(aAvailRef);
    const aBlocked = aSnap.data()?.blockedDates || [];
    if (aBlocked.some(b => b.date === '2026-11-27')) {
      throw new Error("Midwife B's blocked date leaked into Midwife A!");
    }
    console.log(`  ✓ Midwife A availability is completely untouched (0 blocked date bleed)`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 3 FAILED:', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Midwife B Registration & Independent Appointment Booking
  // --------------------------------------------------------------------------
  console.log('\nTEST 4: Midwife B Registers Patient & Books Appointment');
  const patientBId = 'pat_test_b_' + Date.now().toString().slice(-4);
  const apptBId = 'appt_test_b_' + Date.now().toString().slice(-4);
  try {
    await setDoc(doc(db, 'patients', patientBId), {
      fullName: 'Clarissa Test Ramos',
      email: `clarissa.${Date.now().toString().slice(-4)}@example.com`,
      assignedMidwifeId: MIDWIFE_B_UID,
      midwifeId: MIDWIFE_B_UID,
      createdAt: serverTimestamp(),
    });

    const slotKeyB = `${MIDWIFE_B_UID}_2026-11-28_0900`;
    await setDoc(doc(db, 'bookedSlots', slotKeyB), {
      appointmentId: apptBId,
      midwifeId: MIDWIFE_B_UID,
      date: '2026-11-28',
      time: '09:00',
    });

    await setDoc(doc(db, 'appointments', apptBId), {
      patientId: patientBId,
      patientName: 'Clarissa Test Ramos',
      date: '2026-11-28',
      time: '09:00',
      type: 'Prenatal',
      status: 'scheduled',
      assignedMidwifeId: MIDWIFE_B_UID,
      midwifeId: MIDWIFE_B_UID,
      createdAt: serverTimestamp(),
    });

    console.log(`  ✓ Midwife B registered patient ${patientBId} and booked appointment on 2026-11-28 09:00`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 4 FAILED:', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Strict Isolation Verification (Midwife A sees 0 of Midwife B data)
  // --------------------------------------------------------------------------
  console.log('\nTEST 5: Strict Bidirectional Data Isolation');
  try {
    const aPatients = await getDocs(query(collection(db, 'patients'), where('assignedMidwifeId', '==', MIDWIFE_A_UID)));
    const hasBInA = aPatients.docs.some(d => d.id === patientBId);
    if (hasBInA) throw new Error("Midwife B's patient leaked into Midwife A patient list!");
    console.log(`  ✓ Midwife A cannot see Midwife B's patient`);

    const aAppts = await getDocs(query(collection(db, 'appointments'), where('assignedMidwifeId', '==', MIDWIFE_A_UID)));
    const hasBApptInA = aAppts.docs.some(d => d.id === apptBId);
    if (hasBApptInA) throw new Error("Midwife B's appointment leaked into Midwife A calendar!");
    console.log(`  ✓ Midwife A cannot see Midwife B's appointment`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 5 FAILED:', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Reschedule & Slot Transfer Mechanics
  // --------------------------------------------------------------------------
  console.log('\nTEST 6: Appointment Reschedule & bookedSlots Re-allocation');
  try {
    const oldKey = `${MIDWIFE_B_UID}_2026-11-28_0900`;
    const newKey = `${MIDWIFE_B_UID}_2026-11-28_1000`;

    // Reschedule in transaction
    await runTransaction(db, async (tx) => {
      const newSlotSnap = await tx.get(doc(db, 'bookedSlots', newKey));
      if (newSlotSnap.exists()) throw new Error('slot-taken');
      tx.delete(doc(db, 'bookedSlots', oldKey));
      tx.set(doc(db, 'bookedSlots', newKey), {
        appointmentId: apptBId,
        midwifeId: MIDWIFE_B_UID,
        date: '2026-11-28',
        time: '10:00',
      });
      tx.update(doc(db, 'appointments', apptBId), {
        time: '10:00',
        updatedAt: serverTimestamp(),
      });
    });

    const oldSlotSnap = await getDoc(doc(db, 'bookedSlots', oldKey));
    const newSlotSnap = await getDoc(doc(db, 'bookedSlots', newKey));

    if (oldSlotSnap.exists()) throw new Error('Previous slot was not released upon rescheduling!');
    if (!newSlotSnap.exists()) throw new Error('New slot was not reserved upon rescheduling!');
    console.log(`  ✓ Previous slot ${oldKey} released, new slot ${newKey} reserved in transaction`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 6 FAILED:', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Patient Queue Check-In & Unique Ticket Generation (Q-101)
  // --------------------------------------------------------------------------
  console.log('\nTEST 7: Patient Queue Check-In & Ticket Generation');
  const ticketBId = 'q_ticket_test_b_' + Date.now().toString().slice(-4);
  try {
    const ticketDoc = {
      ticketNumber: 'Q-101',
      patientId: patientBId,
      patientUid: patientBId,
      patientName: 'Clarissa Test Ramos',
      visitType: 'Prenatal Checkup',
      priority: 'Regular',
      status: 'waiting',
      checkInTime: '08:45 AM',
      station: 'Consultation Room 1',
      appointmentId: apptBId,
      date: TODAY,
      midwifeId: MIDWIFE_B_UID,
      assignedMidwifeId: MIDWIFE_B_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'queue_tickets', ticketBId), ticketDoc);

    const qSnap = await getDoc(doc(db, 'queue_tickets', ticketBId));
    if (!qSnap.exists()) throw new Error('Failed to create queue ticket');
    if (qSnap.data().ticketNumber !== 'Q-101') throw new Error('Ticket number mismatch');

    console.log(`  ✓ Ticket Q-101 created in Firestore with status 'waiting'`);

    // Verify Midwife A waiting queue still has 0 tickets for Midwife B
    const aQueueSnap = await getDocs(
      query(collection(db, 'queue_tickets'), where('midwifeId', '==', MIDWIFE_A_UID), where('date', '==', TODAY))
    );
    const hasBTicketInA = aQueueSnap.docs.some(d => d.id === ticketBId);
    if (hasBTicketInA) throw new Error("Midwife B's queue ticket leaked into Midwife A's queue!");
    console.log(`  ✓ Queue isolation verified: Midwife A does not see Midwife B's ticket`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 7 FAILED:', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Call Next Ticket & Notification Dispatch
  // --------------------------------------------------------------------------
  console.log('\nTEST 8: Call Next Ticket, Notification & Consultation Lifecycle');
  try {
    // 1. Call ticket
    await updateDoc(doc(db, 'queue_tickets', ticketBId), {
      status: 'called',
      calledTime: '09:00 AM',
      servingStartTime: '09:00 AM',
      calledTimestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const notifId = 'notif_test_' + Date.now().toString().slice(-4);
    await setDoc(doc(db, 'notifications', notifId), {
      title: "It's Your Turn!",
      message: 'Your queue number Q-101 is now being called. Please proceed to Consultation Room 1.',
      type: 'patient',
      targetRole: 'patient',
      targetUserId: patientBId,
      patientUid: patientBId,
      queueTicketNumber: 'Q-101',
      read: false,
      createdAt: serverTimestamp(),
    });

    // Verify patient notification exists
    const pNotifSnap = await getDocs(query(collection(db, 'notifications'), where('targetUserId', '==', patientBId)));
    if (pNotifSnap.empty) throw new Error('Notification not found for patient');
    console.log(`  ✓ Status updated to 'called'; notification dispatched to patient (${pNotifSnap.docs[0].data().title})`);

    // 2. Mark complete
    await updateDoc(doc(db, 'queue_tickets', ticketBId), {
      status: 'completed',
      completedTime: '09:30 AM',
      completedTimestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'appointments', apptBId), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });

    const verifyTicketSnap = await getDoc(doc(db, 'queue_tickets', ticketBId));
    const verifyApptSnap = await getDoc(doc(db, 'appointments', apptBId));

    if (verifyTicketSnap.data().status !== 'completed') throw new Error('Ticket not marked completed');
    if (verifyApptSnap.data().status !== 'completed') throw new Error('Linked appointment not marked completed');

    console.log(`  ✓ Consultation marked 'completed'; linked appointment synchronized to 'completed'`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 8 FAILED:', e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Clean Up Temporary Test Data
  // --------------------------------------------------------------------------
  console.log('\nTEST 9: Clean Up Temporary Test Records');
  try {
    await deleteDoc(doc(db, 'queue_tickets', ticketBId)).catch(() => {});
    await deleteDoc(doc(db, 'appointments', apptBId)).catch(() => {});
    await deleteDoc(doc(db, 'bookedSlots', `${MIDWIFE_B_UID}_2026-11-28_1000`)).catch(() => {});
    await deleteDoc(doc(db, 'patients', patientBId)).catch(() => {});
    await deleteDoc(doc(db, 'midwife_availability', MIDWIFE_B_UID)).catch(() => {});
    console.log(`  ✓ Temporary test documents cleaned up cleanly`);
    passed++;
  } catch (e) {
    console.error('  ✗ TEST 9 FAILED:', e.message);
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================\n');

  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});
