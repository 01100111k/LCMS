import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

/**
 * Verify that the caller is an authenticated administrator
 */
async function assertIsAdmin(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The caller must be authenticated to perform administrative operations.'
    );
  }

  const callerUid = context.auth.uid;
  const userDoc = await db.collection('users').doc(callerUid).get();
  const role = userDoc.data()?.role;

  if (role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only system administrators can approve or repair accounts.'
    );
  }

  return userDoc.data()?.displayName || 'Administrator';
}

/**
 * Secure Backend Approval: Creates Authentication user & linked Firestore docs
 */
export const approveApplication = functions.https.onCall(async (data, context) => {
  const adminName = await assertIsAdmin(context);
  const { applicationId, initialPassword } = data;

  if (!applicationId) {
    throw new functions.https.HttpsError('invalid-argument', 'applicationId is required.');
  }

  const appRef = db.collection('pendingApprovals').doc(applicationId);
  const appSnap = await appRef.get();

  if (!appSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pending application not found.');
  }

  const appData = appSnap.data()!;
  const email = (appData.email || '').toLowerCase().trim();
  const fullName = (appData.fullName || '').trim();
  const role = appData.requestedRole || 'patient';
  const password = initialPassword || 'User@2026!';

  // 1. Create or retrieve Firebase Authentication account
  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: true,
    });
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw new functions.https.HttpsError('internal', `Auth creation failed: ${err.message}`);
    }
  }

  const uid = userRecord.uid;

  // 2. Atomic write to users/{uid}, role profile doc, and pendingApprovals
  const batch = db.batch();

  // Core users/{uid}
  const userDocRef = db.collection('users').doc(uid);
  batch.set(userDocRef, {
    uid,
    email,
    fullName,
    displayName: fullName,
    role,
    contactNumber: appData.contactNumber || '',
    prcLicense: appData.prcLicense || '',
    accountStatus: 'active',
    status: 'active',
    approvalStatus: 'approved',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: adminName,
  }, { merge: true });

  // Role-specific profile
  if (role === 'midwife') {
    const midwifeRef = db.collection('midwives').doc(uid);
    batch.set(midwifeRef, {
      midwifeId: uid,
      uid,
      fullName,
      displayName: fullName,
      email,
      prcLicense: appData.prcLicense || '',
      contactNumber: appData.contactNumber || '',
      accountStatus: 'active',
      status: 'active',
      approvalStatus: 'approved',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    const patientRef = db.collection('patients').doc(uid);
    batch.set(patientRef, {
      id: uid,
      patientId: uid,
      uid,
      fullName,
      displayName: fullName,
      email,
      contactNumber: appData.contactNumber || '',
      status: 'Active',
      riskLevel: 'Low risk',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // Update pending approval status
  batch.set(appRef, {
    status: 'approved',
    approvedUid: uid,
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: adminName,
  }, { merge: true });

  await batch.commit();

  return {
    success: true,
    uid,
    email,
    role,
    message: `Account for ${fullName} approved and registered in both Firebase Auth and Firestore with UID ${uid}.`,
  };
});

/**
 * Backend Repair: Restores missing users/{uid} and role docs for an existing Auth account
 */
export const repairAccount = functions.https.onCall(async (data, context) => {
  const adminName = await assertIsAdmin(context);
  const { uid, role, email, fullName, contactNumber, prcLicense } = data;

  if (!uid || !role || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'uid, role, and email are required.');
  }

  // Verify auth user exists
  await auth.getUser(uid);

  const batch = db.batch();

  // Core users/{uid}
  const userDocRef = db.collection('users').doc(uid);
  batch.set(userDocRef, {
    uid,
    email,
    fullName: fullName || email,
    displayName: fullName || email,
    role,
    contactNumber: contactNumber || '',
    prcLicense: prcLicense || '',
    accountStatus: 'active',
    status: 'active',
    approvalStatus: 'approved',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    repairedBy: adminName,
  }, { merge: true });

  // Role doc
  if (role === 'midwife') {
    const midwifeRef = db.collection('midwives').doc(uid);
    batch.set(midwifeRef, {
      midwifeId: uid,
      uid,
      fullName: fullName || email,
      displayName: fullName || email,
      email,
      prcLicense: prcLicense || '',
      contactNumber: contactNumber || '',
      accountStatus: 'active',
      status: 'active',
      approvalStatus: 'approved',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } else if (role === 'patient') {
    const patientRef = db.collection('patients').doc(uid);
    batch.set(patientRef, {
      id: uid,
      patientId: uid,
      uid,
      fullName: fullName || email,
      displayName: fullName || email,
      email,
      contactNumber: contactNumber || '',
      status: 'Active',
      riskLevel: 'Low risk',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();

  return {
    success: true,
    uid,
    message: `Successfully repaired and linked Firestore documents for ${email} under UID ${uid}.`,
  };
});

