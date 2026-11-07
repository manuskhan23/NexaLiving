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

import { Carpool } from '../models/Carpool';
import { CarpoolRequest } from '../models/CarpoolRequest';
import { REQUEST_STATUSES } from '../constants/enums';
import { PK_PHONE_RE } from '../utils/phone';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

const body = z.object({
  fromLabel: z.string().min(2).max(80), toLabel: z.string().min(2).max(80),
  departureTime: z.string().max(20), returnTime: z.string().max(20).optional(),
  schedule: z.object({ type: z.enum(['once','recurring']), date: z.coerce.date().optional(), days: z.array(z.number().int().min(0).max(6)).optional() }),
  totalSeats: z.number().int().min(1).max(20), costPerSeat: z.number().int().optional(),
  vehicle: z.string().max(80).optional(), genderPreference: z.enum(['any','male','female']).default('any'),
  contactPhone: z.string().regex(PK_PHONE_RE, 'Invalid Pakistani mobile number'),
  notes: z.string().max(500).optional(),
}).strip();

r.post('/', validate({ body }), asyncHandler(async (req, res) => {
  const ride: any = await Carpool.create({ ...req.body, availableSeats: req.body.totalSeats, society: req.params.societyId, driver: (req as any).user._id, status: 'active' });
  created(res, { ride });
}));
r.get('/', validate({ query: z.object({ day: z.coerce.number().int().min(0).max(6).optional(), search: z.string().max(60).optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId, status: { $in: ['active','full'] } };
  if (q.day !== undefined) filter['schedule.days'] = q.day;
  if (q.search) filter.$or = [{ fromLabel: new RegExp(escapeRegex(q.search), 'i') }, { toLabel: new RegExp(escapeRegex(q.search), 'i') }];
  const total = await Carpool.countDocuments(filter);
  const items = await Carpool.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('driver', 'fullName avatar').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
r.get('/mine', asyncHandler(async (req, res) => {
  const items = await Carpool.find({ society: req.params.societyId, driver: (req as any).user._id }).sort({ createdAt: -1 }).lean();
  ok(res, { items });
}));
r.get('/:rideId', validate({ params: z.object({ societyId: oid, rideId: oid }) }), asyncHandler(async (req, res) => {
  const ride: any = await Carpool.findOne({ _id: req.params.rideId, society: req.params.societyId }).populate('driver', 'fullName avatar phone').lean();
  if (!ride) throw ApiError.notFound();
  ok(res, { ride });
}));
r.patch('/:rideId', validate({ params: z.object({ societyId: oid, rideId: oid }), body: body.partial() }), asyncHandler(async (req, res) => {
  const ride: any = await Carpool.findOneAndUpdate({ _id: req.params.rideId, society: req.params.societyId, driver: (req as any).user._id }, { $set: req.body }, { new: true });
  if (!ride) throw ApiError.notFound();
  ok(res, { ride });
}));
r.patch('/:rideId/cancel', validate({ params: z.object({ societyId: oid, rideId: oid }) }), asyncHandler(async (req, res) => {
  const ride: any = await Carpool.findOneAndUpdate({ _id: req.params.rideId, society: req.params.societyId, driver: (req as any).user._id }, { $set: { status: 'cancelled' } }, { new: true });
  if (!ride) throw ApiError.notFound();
  await CarpoolRequest.updateMany({ ride: ride._id, status: 'pending' }, { $set: { status: 'cancelled', reason: 'Ride cancelled' } });
  ok(res, { ride });
}));
r.post('/:rideId/requests', validate({ params: z.object({ societyId: oid, rideId: oid }), body: z.object({ seats: z.number().int().min(1).default(1), message: z.string().max(300).optional(), pickupNote: z.string().max(200).optional() }).strip() }), asyncHandler(async (req, res) => {
  const ride: any = await Carpool.findOne({ _id: req.params.rideId, society: req.params.societyId });
  if (!ride) throw ApiError.notFound();
  const me = (req as any).user._id;
  if (String(ride.driver) === String(me)) throw ApiError.badRequest('SELF_REQUEST', "You can't request a seat on your own ride.");
  if (!['active'].includes(ride.status) || ride.availableSeats < req.body.seats) throw ApiError.conflict('NOT_ENOUGH_SEATS', "This ride is no longer open or doesn't have enough free seats.");
  const dup = await CarpoolRequest.exists({ ride: ride._id, passenger: me, status: 'pending' });
  if (dup) throw ApiError.conflict('ALREADY_REQUESTED', 'You already have a pending request for this ride.');
  const req2: any = await CarpoolRequest.create({ society: req.params.societyId, ride: ride._id, driver: ride.driver, passenger: me, seats: req.body.seats, message: req.body.message, pickupNote: req.body.pickupNote });
  sendToUser(String(ride.driver), { type: NOTIFICATION_TYPES.CARPOOL_REQUEST_RECEIVED, title: 'New ride request', body: ride.fromLabel + ' -> ' + ride.toLabel, society: req.params.societyId }).catch(() => {});
  created(res, { request: req2 });
}));

const requestsRouter = Router({ mergeParams: true });
requestsRouter.use(authenticate, requireMember);
requestsRouter.get('/sent', asyncHandler(async (req, res) => {
  const items = await CarpoolRequest.find({ society: req.params.societyId, passenger: (req as any).user._id }).sort({ createdAt: -1 }).populate('ride').lean();
  ok(res, { items });
}));
requestsRouter.get('/received', asyncHandler(async (req, res) => {
  const items = await CarpoolRequest.find({ society: req.params.societyId, driver: (req as any).user._id }).sort({ createdAt: -1 }).populate('passenger', 'fullName avatar').populate('ride', 'fromLabel toLabel').lean();
  ok(res, { items });
}));
const rid = { params: z.object({ societyId: oid, requestId: oid }) };
requestsRouter.patch('/:requestId/accept', validate(rid), asyncHandler(async (req, res) => {
  const r2: any = await CarpoolRequest.findOne({ _id: req.params.requestId, driver: (req as any).user._id });
  if (!r2) throw ApiError.notFound();
  if (r2.status !== 'pending') throw ApiError.conflict('INVALID_STATE', 'This request has already been answered.');
  const ride: any = await Carpool.findOne({ _id: r2.ride, driver: (req as any).user._id });
  if (!ride) throw ApiError.notFound();
  if (ride.availableSeats < r2.seats) throw ApiError.conflict('NOT_ENOUGH_SEATS', 'Not enough free seats left on this ride to accept this request.');
  ride.availableSeats -= r2.seats;
  if (ride.availableSeats === 0) ride.status = 'full';
  await ride.save();
  r2.status = 'accepted'; r2.respondedAt = new Date(); await r2.save();
  sendToUser(String(r2.passenger), { type: NOTIFICATION_TYPES.CARPOOL_REQUEST_ACCEPTED, title: 'Ride accepted', society: r2.society }).catch(() => {});
  ok(res, { request: r2 });
}));
requestsRouter.patch('/:requestId/reject', validate(rid), asyncHandler(async (req, res) => {
  const r2: any = await CarpoolRequest.findOneAndUpdate({ _id: req.params.requestId, driver: (req as any).user._id, status: 'pending' }, { $set: { status: 'rejected', respondedAt: new Date() } }, { new: true });
  if (!r2) throw ApiError.conflict('INVALID_STATE', 'This request has already been answered.');
  sendToUser(String(r2.passenger), { type: NOTIFICATION_TYPES.CARPOOL_REQUEST_REJECTED, title: 'Ride declined', society: r2.society }).catch(() => {});
  ok(res, { request: r2 });
}));
requestsRouter.patch('/:requestId/cancel', validate(rid), asyncHandler(async (req, res) => {
  const me = (req as any).user._id;
  const r2: any = await CarpoolRequest.findOne({ _id: req.params.requestId, society: req.params.societyId });
  if (!r2) throw ApiError.notFound();
  const isPassenger = String(r2.passenger) === String(me);
  const isDriver = String(r2.driver) === String(me);
  if (!isPassenger && !isDriver) throw ApiError.notFound();
  if (!['pending','accepted'].includes(r2.status)) throw ApiError.conflict('INVALID_STATE', 'Only pending or accepted requests can be cancelled.');
  if (r2.status === 'accepted') {
    const ride: any = await Carpool.findById(r2.ride);
    if (ride) { ride.availableSeats += r2.seats; if (ride.status === 'full') ride.status = 'active'; await ride.save(); }
  }
  r2.status = 'cancelled'; await r2.save();
  ok(res, { request: r2 });
}));
export default r;
export { requestsRouter as carpoolRequestRoutes };
