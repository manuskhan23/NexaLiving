import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { requireMember } from '../middleware/requireMember';
import { requireSocietyAdmin } from '../middleware/requireSocietyAdmin';
import { requireAssistanceReviewer } from '../middleware/requireAssistanceReviewer';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, created } from '../utils/respond';
import { ApiError } from '../utils/ApiError';
import { paginate, buildMeta } from '../utils/paginate';
import { escapeRegex } from '../utils/escapeRegex';
import { sendToUser, sendToSociety } from '../services/notification.service';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { audit } from '../services/audit.service';
const oid = z.string().regex(/^[0-9a-fA-F]{24}$/);

import { Deal } from '../models/Deal';
import { Society } from '../models/Society';
import { ITEM_CATEGORIES } from '../constants/enums';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);
const body = z.object({
  shopName: z.string().min(2).max(80), title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  discountLabel: z.string().max(60).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  terms: z.string().max(500).optional(),
  shopLocation: z.string().max(200).optional(), shopPhone: z.string().max(30).optional(),
  image: z.object({ url: z.string(), publicId: z.string() }).optional(),
  validFrom: z.coerce.date().optional(), validTo: z.coerce.date().optional(),
}).strip();

r.post('/', validate({ body }), asyncHandler(async (req, res) => {
  const isAdmin = (req as any).membership.role === 'admin';
  const society: any = await Society.findById(req.params.societyId).select('settings').lean();
  if (!isAdmin && !society?.settings?.allowResidentDeals) throw ApiError.forbidden('FORBIDDEN', 'Residents cannot post deals');
  const d: any = await Deal.create({ ...req.body, createdBy: (req as any).user._id, society: req.params.societyId, status: isAdmin ? 'approved' : 'pending' });
  if (!isAdmin) sendToSociety(req.params.societyId, { type: NOTIFICATION_TYPES.DEAL_APPROVED, title: 'Deal awaiting review', body: req.body.title }, (req as any).user._id).catch(() => {});
  created(res, { deal: d });
}));
r.get('/pending', requireSocietyAdmin, asyncHandler(async (req, res) => {
  const items = await Deal.find({ society: req.params.societyId, status: 'pending' }).sort({ createdAt: 1 }).lean();
  ok(res, { items });
}));
r.get('/mine', asyncHandler(async (req, res) => {
  const items = await Deal.find({ society: req.params.societyId, createdBy: (req as any).user._id }).sort({ createdAt: -1 }).lean();
  ok(res, { items });
}));
r.get('/', validate({ query: z.object({ category: z.enum(ITEM_CATEGORIES).optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any);
  const now = new Date();
  const filter: any = { society: req.params.societyId, status: 'approved', $or: [{ validTo: null }, { validTo: { $gte: now } }] };
  if ((req.query as any).category) filter.category = (req.query as any).category;
  const total = await Deal.countDocuments(filter);
  const items = await Deal.find(filter).sort({ validTo: 1, createdAt: -1 }).skip(skip).limit(limit).lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
r.get('/:dealId', validate({ params: z.object({ societyId: oid, dealId: oid }) }), asyncHandler(async (req, res) => {
  const d: any = await Deal.findOne({ _id: req.params.dealId, society: req.params.societyId });
  if (!d) throw ApiError.notFound();
  ok(res, { deal: d });
}));
r.patch('/:dealId', validate({ params: z.object({ societyId: oid, dealId: oid }), body: body.partial() }), asyncHandler(async (req, res) => {
  const isAdmin = (req as any).membership.role === 'admin';
  const filter: any = { _id: req.params.dealId, society: req.params.societyId };
  if (!isAdmin) { filter.createdBy = (req as any).user._id; filter.status = 'pending'; }
  const d: any = await Deal.findOneAndUpdate(filter, { $set: req.body }, { new: true });
  if (!d) throw ApiError.notFound();
  ok(res, { deal: d });
}));
r.patch('/:dealId/review', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, dealId: oid }), body: z.object({ approved: z.boolean(), note: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const d: any = await Deal.findOneAndUpdate({ _id: req.params.dealId, society: req.params.societyId, status: 'pending' }, { $set: { status: req.body.approved ? 'approved' : 'rejected', reviewNote: req.body.note } }, { new: true });
  if (!d) throw ApiError.conflict('INVALID_STATE', 'This deal has already been reviewed.');
  sendToUser(String(d.createdBy), { type: req.body.approved ? NOTIFICATION_TYPES.DEAL_APPROVED : NOTIFICATION_TYPES.DEAL_REJECTED, title: 'Deal ' + (req.body.approved ? 'approved' : 'rejected'), body: d.title, society: req.params.societyId }).catch(() => {});
  ok(res, { deal: d });
}));
r.delete('/:dealId', validate({ params: z.object({ societyId: oid, dealId: oid }) }), asyncHandler(async (req, res) => {
  const isAdmin = (req as any).membership.role === 'admin';
  const filter: any = { _id: req.params.dealId, society: req.params.societyId };
  if (!isAdmin) filter.createdBy = (req as any).user._id;
  await Deal.updateOne(filter, { $set: { deletedAt: new Date() } });
  ok(res, { message: 'Deleted' });
}));
export default r;
