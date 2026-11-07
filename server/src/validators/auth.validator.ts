import { z } from 'zod';
import { PK_PHONE_RE } from '../utils/phone';

export const passwordSchema = z.string().min(8).max(64).regex(/(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain a letter and a number');

export const registerSchema = {
  body: z.object({
    fullName: z.string().trim().min(2).max(60),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().regex(PK_PHONE_RE, 'Invalid Pakistani mobile number'),
    cnic: z.string().regex(/^\d{5}-\d{7}-\d{1}$/, 'Invalid CNIC format (expected: XXXXX-XXXXXXX-X)'),
    password: passwordSchema,
    adminCode: z.string().max(80).optional().or(z.literal('')),
    deviceName: z.string().max(60).optional(),
  }).strip(),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
    deviceName: z.string().max(60).optional(),
  }).strip(),
};

export const refreshSchema = { body: z.object({ refreshToken: z.string().min(10) }).strip() };
export const logoutSchema = { body: z.object({ refreshToken: z.string().min(10), pushToken: z.string().optional() }).strip() };
export const forgotSchema = { body: z.object({ email: z.string().trim().toLowerCase().email() }).strip() };
export const verifyOtpSchema = { body: z.object({ email: z.string().trim().toLowerCase().email(), otp: z.string().regex(/^\d{6}$/) }).strip() };
export const verifySignupOtpSchema = { body: z.object({ email: z.string().trim().toLowerCase().email(), otp: z.string().regex(/^\d{6}$/), deviceName: z.string().max(60).optional() }).strip() };
export const resendSignupOtpSchema = { body: z.object({ email: z.string().trim().toLowerCase().email() }).strip() };
export const resetSchema = { body: z.object({ resetToken: z.string().min(10), newPassword: passwordSchema }).strip() };
export const changePasswordSchema = { body: z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }).strip() };
