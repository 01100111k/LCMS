/**
 * LCMS Account Integrity & Firestore Sync Script
 * Inspects all user registrations, verifies matching users/{uid} and profile documents in Firestore,
 * and restores any missing Firestore documents using trusted pendingApprovals records.
 *
 * Usage:
 *   node scripts/repair-accounts.mjs         # Audit only
 *   node scripts/repair-accounts.mjs --fix   # Audit and automatically repair missing records
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForScript",
  authDomain: "lying-in-care-ms.firebaseapp.com",
  projectId: "lying-in-care-ms",
  storageBucket: "lying-in-care-ms.firebasestorage.app",
  messagingSenderId: "1083984501258",
  appId: "1:1083984501258:web:7856e18ad40b49cb376f9c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const fixMode = process.argv.includes('--fix');

console.log('====================================================');
console.log('LCMS FIRESTORE & AUTH INTEGRITY AUDIT');
console.log(`Mode: ${fixMode ? 'AUDIT & REPAIR (--fix)' : 'AUDIT ONLY (run with --fix to repair)'}`);
console.log('====================================================\n');

async function runAudit() {
  try {
    const pendingSnap = await getDocs(collection(db, 'pendingApprovals'));
    console.log(`Retrieved ${pendingSnap.size} records from pendingApprovals.`);

    let healthyCount = 0;
    let missingCount = 0;

    for (const d of pendingSnap.docs) {
      const data = d.data();
      const email = data.email || '';
      const fullName = data.fullName || '';
      const role = data.requestedRole || 'patient';
      const uid = data.approvedUid || data.authUid || d.id;
      const isApproved = data.status === 'approved';

      console.log(`\nChecking: ${fullName} (${email}) | Role: ${role} | UID: ${uid}`);

      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      const hasUserDoc = userDocSnap.exists();

      let hasProfileDoc = false;
      const profileCollection = role === 'midwife' ? 'midwives' : 'patients';
      const profileDocRef = doc(db, profileCollection, uid);
      const profileDocSnap = await getDoc(profileDocRef);
      hasProfileDoc = profileDocSnap.exists();

      console.log(`  - users/${uid}: ${hasUserDoc ? 'FOUND' : 'MISSING'}`);
      console.log(`  - ${profileCollection}/${uid}: ${hasProfileDoc ? 'FOUND' : 'MISSING'}`);

      if (hasUserDoc && hasProfileDoc) {
        healthyCount++;
        console.log(`  STATUS: HEALTHY (Synchronized)`);
      } else {
        missingCount++;
        console.log(`  STATUS: INCOMPLETE (Requires repair)`);

        if (fixMode) {
          console.log(`  -> Repairing Firestore documents with identical UID: ${uid}...`);
          const batch = writeBatch(db);

          const userDoc = {
            uid,
            email,
            fullName,
            displayName: fullName,
            role,
            contactNumber: data.contactNumber || '',
            prcLicense: data.prcLicense || '',
            accountStatus: 'active',
            status: 'active',
            approvalStatus: 'approved',
            createdAt: data.submittedAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
            reviewedBy: 'Administrator (Integrity Script)',
          };

          batch.set(userDocRef, userDoc, { merge: true });

          if (role === 'midwife') {
            batch.set(profileDocRef, {
              midwifeId: uid,
              uid,
              fullName,
              displayName: fullName,
              email,
              prcLicense: data.prcLicense || '',
              contactNumber: data.contactNumber || '',
              accountStatus: 'active',
              status: 'active',
              approvalStatus: 'approved',
              createdAt: data.submittedAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            batch.set(profileDocRef, {
              id: uid,
              patientId: uid,
              uid,
              fullName,
              displayName: fullName,
              email,
              contactNumber: data.contactNumber || '',
              status: 'Active',
              riskLevel: 'Low risk',
              createdAt: data.submittedAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }

          await batch.commit();
          console.log(`  -> SUCCESS: Restored users/${uid} and ${profileCollection}/${uid}.`);
        }
      }
    }

    console.log('\n====================================================');
    console.log(`AUDIT COMPLETE:`);
    console.log(`  Healthy accounts: ${healthyCount}`);
    console.log(`  Incomplete / Missing accounts: ${missingCount}`);
    if (missingCount > 0 && !fixMode) {
      console.log(`\nRun with --fix to automatically restore missing Firestore documents:`);
      console.log(`  node scripts/repair-accounts.mjs --fix`);
    }
    console.log('====================================================');
  } catch (err) {
    console.error('Audit failed with error:', err);
  }
}

runAudit();

