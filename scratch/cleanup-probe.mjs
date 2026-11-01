import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyAang81fMZatH0njfH02TqPWjLQmicI_DU',
  authDomain: 'lying-in-care-ms.firebaseapp.com',
  projectId: 'lying-in-care-ms',
  storageBucket: 'lying-in-care-ms.firebasestorage.app',
  messagingSenderId: '1002256541817',
  appId: '1:1002256541817:web:ae5695dd3d6b05e9718ca8'
});
const db = getFirestore(app);

async function clean() {
  await deleteDoc(doc(db, 'test_probe', 'probe1')).catch(() => {});
  await deleteDoc(doc(db, 'pendingApprovals', 'probe_app')).catch(() => {});
  await deleteDoc(doc(db, 'users', 'probe_user')).catch(() => {});
  await deleteDoc(doc(db, 'midwives', 'probe_midwife')).catch(() => {});
  console.log('Test probe documents cleaned up successfully.');
  process.exit(0);
}
clean();

