import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiBase } from './config';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { path: string; message: string }[];
  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Tokens = { accessToken: string; refreshToken: string };
const TOKEN_KEY = 'nexa.tokens';
let tokens: Tokens | null = null;
let onSessionExpired: (() => void) | null = null;
type RefreshResult = 'ok' | 'rejected' | 'offline';
let refreshing: Promise<RefreshResult> | null = null;

export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};
export const getTokens = () => tokens;

export async function loadTokens() {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    tokens = raw ? JSON.parse(raw) : null;
  } catch {
    tokens = null;
  }
  return tokens;
}
let persist = true; // false = "Remember me" unchecked: keep the session in memory only
export async function setTokens(t: Tokens | null, remember?: boolean) {
  tokens = t;
  if (remember !== undefined) persist = remember;
  try {
    if (t && persist) await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function raw(method: string, path: string, body?: any, auth = true, isForm = false) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (auth && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
  let res: Response;
  try {
    res = await fetch(apiBase() + path, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', OFFLINE_MSG);
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { res, json };
}

const OFFLINE_MSG = 'Cannot reach the server. Check your internet connection and try again.';

// One refresh at a time. 'rejected' = the server refused the refresh token (sign out);
// 'offline' = network/server trouble (keep the session and let the user retry).
async function refreshTokens(): Promise<RefreshResult> {
  if (!tokens?.refreshToken) return 'rejected';
  if (!refreshing) {
    const refreshToken = tokens.refreshToken;
    refreshing = (async (): Promise<RefreshResult> => {
      let r: { res: Response; json: any };
      try {
        r = await raw('POST', '/auth/refresh', { refreshToken }, false);
      } catch {
        return 'offline';
      }
      if (r.res.ok && r.json?.data?.accessToken) {
        await setTokens({ accessToken: r.json.data.accessToken, refreshToken: r.json.data.refreshToken });
        return 'ok';
      }
      return r.res.status === 401 || r.res.status === 403 ? 'rejected' : 'offline';
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export type ListMeta = { page: number; limit: number; total: number; totalPages: number };

async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  opts: { auth?: boolean; form?: boolean; full?: boolean } = {},
): Promise<T> {
  const auth = opts.auth !== false;
  const sentWith = tokens?.accessToken;
  let { res, json } = await raw(method, path, body, auth, !!opts.form);
  if (res.status === 401 && auth && tokens) {
    // If another request refreshed while this one was in flight, just retry with the new token.
    const r = tokens.accessToken !== sentWith ? 'ok' : await refreshTokens();
    if (r === 'offline') throw new ApiError(0, 'NETWORK_ERROR', OFFLINE_MSG);
    if (r === 'ok') ({ res, json } = await raw(method, path, body, auth, !!opts.form));
  }
  if (!res.ok || json?.success === false) {
    const e = json?.error || {};
    if (res.status === 401 && auth && tokens) {
      await setTokens(null);
      onSessionExpired?.();
    }
    const fallback = res.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.'
      : res.status === 503 ? 'The server cannot reach its database right now. Please try again in a moment.'
      : res.status >= 500 ? 'The server had a problem. Please try again.' : `Request failed (${res.status})`;
    throw new ApiError(res.status, e.code || (res.status === 429 ? 'TOO_MANY_REQUESTS' : 'ERROR'), e.message || fallback, e.details);
  }
  return (opts.full ? json : json?.data) as T;
}

export const api = {
  get: <T = any>(p: string, o?: any) => request<T>('GET', p, undefined, o),
  post: <T = any>(p: string, b?: any, o?: any) => request<T>('POST', p, b ?? {}, o),
  patch: <T = any>(p: string, b?: any, o?: any) => request<T>('PATCH', p, b ?? {}, o),
  put: <T = any>(p: string, b?: any, o?: any) => request<T>('PUT', p, b, o),
  del: <T = any>(p: string, b?: any, o?: any) => request<T>('DELETE', p, b, o),
  /** GET returning { items, meta } */
  list: async <T = any>(p: string): Promise<{ items: T[]; meta?: ListMeta }> => {
    const j: any = await request('GET', p, undefined, { full: true });
    return { items: j?.data?.items ?? [], meta: j?.meta };
  },
};

export const qs = (o: Record<string, any>) => {
  const p = Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

export const errMsg = (e: any) => {
  if (e instanceof ApiError) {
    if (e.details?.length) return e.details.map(d => d.message).join('\n');
    return e.message;
  }
  return e?.message || 'Something went wrong';
};

export const imageUrl = (img?: { url?: string } | string | null) => {
  const u = typeof img === 'string' ? img : img?.url;
  if (!u) return undefined;
  if (/^https?:\/\//.test(u)) return u;
  return apiBase().replace(/\/api\/v1$/, '') + (u.startsWith('/') ? u : '/' + u);
};
