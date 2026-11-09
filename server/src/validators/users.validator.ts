import { z } from 'zod';
import { PK_PHONE_RE } from '../utils/phone';
import { THEMES } from '../constants/enums';

export const updateProfileSchema = {
  body: z.object({
    fullName: z.string().trim().min(2).max(60).optional(),
    phone: z.string().regex(PK_PHONE_RE).optional(),
    bio: z.string().max(300).optional(),
    skills: z.array(z.string().min(1).max(30)).max(10).optional(),
    showPhoneInDirectory: z.boolean().optional(),
    showInDirectory: z.boolean().optional(),
  }).strip(),
};

export const updateSettingsSchema = {
  body: z.object({
    theme: z.enum(THEMES).optional(),
    notifications: z.object({
      announcements: z.boolean().optional(),
      bookings: z.boolean().optional(),
      requests: z.boolean().optional(),
      listings: z.boolean().optional(),
      community: z.boolean().optional(),
      marketing: z.boolean().optional(),
    }).optional(),
  }).strip(),
};

export const becomeAdminSchema = { body: z.object({ adminCode: z.string().min(1).max(80) }).strip() };

export const pushTokenSchema = {
  body: z.object({
    token: z.string().regex(/^ExponentPushToken\[[^\]]+\]$/),
    platform: z.enum(['android', 'ios']),
  }).strip(),
};

export const userIdParamSchema = { params: z.object({ userId: z.string().regex(/^[0-9a-fA-F]{24}$/) }) };
export const societyQuerySchema = { query: z.object({ societyId: z.string().regex(/^[0-9a-fA-F]{24}$/) }) };
export const deleteAccountSchema = { body: z.object({ password: z.string().min(1) }).strip() };
