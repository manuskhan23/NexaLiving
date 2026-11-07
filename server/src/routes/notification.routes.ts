import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok } from '../utils/respond';
import { Notification } from '../models/Notification';
import { paginate, buildMeta } from '../utils/paginate';

const r = Router();
r.use(authenticate);
r.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query as any);
  const filter: any = { user: (req as any).user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const total = await Notification.countDocuments(filter);
  const items = await Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  return ok(res, { items }, undefined, buildMeta(page, limit, total));
}));
r.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: (req as any).user._id, readAt: null });
  return ok(res, { count });
}));
r.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: (req as any).user._id, readAt: null }, { $set: { readAt: new Date() } });
  return ok(res, { message: 'All marked read' });
}));
r.patch('/:notificationId/read', asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.notificationId, user: (req as any).user._id }, { $set: { readAt: new Date() } }, { new: true });
  if (!n) throw ApiError.notFound();
  return ok(res, { notification: n });
}));
r.delete('/:notificationId', asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndDelete({ _id: req.params.notificationId, user: (req as any).user._id });
  if (!n) throw ApiError.notFound();
  return ok(res, { message: 'Deleted' });
}));
export default r;
