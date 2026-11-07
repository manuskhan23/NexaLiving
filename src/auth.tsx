import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, loadTokens, setSessionExpiredHandler, setTokens, getTokens } from './api';
import { useNotificationSync } from './notifications';

export type Society = { _id: string; name: string; area?: string; city?: string; coverImage?: any };
export type Membership = {
  _id: string; role: 'resident' | 'admin'; status: string; block?: string; unitLabel?: string;
  society: Society; canReviewAssistance?: boolean; isVerifiedResident?: boolean; residentType?: string;
};
export type User = {
  _id: string; fullName: string; email: string; phone?: string; cnic?: string; globalRole: 'user' | 'admin';
  avatar?: any; bio?: string; settings?: any; isVerified?: boolean;
};

type Ctx = {
  ready: boolean;
  user: User | null;
  memberships: Membership[];
  active: Membership | null;       // currently selected membership
  sid: string;                     // active society id ('' when none)
  isAdmin: boolean;                // society admin of the active society
  isGlobalAdmin: boolean;          // platform admin (registered with admin code)
  unread: number;
  establishSession: (d: { user: User; accessToken: string; refreshToken: string; memberships?: Membership[]; remember?: boolean }) => Promise<void>;
  refreshMe: () => Promise<void>;
  setActiveId: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUnread: (n: number) => void;
};

const C = createContext<Ctx>(null as any);
export const useAuth = () => useContext(C);
const ACTIVE_KEY = 'nexa.activeMembership';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActive] = useState<string>('');
  const [unread, setUnread] = useState(0);

  const clear = useCallback(() => { setUser(null); setMemberships([]); setUnread(0); }, []);
  useNotificationSync(user?._id, unread, setUnread);

  const refreshMe = useCallback(async () => {
    const d: any = await api.get('/auth/me');
    setUser(d.user);
    setMemberships(d.memberships || []);
    setUnread(d.unreadNotifications || 0);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(clear);
    (async () => {
      await loadTokens();
      try { setActive((await AsyncStorage.getItem(ACTIVE_KEY)) || ''); } catch {}
      if (getTokens()) {
        try { await refreshMe(); } catch (e: any) {
          // keep session on network errors, drop it otherwise
          if (e?.status && e.status !== 0) { await setTokens(null); clear(); }
        }
      }
      setReady(true);
    })();
  }, [clear, refreshMe]);

  const establishSession: Ctx['establishSession'] = useCallback(async d => {
    await setTokens({ accessToken: d.accessToken, refreshToken: d.refreshToken }, d.remember ?? true);
    setUser(d.user);
    if (d.memberships) setMemberships(d.memberships);
    try { await refreshMe(); } catch {}
  }, [refreshMe]);

  const setActiveId = useCallback(async (id: string) => {
    setActive(id);
    try { await AsyncStorage.setItem(ACTIVE_KEY, id); } catch {}
  }, []);

  const signOut = useCallback(async () => {
    const t = getTokens();
    try { if (t) await api.post('/auth/logout', { refreshToken: t.refreshToken }); } catch {}
    await setTokens(null);
    clear();
  }, [clear]);

  const value = useMemo<Ctx>(() => {
    const live = memberships.filter(m => m.society);
    const active = live.find(m => m._id === activeId)
      || live.find(m => m.status === 'active') || live[0] || null;
    return {
      ready, user, memberships: live, active, sid: active?.society?._id || '',
      isAdmin: !!active && active.status === 'active' && active.role === 'admin',
      isGlobalAdmin: user?.globalRole === 'admin',
      unread, establishSession, refreshMe, setActiveId, signOut, setUnread,
    };
  }, [ready, user, memberships, activeId, unread, establishSession, refreshMe, setActiveId, signOut]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
