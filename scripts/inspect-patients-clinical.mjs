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

async function run() {
  await signInWithEmailAndPassword(auth, 'admin@gmail.com', 'Admin123');
  console.log('Authenticated as Admin.');

  const q = query(
    collection(db, 'patients'),
    where('assignedMidwifeId', '==', 'bTHiMlndLCWH08gG97Sd55NK1bc2')
  );
  const snap = await getDocs(q);
  console.log('Total patient documents for midwife:', snap.size);
  const list = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.email === 'patient@gmail.com') return; // skip test account
    list.push({
      id: d.id,
      name: data.fullName,
      email: data.email,
      edd: data.edd || '',
      lmp: data.lmp || '',
      gestationalAge: data.gestationalAge || '',
      risk: data.riskLevel || 'Low risk',
      status: data.status || 'Active',
      bloodType: data.bloodType || 'O+',
      medicalNotes: data.medicalNotes || data.notes || '',
      obstetricHistory: data.obstetricHistory || data.gravidaPara || '',
    });
  });
  console.log(`Real patients count: ${list.length}`);
  console.log(JSON.stringify(list, null, 2));

  // Check existing appointments
  const apptSnap = await getDocs(
    query(
      collection(db, 'appointments'),
      where('assignedMidwifeId', '==', 'bTHiMlndLCWH08gG97Sd55NK1bc2')
    )
  );
  console.log(`\nCurrent appointments in Firestore: ${apptSnap.size}`);
  apptSnap.forEach(d => {
    const data = d.data();
    console.log(`- ${d.id}: ${data.patientName} | ${data.date} ${data.time} | ${data.type} (${data.status})`);
  });
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
