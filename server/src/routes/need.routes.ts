import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
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

import { Need } from '../models/Need';
import { Item } from '../models/Item';
import { ItemRequest } from '../models/ItemRequest';
import { Membership } from '../models/Membership';
import { NEED_KINDS, NEED_VISIBILITIES, NEED_STATUSES, ITEM_CATEGORIES } from '../constants/enums';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

async function findMatches(need: any, viewerId: string, societyId: string, limit = 10) {
  const candidates = await Item.find({
    society: societyId, listingType: { $in: ['lend','giveaway'] }, status: 'available',
    isHidden: false, deletedAt: null, owner: { $ne: viewerId },
    $or: [
      { category: need.category },
      { tags: { $in: need.tags || [] } },
      { title: new RegExp(escapeRegex(need.title.split(' ')[0] || need.title), 'i') },
    ],
  }).limit(100);
  const conflicting = await ItemRequest.distinct('item', { item: { $in: candidates.map((c) => c._id) }, status: { $in: ['accepted','handed_over'] }, startAt: { $lt: need.neededTo }, endAt: { $gt: need.neededFrom } });
  const conflictingSet = new Set(conflicting.map(String));
  const viewer = await Membership.findOne({ user: viewerId, society: societyId }).select('block').lean();
  const scored = [];
  for (const item of candidates as any[]) {
    if (conflictingSet.has(String(item._id))) continue;
    if (item.listingType === 'lend') {
      if (item.availableFrom && need.neededFrom < item.availableFrom) continue;
      if (item.availableTo && need.neededTo > item.availableTo) continue;
      const days = (need.neededTo.getTime() - need.neededFrom.getTime()) / 86400000;
      if (days > (item.maxBorrowDays || 3)) continue;
    }
    let score = 0; const reasons: string[] = [];
    if (item.category === need.category) { score += 5; reasons.push('Same category'); }
    const shared = (item.tags || []).filter((t: string) => (need.tags || []).includes(t));
    score += shared.length * 3; shared.forEach((t: string) => reasons.push('Tag: ' + t));
    if ((item.title || '').toLowerCase().includes(need.title.toLowerCase())) { score += 4; reasons.push('Title match'); }
    const ownerMem: any = await Membership.findOne({ user: item.owner, society: societyId }).populate('user', 'fullName avatar').lean();
    if (ownerMem?.isVerifiedResident) { score += 2; reasons.push('Verified owner'); }
    if (viewer && ownerMem?.block && viewer.block === ownerMem.block) { score += 1; reasons.push('Same block'); }
    reasons.push('Available for your time');
    scored.push({ item, owner: { fullName: (ownerMem as any)?.user?.fullName, block: ownerMem?.block, _id: item.owner }, score, matchReasons: reasons });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

r.post('/', validate({ body: z.object({
  kind: z.enum(NEED_KINDS),
  title: z.string().min(3).max(80),
  description: z.string().max(500).optional(),
  category: z.enum(ITEM_CATEGORIES),
  tags: z.array(z.string().max(30)).max(10).optional(),
  neededFrom: z.coerce.date(), neededTo: z.coerce.date(),
  visibility: z.enum(NEED_VISIBILITIES).default('community'),
}).strip().refine((v) => v.neededTo > v.neededFrom, { message: 'neededTo must be after neededFrom' }) }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const me = (req as any).user._id;
  const openCount = await Need.countDocuments({ society: sid, owner: me, status: 'open' });
  if (openCount >= 5) throw ApiError.tooMany('Too many open needs');
  const tags = (req.body.tags || []).map((t: string) => t.toLowerCase().trim());
  const need: any = await Need.create({ ...req.body, tags, society: sid, owner: me, status: 'open', expiresAt: req.body.neededTo });
  let matches: any[] = [];
  if (req.body.kind === 'item') matches = await findMatches(need, me, sid, 10);
  created(res, { need, matches });
}));

r.get('/:needId/matches', validate({ params: z.object({ societyId: oid, needId: oid }), query: z.object({ limit: z.coerce.number().int().min(1).max(30).default(10) }) }), asyncHandler(async (req, res) => {
  const need: any = await Need.findOne({ _id: req.params.needId, society: req.params.societyId, owner: (req as any).user._id });
  if (!need) throw ApiError.notFound();
  const items = await findMatches(need, String((req as any).user._id), req.params.societyId, (req.query as any).limit);
  ok(res, { items });
}));

r.get('/', validate({ query: z.object({ kind: z.enum(NEED_KINDS).optional(), category: z.enum(ITEM_CATEGORIES).optional(), search: z.string().max(80).optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId, status: 'open', visibility: 'community', expiresAt: { $gt: new Date() }, isHidden: false, owner: { $ne: (req as any).user._id } };
  if (q.kind) filter.kind = q.kind;
  if (q.category) filter.category = q.category;
  if (q.search) filter.title = new RegExp(escapeRegex(q.search), 'i');
  const total = await Need.countDocuments(filter);
  const items = await Need.find(filter).sort({ neededFrom: 1 }).skip(skip).limit(limit).populate('owner', 'fullName avatar').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
r.get('/mine', asyncHandler(async (req, res) => {
  const filter: any = { society: req.params.societyId, owner: (req as any).user._id };
  if ((req.query as any).status) filter.status = (req.query as any).status;
  const items = await Need.find(filter).sort({ createdAt: -1 }).lean();
  ok(res, { items: items.map((n: any) => ({ ...n, offersCount: (n.offers || []).length })) });
}));
r.get('/:needId', validate({ params: z.object({ societyId: oid, needId: oid }) }), asyncHandler(async (req, res) => {
  const need: any = await Need.findOne({ _id: req.params.needId, society: req.params.societyId });
  if (!need) throw ApiError.notFound();
  const me = String((req as any).user._id);
  if (need.visibility === 'private' && String(need.owner) !== me) throw ApiError.notFound();
  const myOffer = (need.offers || []).find((o: any) => String(o.user) === me);
  ok(res, { need, myOffer });
}));

r.post('/:needId/offers', validate({ params: z.object({ societyId: oid, needId: oid }), body: z.object({ itemId: oid.optional(), message: z.string().min(1).max(300) }).strip() }), asyncHandler(async (req, res) => {
  const need: any = await Need.findOne({ _id: req.params.needId, society: req.params.societyId });
  if (!need) throw ApiError.notFound();
  if (need.status !== 'open' || need.visibility !== 'community') throw ApiError.conflict('INVALID_STATE', 'This request is no longer open for offers.');
  if (String(need.owner) === String((req as any).user._id)) throw ApiError.badRequest('SELF_REQUEST', "You can't make an offer on your own request.");
  if ((need.offers || []).some((o: any) => String(o.user) === String((req as any).user._id))) throw ApiError.conflict('ALREADY_REQUESTED', 'You already offered');
  if (req.body.itemId) {
    const own: any = await Item.findOne({ _id: req.body.itemId, owner: (req as any).user._id, status: 'available' });
    if (!own) throw ApiError.badRequest('VALIDATION_ERROR', 'You do not own that available item');
  }
  need.offers.push({ user: (req as any).user._id, item: req.body.itemId, message: req.body.message, status: 'pending', createdAt: new Date() });
  await need.save();
  sendToUser(String(need.owner), { type: NOTIFICATION_TYPES.NEED_OFFER_RECEIVED, title: 'New offer', body: need.title, society: req.params.societyId }).catch(() => {});
  created(res, { offer: need.offers[need.offers.length - 1] });
}));

r.patch('/:needId/offers/:offerId/accept', validate({ params: z.object({ societyId: oid, needId: oid, offerId: oid }) }), asyncHandler(async (req, res) => {
  const need: any = await Need.findOne({ _id: req.params.needId, society: req.params.societyId, owner: (req as any).user._id });
  if (!need) throw ApiError.notFound();
  const offer: any = (need.offers || []).id(req.params.offerId);
  if (!offer) throw ApiError.notFound();
  offer.status = 'accepted';
  for (const o of need.offers) if (String(o._id) !== String(offer._id) && o.status === 'pending') o.status = 'declined';
  need.status = 'matched';
  await need.save();
  let created = null;
  if (offer.item) {
    const item: any = await Item.findById(offer.item);
    if (item) {
      created = await ItemRequest.create({
        society: req.params.societyId, item: item._id, owner: offer.user, requester: need.owner,
        type: item.listingType, startAt: need.neededFrom, endAt: need.neededTo,
        need: need._id, status: 'accepted', message: 'Auto-created from accepted offer',
      });
    }
  }
  sendToUser(String(offer.user), { type: NOTIFICATION_TYPES.NEED_OFFER_ACCEPTED, title: 'Offer accepted', body: need.title, society: req.params.societyId }).catch(() => {});
  ok(res, { offer, itemRequest: created });
}));

r.patch('/:needId/close', validate({ params: z.object({ societyId: oid, needId: oid }), body: z.object({ outcome: z.enum(['fulfilled','cancelled']) }).strip() }), asyncHandler(async (req, res) => {
  const need: any = await Need.findOne({ _id: req.params.needId, society: req.params.societyId, owner: (req as any).user._id });
  if (!need) throw ApiError.notFound();
  need.status = req.body.outcome;
  for (const o of need.offers) if (o.status === 'pending') o.status = 'declined';
  await need.save();
  ok(res, { need });
}));
r.delete('/:needId', validate({ params: z.object({ societyId: oid, needId: oid }) }), asyncHandler(async (req, res) => {
  const need: any = await Need.findOne({ _id: req.params.needId, society: req.params.societyId });
  if (!need) throw ApiError.notFound();
  const isAdmin = (req as any).membership.role === 'admin';
  if (String(need.owner) !== String((req as any).user._id) && !isAdmin) throw ApiError.notFound();
  need.deletedAt = new Date(); await need.save();
  ok(res, { message: 'Deleted' });
}));
export default r;
