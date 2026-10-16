import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

export const app = initializeApp(environment.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);

// A second app instance used ONLY to create patient logins,
// so the midwife stays signed in on the main one.
export const secondaryAuth = getAuth(initializeApp(environment.firebase, 'secondary'));