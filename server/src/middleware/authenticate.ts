import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';

export interface AuthUser {
  _id: string;
  fullName: string;
  email: string;
  globalRole: 'user' | 'admin';
  tokenVersion: number;
  isBlocked: boolean;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const m = /^Bearer (.+)$/.exec(header);
    if (!m) throw ApiError.unauthorized('UNAUTHORIZED', 'Missing bearer token');
    let payload: any;
    try { payload = jwt.verify(m[1], env.JWT_ACCESS_SECRET); }
    catch (e: any) {
      if (e.name === 'TokenExpiredError') throw ApiError.unauthorized('TOKEN_EXPIRED', 'Access token expired');
      throw ApiError.unauthorized('INVALID_TOKEN', 'Invalid access token');
    }
    const user = await User.findOne({ _id: payload.sub, deletedAt: null }).lean() as any;
    if (!user) throw ApiError.unauthorized('UNAUTHORIZED', 'User not found');
    if (payload.tv !== user.tokenVersion) throw ApiError.unauthorized('UNAUTHORIZED', 'Session invalidated');
    if (user.isBlocked) throw ApiError.forbidden('ACCOUNT_BLOCKED', 'Your account is blocked');
    (req as any).user = {
      _id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      globalRole: user.globalRole,
      tokenVersion: user.tokenVersion,
      isBlocked: user.isBlocked,
      phone: user.phone,
      showPhoneInDirectory: user.showPhoneInDirectory,
      settings: user.settings,
    } as AuthUser;
    next();
  } catch (err) { next(err); }
}