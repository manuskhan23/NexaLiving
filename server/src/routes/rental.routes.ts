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

import { Rental } from '../models/Rental';
import { RentalInquiry } from '../models/RentalInquiry';
import { Society } from '../models/Society';
import { PROPERTY_TYPES, FURNISHING, PREFERRED_TENANTS, CONTACT_PREFERENCES, RENTAL_STATUSES } from '../constants/enums';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

const body = z.object({
  title: z.string().min(5).max(100),
  propertyType: z.enum(PROPERTY_TYPES),
  monthlyRent: z.number().int().min(0),
  securityDeposit: z.number().int().optional(),
  advanceMonths: z.number().int().min(0).max(12).optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  areaSqft: z.number().optional(), areaSqYards: z.number().optional(),
  furnishing: z.enum(FURNISHING).optional(),
  features: z.array(z.string()).optional(),
  images: z.array(z.object({ url: z.string(), publicId: z.string() })).min(1).max(10),
  block: z.string().max(20).optional(), streetLabel: z.string().max(60).optional(),
  availableFrom: z.coerce.date().optional(),
  contactPreference: z.enum(CONTACT_PREFERENCES).default('in_app'),
  preferredTenants: z.enum(PREFERRED_TENANTS).default('any'),
  description: z.string().max(2000).optional(),
}).strip();

