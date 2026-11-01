import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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

async function run() {
  console.log('--- TESTING AUTHENTICATED WRITES ---');
  let userCred;

  // Try signing in with a known user or create a temporary one
  const testEmail = 'probe_test_admin@lyingincare.ph';
  const testPass = 'Admin@2026!Probe';

  try {
    userCred = await createUserWithEmailAndPassword(auth, testEmail, testPass);
    console.log('Created test auth user:', userCred.user.uid, userCred.user.email);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      userCred = await signInWithEmailAndPassword(auth, testEmail, testPass);
      console.log('Signed in existing test auth user:', userCred.user.uid, userCred.user.email);
    } else {
      console.error('Failed to create/signin test user:', e);
      process.exit(1);
    }
  }

  const uid = userCred.user.uid;
  console.log('Authenticated UID:', uid);
  console.log('auth.currentUser:', auth.currentUser?.uid);

  // Now test writing to users/{uid} as the AUTHENTICATED USER
  try {
    console.log(`\nAttempting authenticated write to users/${uid}...`);
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: testEmail,
      displayName: 'Probe Admin',
      role: 'admin',
      accountStatus: 'active',
      status: 'active',
      createdAt: new Date().toISOString()
    });
    console.log('-> SUCCESS: Authenticated write to users/{uid} SUCCEEDED!');
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  // Now test writing to midwives/{uid}
  try {
    console.log(`\nAttempting authenticated write to midwives/${uid}...`);
    await setDoc(doc(db, 'midwives', uid), {
      midwifeId: uid,
      uid,
      email: testEmail,
      fullName: 'Probe Admin',
      status: 'active'
    });
    console.log('-> SUCCESS: Authenticated write to midwives/{uid} SUCCEEDED!');
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  // Now test reading users
  try {
    console.log(`\nAttempting authenticated read from users...`);
    const snap = await getDocs(collection(db, 'users'));
    console.log(`-> SUCCESS: Read users collection! Size: ${snap.size}`);
    snap.forEach(d => console.log('Doc ID:', d.id, d.data()));
  } catch (e) {
    console.log('-> FAILED:', e.code, e.message);
  }

  process.exit(0);
}

run();

