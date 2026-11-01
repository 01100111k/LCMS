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

const secApp = initializeApp(firebaseConfig, 'secTestApp');
const secAuth = getAuth(secApp);
const secDb = getFirestore(secApp);

async function test() {
  const email = `test_secdb_${Date.now()}@test.ph`;
  const cred = await createUserWithEmailAndPassword(secAuth, email, 'Password123!');
  const uid = cred.user.uid;
  console.log('User created:', uid);

  try {
    await setDoc(doc(secDb, 'users', uid), { uid, email, role: 'midwife' });
    console.log('secDb wrote to users successfully!');
  } catch (e) {
    console.log('secDb failed:', e.code, e.message);
  }

  await deleteUser(cred.user);
  console.log('Cleaned up.');
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

