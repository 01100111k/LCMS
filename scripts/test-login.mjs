import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

async function check() {
  const cred = await signInWithEmailAndPassword(auth, 'rochelle.villanueva@gmail.com', 'Password123!');
  console.log(`CONFIRMED! Email: ${cred.user.email} | Password: Password123! | UID: ${cred.user.uid}`);
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
