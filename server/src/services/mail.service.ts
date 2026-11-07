import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let transporter: nodemailer.Transporter | null = null;
function getTransport() {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT || 587, secure: (env.SMTP_PORT || 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

// Reserved/fake domains (RFC 2606) can never receive mail; don't burn the SMTP daily quota on them.
const UNDELIVERABLE = /@(example\.(com|org|net)|.*\.(test|invalid|example|localhost))$/i;

export async function sendMail(to: string, subject: string, html: string) {
  if (UNDELIVERABLE.test(to)) { logger.info({ subject }, 'email skipped: undeliverable test domain'); return; }
  const t = getTransport();
  if (!t) { logger.warn({ to, subject }, 'SMTP not configured; email skipped'); return; }
  try { await t.sendMail({ from: env.MAIL_FROM, to, subject, html }); }
  catch (e) { logger.error({ e, to }, 'email send failed'); }
}

export function passwordResetEmail(otp: string) {
  return { subject: 'Your NexaLiving reset code', html: '<p>Your reset code is <b>' + otp + '</b>. It expires in 10 minutes.</p>' };
}
export function signupOtpEmail(otp: string) {
  return { subject: 'Your NexaLiving verification code', html: '<p>Welcome to NexaLiving! Your verification code is <b>' + otp + '</b>. It expires in 10 minutes.</p>' };
}
export function passwordChangedEmail() {
  return { subject: 'Your NexaLiving password was changed', html: '<p>Your password was changed. If this was not you, contact an admin immediately.</p>' };
}
