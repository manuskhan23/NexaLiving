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

import { EventSpace } from '../models/EventSpace';
import { SpaceBlackout } from '../models/SpaceBlackout';
import { Booking } from '../models/Booking';
import { Society } from '../models/Society';
import { BOOKING_STATUSES } from '../constants/enums';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc'); const tzp = require('dayjs/plugin/timezone'); const cpf = require('dayjs/plugin/customParseFormat');
dayjs.extend(utc); dayjs.extend(tzp); dayjs.extend(cpf);

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

const spaceBody = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(1000).optional(),
  capacity: z.number().int().min(1).max(5000),
  images: z.array(z.object({ url: z.string(), publicId: z.string() })).max(6).optional(),
  amenities: z.array(z.string()).optional(),
  rules: z.string().max(1500).optional(),
  openingHours: z.array(z.object({ day: z.number().int().min(0).max(6), open: z.string(), close: z.string() })).optional(),
  slotMinutes: z.number().int().optional(),
  minBookingMinutes: z.number().int().optional(), maxBookingMinutes: z.number().int().optional(),
  minNoticeHours: z.number().int().optional(), maxAdvanceDays: z.number().int().optional(),
  fee: z.number().int().optional(), isActive: z.boolean().optional(),
}).strip();

r.post('/', requireSocietyAdmin, validate({ body: spaceBody }), asyncHandler(async (req, res) => {
  const s: any = await EventSpace.create({ ...req.body, society: req.params.societyId });
  await audit({ society: req.params.societyId, actor: (req as any).user._id, action: 'SPACE_CREATED', targetId: String(s._id) });
  created(res, { space: s });
}));
r.get('/', validate({ query: z.object({ includeInactive: z.enum(['true','false']).optional() }) }), asyncHandler(async (req, res) => {
  const filter: any = { society: req.params.societyId, deletedAt: null };
  const isAdmin = (req as any).membership.role === 'admin';
  if (!(isAdmin && (req.query as any).includeInactive === 'true')) filter.isActive = true;
  const items = await EventSpace.find(filter).sort({ name: 1 }).lean();
  ok(res, { items });
}));
r.get('/:spaceId', validate({ params: z.object({ societyId: oid, spaceId: oid }) }), asyncHandler(async (req, res) => {
  const s: any = await EventSpace.findOne({ _id: req.params.spaceId, society: req.params.societyId, deletedAt: null }).lean();
  if (!s) throw ApiError.notFound();
  const now = new Date(); const in60 = new Date(now.getTime() + 60 * 86400 * 1000);
  const blackouts = await SpaceBlackout.find({ space: s._id, endAt: { $gte: now }, startAt: { $lte: in60 } }).lean();
  ok(res, { space: { ...s, upcomingBlackouts: blackouts } });
}));
r.patch('/:spaceId', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, spaceId: oid }), body: spaceBody.partial() }), asyncHandler(async (req, res) => {
  const s: any = await EventSpace.findOneAndUpdate({ _id: req.params.spaceId, society: req.params.societyId }, { $set: req.body, $inc: { version: 1 } }, { new: true });
  if (!s) throw ApiError.notFound();
  ok(res, { space: s });
}));
r.delete('/:spaceId', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, spaceId: oid }) }), asyncHandler(async (req, res) => {
  const upcoming = await Booking.countDocuments({ space: req.params.spaceId, status: 'approved', endAt: { $gt: new Date() } });
  if (upcoming > 0) throw new ApiError(409, 'HAS_UPCOMING_BOOKINGS', 'Space has upcoming bookings', [{ path: '', message: String(upcoming) }]);
  await EventSpace.updateOne({ _id: req.params.spaceId, society: req.params.societyId }, { $set: { isActive: false, deletedAt: new Date() } });
  ok(res, { message: 'Deleted' });
}));
r.post('/:spaceId/blackouts', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, spaceId: oid }), body: z.object({ startAt: z.coerce.date(), endAt: z.coerce.date(), reason: z.string().max(200).optional() }).refine((v) => v.endAt > v.startAt) }), asyncHandler(async (req, res) => {
  const b: any = await SpaceBlackout.create({ ...req.body, society: req.params.societyId, space: req.params.spaceId, createdBy: (req as any).user._id });
  await EventSpace.updateOne({ _id: req.params.spaceId }, { $inc: { version: 1 } });
  const overlapping = await Booking.find({ space: req.params.spaceId, status: { $in: ['approved','pending'] }, startAt: { $lt: req.body.endAt }, endAt: { $gt: req.body.startAt } }).lean();
  created(res, { blackout: b, overlappingBookings: overlapping });
}));
r.delete('/:spaceId/blackouts/:blackoutId', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, spaceId: oid, blackoutId: oid }) }), asyncHandler(async (req, res) => {
  await SpaceBlackout.deleteOne({ _id: req.params.blackoutId, space: req.params.spaceId, society: req.params.societyId });
  ok(res, { message: 'Deleted' });
}));

