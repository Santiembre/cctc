import { getAdminDb } from '@/lib/firebase/admin';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession, requireRole } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { activitySchema } from '@/lib/types/activity';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminDb = getAdminDb();
    const doc = await adminDb.collection('actividades').doc(id).get();
    if (!doc.exists) return handleApiError(new Error('NOT_FOUND'));
    return success({ id: doc.id, ...doc.data() });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['organizador', 'admin']);
    const { id } = await params;
    const body = await request.json();

    const adminDb = getAdminDb();
    const docRef = adminDb.collection('actividades').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return handleApiError(new Error('NOT_FOUND'));

    const data = doc.data()!;
    if (session.role === 'organizador' && data.organizadorId !== session.uid) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    const updateData = {
      ...body,
      updatedAt: Timestamp.now(),
    };
    await docRef.update(updateData);
    return success({ id, ...data, ...updateData });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['organizador', 'admin']);
    const { id } = await params;

    const adminDb = getAdminDb();
    const docRef = adminDb.collection('actividades').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return handleApiError(new Error('NOT_FOUND'));

    const data = doc.data()!;
    if (session.role === 'organizador' && data.organizadorId !== session.uid) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    await docRef.update({ estado: 'archivado', updatedAt: Timestamp.now() });
    return success({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}