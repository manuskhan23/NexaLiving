import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Membership } from '../models/Membership';
import { RefreshToken } from '../models/RefreshToken';
import { ApiError } from '../utils/ApiError';
import { issueTokenPair, verifyRefreshJwt, revokeRefreshToken, revokeAllForUser, bumpTokenVersion, signResetToken, verifyResetToken } from './token.service';
import { isValidAdminCode } from './adminCode.service';
import { audit } from './audit.service';
import { sha256, generateOtp } from './crypto.service';
import { normalizePkPhone } from '../utils/phone';
import { sendMail, passwordResetEmail, passwordChangedEmail, signupOtpEmail } from './mail.service';

// An unverified account older than this no longer reserves its email.
export const UNVERIFIED_TTL_MS = 24 * 60 * 60 * 1000;

export async function register(input: any, ip?: string) {
  const email = String(input.email).toLowerCase();
  const existing: any = await User.findOne({ email }).select('isVerified createdAt').lean();
  if (existing) {
    if (existing.isVerified) throw ApiError.conflict('EMAIL_TAKEN', 'An account with this email already exists. Please log in.');
    // Never overwrite a pending signup: whoever enters the emailed code would end up with the
    // other person's password. The owner can log in (gets a new code) or reset the password.
    if (Date.now() - new Date(existing.createdAt).getTime() < UNVERIFIED_TTL_MS) {
      throw ApiError.conflict('EMAIL_UNVERIFIED', 'This email is registered but not verified yet. Log in with your password to get a new code, or use Forgot password.');
    }
    await User.deleteOne({ _id: existing._id, isVerified: false }); // stale, never verified
  }
  const cnicHolder: any = await User.findOne({ cnic: input.cnic }).select('isVerified +verifyOtpExpiresAt').lean();
  if (cnicHolder) {
    const stalePending = !cnicHolder.isVerified && (!cnicHolder.verifyOtpExpiresAt || new Date(cnicHolder.verifyOtpExpiresAt) < new Date());
    if (!stalePending) {
      throw ApiError.conflict('CNIC_TAKEN', cnicHolder.isVerified
        ? 'An account with this CNIC already exists. Log in with that account instead.'
        : 'This CNIC was just used to sign up with another email. If that was you, verify that email or try again in 10 minutes.');
    }
    await User.deleteOne({ _id: cnicHolder._id, isVerified: false }); // abandoned signup (e.g. typo in email)
  }
  let globalRole: 'user' | 'admin' = 'user';
  if (input.adminCode) {
    if (!(await isValidAdminCode(input.adminCode))) throw ApiError.badRequest('INVALID_ADMIN_CODE', 'Invalid admin signup code');
    globalRole = 'admin';
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const otp = generateOtp();
  const user: any = await User.create({
    fullName: input.fullName, email, phone: normalizePkPhone(input.phone),
    cnic: input.cnic, passwordHash, globalRole,
    verifyOtpHash: sha256(otp).toString('hex'),
    verifyOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    verifyOtpAttempts: 0,
    isVerified: false,
  });
  if (globalRole === 'admin') await audit({ actor: String(user._id), action: 'ADMIN_SIGNUP', ip });
  const m = signupOtpEmail(otp);
  sendMail(user.email, m.subject, m.html).catch(() => {});
  // Verify-gate: no tokens yet. Tokens are issued only after the emailed OTP is
  // verified (see verifySignupOtp).
  return { user: user.toPublicJSON(), otpSent: true, expiresAt: user.verifyOtpExpiresAt };
}

export async function verifySignupOtp(email: string, otp: string, deviceName?: string) {
  const user: any = await User.findOne({ email: email.toLowerCase() }).select('+verifyOtpHash +verifyOtpExpiresAt +verifyOtpAttempts');
  if (!user || !user.verifyOtpHash || !user.verifyOtpExpiresAt || user.verifyOtpExpiresAt < new Date())
    throw ApiError.badRequest('OTP_INVALID', 'Verification code invalid or expired');
  if (user.verifyOtpAttempts >= 5) {
    user.verifyOtpHash = undefined; user.verifyOtpExpiresAt = undefined; user.verifyOtpAttempts = 0;
    await user.save();
    throw ApiError.tooMany('Too many attempts', 'OTP_LOCKED');
  }
  const given = sha256(otp);
  const stored = Buffer.from(user.verifyOtpHash, 'hex');
  if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
    user.verifyOtpAttempts += 1;
    await user.save();
    throw ApiError.badRequest('OTP_INVALID', 'Verification code invalid');
  }
  user.verifyOtpHash = undefined; user.verifyOtpExpiresAt = undefined; user.verifyOtpAttempts = 0; user.isVerified = true;
  await user.save();
  const tokens = await issueTokenPair(user, deviceName);
  return { user: user.toPublicJSON(), ...tokens };
}

