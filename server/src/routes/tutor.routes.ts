import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/authenticate';
import { requireMember } from '../middleware/requireMember';
import { requireSocietyAdmin } from '../middleware/requireSocietyAdmin';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, created } from '../utils/respond';
import { ApiError } from '../utils/ApiError';
import { TutorProfile } from '../models/TutorProfile';
import { TutorRequest } from '../models/TutorRequest';
import { Membership } from '../models/Membership';
import { User } from '../models/User';
import { paginate, buildMeta } from '../utils/paginate';
import { escapeRegex } from '../utils/escapeRegex';
import { sendToUser } from '../services/notification.service';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { audit } from '../services/audit.service';
import { TUTOR_SUBJECTS, TUTOR_GRADES, TEACHING_MODES, FEE_UNITS, REQUEST_STATUSES } from '../constants/enums';
import { PK_PHONE_RE } from '../utils/phone';

const oid = z.string().regex(/^[0-9a-fA-F]{24}$/);
const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

const profileFields = z.object({
  headline: z.string().min(5).max(80),
  bio: z.string().max(1000),
  qualifications: z.string().max(300),
  phone: z.string().regex(PK_PHONE_RE, 'Invalid Pakistani mobile number'),
  whatsapp: z.string().regex(PK_PHONE_RE, 'Invalid Pakistani mobile number').optional().or(z.literal('')),
  subjects: z.array(z.enum(TUTOR_SUBJECTS)).min(1).max(10),
  grades: z.array(z.enum(TUTOR_GRADES)).min(1),
  teachingMode: z.array(z.enum(TEACHING_MODES)).min(1),
  availability: z.array(z.object({ day: z.number().int().min(0).max(6), from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/) })).max(14),
  feeMin: z.number().int().min(0), feeMax: z.number().int().min(0),
  feeUnit: z.enum(FEE_UNITS),
  experienceYears: z.number().int().min(0).max(50),
  photo: z.object({ url: z.string(), publicId: z.string() }),
});
const feeOrder = { message: "Minimum fee can't be more than the maximum fee.", path: ['feeMin'] };
const feesInOrder = (v: { feeMin?: number; feeMax?: number }) => !v.feeMin || !v.feeMax || v.feeMin <= v.feeMax;
const profileBody = profileFields.refine(feesInOrder, feeOrder);

r.post('/profile', validate({ body: profileBody }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId;
  const uid = (req as any).user._id;
  const exists = await TutorProfile.exists({ society: sid, user: uid });
  if (exists) throw ApiError.conflict('PROFILE_EXISTS', 'You already have a tutor profile');
  const t: any = await TutorProfile.create({ ...req.body, society: sid, user: uid, isActive: true, isVerified: false });
  await Membership.updateOne({ user: uid, society: sid }, { $set: { isTutor: true } });
  created(res, { tutor: t });
}));

r.get('/', validate({ query: z.object({
  subject: z.enum(TUTOR_SUBJECTS).optional(), grade: z.enum(TUTOR_GRADES).optional(),
  mode: z.enum(TEACHING_MODES).optional(), day: z.coerce.number().int().min(0).max(6).optional(),
  maxFee: z.coerce.number().int().optional(), verifiedOnly: z.enum(['true','false']).optional(),
  search: z.string().max(60).optional(), sort: z.enum(['newest','fee_low','experience']).default('newest'),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
}) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any);
  const q = req.query as any;
  const filter: any = { society: req.params.societyId, isActive: true, isHidden: false, deletedAt: null };
  if (q.subject) filter.subjects = q.subject;
  if (q.grade) filter.grades = q.grade;
  if (q.mode) filter.teachingMode = q.mode;
  if (q.day !== undefined) filter['availability.day'] = q.day;
  if (q.maxFee) filter.feeMin = { $lte: q.maxFee };
  if (q.verifiedOnly === 'true') filter.isVerified = true;
  if (q.search) filter.$or = [{ headline: new RegExp(escapeRegex(q.search), 'i') }, { bio: new RegExp(escapeRegex(q.search), 'i') }];
  const sortMap: any = { newest: { createdAt: -1 }, fee_low: { feeMin: 1 }, experience: { experienceYears: -1 } };
  const total = await TutorProfile.countDocuments(filter);
  const items = await TutorProfile.find(filter).sort({ isVerified: -1, ...sortMap[q.sort] }).skip(skip).limit(limit).populate('user', 'fullName avatar').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));

