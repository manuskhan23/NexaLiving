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

import { Service } from '../models/Service';
import { ServiceReview } from '../models/ServiceReview';
import { Society } from '../models/Society';
import { SERVICE_CATEGORIES } from '../constants/enums';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

const body = z.object({
  category: z.enum(SERVICE_CATEGORIES),
  providerName: z.string().min(2).max(80),
  businessName: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  phone: z.string().max(30).optional(), whatsapp: z.string().max(30).optional(),
  serviceAreas: z.array(z.string().max(60)).max(20).optional(),
  priceNote: z.string().max(200).optional(), availability: z.string().max(200).optional(),
  emergencyAvailable: z.boolean().optional(),
  images: z.array(z.object({ url: z.string(), publicId: z.string() })).max(6).optional(),
}).strip();

r.post('/', validate({ body }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const me = (req as any).user._id;
  const isAdmin = (req as any).membership.role === 'admin';
  const society: any = await Society.findById(sid).select('settings').lean();
  const status = (isAdmin || !society?.settings?.requireListingApproval) ? 'active' : 'pending_review';
  const s: any = await Service.create({ ...req.body, owner: isAdmin && (req.body as any).isExternal ? (req as any).user._id : me, society: sid, isExternal: !!req.body.isExternal, status });
  await (await import('../models/Membership')).Membership.updateOne({ user: me, society: sid }, { $set: { isServiceProvider: true } });
  created(res, { service: s });
}));
r.get('/categories', asyncHandler(async (_req, res) => ok(res, { items: SERVICE_CATEGORIES })));
r.get('/', validate({ query: z.object({ category: z.enum(SERVICE_CATEGORIES).optional(), search: z.string().max(80).optional(), sort: z.enum(['newest','rating']).default('newest'), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId, status: 'active', isHidden: false };
  if (q.category) filter.category = q.category;
  if (q.search) filter.$or = [{ providerName: new RegExp(escapeRegex(q.search), 'i') }, { businessName: new RegExp(escapeRegex(q.search), 'i') }];
  const sortMap: any = { newest: { createdAt: -1 }, rating: { avgRating: -1, reviewCount: -1 } };
  const total = await Service.countDocuments(filter);
  const items = await Service.find(filter).sort(sortMap[q.sort]).skip(skip).limit(limit).lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
r.get('/:serviceId', validate({ params: z.object({ societyId: oid, serviceId: oid }) }), asyncHandler(async (req, res) => {
  const s: any = await Service.findOne({ _id: req.params.serviceId, society: req.params.societyId }).populate('owner', 'fullName avatar').lean();
  if (!s) throw ApiError.notFound();
  ok(res, { service: s });
}));
r.patch('/:serviceId', validate({ params: z.object({ societyId: oid, serviceId: oid }), body: body.partial() }), asyncHandler(async (req, res) => {
  const isAdmin = (req as any).membership.role === 'admin';
  const filter: any = { _id: req.params.serviceId, society: req.params.societyId };
  if (!isAdmin) filter.owner = (req as any).user._id;
  const s: any = await Service.findOneAndUpdate(filter, { $set: req.body }, { new: true });
  if (!s) throw ApiError.notFound();
  ok(res, { service: s });
}));
r.delete('/:serviceId', validate({ params: z.object({ societyId: oid, serviceId: oid }) }), asyncHandler(async (req, res) => {
  const isAdmin = (req as any).membership.role === 'admin';
  const filter: any = { _id: req.params.serviceId, society: req.params.societyId };
  if (!isAdmin) filter.owner = (req as any).user._id;
  await Service.updateOne(filter, { $set: { deletedAt: new Date() } });
  ok(res, { message: 'Deleted' });
}));
r.patch('/:serviceId/review', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, serviceId: oid }), body: z.object({ approved: z.boolean(), note: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const s: any = await Service.findOneAndUpdate({ _id: req.params.serviceId, society: req.params.societyId, status: 'pending_review' },
    { $set: { status: req.body.approved ? 'active' : 'rejected' } }, { new: true });
  if (!s) throw ApiError.conflict('INVALID_STATE', 'This service has already been reviewed.');
  sendToUser(String(s.owner), { type: req.body.approved ? NOTIFICATION_TYPES.SERVICE_APPROVED : NOTIFICATION_TYPES.SERVICE_REJECTED, title: 'Service ' + (req.body.approved ? 'approved' : 'rejected'), society: req.params.societyId }).catch(() => {});
  ok(res, { service: s });
}));
r.post('/:serviceId/reviews', validate({ params: z.object({ societyId: oid, serviceId: oid }), body: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }).strip() }), asyncHandler(async (req, res) => {
  const s: any = await Service.findOne({ _id: req.params.serviceId, society: req.params.societyId, status: 'active' });
  if (!s) throw ApiError.notFound();
  const me = (req as any).user._id;
  if (String(s.owner) === String(me)) throw ApiError.badRequest('SELF_REQUEST', "You can't review your own service.");
  const dup = await ServiceReview.exists({ service: s._id, user: me });
  if (dup) throw ApiError.conflict('ALREADY_REPORTED', 'You already reviewed');
  const rev: any = await ServiceReview.create({ society: req.params.societyId, service: s._id, user: me, rating: req.body.rating, comment: req.body.comment });
  const agg: any = await ServiceReview.aggregate([{ $match: { service: s._id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  const a = agg[0] || { avg: 0, n: 0 };
  await Service.updateOne({ _id: s._id }, { $set: { avgRating: Math.round(a.avg * 100) / 100, reviewCount: a.n } });
  sendToUser(String(s.owner), { type: NOTIFICATION_TYPES.SERVICE_REVIEW_NEW, title: 'New review', body: a.avg + ' / 5', society: req.params.societyId }).catch(() => {});
  created(res, { review: rev });
}));
r.get('/:serviceId/reviews', validate({ params: z.object({ societyId: oid, serviceId: oid }) }), asyncHandler(async (req, res) => {
  const items = await ServiceReview.find({ service: req.params.serviceId, society: req.params.societyId }).sort({ createdAt: -1 }).populate('user', 'fullName avatar').lean();
  ok(res, { items });
}));
r.delete('/:serviceId/reviews/:reviewId', validate({ params: z.object({ societyId: oid, serviceId: oid, reviewId: oid }) }), asyncHandler(async (req, res) => {
  const isAdmin = (req as any).membership.role === 'admin';
  const filter: any = { _id: req.params.reviewId, service: req.params.serviceId };
  if (!isAdmin) filter.user = (req as any).user._id;
  await ServiceReview.updateOne(filter, { $set: { deletedAt: new Date() } });
  ok(res, { message: 'Deleted' });
}));
export default r;
