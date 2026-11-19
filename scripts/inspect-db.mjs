import { initializeApp } from 'firebase/app';
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
const db = getFirestore(app);

async function inspect() {
  console.log("=== PATIENTS ===");
  const patientsSnap = await getDocs(collection(db, "patients"));
  console.log("Total patients in Firestore:", patientsSnap.size);
  const midwifeCounts = {};
  patientsSnap.forEach(doc => {
    const d = doc.data();
    const mw = d.assignedMidwifeId || d.midwifeId || "none";
    midwifeCounts[mw] = (midwifeCounts[mw] || 0) + 1;
    console.log(`- Patient [${doc.id}]: "${d.fullName || d.name}" -> midwife: ${mw}`);
  });
  console.log("Patients by midwifeId:", midwifeCounts);

  console.log("\n=== APPOINTMENTS ===");
  const apptSnap = await getDocs(collection(db, "appointments"));
  console.log("Total appointments in Firestore:", apptSnap.size);
  const apptMwCounts = {};
  apptSnap.forEach(doc => {
    const d = doc.data();
    const mw = d.assignedMidwifeId || d.midwifeId || "none";
    apptMwCounts[mw] = (apptMwCounts[mw] || 0) + 1;
    console.log(`- Appt [${doc.id}]: "${d.patientName}" on ${d.date} ${d.time} (${d.status}) -> midwife: ${mw}`);
  });
  console.log("Appointments by midwifeId:", apptMwCounts);

  console.log("\n=== QUEUE TICKETS ===");
  const qSnap = await getDocs(collection(db, "queue_tickets"));
  console.log("Total queue tickets:", qSnap.size);
  const qMwCounts = {};
  qSnap.forEach(doc => {
    const d = doc.data();
    const mw = d.midwifeId || "none";
    qMwCounts[mw] = (qMwCounts[mw] || 0) + 1;
    console.log(`- Queue [${doc.id}]: ${d.ticketNumber} "${d.patientName}" (${d.status}) -> midwife: ${mw}`);
  });
  console.log("Queue tickets by midwifeId:", qMwCounts);

  console.log("\n=== USERS (from firestore users collection if any) ===");
  const usersSnap = await getDocs(collection(db, "users"));
  console.log("Total users in Firestore:", usersSnap.size);
  usersSnap.forEach(doc => {
    const d = doc.data();
    console.log(`- User [${doc.id}]: ${d.email} | ${d.displayName || d.fullName} | role: ${d.role}`);
  });
}

inspect().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
