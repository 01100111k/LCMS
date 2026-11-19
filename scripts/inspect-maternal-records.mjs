import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

async function check() {
  await signInWithEmailAndPassword(auth, 'admin@gmail.com', 'Admin123');

  const preSnap = await getDocs(collection(db, 'prenatal_records'));
  console.log(`prenatal_records count: ${preSnap.size}`);
  preSnap.forEach(d => console.log('  prenatal:', d.id, d.data().patientName, d.data().gestationalAge));

  const delSnap = await getDocs(collection(db, 'delivery_records'));
  console.log(`delivery_records count: ${delSnap.size}`);
  delSnap.forEach(d => console.log('  delivery:', d.id, d.data().patientName, d.data().deliveryDateTime));

  const postSnap = await getDocs(collection(db, 'postpartum_records'));
  console.log(`postpartum_records count: ${postSnap.size}`);
  postSnap.forEach(d => console.log('  postpartum:', d.id, d.data().patientName, d.data().visitStage));
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
