import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, addDoc, collection, updateDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAang81fMZatH0njfH02TqPWjLQmicI_DU',
  authDomain: 'lying-in-care-ms.firebaseapp.com',
  projectId: 'lying-in-care-ms',
  storageBucket: 'lying-in-care-ms.firebasestorage.app',
  messagingSenderId: '1002256541817',
  appId: '1:1002256541817:web:ae5695dd3d6b05e9718ca8',
};

const app = initializeApp(firebaseConfig, 'testRulesApp');
const auth = getAuth(app);
const db = getFirestore(app);

async function probe() {
  const email = `ruleprobe_${Date.now()}@lyingincare.ph`;
  const cred = await createUserWithEmailAndPassword(auth, email, 'Password123!');
  const uid = cred.user.uid;
  console.log('Signed in user UID:', uid, 'email:', email);

  const tests = [
    { name: 'users/{uid} with email, uid', coll: 'users', docId: uid, data: { uid, email } },
    { name: 'users/{uid} with role: patient', coll: 'users', docId: uid, data: { uid, email, role: 'patient' } },
    { name: 'patients/{uid}', coll: 'patients', docId: uid, data: { id: uid, uid, email } },
    { name: 'appointments (addDoc)', coll: 'appointments', data: { patientId: uid, date: '2026-11-01' } },
    { name: 'pendingApprovals (addDoc)', coll: 'pendingApprovals', data: { email, status: 'pending' } },
    { name: 'pendingApprovals/{uid}', coll: 'pendingApprovals', docId: uid, data: { email, status: 'pending' } },
  ];

  for (const t of tests) {
    try {
      if (t.docId) {
        await setDoc(doc(db, t.coll, t.docId), t.data);
      } else {
        await addDoc(collection(db, t.coll), t.data);
      }
      console.log(`PASS: ${t.name}`);
    } catch (e) {
      console.log(`FAIL: ${t.name} -> ${e.code} (${e.message})`);
    }
  }

  await deleteUser(cred.user);
  console.log('Cleaned up.');
}

probe().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

