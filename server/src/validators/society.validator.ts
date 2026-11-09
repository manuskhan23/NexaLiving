import { z } from 'zod';
const oid = z.string().regex(/^[0-9a-fA-F]{24}$/);
export const societyIdParams = { params: z.object({ societyId: oid }) };
export const membershipIdParams = { params: z.object({ societyId: oid, membershipId: oid }) };

export const createSocietySchema = { body: z.object({
  name: z.string().trim().min(3).max(80),
  area: z.string().min(2).max(120),
  city: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
  coverImage: z.object({ url: z.string(), publicId: z.string() }).optional(),
  blocks: z.array(z.string().max(20)).max(50).optional(),
}).strip() };

export const updateSocietySchema = { body: z.object({
  name: z.string().trim().min(3).max(80).optional(),
  area: z.string().max(120).optional(),
  city: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
  coverImage: z.object({ url: z.string(), publicId: z.string() }).optional(),
  blocks: z.array(z.string().max(20)).max(50).optional(),
}).strip() };

export const updateSettingsSchema = { body: z.object({
  requireListingApproval: z.boolean().optional(),
  allowResidentDeals: z.boolean().optional(),
  maxPendingBookingsPerUser: z.number().int().min(1).max(10).optional(),
  autoHideReportThreshold: z.number().int().min(2).max(20).optional(),
  timezone: z.string().max(60).optional(),
}).strip() };

export const lookupSchema = { query: z.object({ code: z.string().length(8) }) };
export const joinSchema = { body: z.object({
  joinCode: z.string().length(8),
  block: z.string().max(20),
  unitLabel: z.string().max(40),
  residentType: z.enum(['owner', 'tenant', 'family_member']),
  note: z.string().max(200).optional(),
}).strip() };

export const membersListSchema = { query: z.object({
  status: z.enum(['pending','active','suspended','rejected','left']).optional(),
  role: z.enum(['resident','admin']).optional(),
  block: z.string().optional(),
  search: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}) };

export const directorySchema = { query: z.object({
  search: z.string().max(80).optional(),
  skill: z.string().max(40).optional(),
  block: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}) };

export const approveSchema = { body: z.object({ markVerified: z.boolean().optional() }).strip() };
export const rejectSchema = { body: z.object({ reason: z.string().max(200).optional() }).strip() };
export const roleSchema = { body: z.object({ role: z.enum(['resident','admin']) }).strip() };
export const permissionsSchema = { body: z.object({ canReviewAssistance: z.boolean() }).strip() };
export const verifySchema = { body: z.object({ isVerifiedResident: z.boolean(), note: z.string().max(200).optional() }).strip() };
export const suspendSchema = { body: z.object({ suspended: z.boolean(), reason: z.string().max(200).optional() }).strip() };
export const removeSchema = { body: z.object({ reason: z.string().max(200).optional() }).strip() };
