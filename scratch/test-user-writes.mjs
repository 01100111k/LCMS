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

const secApp = initializeApp(firebaseConfig, 'probeApp');
const secAuth = getAuth(secApp);
const secDb = getFirestore(secApp);

async function testUserWrites() {
  const testEmail = `probe_write_${Date.now()}@testclinic.ph`;
  const cred = await createUserWithEmailAndPassword(secAuth, testEmail, 'Pass1234!');
  const uid = cred.user.uid;
  console.log('Authenticated UID:', uid);

  // Test A: empty object or minimal
  try {
    console.log('Test A: minimal setDoc { uid }');
    await setDoc(doc(secDb, 'users', uid), { uid });
    console.log('Test A: SUCCESS');
  } catch (e) {
    console.log('Test A: FAILED', e.message);
  }

  // Test B: with role: 'patient'
  try {
    console.log('Test B: { uid, role: "patient" }');
    await setDoc(doc(secDb, 'users', uid), { uid, role: 'patient' });
    console.log('Test B: SUCCESS');
  } catch (e) {
    console.log('Test B: FAILED', e.message);
  }

  // Test C: with role: 'patient', approvalStatus: 'pending'
  try {
    console.log('Test C: { uid, role: "patient", approvalStatus: "pending" }');
    await setDoc(doc(secDb, 'users', uid), { uid, role: 'patient', approvalStatus: 'pending' });
    console.log('Test C: SUCCESS');
  } catch (e) {
    console.log('Test C: FAILED', e.message);
  }

  // Test D: with role: 'patient', approvalStatus: 'approved'
  try {
    console.log('Test D: { uid, role: "patient", approvalStatus: "approved" }');
    await setDoc(doc(secDb, 'users', uid), { uid, role: 'patient', approvalStatus: 'approved' });
    console.log('Test D: SUCCESS');
  } catch (e) {
    console.log('Test D: FAILED', e.message);
  }

  // Test E: write to patients/{uid}
  try {
    console.log('Test E: patients/{uid}');
    await setDoc(doc(secDb, 'patients', uid), { id: uid, uid, email: testEmail });
    console.log('Test E: SUCCESS');
  } catch (e) {
    console.log('Test E: FAILED', e.message);
  }

  // Test F: write to pendingApprovals/{uid}
  try {
    console.log('Test F: pendingApprovals/{uid}');
    await setDoc(doc(secDb, 'pendingApprovals', uid), { email: testEmail, status: 'pending' });
    console.log('Test F: SUCCESS');
  } catch (e) {
    console.log('Test F: FAILED', e.message);
  }

  await deleteUser(cred.user);
  console.log('Cleaned up.');
}

testUserWrites().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

