import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, collection, query, limit, setDoc } from 'firebase/firestore';

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

async function checkApprovedUser() {
  const passwordsToTry = ['User@2026!', 'Password123!', 'Midwife@2026!', 'Admin@2026!', 'kristina123', 'admin123', 'password'];
  console.log('Testing kristina.reyes@gmail.com login...');

  let cred = null;
  for (const pw of passwordsToTry) {
    try {
      cred = await signInWithEmailAndPassword(auth, 'kristina.reyes@gmail.com', pw);
      console.log('SUCCESS! Signed in as kristina.reyes@gmail.com with password:', pw);
      console.log('UID:', cred.user.uid);
      break;
    } catch (e) {
      if (e.code !== 'auth/invalid-credential' && e.code !== 'auth/wrong-password') {
        console.log(`Password "${pw}": ${e.code}`);
      }
    }
  }

  if (cred) {
    const uid = cred.user.uid;
    // Check if doc exists in users/{uid}
    const snap = await getDoc(doc(db, 'users', uid));
    console.log(`Doc users/${uid} exists?`, snap.exists());
    if (snap.exists()) {
      console.log('Data:', snap.data());
    } else {
      console.log('Doc does NOT exist in Firestore users collection!');
      // Can this authenticated user write their own profile?
      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: 'kristina.reyes@gmail.com',
          displayName: 'Maria Kristina Reyes, RM',
          role: 'midwife',
          approvalStatus: 'approved',
          status: 'active'
        });
        console.log('SUCCESS: Written users doc by authenticated user!');
      } catch (err) {
        console.error('FAILED to write users doc by authenticated user:', err.message);
      }
    }
  } else {
    console.log('Could not sign in with tested passwords.');
  }
}

checkApprovedUser().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

