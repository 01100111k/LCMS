import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAang81fMZatH0njfH02TqPWjLQmicI_DU',
  authDomain: 'lying-in-care-ms.firebaseapp.com',
  projectId: 'lying-in-care-ms',
  storageBucket: 'lying-in-care-ms.firebasestorage.app',
  messagingSenderId: '1002256541817',
  appId: '1:1002256541817:web:ae5695dd3d6b05e9718ca8',
};

const app = initializeApp(firebaseConfig, 'probeApp2');
const auth = getAuth(app);
const db = getFirestore(app);

async function probeAll() {
  const email = `probe_all_${Date.now()}@test.ph`;
  const cred = await createUserWithEmailAndPassword(auth, email, 'Password123!');
  const uid = cred.user.uid;

  const testList = [
    'users',
    'patients',
    'midwives',
    'pendingApprovals',
    'appointments',
    'records',
    'prenatal_records',
    'delivery_records',
    'postpartum_records',
    'pregnancy_journey',
    'health_library',
    'audit_logs',
    'activity_logs',
    'admin'
  ];

  for (const coll of testList) {
    try {
      await setDoc(doc(db, coll, uid), { probe: true, uid, createdAt: new Date() });
      console.log(`COLL ${coll}: WRITABLE!`);
    } catch (e) {
      console.log(`COLL ${coll}: BLOCKED (${e.code})`);
    }
  }

  await deleteUser(cred.user);
  console.log('Done.');
}

probeAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

