export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Sign in to continue') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have access to this') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(entity = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${entity} not found`);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(409, 'CONFLICT', message, details);
  }

  static unprocessable(message: string, details?: unknown) {
    return new AppError(422, 'UNPROCESSABLE', message, details);
  }
}

export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 11000;
}
