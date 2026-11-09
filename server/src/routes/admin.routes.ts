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

import { Membership } from '../models/Membership';
import { Booking } from '../models/Booking';
import { Announcement } from '../models/Announcement';
import { Item } from '../models/Item';
import { Need } from '../models/Need';
import { Rental } from '../models/Rental';
import { Report } from '../models/Report';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember, requireSocietyAdmin);

r.get('/stats', asyncHandler(async (req, res) => {
  const sid = req.params.societyId;
  const [members, active, pending, spaces, upcomingBookings, pendingBookings, announcements, items, needs, rentals, openReports] = await Promise.all([
    Membership.countDocuments({ society: sid }),
    Membership.countDocuments({ society: sid, status: 'active' }),
    Membership.countDocuments({ society: sid, status: 'pending' }),
    (await import('../models/EventSpace')).EventSpace.countDocuments({ society: sid, isActive: true }),
    Booking.countDocuments({ society: sid, status: 'approved', startAt: { $gte: new Date() } }),
    Booking.countDocuments({ society: sid, status: 'pending' }),
    Announcement.countDocuments({ society: sid, deletedAt: null }),
    Item.countDocuments({ society: sid, status: 'available', deletedAt: null }),
    Need.countDocuments({ society: sid, status: 'open' }),
    Rental.countDocuments({ society: sid, status: 'active' }),
    Report.countDocuments({ society: sid, status: 'open' }),
  ]);
  ok(res, { stats: { members, active, pendingMembers: pending, spaces, upcomingBookings, pendingBookings, announcements, items, needs, rentals, openReports } });
}));

r.get('/audit-logs', validate({ query: z.object({ action: z.string().optional(), actor: oid.optional(), page: z.coerce.number().int().default(1), limit: z.coerce.number().int().default(50) }) }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any); const q = req.query as any;
  const filter: any = { society: req.params.societyId };
  if (q.action) filter.action = q.action;
  if (q.actor) filter.actor = q.actor;
  const total = await AuditLog.countDocuments(filter);
  const items = await AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'fullName').lean();
  ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
export default r;
