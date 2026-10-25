/**
 * Cliente HTTP de la API.
 *
 * Centraliza tres cosas que no queremos repetir en cada pantalla:
 *   1. el access token en la cabecera Authorization;
 *   2. el reintento automatico cuando el token expiro (llama a /refresh y
 *      repite el request original, una sola vez);
 *   3. la traduccion de la respuesta de error de la API a una excepcion con
 *      mensaje legible.
 *
 * El access token vive en memoria (no en localStorage) para que un XSS no se
 * lo pueda llevar. Al recargar la pagina se recupera la sesion con la cookie
 * httpOnly de refresh.
 */

/** Base de la API. Vacio en desarrollo: el proxy de Vite resuelve /api. */
const BASE = import.meta.env.VITE_API_URL ?? '';

let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};
export const getAccessToken = (): string | null => accessToken;

/** Error con la informacion que la UI necesita mostrar. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RespuestaError {
  error?: { code?: string; message?: string; details?: unknown };
}

async function aError(respuesta: Response): Promise<ApiError> {
  let cuerpo: RespuestaError = {};
  try {
    cuerpo = (await respuesta.json()) as RespuestaError;
  } catch {
    // Respuesta sin JSON (502 de un proxy, por ejemplo).
  }
  return new ApiError(
    respuesta.status,
    cuerpo.error?.message ?? `Error ${respuesta.status}`,
    cuerpo.error?.code,
    cuerpo.error?.details,
  );
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Interno: evita el bucle infinito de refresh. */
  _reintento?: boolean;
}

export async function request<T>(path: string, opciones: Opciones = {}): Promise<T> {
  const { method = 'GET', body, _reintento = false } = opciones;

  const respuesta = await fetch(`${BASE}/api${path}`, {
    method,
    // credentials: la cookie de refresh tiene que viajar aunque la API este
    // en otro dominio.
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Token vencido: se renueva y se repite el request una unica vez.
  if (respuesta.status === 401 && !_reintento && !path.startsWith('/auth/')) {
    const renovado = await intentarRefresh();
    if (renovado) return request<T>(path, { ...opciones, _reintento: true });
  }

  if (!respuesta.ok) throw await aError(respuesta);
  if (respuesta.status === 204) return undefined as T;

  return (await respuesta.json()) as T;
}

/**
 * Renueva el access token. Si varios requests fallan a la vez, todos esperan
 * la misma promesa en lugar de disparar N refresh simultaneos (que rotarian
 * el token entre ellos y se invalidarian mutuamente).
 */
let refreshEnCurso: Promise<boolean> | null = null;

export function intentarRefresh(): Promise<boolean> {
  refreshEnCurso ??= (async () => {
    try {
      const respuesta = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!respuesta.ok) return false;

      const datos = (await respuesta.json()) as { accessToken: string };
      setAccessToken(datos.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshEnCurso = null;
    }
  })();

  return refreshEnCurso;
}

/** Atajos por verbo, para que las pantallas queden declarativas. */
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
