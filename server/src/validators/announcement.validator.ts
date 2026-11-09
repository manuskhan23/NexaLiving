import { z } from 'zod';
const oid = z.string().regex(/^[0-9a-fA-F]{24}$/);
const img = z.object({ url: z.string(), publicId: z.string() });
export const listSchema = { params: z.object({ societyId: oid }), query: z.object({
  category: z.enum(['general','maintenance','event','security','billing','other']).optional(),
  search: z.string().max(80).optional(),
  includeExpired: z.enum(['true','false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})};
export const itemParams = { params: z.object({ societyId: oid, announcementId: oid }) };
export const createSchema = { body: z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(1).max(5000),
  category: z.enum(['general','maintenance','event','security','billing','other']).default('general'),
  images: z.array(img).max(5).optional(),
  attachments: z.array(z.object({ url: z.string(), name: z.string() })).max(3).optional(),
  isPinned: z.boolean().optional(),
  expiresAt: z.coerce.date().optional(),
  notify: z.boolean().default(true),
}).strip() };
export const updateSchema = { body: z.object({
  title: z.string().min(3).max(120).optional(),
  body: z.string().min(1).max(5000).optional(),
  category: z.enum(['general','maintenance','event','security','billing','other']).optional(),
  images: z.array(img).max(5).optional(),
  attachments: z.array(z.object({ url: z.string(), name: z.string() })).max(3).optional(),
  isPinned: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
}).strip() };
export const pinSchema = { params: z.object({ societyId: oid, announcementId: oid }), body: z.object({ isPinned: z.boolean() }).strip() };
