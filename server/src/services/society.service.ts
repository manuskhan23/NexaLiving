import { Society } from '../models/Society';
import { Membership } from '../models/Membership';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { generateJoinCode } from './crypto.service';
import { audit } from './audit.service';
import { sendToUser } from './notification.service';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { escapeRegex } from '../utils/escapeRegex';
import { paginate, buildMeta } from '../utils/paginate';

export async function createSociety(userId: string, input: any) {
  const dup = await Society.exists({ createdBy: userId, name: new RegExp('^' + escapeRegex(String(input.name).trim()) + '$', 'i') });
  if (dup) throw ApiError.conflict('SOCIETY_EXISTS', 'You already created a society with this name');
  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const slug = String(input.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + joinCode.toLowerCase();
      const s: any = await Society.create({ ...input, joinCode, slug, createdBy: userId });
      const m: any = await Membership.create({
        user: userId, society: s._id, role: 'admin', status: 'active',
        canReviewAssistance: true, approvedBy: userId, approvedAt: new Date(),
      });
      await audit({ society: String(s._id), actor: userId, action: 'SOCIETY_CREATED' });
      return { society: s, membership: m };
    } catch (e: any) {
      if (e.code === 11000 && e.message.includes('joinCode')) { joinCode = generateJoinCode(); continue; }
      throw e;
    }
  }
  throw ApiError.internal('Could not generate a unique join code');
}

export async function mySocieties(userId: string) {
  const list = await Membership.find({ user: userId, status: { $ne: 'removed' } }).populate('society', '_id name area city coverImage').lean();
  return list.map((m: any) => ({ membership: { _id: m._id, role: m.role, status: m.status, block: m.block, unitLabel: m.unitLabel }, society: m.society }));
}

export async function lookup(code: string) {
  const s: any = await Society.findOne({ joinCode: code.toUpperCase(), isActive: true }).lean();
  if (!s) throw ApiError.notFound();
  const memberCount = await Membership.countDocuments({ society: s._id, status: 'active' });
  return { _id: s._id, name: s.name, area: s.area, city: s.city, coverImage: s.coverImage, blocks: s.blocks, memberCount };
}

export async function join(userId: string, input: any) {
  const s: any = await Society.findOne({ joinCode: input.joinCode.toUpperCase(), isActive: true });
  if (!s) throw ApiError.notFound();
  if (Array.isArray(s.blocks) && s.blocks.length && !s.blocks.includes(input.block))
    throw ApiError.badRequest('VALIDATION_ERROR', 'Unknown block');
  const existing: any = await Membership.findOne({ user: userId, society: s._id });
  if (existing) {
    if (['active', 'pending'].includes(existing.status)) throw ApiError.conflict('ALREADY_MEMBER', 'You already have a membership');
    if (['removed', 'suspended'].includes(existing.status)) throw ApiError.forbidden('JOIN_BLOCKED', 'You cannot re-join this society');
    // Re-joining after leaving/rejection starts over as a plain resident awaiting approval.
    existing.status = 'pending'; existing.block = input.block; existing.unitLabel = input.unitLabel;
    existing.residentType = input.residentType; existing.note = input.note;
    existing.role = 'resident'; existing.canReviewAssistance = false; existing.isVerifiedResident = false;
    existing.approvedBy = undefined; existing.approvedAt = undefined; existing.rejectionReason = undefined;
    await existing.save();
    notifyAdmins(String(s._id), userId, String(s._id));
    return existing;
  }
  const m: any = await Membership.create({
    user: userId, society: s._id, role: 'resident', status: 'pending',
    block: input.block, unitLabel: input.unitLabel, residentType: input.residentType, note: input.note,
  });
  notifyAdmins(String(s._id), userId, String(s._id));
  return m;
}

async function notifyAdmins(societyId: string, applicantId: string, sid: string) {
  const admins = await Membership.find({ society: societyId, role: 'admin', status: 'active' }).select('user').lean();
  const applicant: any = await User.findById(applicantId).select('fullName').lean();
  for (const a of admins as any[]) {
    sendToUser(String(a.user), {
      type: NOTIFICATION_TYPES.MEMBER_JOIN_REQUEST, title: 'New join request',
      body: (applicant && applicant.fullName) + ' wants to join', society: sid,
      data: { screen: 'PendingMembers', params: { societyId } },
    }).catch(() => {});
  }
}

export async function getSociety(societyId: string, membership: any) {
  const s: any = await Society.findById(societyId).lean();
  if (!s) throw ApiError.notFound();
  if (membership.role !== 'admin') { delete s.joinCode; delete s.settings; }
  return s;
}