r.get('/:spaceId/availability', validate({ params: z.object({ societyId: oid, spaceId: oid }), query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const dateStr = String(req.query.date);
  const space: any = await EventSpace.findOne({ _id: req.params.spaceId, society: sid, deletedAt: null }).lean();
  if (!space) throw ApiError.notFound();
  const society: any = await Society.findById(sid).select('settings.timezone').lean();
  const tz = society?.settings?.timezone || 'Asia/Karachi';
  const localDay = dayjs.tz(dateStr, tz);
  const weekday = localDay.day();
  const hours = (space.openingHours || []).find((h: any) => h.day === weekday);
  if (!hours) return ok(res, { date: dateStr, isOpen: false, slots: [] });
  const [oh, om] = hours.open.split(':').map(Number);
  const [ch, cm] = hours.close.split(':').map(Number);
  const step = space.slotMinutes || 60;
  const openDate = dayjs.tz(dateStr + ' ' + hours.open, 'YYYY-MM-DD HH:mm', tz);
  const closeDate = dayjs.tz(dateStr + ' ' + hours.close, 'YYYY-MM-DD HH:mm', tz);
  const now = new Date();
  const minStart = new Date(now.getTime() + (space.minNoticeHours || 0) * 3600 * 1000);
  const dayStart = openDate.toDate(); const dayEnd = closeDate.toDate();
  const bookings = await Booking.find({ space: space._id, status: { $in: ['approved','pending'] }, startAt: { $lt: dayEnd }, endAt: { $gt: dayStart } }).lean();
  const blackouts = await SpaceBlackout.find({ space: space._id, startAt: { $lt: dayEnd }, endAt: { $gt: dayStart } }).lean();
  const slots: any[] = [];
  for (let m = 0; m < (closeDate.diff(openDate, 'minute')); m += step) {
    const s = openDate.add(m, 'minute').toDate();
    const e = openDate.add(m + step, 'minute').toDate();
    let status = 'available';
    if (blackouts.some((b: any) => b.startAt < e && b.endAt > s)) status = 'blocked';
    else if (bookings.some((b: any) => b.status === 'approved' && b.startAt < e && b.endAt > s)) status = 'booked';
    else if (bookings.some((b: any) => b.status === 'pending' && b.startAt < e && b.endAt > s)) status = 'pending';
    if (status === 'available' && s < minStart) status = 'too_soon';
    slots.push({ start: s.toISOString(), end: e.toISOString(), status });
  }
  ok(res, { date: dateStr, isOpen: true, open: hours.open, close: hours.close, slotMinutes: step, slots });
}));

const bookingCreate = z.object({
  eventTitle: z.string().min(3).max(80),
  eventType: z.enum(['birthday','wedding','meeting','religious','sports','other']),
  startAt: z.coerce.date(), endAt: z.coerce.date(),
  guestCount: z.number().int().min(1),
  notes: z.string().max(500).optional(), contactPhone: z.string().optional(),
}).refine((v) => v.endAt > v.startAt, { message: 'endAt after startAt' });

r.post('/:spaceId/bookings', validate({ params: z.object({ societyId: oid, spaceId: oid }), body: bookingCreate }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const uid = (req as any).user._id;
  const space: any = await EventSpace.findOne({ _id: req.params.spaceId, society: sid, isActive: true });
  if (!space) throw ApiError.notFound();
  const { startAt, endAt } = req.body;
  const durMin = (endAt - startAt) / 60000;
  if (durMin < (space.minBookingMinutes || 0) || durMin > (space.maxBookingMinutes || 1e9)) throw ApiError.badRequest('VALIDATION_ERROR', 'Duration not allowed');
  if ((durMin % (space.slotMinutes || 60)) !== 0) throw ApiError.badRequest('VALIDATION_ERROR', 'Must align to slot');
  if (startAt < new Date(Date.now() + (space.minNoticeHours || 0) * 3600 * 1000)) throw ApiError.badRequest('VALIDATION_ERROR', 'Not enough notice');
  if (startAt > new Date(Date.now() + (space.maxAdvanceDays || 60) * 86400 * 1000)) throw ApiError.badRequest('VALIDATION_ERROR', 'Too far in advance');
  if (req.body.guestCount > space.capacity) throw ApiError.badRequest('VALIDATION_ERROR', 'Exceeds capacity');
  const conflict = await Booking.exists({ space: space._id, status: 'approved', startAt: { $lt: endAt }, endAt: { $gt: startAt } });
  const blackout = await SpaceBlackout.exists({ space: space._id, startAt: { $lt: endAt }, endAt: { $gt: startAt } });
  if (conflict || blackout) throw ApiError.conflict('SLOT_UNAVAILABLE', 'This time slot is already booked');
  const selfOverlap = await Booking.exists({ requester: uid, space: space._id, status: { $in: ['pending','approved'] }, startAt: { $lt: endAt }, endAt: { $gt: startAt } });
  if (selfOverlap) throw ApiError.conflict('SLOT_UNAVAILABLE', 'You already have a booking overlapping this time');
  const pendingCount = await Booking.countDocuments({ requester: uid, society: sid, status: 'pending' });
  const society: any = await Society.findById(sid).select('settings').lean();
  if (pendingCount >= (society?.settings?.maxPendingBookingsPerUser || 3)) throw ApiError.tooMany('Too many pending bookings', 'TOO_MANY_PENDING');
  const b: any = await Booking.create({
    society: sid, space: space._id, requester: uid,
    spaceName: space.name, fee: space.fee,
    eventTitle: req.body.eventTitle, eventType: req.body.eventType,
    guestCount: req.body.guestCount, notes: req.body.notes, contactPhone: req.body.contactPhone,
    startAt, endAt, status: 'pending',
    statusHistory: [{ status: 'pending', by: uid, at: new Date() }],
  });
  sendToSociety(sid, { type: NOTIFICATION_TYPES.BOOKING_REQUESTED, title: 'New booking request', body: req.body.eventTitle, data: { screen: 'BookingDetail', params: { id: String(b._id) } } }, uid).catch(() => {});
  created(res, { booking: b });
}));