export async function resendSignupOtp(email: string) {
  const user: any = await User.findOne({ email: email.toLowerCase() });
  const result: any = { sent: true };
  if (!user) return result; // always look successful to avoid account enumeration
  const otp = generateOtp();
  user.verifyOtpHash = sha256(otp).toString('hex');
  user.verifyOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  user.verifyOtpAttempts = 0;
  await user.save();
  const m = signupOtpEmail(otp);
  sendMail(user.email, m.subject, m.html).catch(() => {});
  result.expiresAt = user.verifyOtpExpiresAt;
  return result;
}

export async function login(input: any) {
  const email = String(input.email).toLowerCase();
  const user: any = await User.findOne({ email, deletedAt: null }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  if (user.isBlocked) throw ApiError.forbidden('ACCOUNT_BLOCKED', 'Account is blocked');
  if (!user.isVerified) throw ApiError.forbidden('EMAIL_NOT_VERIFIED', 'Please verify your email with the code we sent you');
  user.lastLoginAt = new Date();
  await user.save();
  const tokens = await issueTokenPair(user, input.deviceName);
  const memberships = await Membership.find({ user: user._id, status: { $in: ['pending', 'active', 'suspended'] } })
    .populate('society', '_id name area city coverImage').lean();
  return { user: user.toPublicJSON(), memberships, ...tokens };
}

const REFRESH_REUSE_GRACE_MS = 60 * 1000;

export async function refresh(refreshToken: string) {
  let payload: any;
  try { payload = verifyRefreshJwt(refreshToken); }
  catch { throw ApiError.unauthorized('INVALID_TOKEN', 'Invalid refresh token'); }
  const hash = sha256(refreshToken).toString('hex');
  const doc: any = await RefreshToken.findOne({ jti: payload.jti });
  if (!doc || doc.tokenHash !== hash) throw ApiError.unauthorized('INVALID_TOKEN', 'Invalid refresh token');
  if (doc.revokedAt) {
    // A token rotated moments ago is almost always a retry after a lost response (weak mobile network),
    // not theft: issue a fresh pair. Older reuse, or reuse after logout, still revokes every session.
    const rotatedRecently = !!doc.replacedBy && Date.now() - new Date(doc.revokedAt).getTime() < REFRESH_REUSE_GRACE_MS;
    if (!rotatedRecently) {
      await revokeAllForUser(String(doc.user));
      await bumpTokenVersion(doc.user);
      throw ApiError.unauthorized('TOKEN_REUSED', 'Refresh token reused; sessions revoked');
    }
  }
  if (doc.expiresAt < new Date()) throw ApiError.unauthorized('INVALID_TOKEN', 'Refresh token expired');
  const user: any = await User.findById(doc.user);
  if (!user || user.deletedAt) throw ApiError.unauthorized('INVALID_TOKEN', 'User gone');
  if (user.isBlocked) throw ApiError.forbidden('ACCOUNT_BLOCKED', 'Account is blocked');
  const tokens = await issueTokenPair(user, doc.deviceName);
  if (!doc.revokedAt) doc.revokedAt = new Date();
  doc.replacedBy = verifyRefreshJwt(tokens.refreshToken).jti;
  await doc.save();
  return tokens;
}

export async function logout(userId: string, refreshToken: string, pushToken?: string) {
  try {
    const payload: any = verifyRefreshJwt(refreshToken);
    await revokeRefreshToken(payload.jti);
  } catch { /* idempotent */ }
  if (pushToken) await User.updateOne({ _id: userId }, { $pull: { pushTokens: { token: pushToken } } });
}

export async function logoutAll(userId: string) {
  await revokeAllForUser(userId);
  await bumpTokenVersion(userId);
  await User.updateOne({ _id: userId }, { $set: { pushTokens: [] } });
}

export async function forgotPassword(email: string) {
  const user: any = await User.findOne({ email: email.toLowerCase(), deletedAt: null });
  if (user) {
    const otp = generateOtp();
    user.resetOtpHash = sha256(otp).toString('hex');
    user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.resetOtpAttempts = 0;
    await user.save();
    const m = passwordResetEmail(otp);
    sendMail(user.email, m.subject, m.html).catch(() => {});
  }
}

export async function verifyOtp(email: string, otp: string) {
  const user: any = await User.findOne({ email: email.toLowerCase() }).select('+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts');
  if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt || user.resetOtpExpiresAt < new Date())
    throw ApiError.badRequest('OTP_INVALID', 'Reset code invalid or expired');
  if (user.resetOtpAttempts >= 5) {
    user.resetOtpHash = undefined; user.resetOtpExpiresAt = undefined; user.resetOtpAttempts = 0;
    await user.save();
    throw ApiError.tooMany('Too many attempts', 'OTP_LOCKED');
  }
  const given = sha256(otp);
  const stored = Buffer.from(user.resetOtpHash, 'hex');
  if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
    user.resetOtpAttempts += 1;
    await user.save();
    throw ApiError.badRequest('OTP_INVALID', 'Reset code invalid');
  }
  user.resetOtpHash = undefined; user.resetOtpExpiresAt = undefined; user.resetOtpAttempts = 0;
  await user.save();
  return signResetToken(String(user._id));
}

