import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const base = { windowMs: 15 * 60 * 1000, standardHeaders: true, legacyHeaders: false } as const;

// Signed-in requests are limited per account, everything else per IP. Many mobile users share one carrier
// IP (CGNAT), so a per-IP budget would throttle unrelated people. The token is verified, so it can't be spoofed.
function userOrIp(req: Request): string {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (m) {
    try {
      const p: any = jwt.verify(m[1], env.JWT_ACCESS_SECRET);
      if (p?.sub) return `u:${p.sub}`;
    } catch {
      /* invalid or expired token: fall back to IP */
    }
  }
  return `ip:${req.ip}`;
}

export const globalLimiter = rateLimit({
  ...base, max: 300, keyGenerator: userOrIp,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests' } },
});
export const registerLimiter = rateLimit({ ...base, max: 20 });
// Only failed logins count, so people sharing an IP are not locked out by each other's successful sign-ins.
export const loginLimiter = rateLimit({ ...base, max: 10, skipSuccessfulRequests: true });
export const forgotLimiter = rateLimit({ ...base, max: 3 });
export const otpLimiter = rateLimit({ ...base, max: 10 });
export const lookupLimiter = rateLimit({ ...base, max: 20 });
export const adminCodeLimiter = rateLimit({ ...base, max: 10 });
export const alertLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 10 });
