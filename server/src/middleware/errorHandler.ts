import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { isProd } from '../config/env';
import multer from 'multer';
import { logger } from '../utils/logger';
import { friendlyIssue } from './validate';

const DUPLICATE_MESSAGES: Record<string, string> = {
  email: 'An account with this email already exists.',
  cnic: 'An account with this CNIC already exists.',
  joinCode: 'Please try again.',
  user: 'You already have one of these.',
};

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  let status = 500; let code = 'INTERNAL_ERROR'; let message = 'Internal server error'; let details: any;
  if (err instanceof ApiError) { status = err.statusCode; code = err.code; message = err.message; details = err.details; }
  else if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR';
    details = err.errors.map((i) => ({ path: i.path.join('.'), message: friendlyIssue(i) }));
    message = details[0]?.message || 'Please check the form and try again.';
  }
  else if (err?.name === 'MongoServerSelectionError' || err?.name === 'MongoNetworkError' || err?.name === 'MongoNetworkTimeoutError') {
    status = 503; code = 'DB_UNAVAILABLE'; message = 'The server cannot reach its database right now. Please try again in a moment.';
  }
  else if (err instanceof mongoose.Error.CastError) { status = 404; code = 'NOT_FOUND'; message = 'Not found'; }
  else if (err instanceof mongoose.Error.ValidationError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Invalid request';
    details = Object.values(err.errors).map((e: any) => ({ path: e.path, message: e.message }));
  }
  else if (err?.code === 11000) {
    status = 409; code = 'CONFLICT';
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || '';
    message = DUPLICATE_MESSAGES[field] || (field ? `This ${field} is already in use.` : 'This already exists.');
  }
  else if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err)) {
    status = 400; code = 'INVALID_JSON'; message = 'Malformed JSON in request body';
  }
  else if (err?.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body too large';
  }
  else if (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600) {
    status = err.statusCode; code = err.code || 'ERROR'; message = err.message || 'Request error';
  }
  else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 5 MB or smaller.'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can upload up to 6 photos at a time.'
      : err.message;
  }
  // ApiErrors and DB outages carry messages written for users; anything else is unexpected.
  const expected = err instanceof ApiError || code === 'DB_UNAVAILABLE';
  if (status >= 500 && isProd && !expected) message = 'Internal server error';
  if (status >= 500) {
    if (code === 'DB_UNAVAILABLE') logger.error({ msg: String(err?.message).slice(0, 160) }, 'Database unreachable');
    else if (expected) logger.warn({ code, status }, message);
    else logger.error({ err }, 'Unhandled error');
  }
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}