import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
export function requireAssistanceReviewer(req: Request, _res: Response, next: NextFunction) {
  const m = (req as any).membership;
  if (!m || !m.canReviewAssistance) return next(ApiError.forbidden('SELF_REVIEW', 'Assistance reviewer permission required'));
  next();
}