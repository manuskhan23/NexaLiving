import * as crypto from 'crypto';
import { env } from '../config/env';

const KEY = Buffer.from(env.ASSISTANCE_ENC_KEY, 'hex');

export interface EncryptedPayload { iv: string; tag: string; data: string; }

export function encryptString(plain: string): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), data: enc.toString('base64') };
}

export function decryptString(payload: EncryptedPayload | undefined | null): string {
  if (!payload || !payload.iv || !payload.tag || !payload.data) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

export function sha256(s: string | Buffer): Buffer {
  return crypto.createHash('sha256').update(s).digest();
}

export function randomId(len = 16): string {
  return crypto.randomBytes(len).toString('hex');
}

export function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}
