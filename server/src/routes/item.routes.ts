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

import { Item } from '../models/Item';
import { ItemRequest } from '../models/ItemRequest';
import { Need } from '../models/Need';
import { ITEM_CATEGORIES, ITEM_CONDITIONS, LISTING_TYPES, ITEM_STATUSES, ITEM_REQUEST_STATUSES, REQUEST_STATUSES } from '../constants/enums';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

const itemBody = z.object({
  listingType: z.enum(LISTING_TYPES),
  title: z.string().min(3).max(80),
  description: z.string().max(1000).optional(),
  category: z.enum(ITEM_CATEGORIES),
  condition: z.enum(ITEM_CONDITIONS).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  images: z.array(z.object({ url: z.string(), publicId: z.string() })).min(1).max(6),
  availableFrom: z.coerce.date().optional(), availableTo: z.coerce.date().optional(),
  maxBorrowDays: z.number().int().min(1).max(30).optional(),
  pickupNote: z.string().max(200).optional(), depositNote: z.string().max(100).optional(),
}).strip();

r.post('/', validate({ body: itemBody }), asyncHandler(async (req, res) => {
  const tags = (req.body.tags || []).map((t: string) => t.toLowerCase().trim()).filter(Boolean);
  const it: any = await Item.create({ ...req.body, tags, society: req.params.societyId, owner: (req as any).user._id, status: 'available' });
  let matched = 0;
  if (it.listingType === 'lend' || it.listingType === 'giveaway') {
    try {
      const openNeeds = await Need.find({ society: req.params.societyId, status: 'open', kind: 'item', expiresAt: { $gt: new Date() }, owner: { $ne: (req as any).user._id } }).limit(20);
      matched = openNeeds.length;
    } catch {}
  }
  created(res, { item: it, matchedNeeds: matched });
}));
r.get('/', validate({ query: z.object({
  listingType: z.enum(LISTING_TYPES).optional(), category: z.enum(ITEM_CATEGORIES).optional(),
  search: z.string().max(80).optional(), availableOn: z.coerce.date().optional(),
  sort: z.enum(['newest','oldest']).default('newest'), includeMine: z.enum(['true','false']).optional(),
  page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20),
}) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId, status: 'available', isHidden: false, deletedAt: null };
  if (q.listingType) filter.listingType = q.listingType;
  if (q.category) filter.category = q.category;
  if (q.search) filter.$or = [{ title: new RegExp(escapeRegex(q.search), 'i') }, { description: new RegExp(escapeRegex(q.search), 'i') }, { tags: new RegExp(escapeRegex(q.search), 'i') }];
  if (q.availableOn) { filter.$and = [{ $or: [{ availableFrom: null }, { availableFrom: { $lte: q.availableOn } }] }, { $or: [{ availableTo: null }, { availableTo: { $gte: q.availableOn } }] }]; }
  if (q.includeMine !== 'true') filter.owner = { $ne: (req as any).user._id };
  const total = await Item.countDocuments(filter);
  const items = await Item.find(filter).sort({ createdAt: q.sort === 'oldest' ? 1 : -1 }).skip(skip).limit(limit).populate('owner', 'fullName avatar').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
r.get('/mine', validate({ query: z.object({ status: z.enum(ITEM_STATUSES).optional(), listingType: z.enum(LISTING_TYPES).optional() }) }), asyncHandler(async (req, res) => {
  const filter: any = { society: req.params.societyId, owner: (req as any).user._id, deletedAt: null };
  if ((req.query as any).status) filter.status = (req.query as any).status;
  if ((req.query as any).listingType) filter.listingType = (req.query as any).listingType;
  ok(res, { items: await Item.find(filter).sort({ createdAt: -1 }).lean() });
}));
r.get('/:itemId', validate({ params: z.object({ societyId: oid, itemId: oid }) }), asyncHandler(async (req, res) => {
  const it: any = await Item.findOne({ _id: req.params.itemId, society: req.params.societyId, deletedAt: null }).populate('owner', 'fullName avatar').lean();
  if (!it) throw ApiError.notFound();
  const bookedRanges = await ItemRequest.find({ item: it._id, status: { $in: ['accepted','handed_over'] }, endAt: { $gte: new Date() } }).select('startAt endAt').lean();
  const myRequest: any = await ItemRequest.findOne({ item: it._id, requester: (req as any).user._id }).sort({ createdAt: -1 }).lean();
  ok(res, { item: it, bookedRanges, myRequest });
}));
r.patch('/:itemId', validate({ params: z.object({ societyId: oid, itemId: oid }), body: itemBody.omit({ listingType: true }).partial() }), asyncHandler(async (req, res) => {
  const it: any = await Item.findOne({ _id: req.params.itemId, society: req.params.societyId, owner: (req as any).user._id });
  if (!it) throw ApiError.notFound();
  if (it.status === 'given_away') throw ApiError.conflict('INVALID_STATE', 'Given away items cannot be edited');
  Object.assign(it, req.body); await it.save();
  ok(res, { item: it });
}));
r.patch('/:itemId/status', validate({ params: z.object({ societyId: oid, itemId: oid }), body: z.object({ status: z.enum(['available','paused','given_away']) }).strip() }), asyncHandler(async (req, res) => {
  const it: any = await Item.findOne({ _id: req.params.itemId, society: req.params.societyId, owner: (req as any).user._id });
  if (!it) throw ApiError.notFound();
  if (req.body.status === 'given_away' && it.listingType !== 'giveaway') throw ApiError.conflict('INVALID_STATE', 'Only giveaway items can be marked as given away.');
  it.status = req.body.status;
  if (req.body.status === 'given_away') await ItemRequest.updateMany({ item: it._id, status: 'pending' }, { $set: { status: 'rejected', reason: 'Item given away' } });
  await it.save();
  ok(res, { item: it });
}));
r.delete('/:itemId', validate({ params: z.object({ societyId: oid, itemId: oid }), body: z.object({ reason: z.string().max(200).optional() }).strip() }), asyncHandler(async (req, res) => {
  const it: any = await Item.findOne({ _id: req.params.itemId, society: req.params.societyId });
  if (!it) throw ApiError.notFound();
  const me = (req as any).user._id; const isAdmin = (req as any).membership.role === 'admin';
  if (String(it.owner) !== me && !isAdmin) throw ApiError.notFound();
  const onLoan = await ItemRequest.exists({ item: it._id, status: 'handed_over' });
  if (onLoan) throw ApiError.conflict('ITEM_ON_LOAN', 'Item currently borrowed');
  it.deletedAt = new Date(); await it.save();
  await ItemRequest.updateMany({ item: it._id, status: { $in: ['pending','accepted'] } }, { $set: { status: 'cancelled', reason: 'Item deleted' } });
  ok(res, { message: 'Deleted' });
}));

r.post('/:itemId/requests', validate({ params: z.object({ societyId: oid, itemId: oid }), body: z.object({
  startAt: z.coerce.date().optional(), endAt: z.coerce.date().optional(),
  message: z.string().max(300).optional(), needId: oid.optional(),
}).strip() }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const me = (req as any).user._id;
  const it: any = await Item.findOne({ _id: req.params.itemId, society: sid, deletedAt: null });
  if (!it) throw ApiError.notFound();
  if (String(it.owner) === String(me)) throw ApiError.badRequest('SELF_REQUEST', 'Cannot request your own item');
  if (it.status !== 'available') throw ApiError.conflict('ITEM_UNAVAILABLE', 'Item not available');
  const dup = await ItemRequest.exists({ item: it._id, requester: me, status: 'pending' });
  if (dup) throw ApiError.conflict('ALREADY_REQUESTED', 'You already have a pending request for this item.');
  let startAt = req.body.startAt; let endAt = req.body.endAt;
  if (it.listingType === 'lend') {
    if (!startAt || !endAt) throw ApiError.badRequest('VALIDATION_ERROR', 'Dates required for lend');
    if (endAt <= startAt) throw ApiError.badRequest('VALIDATION_ERROR', 'The return date must be after the start date.');
    const days = (endAt.getTime() - startAt.getTime()) / 86400000;
    if (days > (it.maxBorrowDays || 3)) throw ApiError.badRequest('VALIDATION_ERROR', 'Exceeds maxBorrowDays');
    if (it.availableFrom && startAt < it.availableFrom) throw ApiError.badRequest('VALIDATION_ERROR', 'Outside available range');
    if (it.availableTo && endAt > it.availableTo) throw ApiError.badRequest('VALIDATION_ERROR', 'Outside available range');
    const overlap = await ItemRequest.exists({ item: it._id, status: { $in: ['accepted','handed_over'] }, startAt: { $lt: endAt }, endAt: { $gt: startAt } });
    if (overlap) throw ApiError.conflict('ITEM_UNAVAILABLE', 'Overlaps another borrow');
  } else { startAt = undefined; endAt = undefined; }
  const req2: any = await ItemRequest.create({
    society: sid, item: it._id, owner: it.owner, requester: me, type: it.listingType,
    startAt, endAt, message: req.body.message, need: req.body.needId, status: 'pending',
  });
  sendToUser(String(it.owner), { type: NOTIFICATION_TYPES.ITEM_REQUEST_RECEIVED, title: 'New item request', body: it.title, society: sid, data: { screen: 'ItemRequests', params: { id: String(req2._id) } } }).catch(() => {});
  created(res, { request: req2 });
}));

