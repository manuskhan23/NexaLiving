import { Announcement } from '../models/Announcement';
import { Membership } from '../models/Membership';
import { ApiError } from '../utils/ApiError';
import { paginate, buildMeta } from '../utils/paginate';
import { escapeRegex } from '../utils/escapeRegex';
import { sendToSociety } from './notification.service';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { audit } from './audit.service';

export async function list(societyId: string, q: any, viewerId: string, isAdmin: boolean) {
  const { page, limit, skip } = paginate(q);
  const filter: any = { society: societyId, deletedAt: null };
  const and: any[] = [];
  if (!isAdmin && q.includeExpired !== 'true') and.push({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
  if (q.category) filter.category = q.category;
  if (q.search) and.push({ $or: [{ title: new RegExp(escapeRegex(q.search), 'i') }, { body: new RegExp(escapeRegex(q.search), 'i') }] });
  if (and.length) filter.$and = and;
  const total = await Announcement.countDocuments(filter);
  const items = await Announcement.find(filter).sort({ isPinned: -1, publishedAt: -1 }).skip(skip).limit(limit)
    .populate('createdBy', 'fullName avatar').lean();
  const mapped = (items as any[]).map((a) => ({ ...a, isRead: Array.isArray(a.readBy) && a.readBy.some((r: any) => String(r) === viewerId), ...(isAdmin ? { readCount: (a.readBy || []).length } : {}) }));
  return { items: mapped, meta: buildMeta(page, limit, total) };
}

export async function getOne(societyId: string, id: string, viewerId: string) {
  const a: any = await Announcement.findOneAndUpdate(
    { _id: id, society: societyId, deletedAt: null },
    { $addToSet: { readBy: viewerId } },
    { new: true }
  ).populate('createdBy', 'fullName avatar').lean();
  if (!a) throw ApiError.notFound();
  return { ...a, isRead: true };
}

export async function create(societyId: string, input: any, adminId: string) {
  const a: any = await Announcement.create({
    society: societyId, title: input.title, body: input.body, category: input.category,
    images: input.images, attachments: input.attachments, isPinned: input.isPinned,
    expiresAt: input.expiresAt, createdBy: adminId, publishedAt: new Date(),
  });
  if (input.notify) {
    sendToSociety(societyId, { type: NOTIFICATION_TYPES.ANNOUNCEMENT, title: input.title, body: (input.body || '').slice(0, 120), society: societyId, data: { screen: 'AnnouncementDetail', params: { id: String(a._id), societyId } } }, adminId, 'announcements').catch(() => {});
  }
  return a;
}

export async function update(societyId: string, id: string, patch: any, adminId: string) {
  const a: any = await Announcement.findOneAndUpdate(
    { _id: id, society: societyId, deletedAt: null },
    { $set: { ...patch, editedAt: new Date() } }, { new: true }
  );
  if (!a) throw ApiError.notFound();
  await audit({ society: societyId, actor: adminId, action: 'ANNOUNCEMENT_UPDATED', targetId: id });
  return a;
}

export async function pin(societyId: string, id: string, isPinned: boolean, adminId: string) {
  if (isPinned) {
    const count = await Announcement.countDocuments({ society: societyId, isPinned: true, deletedAt: null });
    if (count >= 3) throw ApiError.conflict('PIN_LIMIT', 'Max 3 pinned');
  }
  const a: any = await Announcement.findOneAndUpdate({ _id: id, society: societyId, deletedAt: null }, { $set: { isPinned } }, { new: true });
  if (!a) throw ApiError.notFound();
  await audit({ society: societyId, actor: adminId, action: 'ANNOUNCEMENT_PIN', targetId: id });
  return a;
}

export async function remove(societyId: string, id: string, adminId: string) {
  const a: any = await Announcement.findOneAndUpdate(
    { _id: id, society: societyId, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: adminId } }, { new: false }
  );
  if (!a) throw ApiError.notFound();
  await audit({ society: societyId, actor: adminId, action: 'ANNOUNCEMENT_DELETED', targetId: id });
}