r.post('/', validate({ body }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const society: any = await Society.findById(sid).select('settings').lean();
  const status = society?.settings?.requireListingApproval ? 'pending_review' : 'active';
  const rental: any = await Rental.create({ ...req.body, society: sid, owner: (req as any).user._id, status });
  if (status === 'pending_review') sendToSociety(sid, { type: NOTIFICATION_TYPES.RENTAL_INQUIRY_RECEIVED, title: 'New listing awaiting review', body: req.body.title }, (req as any).user._id).catch(() => {});
  created(res, { rental });
}));
r.get('/', validate({ query: z.object({ propertyType: z.enum(PROPERTY_TYPES).optional(), minRent: z.coerce.number().int().optional(), maxRent: z.coerce.number().int().optional(), bedrooms: z.coerce.number().int().optional(), furnishing: z.enum(FURNISHING).optional(), block: z.string().optional(), availableBy: z.coerce.date().optional(), preferredTenants: z.enum(PREFERRED_TENANTS).optional(), sort: z.enum(['newest','rent_low','rent_high']).default('newest'), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId, status: 'active', isHidden: false };
  for (const k of ['propertyType','furnishing','block','preferredTenants']) if (q[k]) filter[k] = q[k];
  if (q.minRent || q.maxRent) filter.monthlyRent = { ...(q.minRent ? { $gte: q.minRent } : {}), ...(q.maxRent ? { $lte: q.maxRent } : {}) };
  if (q.bedrooms) filter.bedrooms = { $gte: q.bedrooms };
  if (q.availableBy) filter.availableFrom = { $lte: q.availableBy };
  const sortMap: any = { newest: { createdAt: -1 }, rent_low: { monthlyRent: 1 }, rent_high: { monthlyRent: -1 } };
  const total = await Rental.countDocuments(filter);
  const items = await Rental.find(filter).sort(sortMap[q.sort]).skip(skip).limit(limit).populate('owner', 'fullName avatar').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
r.get('/mine', asyncHandler(async (req, res) => {
  const items = await Rental.find({ society: req.params.societyId, owner: (req as any).user._id }).sort({ createdAt: -1 }).lean();
  ok(res, { items });
}));
r.get('/:rentalId', validate({ params: z.object({ societyId: oid, rentalId: oid }) }), asyncHandler(async (req, res) => {
  const rental: any = await Rental.findOneAndUpdate({ _id: req.params.rentalId, society: req.params.societyId }, { $inc: { viewCount: 1 } }, { new: true }).populate('owner', 'fullName avatar phone').lean();
  if (!rental) throw ApiError.notFound();
  ok(res, { rental });
}));
r.patch('/:rentalId', validate({ params: z.object({ societyId: oid, rentalId: oid }), body: body.omit({ images: true, title: true, propertyType: true, monthlyRent: true }).partial() }), asyncHandler(async (req, res) => {
  const rental: any = await Rental.findOne({ _id: req.params.rentalId, society: req.params.societyId, owner: (req as any).user._id });
  if (!rental) throw ApiError.notFound();
  Object.assign(rental, req.body); await rental.save();
  ok(res, { rental });
}));
r.patch('/:rentalId/status', validate({ params: z.object({ societyId: oid, rentalId: oid }), body: z.object({ status: z.enum(['active','paused','rented']) }).strip() }), asyncHandler(async (req, res) => {
  const rental: any = await Rental.findOne({ _id: req.params.rentalId, society: req.params.societyId, owner: (req as any).user._id });
  if (!rental) throw ApiError.notFound();
  if (['pending_review','rejected'].includes(rental.status) && req.body.status === 'active') throw ApiError.conflict('INVALID_STATE', 'This listing must be approved by an admin before it can go live.');
  rental.status = req.body.status; await rental.save();
  ok(res, { rental });
}));
r.delete('/:rentalId', validate({ params: z.object({ societyId: oid, rentalId: oid }) }), asyncHandler(async (req, res) => {
  const isAdmin = (req as any).membership.role === 'admin';
  const filter: any = { _id: req.params.rentalId, society: req.params.societyId };
  if (!isAdmin) filter.owner = (req as any).user._id;
  await Rental.findOneAndUpdate(filter, { $set: { deletedAt: new Date() } });
  ok(res, { message: 'Deleted' });
}));
r.patch('/:rentalId/review', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, rentalId: oid }), body: z.object({ approved: z.boolean(), note: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const rental: any = await Rental.findOneAndUpdate({ _id: req.params.rentalId, society: req.params.societyId, status: 'pending_review' },
    { $set: { status: req.body.approved ? 'active' : 'rejected', reviewNote: req.body.note, isVerified: req.body.approved } }, { new: true });
  if (!rental) throw ApiError.conflict('INVALID_STATE', 'This listing has already been reviewed.');
  sendToUser(String(rental.owner), { type: req.body.approved ? NOTIFICATION_TYPES.RENTAL_APPROVED : NOTIFICATION_TYPES.RENTAL_REJECTED, title: 'Listing ' + (req.body.approved ? 'approved' : 'rejected'), body: rental.title, society: req.params.societyId }).catch(() => {});
  audit({ society: req.params.societyId, actor: (req as any).user._id, action: 'RENTAL_REVIEWED', targetId: String(rental._id) });
  ok(res, { rental });
}));
r.post('/:rentalId/inquiries', validate({ params: z.object({ societyId: oid, rentalId: oid }), body: z.object({ message: z.string().min(1).max(500), visitPreference: z.string().max(120).optional() }).strip() }), asyncHandler(async (req, res) => {
  const rental: any = await Rental.findOne({ _id: req.params.rentalId, society: req.params.societyId, status: 'active' });
  if (!rental) throw ApiError.notFound();
  const me = (req as any).user._id;
  if (String(rental.owner) === String(me)) throw ApiError.badRequest('SELF_REQUEST', "You can't send an inquiry about your own listing.");
  const dup = await RentalInquiry.exists({ rental: rental._id, inquirer: me });
  if (dup) throw ApiError.conflict('ALREADY_REQUESTED', 'You have already sent an inquiry about this listing.');
  const inq: any = await RentalInquiry.create({ society: req.params.societyId, rental: rental._id, owner: rental.owner, inquirer: me, message: req.body.message, visitPreference: req.body.visitPreference });
  sendToUser(String(rental.owner), { type: NOTIFICATION_TYPES.RENTAL_INQUIRY_RECEIVED, title: 'New inquiry', body: rental.title, society: req.params.societyId }).catch(() => {});
  created(res, { inquiry: inq });
}));
r.get('/:rentalId/inquiries', validate({ params: z.object({ societyId: oid, rentalId: oid }) }), asyncHandler(async (req, res) => {
  const rental: any = await Rental.findOne({ _id: req.params.rentalId, owner: (req as any).user._id, society: req.params.societyId });
  if (!rental) throw ApiError.notFound();
  const items = await RentalInquiry.find({ rental: rental._id }).populate('inquirer', 'fullName avatar phone').lean();
  ok(res, { items });
}));
export default r;