const requestsRouter = Router({ mergeParams: true });
requestsRouter.use(authenticate, requireMember);
requestsRouter.get('/sent', asyncHandler(async (req, res) => {
  const filter: any = { society: req.params.societyId, requester: (req as any).user._id };
  if ((req.query as any).status) filter.status = (req.query as any).status;
  const items = await ItemRequest.find(filter).sort({ createdAt: -1 }).populate('item', 'title images owner').lean();
  ok(res, { items });
}));
requestsRouter.get('/received', asyncHandler(async (req, res) => {
  const filter: any = { society: req.params.societyId, owner: (req as any).user._id };
  if ((req.query as any).status) filter.status = (req.query as any).status;
  if ((req.query as any).itemId) filter.item = (req.query as any).itemId;
  const items = await ItemRequest.find(filter).sort({ createdAt: -1 }).populate('requester', 'fullName avatar').populate('item', 'title').lean();
  ok(res, { items });
}));
const rid = { params: z.object({ societyId: oid, requestId: oid }) };
requestsRouter.patch('/:requestId/accept', validate({ ...rid, body: z.object({ message: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const r2: any = await ItemRequest.findOne({ _id: req.params.requestId, owner: (req as any).user._id, society: req.params.societyId });
  if (!r2) throw ApiError.notFound();
  if (r2.status !== 'pending') throw ApiError.conflict('INVALID_STATE', 'This request has already been answered.');
  r2.status = 'accepted'; r2.responseMessage = req.body.message; await r2.save();
  const overlapping = await ItemRequest.find({ item: r2.item, _id: { $ne: r2._id }, status: 'pending',
    ...(r2.type === 'lend' ? { startAt: { $lt: r2.endAt }, endAt: { $gt: r2.startAt } } : {}) });
  for (const o of overlapping) { o.status = 'rejected'; o.reason = 'Item booked by another'; await o.save(); }
  if (r2.type === 'giveaway') await Item.updateOne({ _id: r2.item }, { $set: { status: 'reserved' } });
  if (r2.need) await Need.updateOne({ _id: r2.need }, { $set: { status: 'matched' } });
  const item: any = await Item.findById(r2.item).select('title pickupNote').lean();
  sendToUser(String(r2.requester), { type: NOTIFICATION_TYPES.ITEM_REQUEST_ACCEPTED, title: 'Request accepted', body: item?.title || '', society: r2.society, data: { screen: 'ItemRequestDetail', params: { id: String(r2._id) } } }).catch(() => {});
  ok(res, { request: r2, contact: { pickupNote: item?.pickupNote } });
}));
requestsRouter.patch('/:requestId/reject', validate({ ...rid, body: z.object({ reason: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const r2: any = await ItemRequest.findOneAndUpdate({ _id: req.params.requestId, owner: (req as any).user._id, status: 'pending' }, { $set: { status: 'rejected', reason: req.body.reason } }, { new: true });
  if (!r2) throw ApiError.conflict('INVALID_STATE', 'This request has already been answered.');
  sendToUser(String(r2.requester), { type: NOTIFICATION_TYPES.ITEM_REQUEST_REJECTED, title: 'Request rejected', society: r2.society }).catch(() => {});
  ok(res, { request: r2 });
}));
requestsRouter.patch('/:requestId/cancel', validate({ ...rid, body: z.object({ reason: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const me = (req as any).user._id;
  const r2: any = await ItemRequest.findOne({ _id: req.params.requestId, society: req.params.societyId });
  if (!r2) throw ApiError.notFound();
  const isReq = String(r2.requester) === String(me);
  const isOwner = String(r2.owner) === String(me);
  if (!isReq && !isOwner) throw ApiError.notFound();
  if (!['pending','accepted'].includes(r2.status)) throw ApiError.conflict('INVALID_STATE', 'Only pending or accepted requests can be cancelled.');
  r2.status = 'cancelled'; r2.reason = req.body.reason; await r2.save();
  if (r2.type === 'giveaway' && r2.status === 'cancelled') await Item.updateOne({ _id: r2.item, status: 'reserved' }, { $set: { status: 'available' } });
  sendToUser(String(isReq ? r2.owner : r2.requester), { type: NOTIFICATION_TYPES.ITEM_REQUEST_REJECTED, title: 'Request cancelled', society: r2.society }).catch(() => {});
  ok(res, { request: r2 });
}));
requestsRouter.patch('/:requestId/handover', validate(rid), asyncHandler(async (req, res) => {
  const r2: any = await ItemRequest.findOne({ _id: req.params.requestId, owner: (req as any).user._id });
  if (!r2) throw ApiError.notFound();
  if (r2.status !== 'accepted') throw ApiError.conflict('INVALID_STATE', 'Only accepted requests can be marked as handed over.');
  if (r2.type === 'lend') { r2.status = 'handed_over'; r2.handedOverAt = new Date(); }
  else { r2.status = 'completed'; r2.handedOverAt = new Date(); await Item.updateOne({ _id: r2.item }, { $set: { status: 'given_away' } }); }
  await r2.save();
  sendToUser(String(r2.requester), { type: NOTIFICATION_TYPES.ITEM_HANDED_OVER, title: 'Item handed over', society: r2.society }).catch(() => {});
  ok(res, { request: r2 });
}));
requestsRouter.patch('/:requestId/return', validate({ ...rid, body: z.object({ conditionNote: z.string().max(200).optional() }).strip() }), asyncHandler(async (req, res) => {
  const r2: any = await ItemRequest.findOne({ _id: req.params.requestId, owner: (req as any).user._id });
  if (!r2) throw ApiError.notFound();
  if (r2.status !== 'handed_over') throw ApiError.conflict('INVALID_STATE', 'Only items that were handed over can be marked as returned.');
  r2.status = 'completed'; r2.returnedAt = new Date(); r2.conditionNote = req.body.conditionNote; await r2.save();
  sendToUser(String(r2.requester), { type: NOTIFICATION_TYPES.ITEM_RETURNED, title: 'Thanks for returning', society: r2.society }).catch(() => {});
  ok(res, { request: r2 });
}));
export default r;
export { requestsRouter as itemRequestRoutes };
