export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
