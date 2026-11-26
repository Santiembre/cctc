import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

function getServiceAccount() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }
  
  return { projectId, clientEmail, privateKey };
}

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let adminStorage: Storage | null = null;

function initializeAdmin() {
  if (adminApp) return;
  
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    console.warn('Firebase Admin credentials not configured. Admin features will not work.');
    return;
  }
  
  if (getApps().length === 0) {
    adminApp = initializeApp({ credential: cert(serviceAccount) });
  } else {
    adminApp = getApps()[0];
  }
  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);
  adminStorage = getStorage(adminApp);
}

function ensureAdmin() {
  if (!adminApp) {
    initializeAdmin();
  }
  if (!adminApp) {
    throw new Error('Firebase Admin not initialized. Check credentials.');
  }
}

export function getAdminAuth(): Auth {
  ensureAdmin();
  return adminAuth!;
}

export function getAdminDb(): Firestore {
  ensureAdmin();
  return adminDb!;
}

export function getAdminStorage(): Storage {
  ensureAdmin();
  return adminStorage!;
}

export function getAdminApp(): App {
  ensureAdmin();
  return adminApp!;
}

// For backward compatibility - lazy getters
export const admin = {
  get auth(): Auth { return getAdminAuth(); },
  get db(): Firestore { return getAdminDb(); },
  get storage(): Storage { return getAdminStorage(); },
  get app(): App { return getAdminApp(); },
};