export async function updateSociety(societyId: string, patch: any, actor: string) {
  const s = await Society.findByIdAndUpdate(societyId, { $set: patch }, { new: true });
  if (!s) throw ApiError.notFound();
  await audit({ society: societyId, actor, action: 'SOCIETY_UPDATED', meta: { fields: Object.keys(patch) } });
  return s;
}

export async function updateSettings(societyId: string, patch: any, actor: string) {
  const set: any = {};
  for (const [k, v] of Object.entries(patch)) set['settings.' + k] = v;
  const s = await Society.findByIdAndUpdate(societyId, { $set: set }, { new: true });
  if (!s) throw ApiError.notFound();
  await audit({ society: societyId, actor, action: 'SOCIETY_SETTINGS_UPDATED' });
  return s.settings;
}

export async function regenerateJoinCode(societyId: string, actor: string) {
  const code = generateJoinCode();
  await Society.updateOne({ _id: societyId }, { $set: { joinCode: code } });
  await audit({ society: societyId, actor, action: 'JOIN_CODE_REGENERATED' });
  return code;
}

export async function listMembers(societyId: string, q: any) {
  const { page, limit, skip } = paginate(q);
  const filter: any = { society: societyId };
  if (q.status) filter.status = q.status;
  if (q.role) filter.role = q.role;
  if (q.block) filter.block = q.block;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    const users = await User.find({ $or: [{ fullName: rx }, { email: rx }, { phone: rx }] }).select('_id').lean();
    filter.user = { $in: users.map((u: any) => u._id) };
  }
  const total = await Membership.countDocuments(filter);
  const items = await Membership.find(filter).sort({ status: 1, createdAt: 1 }).skip(skip).limit(limit)
    .populate('user', 'fullName email phone avatar').lean();
  return { items, meta: buildMeta(page, limit, total) };
}

export async function listDirectory(societyId: string, q: any, viewerId: string) {
  const { page, limit, skip } = paginate(q);
  const filter: any = { society: societyId, status: 'active' };
  if (q.block) filter.block = q.block;
  let query = Membership.find(filter).populate({
    path: 'user', match: { showInDirectory: true, deletedAt: null },
    select: 'fullName avatar skills showPhoneInDirectory phone',
  });
  let items: any[] = (await query.lean()) as any[];
  items = items.filter((m) => m.user && String(m.user._id) !== viewerId);
  if (q.skill) items = items.filter((m) => (m.user.skills || []).some((s: string) => s.toLowerCase().includes(q.skill.toLowerCase())));
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    items = items.filter((m) => rx.test(m.user.fullName));
  }
  const total = items.length;
  items = items.slice(skip, skip + limit).map((m: any) => ({
    userId: m.user._id, fullName: m.user.fullName, avatar: m.user.avatar,
    block: m.block, skills: m.user.skills,
    isVerifiedResident: m.isVerifiedResident, isTutor: m.isTutor, isServiceProvider: m.isServiceProvider,
    phone: m.user.showPhoneInDirectory ? m.user.phone : undefined,
  }));
  return { items, meta: buildMeta(page, limit, total) };
}

export async function approveMembership(societyId: string, membershipId: string, adminId: string, markVerified?: boolean) {
  const m: any = await Membership.findOneAndUpdate(
    { _id: membershipId, society: societyId, status: 'pending' },
    { $set: { status: 'active', approvedBy: adminId, approvedAt: new Date(), ...(markVerified ? { isVerifiedResident: true, verifiedBy: adminId, verifiedAt: new Date() } : {}) } },
    { new: true }
  );
  if (!m) {
    const exists = await Membership.exists({ _id: membershipId, society: societyId });
    if (!exists) throw ApiError.notFound();
    throw ApiError.conflict('INVALID_STATE', 'Membership not pending');
  }
  sendToUser(String(m.user), { type: NOTIFICATION_TYPES.MEMBERSHIP_APPROVED, title: 'Welcome!', body: 'Your membership is approved', society: societyId, data: { screen: 'Home' } }).catch(() => {});
  await audit({ society: societyId, actor: adminId, action: 'MEMBERSHIP_APPROVED', targetId: membershipId });
  return m;
}

export async function rejectMembership(societyId: string, membershipId: string, adminId: string, reason?: string) {
  const m: any = await Membership.findOneAndUpdate(
    { _id: membershipId, society: societyId, status: 'pending' },
    { $set: { status: 'rejected', rejectionReason: reason } }, { new: true }
  );
  if (!m) throw ApiError.conflict('INVALID_STATE', 'Membership not pending');
  sendToUser(String(m.user), { type: NOTIFICATION_TYPES.MEMBERSHIP_REJECTED, title: 'Join request rejected', body: reason || 'Please contact your society admin', society: societyId }).catch(() => {});
  await audit({ society: societyId, actor: adminId, action: 'MEMBERSHIP_REJECTED', targetId: membershipId });
  return m;
}