r.get('/me', asyncHandler(async (req, res) => {
  const t: any = await TutorProfile.findOne({ society: req.params.societyId, user: (req as any).user._id }).lean();
  if (!t) throw ApiError.notFound();
  const pending = await TutorRequest.countDocuments({ tutor: t._id, status: 'pending' });
  const accepted = await TutorRequest.countDocuments({ tutor: t._id, status: 'accepted' });
  ok(res, { tutor: { ...t, pendingCount: pending, acceptedCount: accepted } });
}));

r.patch('/me', validate({ body: profileFields.partial().strip().refine(feesInOrder, feeOrder) }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const uid = (req as any).user._id;
  const t: any = await TutorProfile.findOne({ society: sid, user: uid });
  if (!t) throw ApiError.notFound();
  Object.assign(t, req.body);
  if (t.isVerified && (req.body.subjects || req.body.qualifications)) {
    t.isVerified = false;
    const admins = await Membership.find({ society: sid, role: 'admin', status: 'active' }).select('user').lean();
    for (const a of admins as any[]) sendToUser(String(a.user), { type: NOTIFICATION_TYPES.TUTOR_VERIFIED, title: 'Tutor re-verification needed', body: t.headline, society: sid }).catch(() => {});
  }
  await t.save();
  ok(res, { tutor: t });
}));

r.patch('/me/status', validate({ body: z.object({ isActive: z.boolean() }).strip() }), asyncHandler(async (req, res) => {
  const t = await TutorProfile.findOneAndUpdate({ society: req.params.societyId, user: (req as any).user._id }, { $set: { isActive: req.body.isActive } }, { new: true });
  if (!t) throw ApiError.notFound();
  ok(res, { tutor: t });
}));

r.delete('/me', asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const uid = (req as any).user._id;
  const t: any = await TutorProfile.findOne({ society: sid, user: uid });
  if (!t) throw ApiError.notFound();
  await TutorRequest.updateMany({ tutor: t._id, status: 'pending' }, { $set: { status: 'rejected', reason: 'Tutor profile removed' } });
  await TutorProfile.deleteOne({ _id: t._id });
  await Membership.updateOne({ user: uid, society: sid }, { $set: { isTutor: false } });
  ok(res, { message: 'Deleted' });
}));

r.patch('/:tutorId/verify', requireSocietyAdmin, validate({
  params: z.object({ societyId: oid, tutorId: oid }),
  body: z.object({ isVerified: z.boolean(), verificationNote: z.string().max(300).optional() }).strip(),
}), asyncHandler(async (req, res) => {
  const t: any = await TutorProfile.findOne({ _id: req.params.tutorId, society: req.params.societyId });
  if (!t) throw ApiError.notFound();
  if (String(t.user) === (req as any).user._id) throw ApiError.forbidden('SELF_APPROVAL', 'Cannot verify yourself');
  if (req.body.isVerified && !req.body.verificationNote) throw ApiError.badRequest('VALIDATION_ERROR', 'Note required');
  t.isVerified = req.body.isVerified;
  if (req.body.isVerified) { t.verifiedBy = (req as any).user._id; t.verifiedAt = new Date(); t.verificationNote = req.body.verificationNote; }
  await t.save();
  sendToUser(String(t.user), { type: NOTIFICATION_TYPES.TUTOR_VERIFIED, title: req.body.isVerified ? 'You are verified' : 'Your verification was removed', body: t.headline, society: req.params.societyId }).catch(() => {});
  await audit({ society: req.params.societyId, actor: (req as any).user._id, action: 'TUTOR_VERIFY', targetId: String(t._id) });
  ok(res, { tutor: t });
}));

r.get('/:tutorId', validate({ params: z.object({ societyId: oid, tutorId: oid }) }), asyncHandler(async (req, res) => {
  const t: any = await TutorProfile.findOne({ _id: req.params.tutorId, society: req.params.societyId, isActive: true }).populate('user', 'fullName avatar').lean();
  if (!t) throw ApiError.notFound();
  const myRequest: any = await TutorRequest.findOne({ tutor: t._id, requester: (req as any).user._id }).sort({ createdAt: -1 }).lean();
  ok(res, { tutor: t, myRequest });
}));

