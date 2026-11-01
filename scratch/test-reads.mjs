import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, collection, query, limit } from 'firebase/firestore';

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

const secApp = initializeApp(firebaseConfig, 'secApp');
const secAuth = getAuth(secApp);
const secDb = getFirestore(secApp);

async function testReads() {
  const collections = ['users', 'admin', 'patients', 'midwives', 'pendingApprovals', 'appointments', 'records'];

  console.log('--- TESTING UNAUTHENTICATED READS ---');
  for (const c of collections) {
    try {
      const snap = await getDocs(query(collection(db, c), limit(2)));
      console.log(`Unauth read "${c}": SUCCESS, count =`, snap.size);
      snap.forEach(d => console.log(`   [${c}/${d.id}]:`, JSON.stringify(d.data()).slice(0, 80)));
    } catch (e) {
      console.log(`Unauth read "${c}": FAILED:`, e.code);
    }
  }

  // Create authenticated user to test AUTHENTICATED reads
  const testEmail = `probe_read_${Date.now()}@testclinic.ph`;
  const cred = await createUserWithEmailAndPassword(secAuth, testEmail, 'Pass1234!');
  console.log('\n--- TESTING AUTHENTICATED READS (UID:', cred.user.uid, ') ---');
  for (const c of collections) {
    try {
      const snap = await getDocs(query(collection(secDb, c), limit(2)));
      console.log(`Auth read "${c}": SUCCESS, count =`, snap.size);
      snap.forEach(d => console.log(`   [${c}/${d.id}]:`, JSON.stringify(d.data()).slice(0, 80)));
    } catch (e) {
      console.log(`Auth read "${c}": FAILED:`, e.code);
    }
  }

  // Test reading specific user doc: users/{uid}
  try {
    const uDoc = await getDoc(doc(secDb, 'users', cred.user.uid));
    console.log(`Auth read self "users/${cred.user.uid}": SUCCESS (exists: ${uDoc.exists()})`);
  } catch (e) {
    console.log(`Auth read self "users/${cred.user.uid}": FAILED:`, e.code);
  }

  // Cleanup
  await deleteUser(cred.user);
  console.log('\nTest complete and cleaned up.');
}

testReads().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