export async function resetPassword(resetToken: string, newPassword: string) {
  let sub: string;
  try { sub = verifyResetToken(resetToken).sub; }
  catch { throw ApiError.unauthorized('INVALID_TOKEN', 'Invalid reset token'); }
  const user: any = await User.findById(sub);
  if (!user) throw ApiError.unauthorized('INVALID_TOKEN', 'Invalid reset token');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllForUser(String(user._id));
  await bumpTokenVersion(user._id);
  const m = passwordChangedEmail();
  sendMail(user.email, m.subject, m.html).catch(() => {});
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, deviceRefresh?: string) {
  const user: any = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('UNAUTHORIZED', 'User not found');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw ApiError.badRequest('WRONG_PASSWORD', 'Current password incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  // Bump the token version on the SAME document we just loaded, then save, so
  // the in-memory value used to sign the new access token (tv) matches the DB.
  // Doing this with a separate $inc (bumpTokenVersion) left the freshly issued
  // token stamped with a stale tv, so the very next authenticated request was
  // rejected with 401 "Session invalidated". Revoke old refresh sessions first.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await revokeAllForUser(String(user._id));
  return issueTokenPair(user);
}

export async function me(userId: string) {
  const user: any = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('UNAUTHORIZED', 'No session');
  const memberships = await Membership.find({ user: userId, status: { $in: ['pending', 'active', 'suspended'] } })
    .populate('society', '_id name area city coverImage').lean();
  const { Notification } = require('../models/Notification');
  const unreadNotifications = await Notification.countDocuments({ user: userId, readAt: null });
  return { user: user.toPublicJSON(), memberships, unreadNotifications };
}
