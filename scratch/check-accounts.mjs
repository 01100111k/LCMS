import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

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

// Test checking if accounts exist
const testEmails = [
  'admin@lyingincare.ph',
  'maria.santos@gmail.com',
  'joy.cruz@gmail.com',
  'elena.bautista@gmail.com',
  'corazon.ramos@gmail.com',
  'admin@gmail.com',
  'lyingincare@gmail.com',
];

async function checkEmails() {
  for (const email of testEmails) {
    try {
      await signInWithEmailAndPassword(auth, email, 'RandomWrongPassword123!');
    } catch (e) {
      if (e.code === 'auth/wrong-password') {
        console.log(`Account EXISTS: ${email}`);
      } else if (e.code === 'auth/invalid-credential') {
        // In new firebase identity platform, invalid-credential can mean user-not-found or wrong password
        console.log(`Account ${email}: ${e.code}`);
      } else {
        console.log(`Account ${email}: ${e.code}`);
      }
    }
  }
}

checkEmails().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