r.post('/:tutorId/requests', validate({ params: z.object({ societyId: oid, tutorId: oid }), body: z.object({
  studentName: z.string().min(2).max(60), grade: z.enum(TUTOR_GRADES),
  subjects: z.array(z.string()).min(1),
  preferredMode: z.enum(TEACHING_MODES),
  preferredDays: z.array(z.number().int().min(0).max(6)).optional(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  message: z.string().max(500).optional(),
}).strip() }), asyncHandler(async (req, res) => {
  const sid = req.params.societyId; const uid = (req as any).user._id;
  const t: any = await TutorProfile.findOne({ _id: req.params.tutorId, society: sid, isActive: true });
  if (!t) throw ApiError.notFound();
  if (String(t.user) === uid) throw ApiError.badRequest('SELF_REQUEST', 'Cannot request yourself');
  const dup = await TutorRequest.exists({ tutor: t._id, requester: uid, status: 'pending' });
  if (dup) throw ApiError.conflict('ALREADY_REQUESTED', 'You already have a pending request');
  const count = await TutorRequest.countDocuments({ requester: uid, society: sid, status: 'pending' });
  if (count >= 10) throw ApiError.tooMany('Too many pending requests');
  const req2: any = await TutorRequest.create({
    society: sid, tutor: t._id, tutorUser: t.user, requester: uid,
    studentName: req.body.studentName, grade: req.body.grade, subjects: req.body.subjects,
    preferredMode: req.body.preferredMode, preferredDays: req.body.preferredDays,
    preferredTime: req.body.preferredTime, message: req.body.message, status: 'pending',
  });
  sendToUser(String(t.user), { type: NOTIFICATION_TYPES.TUTOR_REQUEST_RECEIVED, title: 'New tutoring request', body: req.body.studentName, society: sid, data: { screen: 'TutorRequests', params: { societyId: sid } } }).catch(() => {});
  created(res, { request: req2 });
}));

r.get('/tutor-requests-removed/sent', asyncHandler(async (_req, res) => ok(res, { items: [] })));

export default r;

const requestsRouter = Router({ mergeParams: true });
requestsRouter.use(authenticate, requireMember);
requestsRouter.get('/sent', validate({ query: z.object({ status: z.enum(REQUEST_STATUSES).optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any);
  const filter: any = { society: req.params.societyId, requester: (req as any).user._id };
  if (req.query.status) filter.status = req.query.status;
  const total = await TutorRequest.countDocuments(filter);
  const items = await TutorRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
    .populate('tutor', 'headline').populate('tutorUser', 'fullName avatar phone').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
requestsRouter.get('/received', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any);
  const filter: any = { society: req.params.societyId, tutorUser: (req as any).user._id };
  if ((req.query as any).status) filter.status = (req.query as any).status;
  const total = await TutorRequest.countDocuments(filter);
  const items = await TutorRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
    .populate('requester', 'fullName avatar').populate('tutor', 'headline').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
const rid = { params: z.object({ societyId: oid, requestId: oid }) };
requestsRouter.patch('/:requestId/accept', validate({ ...rid, body: z.object({ responseMessage: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const r2: any = await TutorRequest.findOneAndUpdate({ _id: req.params.requestId, tutorUser: (req as any).user._id, status: 'pending' }, { $set: { status: 'accepted', responseMessage: req.body.responseMessage, respondedAt: new Date() } }, { new: true });
  if (!r2) throw ApiError.conflict('INVALID_STATE', 'Request not pending');
  const tutor: any = await User.findById(r2.tutorUser).select('phone').lean();
  sendToUser(String(r2.requester), { type: NOTIFICATION_TYPES.TUTOR_REQUEST_ACCEPTED, title: 'Tutor accepted', body: r2.studentName, society: r2.society, data: { screen: 'TutorRequests' } }).catch(() => {});
  ok(res, { request: r2, contact: { phone: tutor?.phone } });
}));
requestsRouter.patch('/:requestId/reject', validate({ ...rid, body: z.object({ reason: z.string().max(300).optional() }).strip() }), asyncHandler(async (req, res) => {
  const r2: any = await TutorRequest.findOneAndUpdate({ _id: req.params.requestId, tutorUser: (req as any).user._id, status: 'pending' }, { $set: { status: 'rejected', reason: req.body.reason, respondedAt: new Date() } }, { new: true });
  if (!r2) throw ApiError.conflict('INVALID_STATE', 'This request has already been answered.');
  sendToUser(String(r2.requester), { type: NOTIFICATION_TYPES.TUTOR_REQUEST_REJECTED, title: 'Tutor declined', body: r2.studentName, society: r2.society }).catch(() => {});
  ok(res, { request: r2 });
}));
requestsRouter.patch('/:requestId/cancel', validate(rid), asyncHandler(async (req, res) => {
  const r2: any = await TutorRequest.findOneAndUpdate({ _id: req.params.requestId, requester: (req as any).user._id, status: 'pending' }, { $set: { status: 'cancelled' } }, { new: true });
  if (!r2) throw ApiError.conflict('INVALID_STATE', 'Only pending requests can be cancelled.');
  ok(res, { request: r2 });
}));
export { requestsRouter as tutorRequestsRouter };
