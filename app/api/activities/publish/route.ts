import { getAdminDb } from '@/lib/firebase/admin';
import { validateRequest, publishRequestSchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession, requireRole } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['organizador']);
    const body = await request.json();
    const { draftId } = validateRequest(publishRequestSchema, body);

    const adminDb = getAdminDb();
    const draftRef = adminDb.collection('actividades').doc(draftId);
    const draft = await draftRef.get();
    if (!draft.exists) return handleApiError(new Error('NOT_FOUND'));

    const draftData = draft.data()!;
    if (draftData.organizadorId !== session.uid) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    // Create published activity
    const { extractionId, ...draftDataWithoutExtraction } = draftData;
    const publishedData = {
      ...draftDataWithoutExtraction,
      estado: 'publicado',
      publishedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const publishedRef = await adminDb.collection('actividades').add(publishedData);

    // Update draft to reference published
    await draftRef.update({ estado: 'publicado', publishedId: publishedRef.id, updatedAt: Timestamp.now() });

    return success({ id: publishedRef.id, ...publishedData });
  } catch (err) {
    return handleApiError(err);
  }
}