import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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

// Secondary app
const secApp = initializeApp(firebaseConfig, 'secApp');
const secAuth = getAuth(secApp);
const secDb = getFirestore(secApp);

async function run() {
  const testEmail = `probe_${Date.now()}@testclinic.ph`;
  const testPass = 'TempPass123!';
  console.log('Creating test user in secondaryAuth:', testEmail);

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(secAuth, testEmail, testPass);
    console.log('Created test user! UID:', cred.user.uid);
  } catch (e) {
    console.error('Failed to create test user:', e.message);
    return;
  }

  const uid = cred.user.uid;

  // Test 1: Can the user themselves write to users/{uid} using secDb (where request.auth is the user)?
  try {
    console.log('Test 1: Writing to users/{uid} with secDb (authenticated as the user itself)...');
    await setDoc(doc(secDb, 'users', uid), {
      uid,
      email: testEmail,
      fullName: 'Probe User',
      role: 'midwife',
      approvalStatus: 'approved',
      status: 'active'
    });
    console.log('SUCCESS: secDb wrote to users/{uid}!');
  } catch (e) {
    console.error('FAIL secDb write users/{uid}:', e.message, e.code);
  }

  // Test 2: Can the user themselves write to midwives/{uid} using secDb?
  try {
    console.log('Test 2: Writing to midwives/{uid} with secDb...');
    await setDoc(doc(secDb, 'midwives', uid), {
      midwifeId: uid,
      uid,
      fullName: 'Probe User',
      email: testEmail,
      role: 'midwife'
    });
    console.log('SUCCESS: secDb wrote to midwives/{uid}!');
  } catch (e) {
    console.error('FAIL secDb write midwives/{uid}:', e.message, e.code);
  }

  // Test 3: Can the user themselves write to patients/{uid} using secDb?
  try {
    console.log('Test 3: Writing to patients/{uid} with secDb...');
    await setDoc(doc(secDb, 'patients', uid), {
      id: uid,
      uid,
      fullName: 'Probe User',
      email: testEmail
    });
    console.log('SUCCESS: secDb wrote to patients/{uid}!');
  } catch (e) {
    console.error('FAIL secDb write patients/{uid}:', e.message, e.code);
  }

  // Test 4: Can unauthenticated / main app db (which has no user logged in) write to users/{uid}?
  try {
    console.log('Test 4: Writing to users/{uid} with main db (where request.auth is null)...');
    await setDoc(doc(db, 'users', uid), {
      uid,
      testFromMain: true
    }, { merge: true });
    console.log('SUCCESS: main db wrote to users/{uid}!');
  } catch (e) {
    console.error('FAIL main db write users/{uid}:', e.message, e.code);
  }

  // Test 5: Can secDb write to pendingApprovals?
  try {
    console.log('Test 5: Writing to pendingApprovals with secDb...');
    await setDoc(doc(secDb, 'pendingApprovals', 'probe-app-id'), {
      status: 'approved',
      approvedUid: uid
    }, { merge: true });
    console.log('SUCCESS: secDb wrote to pendingApprovals!');
  } catch (e) {
    console.error('FAIL secDb write pendingApprovals:', e.message, e.code);
  }

  // Cleanup test auth user
  try {
    await deleteUser(cred.user);
    console.log('Cleaned up test auth user.');
  } catch (e) {
    console.warn('Cleanup failed:', e.message);
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

