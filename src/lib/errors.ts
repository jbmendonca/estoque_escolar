// Erros de aplicação com código estável e status HTTP, para resposta padronizada.

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'INSUFFICIENT_STOCK'
  | 'IMMUTABLE'
  | 'BAD_REQUEST';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  IMMUTABLE: 409,
  BAD_REQUEST: 400,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function toErrorResponse(error: unknown): {
  status: number;
  body: { error: { code: string; message: string; details?: Record<string, unknown> } };
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: 'Erro interno inesperado.' } },
  };
}
