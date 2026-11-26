import { cookies } from "next/headers";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export function getAdminAuthInstance() {
  return getAdminAuth();
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SESSION_DAYS = 5;
const SESSION_DURATION_MS =
  SESSION_DAYS *
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MS_PER_SECOND;

// TEMPORAL mientras se arregla el flujo de sesión: con DEV_AUTH_BYPASS_ROLE en .env.local
// (estudiante | organizador | admin) todas las rutas usan una sesión falsa con ese rol.
// Nunca aplica en producción, aunque la variable esté definida.
function getDevBypassSession() {
  const role = process.env.DEV_AUTH_BYPASS_ROLE;
  if (process.env.NODE_ENV === "production" || !role) return null;
  return {
    uid: "dev-bypass-user",
    email: "dev@localhost",
    role,
    organizadorAprobado: true,
    profile: { nombre: "Usuario de prueba (dev)" },
  };
}

export async function getServerSession() {
  const devSession = getDevBypassSession();
  if (devSession) return devSession;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return null;

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );
    const userDoc = await adminDb
      .collection("usuarios")
      .doc(decodedClaims.uid)
      .get();
    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email,
      role: decodedClaims.role || "estudiante",
      organizadorAprobado: decodedClaims.organizadorAprobado || false,
      profile: userDoc.exists ? userDoc.data() : null,
    };
  } catch {
    return null;
  }
}

export async function requireRole(allowedRoles: string[]) {
  const session = await getServerSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (!allowedRoles.includes(session.role)) throw new Error("FORBIDDEN");
  return session;
}

export async function createSessionCookie(idToken: string) {
  const expiresIn = SESSION_DURATION_MS;
  const adminAuth = getAdminAuth();
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn,
  });
  return sessionCookie;
}

export async function setCustomClaims(
  uid: string,
  claims: Record<string, unknown>,
) {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  await adminAuth.setCustomUserClaims(uid, claims);
  // Actualizar perfil en Firestore
  await adminDb
    .collection("usuarios")
    .doc(uid)
    .update({
      rol: claims.rol,
      organizadorAprobado: claims.organizadorAprobado || false,
      updatedAt: new Date(),
    });
}
