import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { api } from './api';

const CHANNEL = 'nexaliving-default';
const ASKED_KEY = 'nexa.notifAsked';
const POLL_MS = 20000;

async function ensureChannel() {
  return notifee.createChannel({ id: CHANNEL, name: 'NexaLiving notifications', importance: AndroidImportance.HIGH, badge: true });
}

/** Asks the user to allow notifications (Android 13+ shows the system prompt). Only asks once. */
export async function askNotificationPermission(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus >= 1) return true; // already allowed
    let asked = false;
    try { asked = (await AsyncStorage.getItem(ASKED_KEY)) === '1'; } catch {}
    if (asked) return false;
    try { await AsyncStorage.setItem(ASKED_KEY, '1'); } catch {}
    const r = await notifee.requestPermission();
    return r.authorizationStatus >= 1;
  } catch {
    return false;
  }
}

async function show(title: string, body?: string, id?: string) {
  try {
    const channelId = await ensureChannel();
    await notifee.displayNotification({
      id, title, body,
      android: { channelId, pressAction: { id: 'default' }, smallIcon: 'ic_launcher', showTimestamp: true },
    });
  } catch {}
}

export async function clearNotifications() {
  try { await notifee.cancelAllNotifications(); await notifee.setBadgeCount(0); } catch {}
}

/**
 * While logged in: ask permission, keep the app-icon badge equal to the unread count,
 * and pop a phone notification when a new one arrives (polls the server while the app is alive).
 */
export function useNotificationSync(userId: string | undefined, unread: number, setUnread: (n: number) => void) {
  const last = useRef<number | null>(null);

  // badge follows the unread count; nothing unread -> clear shown notifications
  useEffect(() => {
    if (!userId) return;
    notifee.setBadgeCount(unread).catch(() => {});
    if (unread === 0) notifee.cancelAllNotifications().catch(() => {});
  }, [userId, unread]);

  useEffect(() => {
    if (!userId) { last.current = null; clearNotifications(); return; }
    let stop = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        const c: any = await api.get('/notifications/unread-count');
        const count = Number(c?.count ?? 0);
        if (stop) return;
        const prev = last.current;
        last.current = count;
        setUnread(count);
        if (count === 0) return;
        if (prev === null) {
          // first check after opening the app: one summary so the badge/notification shows
          await show('NexaLiving', count === 1 ? 'You have 1 unread notification' : `You have ${count} unread notifications`, 'summary');
        } else if (count > prev) {
          const d: any = await api.list(`/notifications?unread=true&limit=${Math.min(count - prev, 5)}`);
          for (const n of d.items as any[]) await show(n.title, n.body, String(n._id));
        }
      } catch {}
    };

    (async () => {
      await askNotificationPermission();
      await ensureChannel();
      await poll();
      timer = setInterval(poll, POLL_MS);
    })();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') poll(); });
    return () => { stop = true; if (timer) clearInterval(timer); sub.remove(); };
  }, [userId, setUnread]);
}
