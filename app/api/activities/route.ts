import { getAdminDb } from '@/lib/firebase/admin';
import { validateRequest, activityListQuerySchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp, Query } from 'firebase-admin/firestore';
import { activitySchema } from '@/lib/types/activity';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = validateRequest(activityListQuerySchema, Object.fromEntries(searchParams));

    const adminDb = getAdminDb();
    let activitiesQuery: Query = adminDb.collection('actividades').where('estado', '==', 'publicado');

    if (query.tipo) activitiesQuery = activitiesQuery.where('tipo', '==', query.tipo);
    if (query.area) activitiesQuery = activitiesQuery.where('area', '==', query.area);
    if (query.modalidad) activitiesQuery = activitiesQuery.where('modalidad', '==', query.modalidad);
    if (query.costo === 'gratis') activitiesQuery = activitiesQuery.where('costo', '==', 0);
    if (query.costo === 'pago') activitiesQuery = activitiesQuery.where('costo', '>', 0);

    // Date filtering - requires composite index
    if (query.fechaDesde) {
      activitiesQuery = activitiesQuery.where('fechaInicio', '>=', Timestamp.fromDate(new Date(query.fechaDesde)));
    }
    if (query.fechaHasta) {
      activitiesQuery = activitiesQuery.where('fechaInicio', '<=', Timestamp.fromDate(new Date(query.fechaHasta)));
    }

    // Text search - simple array-contains on etiquetas (for MVP)
    if (query.q) {
      activitiesQuery = activitiesQuery.where('etiquetas', 'array-contains', query.q.toLowerCase());
    }

    // Sorting
    const sortField = query.sort === 'titulo' ? 'titulo' : 'fechaInicio';
    const sortDir = query.sort === 'fechaDesc' ? 'desc' : 'asc';
    activitiesQuery = activitiesQuery.orderBy(sortField, sortDir);

    // Pagination
    const offset = (query.page - 1) * query.limit;
    const snapshot = await activitiesQuery.limit(query.limit).offset(offset).get();
    const totalSnapshot = await activitiesQuery.count().get();

    const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return success({
      activities,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: totalSnapshot.data().count,
        totalPages: Math.ceil(totalSnapshot.data().count / query.limit),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'organizador' || !session.organizadorAprobado) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    const body = await request.json();
    const activityData = validateRequest(activitySchema, body);

    const adminDb = getAdminDb();
    const activity = {
      ...activityData,
      organizadorId: session.uid,
      organizadorNombre: session.profile?.nombre || session.email || 'Organizador',
      estado: 'publicado',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      publishedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection('actividades').add(activity);
    return success({ id: docRef.id, ...activity }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}