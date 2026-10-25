/**
 * Errores de dominio.
 *
 * Los servicios lanzan estas clases y el manejador global de errores las
 * traduce a respuestas HTTP. Asi la capa de negocio no conoce Fastify.
 */

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 - el pedido no tiene sentido para el dominio. */
export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'BAD_REQUEST', details);
  }
}

/** 401 - no sabemos quien es. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciales invalidas') {
    super(401, message, 'UNAUTHORIZED');
  }
}

/** 403 - sabemos quien es, pero no le corresponde. */
export class ForbiddenError extends AppError {
  constructor(message = 'No tiene permisos para esta operacion') {
    super(403, message, 'FORBIDDEN');
  }
}

/** 404 */
export class NotFoundError extends AppError {
  constructor(recurso: string) {
    super(404, `${recurso} no encontrado`, 'NOT_FOUND');
  }
}

/** 409 - choca con el estado actual (duplicados, dependencias). */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, message, 'CONFLICT', details);
  }
}
