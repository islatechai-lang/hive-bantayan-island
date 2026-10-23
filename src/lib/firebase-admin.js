import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Clean the private key: strip surrounding quotes and replace escaped newlines
const getCleanPrivateKey = () => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  
  // Remove any surrounding quotes
  let cleaned = key.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  
  // Replace literal '\n' characters with actual newlines
  return cleaned.replace(/\\n/g, '\n');
};

let adminApp = null;
let adminDb = null;
let adminAuth = null;

try {
  const privateKey = getCleanPrivateKey();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && clientEmail && privateKey) {
    adminApp = !getApps().length
      ? initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        })
      : getApps()[0];

    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
  } else {
    console.warn('Firebase Admin credentials missing or incomplete; server-side Admin SDK will be inactive.');
  }
} catch (err) {
  console.warn('Firebase Admin initialization error:', err.message);
}

export { adminApp, adminDb, adminAuth };
