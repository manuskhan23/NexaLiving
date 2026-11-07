import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import { sha256 } from './crypto.service';

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number; }

export async function issueTokenPair(user: any, deviceName?: string): Promise<TokenPair> {
  const jti = uuidv4();
  const accessToken = jwt.sign({ sub: String(user._id), globalRole: user.globalRole, tv: user.tokenVersion }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC });
  const refreshToken = jwt.sign({ sub: String(user._id), jti }, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_SEC });
  await RefreshToken.create({
    user: user._id, jti, tokenHash: sha256(refreshToken).toString('hex'),
    deviceName, expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
  });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC };
}

export async function revokeRefreshToken(jti: string) {
  await RefreshToken.updateOne({ jti }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllForUser(userId: string) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function bumpTokenVersion(userId: number | string) {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

export function signResetToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'reset' }, env.JWT_RESET_SECRET, { expiresIn: 10 * 60 });
}

export function verifyResetToken(token: string): { sub: string } {
  const p: any = jwt.verify(token, env.JWT_RESET_SECRET);
  if (p.purpose !== 'reset') throw new Error('bad purpose');
  return { sub: p.sub };
}

export function verifyRefreshJwt(token: string): any {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
