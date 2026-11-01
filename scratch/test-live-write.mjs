import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

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

console.log('Testing Firestore connection to project:', firebaseConfig.projectId);

async function run() {
  // 1. Try unauthenticated write to test_probe
  try {
    console.log('1. Attempting unauthenticated write to test_probe/probe1...');
    await setDoc(doc(db, 'test_probe', 'probe1'), { test: true, time: new Date().toISOString() });
    console.log('-> SUCCESS: Unauthenticated write succeeded!');
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  // 2. Try unauthenticated write to pendingApprovals
  try {
    console.log('2. Attempting write to pendingApprovals/probe_app...');
    await setDoc(doc(db, 'pendingApprovals', 'probe_app'), { test: true, status: 'pending' });
    console.log('-> SUCCESS: Write to pendingApprovals succeeded!');
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  // 3. Try unauthenticated write to users
  try {
    console.log('3. Attempting write to users/probe_user...');
    await setDoc(doc(db, 'users', 'probe_user'), { test: true, role: 'midwife' });
    console.log('-> SUCCESS: Write to users succeeded!');
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  // 4. Try unauthenticated write to midwives
  try {
    console.log('4. Attempting write to midwives/probe_midwife...');
    await setDoc(doc(db, 'midwives', 'probe_midwife'), { test: true });
    console.log('-> SUCCESS: Write to midwives succeeded!');
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  // 5. Try unauthenticated read on users
  try {
    console.log('5. Attempting to read users collection...');
    const snap = await getDocs(collection(db, 'users'));
    console.log(`-> SUCCESS: Read users collection! Document count: ${snap.size}`);
    snap.forEach(d => console.log('   Doc ID:', d.id, d.data()));
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  // 6. Try unauthenticated read on pendingApprovals
  try {
    console.log('6. Attempting to read pendingApprovals collection...');
    const snap = await getDocs(collection(db, 'pendingApprovals'));
    console.log(`-> SUCCESS: Read pendingApprovals collection! Document count: ${snap.size}`);
    snap.forEach(d => console.log('   Doc ID:', d.id, d.data()));
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  process.exit(0);
}

run();