export async function changeRole(societyId: string, membershipId: string, adminId: string, role: string) {
  const m: any = await Membership.findOne({ _id: membershipId, society: societyId, status: 'active' });
  if (!m) throw ApiError.notFound();
  if (role === 'resident' && m.role === 'admin') {
    const others = await Membership.countDocuments({ society: societyId, role: 'admin', status: 'active', _id: { $ne: membershipId } });
    if (others === 0) throw ApiError.conflict('LAST_ADMIN', 'Cannot demote the last admin');
  }
  m.role = role as any;
  if (role === 'admin') m.canReviewAssistance = true; else m.canReviewAssistance = false;
  await m.save();
  sendToUser(String(m.user), { type: NOTIFICATION_TYPES.ROLE_CHANGED, title: 'Your role changed', body: 'You are now ' + role, society: societyId }).catch(() => {});
  await audit({ society: societyId, actor: adminId, action: 'ROLE_CHANGED', targetId: membershipId, meta: { role } });
  return m;
}

export async function setPermissions(societyId: string, membershipId: string, adminId: string, canReviewAssistance: boolean) {
  const m: any = await Membership.findOneAndUpdate(
    { _id: membershipId, society: societyId, status: 'active' },
    { $set: { canReviewAssistance } }, { new: true }
  );
  if (!m) throw ApiError.notFound();
  await audit({ society: societyId, actor: adminId, action: 'PERMISSION_CHANGED', targetId: membershipId, meta: { canReviewAssistance } });
  return m;
}

export async function verifyResident(societyId: string, membershipId: string, adminId: string, isVerified: boolean, note?: string) {
  const set: any = { isVerifiedResident: isVerified };
  if (isVerified) { set.verifiedBy = adminId; set.verifiedAt = new Date(); }
  const m: any = await Membership.findOneAndUpdate({ _id: membershipId, society: societyId }, { $set: set }, { new: true });
  if (!m) throw ApiError.notFound();
  await audit({ society: societyId, actor: adminId, action: 'RESIDENT_VERIFICATION', targetId: membershipId, meta: { isVerified, note } });
  return m;
}

export async function suspendMember(societyId: string, membershipId: string, adminId: string, suspended: boolean, reason?: string) {
  const m: any = await Membership.findOne({ _id: membershipId, society: societyId });
  if (!m) throw ApiError.notFound();
  if (String(m._id) === String(adminId)) throw ApiError.conflict('INVALID_STATE', 'Cannot suspend yourself');
  if (suspended) {
    if (m.role === 'admin') {
      const others = await Membership.countDocuments({ society: societyId, role: 'admin', status: 'active', _id: { $ne: membershipId } });
      if (others === 0) throw ApiError.conflict('LAST_ADMIN', 'Cannot suspend the last admin');
    }
    m.status = 'suspended'; m.suspendReason = reason;
  } else {
    m.status = 'active'; m.suspendReason = undefined;
  }
  await m.save();
  await audit({ society: societyId, actor: adminId, action: 'MEMBERSHIP_SUSPENDED', targetId: membershipId });
  return m;
}

export async function removeMember(societyId: string, membershipId: string, adminId: string, reason?: string) {
  const m: any = await Membership.findOne({ _id: membershipId, society: societyId });
  if (!m) throw ApiError.notFound();
  if (m.role === 'admin') {
    const others = await Membership.countDocuments({ society: societyId, role: 'admin', status: 'active', _id: { $ne: membershipId } });
    if (others === 0) throw ApiError.conflict('LAST_ADMIN', 'Cannot remove the last admin');
  }
  m.status = 'removed'; m.suspendReason = reason;
  await m.save();
  await audit({ society: societyId, actor: adminId, action: 'MEMBERSHIP_REMOVED', targetId: membershipId });
  return m;
}

export async function leave(societyId: string, userId: string) {
  const m: any = await Membership.findOne({ user: userId, society: societyId, status: 'active' });
  if (!m) throw ApiError.notFound();
  if (m.role === 'admin') {
    const others = await Membership.countDocuments({ society: societyId, role: 'admin', status: 'active', _id: { $ne: m._id } });
    if (others === 0) throw ApiError.conflict('LAST_ADMIN', 'Promote someone before leaving');
  }
  m.status = 'left';
  await m.save();
}