const bookingsRouter = Router({ mergeParams: true });
bookingsRouter.use(authenticate, requireMember);
bookingsRouter.get('/mine', validate({ query: z.object({ status: z.enum(['pending','approved','rejected','cancelled','completed']).optional(), when: z.enum(['upcoming','past']).optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any);
  const filter: any = { society: req.params.societyId, requester: (req as any).user._id };
  if ((req.query as any).status) filter.status = (req.query as any).status;
  if ((req.query as any).when === 'upcoming') filter.startAt = { $gte: new Date() };
  if ((req.query as any).when === 'past') filter.endAt = { $lt: new Date() };
  const total = await Booking.countDocuments(filter);
  const items = await Booking.find(filter).sort({ startAt: (req.query as any).when === 'past' ? -1 : 1 }).skip(skip).limit(limit).populate('space', 'name images').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
bookingsRouter.get('/', requireSocietyAdmin, validate({ query: z.object({ status: z.enum([...BOOKING_STATUSES, 'all']).optional(), spaceId: oid.optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any);
  const filter: any = { society: req.params.societyId };
  const q = req.query as any;
  if (q.status && q.status !== 'all') filter.status = q.status;
  if (q.spaceId) filter.space = q.spaceId;
  if (q.from) filter.startAt = { $gte: q.from };
  if (q.to) filter.startAt = { ...(filter.startAt || {}), $lte: q.to };
  const total = await Booking.countDocuments(filter);
  const items = await Booking.find(filter).sort({ status: 1, startAt: 1 }).skip(skip).limit(limit)
    .populate('requester', 'fullName phone').populate('space', 'name').lean();
  const pending = (items as any[]).filter((b) => b.status === 'pending');
  for (const b of pending) {
    b.conflictsWith = (await Booking.find({ space: b.space?._id, status: 'pending', _id: { $ne: b._id }, startAt: { $lt: b.endAt }, endAt: { $gt: b.startAt } }).select('_id').lean()).map((x: any) => x._id);
  }
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
bookingsRouter.get('/:bookingId', validate({ params: z.object({ societyId: oid, bookingId: oid }) }), asyncHandler(async (req, res) => {
  const b: any = await Booking.findOne({ _id: req.params.bookingId, society: req.params.societyId }).populate('space').lean();
  if (!b) throw ApiError.notFound();
  const me = (req as any).user._id; const isAdmin = (req as any).membership.role === 'admin';
  if (!isAdmin && String(b.requester) !== me) throw ApiError.notFound();
  ok(res, { booking: b });
}));
bookingsRouter.patch('/:bookingId/approve', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, bookingId: oid }), body: z.object({ adminNote: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const me = (req as any).user._id;
  if (!(mongoose.connection as any).startSession) throw ApiError.internal('MongoDB session not available; use a replica set');
  const session = await (mongoose.connection as any).startSession();
  try {
    let booking: any = null; let autoRejected: string[] = [];
    await session.withTransaction(async () => {
      const b: any = await Booking.findOne({ _id: req.params.bookingId, society: req.params.societyId }).session(session);
      if (!b) throw ApiError.notFound();
      if (String(b.requester) === String(me)) throw ApiError.forbidden('SELF_APPROVAL', 'Admins cannot approve their own booking');
      if (b.status !== 'pending') throw ApiError.conflict('INVALID_STATE', 'Booking not pending');
      if (b.startAt < new Date()) throw ApiError.conflict('BOOKING_EXPIRED', 'Start already passed');
      const conflict = await Booking.exists({ _id: { $ne: b._id }, space: b.space, status: 'approved', startAt: { $lt: b.endAt }, endAt: { $gt: b.startAt } }).session(session);
      const blackout = await SpaceBlackout.exists({ space: b.space, startAt: { $lt: b.endAt }, endAt: { $gt: b.startAt } }).session(session);
      if (conflict || blackout) throw ApiError.conflict('SLOT_UNAVAILABLE', 'Slot taken');
      await EventSpace.updateOne({ _id: b.space }, { $inc: { version: 1 } }, { session });
      b.status = 'approved'; b.reviewedBy = me; b.reviewedAt = new Date(); b.adminNote = req.body.adminNote;
      b.statusHistory = [...(b.statusHistory || []), { status: 'approved', by: me, at: new Date() }];
      await b.save({ session });
      booking = b;
      const others = await Booking.find({ space: b.space, status: 'pending', _id: { $ne: b._id }, startAt: { $lt: b.endAt }, endAt: { $gt: b.startAt } }).session(session);
      for (const o of others) {
        o.status = 'rejected'; o.rejectionReason = 'Slot was given to another booking'; o.reviewedBy = me; o.reviewedAt = new Date();
        await o.save({ session });
        autoRejected.push(String(o._id));
      }
    });
    await session.endSession();
    sendToUser(String(booking.requester), { type: NOTIFICATION_TYPES.BOOKING_APPROVED, title: 'Booking approved', body: booking.eventTitle, society: booking.society, data: { screen: 'BookingDetail', params: { id: String(booking._id) } } }).catch(() => {});
    audit({ society: req.params.societyId, actor: me, action: 'BOOKING_APPROVED', targetId: String(booking._id) }).catch(() => {});
    ok(res, { booking, autoRejected });
  } catch (e) { await session.endSession().catch(() => {}); throw e; }
}));
bookingsRouter.patch('/:bookingId/reject', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, bookingId: oid }), body: z.object({ reason: z.string().min(3).max(300) }).strip() }), asyncHandler(async (req, res) => {
  const me = (req as any).user._id;
  const b: any = await Booking.findOneAndUpdate({ _id: req.params.bookingId, society: req.params.societyId, status: 'pending' },
    { $set: { status: 'rejected', reviewedBy: me, reviewedAt: new Date(), rejectionReason: req.body.reason }, $push: { statusHistory: { status: 'rejected', by: me, at: new Date() } } }, { new: true });
  if (!b) throw ApiError.conflict('INVALID_STATE', 'This booking has already been reviewed.');
  sendToUser(String(b.requester), { type: NOTIFICATION_TYPES.BOOKING_REJECTED, title: 'Booking rejected', body: req.body.reason, society: b.society }).catch(() => {});
  audit({ society: req.params.societyId, actor: me, action: 'BOOKING_REJECTED', targetId: String(b._id) });
  ok(res, { booking: b });
}));
bookingsRouter.patch('/:bookingId/cancel', validate({ params: z.object({ societyId: oid, bookingId: oid }), body: z.object({ reason: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const b: any = await Booking.findOne({ _id: req.params.bookingId, society: req.params.societyId });
  if (!b) throw ApiError.notFound();
  const me = (req as any).user._id; const isAdmin = (req as any).membership.role === 'admin';
  const isOwner = String(b.requester) === String(me);
  if (!isOwner && !isAdmin) throw ApiError.forbidden('FORBIDDEN', 'Only the person who made this booking or an admin can cancel it.');
  if (!['pending','approved'].includes(b.status)) throw ApiError.conflict('INVALID_STATE', 'Only pending or approved bookings can be cancelled.');
  if (isAdmin && !isOwner && !req.body.reason) throw ApiError.badRequest('VALIDATION_ERROR', 'Reason required');
  b.status = 'cancelled'; b.cancelledBy = me; b.cancelReason = req.body.reason;
  b.statusHistory = [...(b.statusHistory || []), { status: 'cancelled', by: me, at: new Date() }];
  await b.save();
  if (!isOwner) sendToUser(String(b.requester), { type: NOTIFICATION_TYPES.BOOKING_REJECTED, title: 'Booking cancelled', body: req.body.reason || '', society: b.society }).catch(() => {});
  else if (b.wasApproved) sendToSociety(req.params.societyId, { type: NOTIFICATION_TYPES.BOOKING_REQUESTED, title: 'Booking cancelled', body: b.eventTitle }, me).catch(() => {});
  ok(res, { booking: b });
}));
export default r;
export { bookingsRouter as bookingRoutes };
