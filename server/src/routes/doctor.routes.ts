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

import { Doctor } from '../models/Doctor';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);
const body = z.object({
  name: z.string().min(2).max(80), speciality: z.string().min(2).max(80),
  qualifications: z.string().max(200).optional(),
  clinicName: z.string().max(120).optional(), clinicAddress: z.string().max(300).optional(),
  phone: z.string().max(30).optional(), mapUrl: z.string().max(500).optional(),
  timings: z.array(z.object({ days: z.array(z.number().int().min(0).max(6)), from: z.string(), to: z.string() })).optional(),
  consultationFee: z.number().int().optional(),
  emergencyAvailable: z.boolean().optional(),
  photo: z.object({ url: z.string(), publicId: z.string() }).optional(),
}).strip();

r.post('/', requireSocietyAdmin, validate({ body }), asyncHandler(async (req, res) => {
  const d: any = await Doctor.create({ ...req.body, society: req.params.societyId, createdBy: (req as any).user._id });
  created(res, { doctor: d });
}));
r.get('/specialities', asyncHandler(async (req, res) => {
  const items = await Doctor.distinct('speciality', { society: req.params.societyId, isActive: true });
  ok(res, { items });
}));
r.get('/', validate({ query: z.object({ speciality: z.string().optional(), search: z.string().max(60).optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId, isActive: true };
  if (q.speciality) filter.speciality = q.speciality;
  if (q.search) filter.$or = [{ name: new RegExp(escapeRegex(q.search), 'i') }, { clinicName: new RegExp(escapeRegex(q.search), 'i') }];
  const total = await Doctor.countDocuments(filter);
  const items = await Doctor.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
r.get('/:doctorId', validate({ params: z.object({ societyId: oid, doctorId: oid }) }), asyncHandler(async (req, res) => {
  const d: any = await Doctor.findOne({ _id: req.params.doctorId, society: req.params.societyId });
  if (!d) throw ApiError.notFound();
  ok(res, { doctor: d });
}));
r.patch('/:doctorId', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, doctorId: oid }), body: body.partial() }), asyncHandler(async (req, res) => {
  const d: any = await Doctor.findOneAndUpdate({ _id: req.params.doctorId, society: req.params.societyId }, { $set: req.body }, { new: true });
  if (!d) throw ApiError.notFound();
  ok(res, { doctor: d });
}));
r.delete('/:doctorId', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, doctorId: oid }) }), asyncHandler(async (req, res) => {
  await Doctor.updateOne({ _id: req.params.doctorId, society: req.params.societyId }, { $set: { isActive: false } });
  ok(res, { message: 'Deactivated' });
}));
export default r;
