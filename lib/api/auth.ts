import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { type UserRecord } from 'firebase-admin/auth';

export function getAdminAuthInstance() {
  return getAdminAuth();
}

export async function getServerSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userDoc = await adminDb.collection('usuarios').doc(decodedClaims.uid).get();
    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email,
      role: decodedClaims.role || 'estudiante',
      organizadorAprobado: decodedClaims.organizadorAprobado || false,
      profile: userDoc.exists ? userDoc.data() : null,
    };
  } catch {
    return null;
  }
}

export async function requireRole(allowedRoles: string[]) {
  const session = await getServerSession();
  if (!session) throw new Error('UNAUTHORIZED');
  if (!allowedRoles.includes(session.role)) throw new Error('FORBIDDEN');
  return session;
}

export async function createSessionCookie(idToken: string) {
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 días
  const adminAuth = getAdminAuth();
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
  return sessionCookie;
}

export async function setCustomClaims(uid: string, claims: Record<string, unknown>) {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  await adminAuth.setCustomUserClaims(uid, claims);
  // Actualizar perfil en Firestore
  await adminDb.collection('usuarios').doc(uid).update({
    rol: claims.rol,
    organizadorAprobado: claims.organizadorAprobado || false,
    updatedAt: new Date(),
  });
}