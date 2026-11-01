import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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

async function test() {
  console.log('Testing Firestore connection...');
  try {
    // 1. Try reading a user doc without auth
    const testDoc = await getDoc(doc(db, 'users', 'test-probe'));
    console.log('Unauthenticated read users:', testDoc.exists() ? 'exists' : 'not found');
  } catch (e) {
    console.error('Unauthenticated read users error:', e.message, e.code);
  }

  try {
    // 2. Try writing to users without auth
    await setDoc(doc(db, 'users', 'test-probe'), { test: true });
    console.log('Unauthenticated write users succeeded');
  } catch (e) {
    console.error('Unauthenticated write users error:', e.message, e.code);
  }

  try {
    // 3. Try reading pendingApprovals without auth
    const snap = await getDoc(doc(db, 'pendingApprovals', 'test-probe'));
    console.log('Unauthenticated read pendingApprovals:', snap.exists() ? 'exists' : 'not found');
  } catch (e) {
    console.error('Unauthenticated read pendingApprovals error:', e.message, e.code);
  }

  try {
    // 3b. Try writing to pendingApprovals without auth
    await setDoc(doc(db, 'pendingApprovals', 'test-probe'), { test: true });
    console.log('Unauthenticated write pendingApprovals succeeded!');
  } catch (e) {
    console.error('Unauthenticated write pendingApprovals error:', e.message, e.code);
  }

  try {
    // 4. Try signing in as admin
    console.log('Attempting admin sign-in with admin@lyingincare.ph...');
    // We check common passwords or test accounts
    const cred = await signInWithEmailAndPassword(auth, 'admin@lyingincare.ph', 'Admin@2026!');
    console.log('Admin signed in successfully, uid:', cred.user.uid);

    // Try reading/writing as admin
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: cred.user.email,
      role: 'admin',
      lastTest: new Date().toISOString()
    }, { merge: true });
    console.log('Admin write users succeeded!');
  } catch (e) {
    console.error('Admin test error:', e.message, e.code);
  }
}

test().then(() => process.exit(0)).catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
