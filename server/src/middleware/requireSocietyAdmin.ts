import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
export function requireSocietyAdmin(req: Request, _res: Response, next: NextFunction) {
  const m = (req as any).membership;
  if (!m || m.role !== 'admin') return next(ApiError.forbidden('FORBIDDEN', 'Society admin required'));
  next();
}