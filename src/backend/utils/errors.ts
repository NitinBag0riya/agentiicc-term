/**
 * API Error Classes
 * 
 * Standardized error handling for the backend API.
 */

/**
 * Base API Error
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Authentication errors (401)
 */
export class AuthError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

/**
 * Authorization errors (403)
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Resource not found (404)
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Validation errors (400)
 */
export class ValidationError extends ApiError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Exchange API errors
 */
export class ExchangeError extends ApiError {
  constructor(
    message: string,
    public exchange: string,
    public originalError?: unknown
  ) {
    super(message, 502, 'EXCHANGE_ERROR');
    this.name = 'ExchangeError';
  }
}

/**
 * Insufficient funds/margin
 */
export class InsufficientFundsError extends ApiError {
  constructor(message: string = 'Insufficient funds') {
    super(message, 400, 'INSUFFICIENT_FUNDS');
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

/**
 * Convert unknown error to ApiError
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new ApiError(error.message);
  }
  
  return new ApiError('An unexpected error occurred');
}
