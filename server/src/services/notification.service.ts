import Expo from 'expo-server-sdk';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { Membership } from '../models/Membership';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const expo = new Expo({ accessToken: env.EXPO_ACCESS_TOKEN, useFcmV1: false });

interface SendArgs {
  type: string;
  title: string;
  body?: string;
  data?: { screen?: string; params?: any };
  society?: string;
  priority?: 'high' | 'default';
}

export async function sendToUser(userId: string, args: SendArgs) {
  const n = await Notification.create({ user: userId, ...args });
  try {
    const u: any = await User.findById(userId).lean();
    if (!u || !u.pushTokens?.length) return;
    await pushToTokens(u.pushTokens, n);
  } catch (e) { logger.error({ e }, 'push failed'); }
}

export async function sendToMany(userIds: string[], args: SendArgs) {
  if (!userIds.length) return;
  const docs = userIds.map((user) => ({ user, ...args }));
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const created = await Notification.insertMany(chunk);
    for (const n of created) { /* batch below */ }
    await batchPush(userIds, created[0]);
  }
}

export async function sendToSociety(societyId: string, args: SendArgs, excludeUserId?: string, respectPrefs?: string) {
  const filter: any = { society: societyId, status: 'active' };
  const members = await Membership.find(filter).select('user').lean();
  let userIds = members.map((m: any) => String(m.user));
  if (excludeUserId) userIds = userIds.filter((id) => id !== String(excludeUserId));
  if (!userIds.length) return 0;
  if (respectPrefs) {
    const users = await User.find({ _id: { $in: userIds }, ['settings.notifications.' + respectPrefs]: true }).select('_id').lean();
    userIds = users.map((u: any) => String(u._id));
  }
  await sendToMany(userIds, { ...args, society: societyId });
  return userIds.length;
}

async function pushToTokens(tokens: Array<{ token: string }>, notification: any) {
  const messages: any[] = [];
  for (const pt of tokens) {
    if (!Expo.isExpoPushToken(pt.token)) continue;
    messages.push({
      to: pt.token,
      title: notification.title,
      body: notification.body,
      data: { ...notification.data, type: notification.type, notificationId: String(notification._id) },
      priority: 'high',
    });
  }
  try {
    const tickets = await expo.sendPushNotificationsAsync(messages);
    logger.debug({ count: tickets.length }, 'push tickets received');
  } catch (e) { logger.error({ e }, 'expo push error'); }
}

async function batchPush(userIds: string[], sample: any) {
  const users = await User.find({ _id: { $in: userIds } }).select('pushTokens').lean();
  const messages: any[] = [];
  for (const u of users as any[]) {
    for (const pt of u.pushTokens || []) {
      if (!Expo.isExpoPushToken(pt.token)) continue;
      messages.push({ to: pt.token, title: sample.title, body: sample.body, data: { ...sample.data, type: sample.type } });
    }
  }
  if (!messages.length) return;
  for (let i = 0; i < messages.length; i += 100) {
    try { await expo.sendPushNotificationsAsync(messages.slice(i, i + 100)); } catch (e) { logger.error({ e }, 'expo chunk failed'); }
  }
}
