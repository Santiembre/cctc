import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { success, handleApiError } from '@/lib/api/response';
import { requireRole } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending'; // pending, approved, rejected

    const adminDb = getAdminDb();
    let query = adminDb.collection('usuarios').where('rol', '==', 'organizador');
    if (status === 'pending') query = query.where('organizadorAprobado', '==', false);
    else if (status === 'approved') query = query.where('organizadorAprobado', '==', true);

    const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();
    const organizers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return success(organizers);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = await request.json();
    const { uid, action } = body; // action: 'approve' | 'reject'

    if (!uid || !['approve', 'reject'].includes(action)) {
      return handleApiError(new Error('VALIDATION_ERROR: uid y action (approve/reject) requeridos'));
    }

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    const userRef = adminDb.collection('usuarios').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return handleApiError(new Error('NOT_FOUND'));

    if (action === 'approve') {
      await adminAuth.setCustomUserClaims(uid, { rol: 'organizador', organizadorAprobado: true });
      await userRef.update({ organizadorAprobado: true, updatedAt: Timestamp.now() });
    } else {
      await adminAuth.setCustomUserClaims(uid, { rol: 'estudiante', organizadorAprobado: false });
      await userRef.update({ organizadorAprobado: false, rol: 'estudiante', updatedAt: Timestamp.now() });
    }

    return success({ success: true, action });
  } catch (err) {
    return handleApiError(err);
  }
}