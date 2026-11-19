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

async function listAll() {
  await signInWithEmailAndPassword(auth, 'admin@gmail.com', 'Admin123');

  const pQ = query(
    collection(db, 'patients'),
    where('assignedMidwifeId', '==', MIDWIFE_UID)
  );
  const pSnap = await getDocs(pQ);

  const patients = [];
  pSnap.forEach((d) => {
    const data = d.data();
    if (data.email === 'patient@gmail.com') return;
    patients.push({
      id: d.id,
      name: data.fullName,
      email: data.email,
      password: 'Password123!',
      phone: data.contactNumber || '0917-000-0000',
      status: data.status || 'Active',
      ga: data.gestationalAge || 'Prenatal',
      risk: data.riskLevel || 'Low risk',
    });
  });

  patients.sort((a, b) => a.name.localeCompare(b.name));
  console.log(JSON.stringify(patients, null, 2));
}

listAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
