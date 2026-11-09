import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { requireMember } from '../middleware/requireMember';
import { requireSocietyAdmin } from '../middleware/requireSocietyAdmin';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, created } from '../utils/respond';
import { ApiError } from '../utils/ApiError';
import { EmergencyAlert } from '../models/EmergencyAlert';
import { Membership } from '../models/Membership';
import { paginate, buildMeta } from '../utils/paginate';
import { sendToSociety } from '../services/notification.service';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { audit } from '../services/audit.service';
import { alertLimiter } from '../middleware/rateLimiters';
import { ALERT_TYPES, ALERT_SEVERITIES } from '../constants/enums';

const oid = z.string().regex(/^[0-9a-fA-F]{24}$/);
const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

const createS = { body: z.object({
  type: z.enum(ALERT_TYPES), severity: z.enum(ALERT_SEVERITIES),
  title: z.string().min(3).max(80), message: z.string().min(1).max(1000),
  location: z.string().max(120).optional(),
}).strip() };

r.post('/', requireSocietyAdmin, alertLimiter, validate(createS), asyncHandler(async (req, res) => {
  const a: any = await EmergencyAlert.create({ ...req.body, society: req.params.societyId, createdBy: (req as any).user._id, status: 'active' });
  const recipients = await sendToSociety(req.params.societyId, { type: NOTIFICATION_TYPES.ALERT_SENT, title: req.body.title, body: req.body.message.slice(0, 120), data: { screen: 'AlertDetail', params: { id: String(a._id), societyId: req.params.societyId } } }, undefined).catch(() => 0);
  await audit({ society: req.params.societyId, actor: (req as any).user._id, action: 'ALERT_SENT', targetId: String(a._id) });
  created(res, { alert: a, recipients });
}));

r.get('/', validate({ query: z.object({ status: z.enum(['active','resolved']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any);
  const filter: any = { society: req.params.societyId };
  if (req.query.status) filter.status = req.query.status;
  const total = await EmergencyAlert.countDocuments(filter);
  const items = await EmergencyAlert.find(filter).sort({ status: 1, createdAt: -1 }).skip(skip).limit(limit).lean();
  const me = (req as any).user._id;
  const isAdmin = (req as any).membership.role === 'admin';
  const mapped = (items as any[]).map((a) => ({ ...a, acknowledgedByMe: (a.acknowledgements || []).some((x: any) => String(x.user) === me), ...(isAdmin ? { ackCount: (a.acknowledgements || []).length } : {}) }));
  ok(res, { items: mapped }, undefined, buildMeta(page, limit, total));
}));

r.get('/:alertId', validate({ params: z.object({ societyId: oid, alertId: oid }) }), asyncHandler(async (req, res) => {
  const a: any = await EmergencyAlert.findOne({ _id: req.params.alertId, society: req.params.societyId }).lean();
  if (!a) throw ApiError.notFound();
  const me = (req as any).user._id;
  ok(res, { alert: { ...a, acknowledgedByMe: (a.acknowledgements || []).some((x: any) => String(x.user) === me) } });
}));

r.post('/:alertId/acknowledge', validate({ params: z.object({ societyId: oid, alertId: oid }) }), asyncHandler(async (req, res) => {
  const a = await EmergencyAlert.updateOne(
    { _id: req.params.alertId, society: req.params.societyId, status: 'active', 'acknowledgements.user': { $ne: (req as any).user._id } },
    { $push: { acknowledgements: { user: (req as any).user._id, at: new Date() } } }
  );
  if (!a.matchedCount) {
    const exists = await EmergencyAlert.exists({ _id: req.params.alertId, society: req.params.societyId });
    if (!exists) throw ApiError.notFound();
    throw ApiError.conflict('INVALID_STATE', 'Alert resolved or already acked');
  }
  ok(res, { message: 'Acknowledged' });
}));

r.get('/:alertId/acknowledgements', requireSocietyAdmin, validate({ params: z.object({ societyId: oid, alertId: oid }) }), asyncHandler(async (req, res) => {
  const a: any = await EmergencyAlert.findOne({ _id: req.params.alertId, society: req.params.societyId }).populate('acknowledgements.user', 'fullName block').lean();
  if (!a) throw ApiError.notFound();
  const active = await Membership.countDocuments({ society: req.params.societyId, status: 'active' });
  const acked = (a.acknowledgements || []).map((x: any) => ({ user: x.user, at: x.at }));
  ok(res, { acknowledged: acked, pendingCount: active - acked.length });
}));

r.patch('/:alertId/resolve', requireSocietyAdmin, validate({
  params: z.object({ societyId: oid, alertId: oid }),
  body: z.object({ resolutionNote: z.string().min(1).max(500) }).strip(),
}), asyncHandler(async (req, res) => {
  const a: any = await EmergencyAlert.findOneAndUpdate(
    { _id: req.params.alertId, society: req.params.societyId, status: 'active' },
    { $set: { status: 'resolved', resolvedBy: (req as any).user._id, resolvedAt: new Date(), resolutionNote: req.body.resolutionNote } },
    { new: true }
  );
  if (!a) throw ApiError.conflict('INVALID_STATE', 'Alert not active');
  sendToSociety(req.params.societyId, { type: NOTIFICATION_TYPES.ALERT_RESOLVED, title: 'Alert resolved', body: a.title }).catch(() => {});
  await audit({ society: req.params.societyId, actor: (req as any).user._id, action: 'ALERT_RESOLVED', targetId: String(a._id) });
  ok(res, { alert: a });
}));

export default r;
