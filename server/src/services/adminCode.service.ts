import * as crypto from 'crypto';
import { AdminCode } from '../models/AdminCode';
import { logger } from '../utils/logger';

export const ADMIN_CODE_COUNT = 3;
export const ADMIN_CODE_TTL_MS = 24 * 60 * 60 * 1000;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function block(n: number) {
  const b = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[b[i] % ALPHABET.length];
  return out;
}
export const generateAdminCode = () => `NEXA-${block(4)}-${block(4)}`;

/** Replace every code with 3 fresh ones valid for the next 24 hours. */
export async function rotateAdminCodes() {
  const codes = new Set<string>();
  while (codes.size < ADMIN_CODE_COUNT) codes.add(generateAdminCode());
  const expiresAt = new Date(Date.now() + ADMIN_CODE_TTL_MS);
  await AdminCode.deleteMany({});
  await AdminCode.insertMany([...codes].map((code) => ({ code, expiresAt })));
  logger.info('Admin codes rotated (3 codes, valid 24h) - run `npm run codes` to see them');
}

/** Make sure exactly 3 unexpired codes exist; rotate if not. */
export async function ensureAdminCodes() {
  const live = await AdminCode.countDocuments({ expiresAt: { $gt: new Date() } });
  const total = await AdminCode.estimatedDocumentCount();
  if (live !== ADMIN_CODE_COUNT || total !== ADMIN_CODE_COUNT) await rotateAdminCodes();
}

export async function isValidAdminCode(input?: string): Promise<boolean> {
  if (!input || typeof input !== 'string') return false;
  const code = input.trim().toUpperCase();
  if (!code) return false;
  await ensureAdminCodes();
  return !!(await AdminCode.exists({ code, expiresAt: { $gt: new Date() } }));
}
