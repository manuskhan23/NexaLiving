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

import { AssistanceRequest } from '../models/AssistanceRequest';
import { encryptString, decryptString } from '../services/crypto.service';
import { ASSISTANCE_CATEGORIES, ASSISTANCE_URGENCY, ASSISTANCE_STATUSES } from '../constants/enums';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);
const body = z.object({
  category: z.enum(ASSISTANCE_CATEGORIES),
  urgency: z.enum(ASSISTANCE_URGENCY).default('medium'),
  preferredContact: z.string().max(60).optional(), bestTimeToContact: z.string().max(120).optional(),
  onBehalfOf: z.string().max(120).optional(),
  householdSize: z.number().int().min(1).max(20).optional(),
  details: z.string().min(1).max(5000),
}).strip();

r.post('/', validate({ body }), asyncHandler(async (req, res) => {
  const enc = encryptString(req.body.details);
  const ar: any = await AssistanceRequest.create({
    society: req.params.societyId, requester: (req as any).user._id,
    category: req.body.category, urgency: req.body.urgency,
    preferredContact: req.body.preferredContact, bestTimeToContact: req.body.bestTimeToContact,
    onBehalfOf: req.body.onBehalfOf, householdSize: req.body.householdSize,
    detailsEnc: enc, status: 'submitted',
    statusHistory: [{ status: 'submitted', by: (req as any).user._id, at: new Date() }],
  });
  sendToSociety(req.params.societyId, { type: NOTIFICATION_TYPES.ASSISTANCE_STATUS_CHANGED, title: 'New assistance request', body: req.body.category, data: { screen: 'AssistanceDetail' } }, (req as any).user._id).catch(() => {});
  created(res, { request: { _id: ar._id, category: ar.category, urgency: ar.urgency, status: ar.status } });
}));

r.get('/mine', asyncHandler(async (req, res) => {
  const items = await AssistanceRequest.find({ society: req.params.societyId, requester: (req as any).user._id }).sort({ createdAt: -1 }).select('-detailsEnc -internalNotes').lean();
  ok(res, { items });
}));

r.get('/', requireAssistanceReviewer, validate({ query: z.object({ status: z.enum(ASSISTANCE_STATUSES).optional(), urgency: z.enum(ASSISTANCE_URGENCY).optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId };
  if (q.status) filter.status = q.status;
  if (q.urgency) filter.urgency = q.urgency;
  const total = await AssistanceRequest.countDocuments(filter);
  const items = await AssistanceRequest.find(filter).sort({ urgency: -1, createdAt: -1 }).skip(skip).limit(limit).populate('requester', 'fullName').select('-detailsEnc -internalNotes').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));

r.get('/:requestId', validate({ params: z.object({ societyId: oid, requestId: oid }) }), asyncHandler(async (req, res) => {
  const isReviewer = (req as any).membership.canReviewAssistance;
  const filter: any = { _id: req.params.requestId, society: req.params.societyId };
  if (!isReviewer) filter.requester = (req as any).user._id;
  const ar: any = await AssistanceRequest.findOne(filter).populate('requester', 'fullName block').select('-internalNotes').lean();
  if (!ar) throw ApiError.notFound();
  const out: any = { ...ar };
  if (isReviewer) out.details = decryptString(ar.detailsEnc);
  delete out.detailsEnc;
  ok(res, { request: out });
}));

r.patch('/:requestId/status', requireAssistanceReviewer, validate({ params: z.object({ societyId: oid, requestId: oid }), body: z.object({ status: z.enum(ASSISTANCE_STATUSES), note: z.string().max(500).optional() }).strip() }), asyncHandler(async (req, res) => {
  const ar: any = await AssistanceRequest.findOne({ _id: req.params.requestId, society: req.params.societyId });
  if (!ar) throw ApiError.notFound();
  const allowedTransitions: any = {
    submitted: ['under_review','rejected','cancelled'],
    under_review: ['verified','rejected','cancelled'],
    verified: ['in_progress','fulfilled'],
    in_progress: ['fulfilled'],
  };
  const next = req.body.status;
  if (ar.status === next) return ok(res, { request: ar });
  if (!(allowedTransitions[ar.status] || []).includes(next)) {
    const label = (s: string) => s.replace(/_/g, ' ');
    const allowed: string[] = allowedTransitions[ar.status] || [];
    throw ApiError.conflict('INVALID_STATE', `This request is ${label(ar.status)} and can't be moved to ${label(next)}.` + (allowed.length ? ` Next step: ${allowed.map(label).join(' or ')}.` : ''));
  }
  ar.status = next;
  ar.statusHistory.push({ status: next, by: (req as any).user._id, at: new Date(), note: req.body.note });
  if (next === 'under_review' || next === 'verified' || next === 'in_progress') ar.assignedTo = (req as any).user._id;
  await ar.save();
  sendToUser(String(ar.requester), { type: NOTIFICATION_TYPES.ASSISTANCE_STATUS_CHANGED, title: 'Assistance update', body: next, society: req.params.societyId }).catch(() => {});
  audit({ society: req.params.societyId, actor: (req as any).user._id, action: 'ASSISTANCE_STATUS', targetId: String(ar._id) });
  ok(res, { request: ar });
}));

r.post('/:requestId/notes', requireAssistanceReviewer, validate({ params: z.object({ societyId: oid, requestId: oid }), body: z.object({ note: z.string().min(1).max(2000) }).strip() }), asyncHandler(async (req, res) => {
  const ar: any = await AssistanceRequest.findOne({ _id: req.params.requestId, society: req.params.societyId });
  if (!ar) throw ApiError.notFound();
  const noteEnc = encryptString(req.body.note);
  ar.internalNotes.push({ by: (req as any).user._id, noteEnc, at: new Date() });
  await ar.save();
  ok(res, { message: 'Note added' });
}));

r.patch('/:requestId/cancel', validate({ params: z.object({ societyId: oid, requestId: oid }) }), asyncHandler(async (req, res) => {
  const ar: any = await AssistanceRequest.findOne({ _id: req.params.requestId, society: req.params.societyId, requester: (req as any).user._id });
  if (!ar) throw ApiError.notFound();
  if (['fulfilled','rejected'].includes(ar.status)) throw ApiError.conflict('INVALID_STATE', 'This request is already closed and cannot be cancelled.');
  ar.status = 'cancelled'; await ar.save();
  ok(res, { request: ar });
}));
export default r;
