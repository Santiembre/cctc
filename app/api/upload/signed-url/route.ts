import { getAdminStorage } from '@/lib/firebase/admin';
import { validateRequest, signedUrlRequestSchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession } from '@/lib/api/auth';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'organizador' || !session.organizadorAprobado) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    const body = await request.json();
    const { fileName, contentType } = validateRequest(signedUrlRequestSchema, body);

    const adminStorage = getAdminStorage();
    const bucket = adminStorage.bucket(process.env.STORAGE_BUCKET!);
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `uploads/${session.uid}/${timestamp}_${sanitizedName}`;
    const file = bucket.file(filePath);

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    return success({ uploadUrl, filePath });
  } catch (err) {
    return handleApiError(err);
  }
}