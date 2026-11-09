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

import { Report } from '../models/Report';
import { Society } from '../models/Society';
import { REPORT_TARGET_TYPES, REPORT_REASONS } from '../constants/enums';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);

r.post('/', validate({ body: z.object({
  targetType: z.enum(REPORT_TARGET_TYPES), targetId: oid,
  reason: z.enum(REPORT_REASONS), details: z.string().max(1000).optional(),
}).strip() }), asyncHandler(async (req, res) => {
  const me = (req as any).user._id;
  const dup = await Report.exists({ reporter: me, targetType: req.body.targetType, targetId: req.body.targetId });
  if (dup) throw ApiError.conflict('ALREADY_REPORTED', 'You have already reported this. An admin will review it.');
  const rep: any = await Report.create({ ...req.body, society: req.params.societyId, reporter: me });
  const society: any = await Society.findById(req.params.societyId).select('settings.autoHideReportThreshold').lean();
  const threshold = society?.settings?.autoHideReportThreshold || 5;
  const count = await Report.countDocuments({ society: req.params.societyId, targetType: req.body.targetType, targetId: req.body.targetId, status: 'open' });
  if (count >= threshold) {
    await autoHide(req.body.targetType, req.body.targetId, req.params.societyId);
  }
  created(res, { report: rep });
}));

async function autoHide(targetType: string, targetId: string, societyId: string) {
  const map: any = {
    announcement: '../models/Announcement', item: '../models/Item', rental: '../models/Rental',
    service: '../models/Service', tutor: '../models/TutorProfile', need: '../models/Need',
  };
  const mod = map[targetType]; if (!mod) return;
  const model = require(mod)[Object.keys(require(mod))[0]];
  if (!model) return;
  await model.updateOne({ _id: targetId, society: societyId }, { $set: { isHidden: true, hiddenReason: 'reports_threshold' } });
}

r.get('/mine', asyncHandler(async (req, res) => {
  const items = await Report.find({ society: req.params.societyId, reporter: (req as any).user._id }).sort({ createdAt: -1 }).lean();
  ok(res, { items });
}));

r.get('/', requireSocietyAdmin, validate({ query: z.object({ status: z.enum(['open','resolved']).optional(), targetType: z.enum(REPORT_TARGET_TYPES).optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(20) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId };
  if (q.status) filter.status = q.status;
  if (q.targetType) filter.targetType = q.targetType;
  const total = await Report.countDocuments(filter);
  const items = await Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('reporter', 'fullName').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));

r.patch('/resolve', requireSocietyAdmin, validate({ body: z.object({
  reportId: oid, action: z.enum(['dismiss','warn','remove_content','suspend_user']).optional(),
  resolutionNote: z.string().max(500).optional(),
}).strip() }), asyncHandler(async (req, res) => {
  const rep: any = await Report.findOneAndUpdate({ _id: req.body.reportId, society: req.params.societyId, status: 'open' },
    { $set: { status: 'resolved', action: req.body.action, resolutionNote: req.body.resolutionNote, resolvedBy: (req as any).user._id, resolvedAt: new Date() } }, { new: true });
  if (!rep) throw ApiError.notFound();
  sendToUser(String(rep.reporter), { type: NOTIFICATION_TYPES.REPORT_RESOLVED, title: 'Report resolved', body: rep.reason, society: req.params.societyId }).catch(() => {});
  audit({ society: req.params.societyId, actor: (req as any).user._id, action: 'REPORT_RESOLVED', targetId: String(rep._id) });
  ok(res, { report: rep });
}));
export default r;
