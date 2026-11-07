import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
export function requireGlobalRole(role: 'admin') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const u = (req as any).user;
    if (!u || u.globalRole !== role) return next(ApiError.forbidden('FORBIDDEN', 'Requires ' + role));
    next();
  };
}