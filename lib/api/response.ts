export function success<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function error(message: string, status = 400, details?: unknown) {
  return Response.json({ success: false, error: message, details }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === 'UNAUTHORIZED') return error('No autenticado', 401);
    if (err.message === 'FORBIDDEN') return error('Sin permisos', 403);
    if (err.message.startsWith('VALIDATION_ERROR:')) return error(err.message.replace('VALIDATION_ERROR: ', ''), 400);
    if (err.message.includes('not-found')) return error('No encontrado', 404);
    console.error('API Error:', err);
    return error('Error interno del servidor', 500);
  }
  return error('Error desconocido', 500);
}