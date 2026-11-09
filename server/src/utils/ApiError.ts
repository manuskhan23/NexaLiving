export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: Array<{ path: string; message: string }>;
  isOperational = true;
  constructor(statusCode: number, code: string, message: string, details?: Array<{ path: string; message: string }>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
  static badRequest(code: string, msg: string, details?: any) { return new ApiError(400, code, msg, details); }
  static unauthorized(code: string, msg: string) { return new ApiError(401, code, msg); }
  static forbidden(code: string, msg: string) { return new ApiError(403, code, msg); }
  static notFound(msg = 'This was not found. It may have been removed.', code = 'NOT_FOUND') { return new ApiError(404, code, msg); }
  static conflict(code: string, msg: string) { return new ApiError(409, code, msg); }
  static tooMany(msg = 'Too many requests', code = 'TOO_MANY_REQUESTS') { return new ApiError(429, code, msg); }
  static internal(msg = 'Internal server error', code = 'INTERNAL_ERROR') { return new ApiError(500, code, msg); }
}
