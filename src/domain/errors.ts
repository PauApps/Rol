export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code: string, message: string, details?: unknown): AppError {
  return new AppError(400, code, message, details);
}

export function unauthorized(code = 'UNAUTHORIZED', message = 'Cal iniciar sessió per continuar.'): AppError {
  return new AppError(401, code, message);
}

export function forbidden(code = 'FORBIDDEN', message = 'No tens permisos per fer aquesta operació.'): AppError {
  return new AppError(403, code, message);
}

export function notFound(code = 'NOT_FOUND', message = 'No s’ha trobat el recurs sol·licitat.'): AppError {
  return new AppError(404, code, message);
}

export function conflict(code: string, message: string, details?: unknown): AppError {
  return new AppError(409, code, message, details);
}

export function gone(code: string, message: string): AppError {
  return new AppError(410, code, message);
}
