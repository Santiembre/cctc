const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_ERROR = 500;

const PREFIJO_VALIDACION = "VALIDATION_ERROR:";

export function success<T>(data: T, status = HTTP_OK): Response {
  return Response.json({ success: true, data }, { status });
}

export function error(
  message: string,
  status = HTTP_BAD_REQUEST,
  details?: unknown,
): Response {
  return Response.json({ success: false, error: message, details }, { status });
}

export function handleApiError(err: unknown): Response {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED")
      return error("No autenticado", HTTP_UNAUTHORIZED);
    if (err.message === "FORBIDDEN")
      return error("Sin permisos", HTTP_FORBIDDEN);
    if (err.message.startsWith(PREFIJO_VALIDACION))
      return error(
        err.message.replace(`${PREFIJO_VALIDACION} `, ""),
        HTTP_BAD_REQUEST,
      );
    // "NOT_FOUND" lo lanzan las rutas; "not-found" viene de los errores de Firestore.
    if (err.message === "NOT_FOUND" || err.message.includes("not-found"))
      return error("No encontrado", HTTP_NOT_FOUND);
    console.error("API Error:", err);
    return error("Error interno del servidor", HTTP_INTERNAL_ERROR);
  }
  return error("Error desconocido", HTTP_INTERNAL_ERROR);
}
