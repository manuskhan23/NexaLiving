import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, StyleProp,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { colors, font, radius } from '../theme';
import { Icon } from './Icon';
import { errMsg, imageUrl } from '../api';

export { Icon } from './Icon';

/* ---------- Screen / Header ---------- */
/** Bottom safe-area inset to add on screens that are NOT inside the tab bar (the tab bar already handles it). */
function useBottomInset() {
  const insets = useSafeAreaInsets();
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  return inTabs ? 0 : insets.bottom;
}

export function Screen({ children, scroll = true, padded = true, refreshing, onRefresh, footer, style }: {
  children: React.ReactNode; scroll?: boolean; padded?: boolean; refreshing?: boolean;
  onRefresh?: () => void; footer?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const bottom = useBottomInset();
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[padded && { padding: 20, paddingBottom: 32 + bottom }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined}>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && { padding: 20 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer ? <View style={[s.footer, { paddingBottom: 16 + bottom }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, back = true, right }: {
  title?: string; subtitle?: string; back?: boolean; right?: React.ReactNode;
}) {
  const nav = useNavigation<any>();
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={s.headRow}>
        {back && nav.canGoBack() ? (
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={s.backBtn}>
            <Icon name="back" size={22} />
          </Pressable>
        ) : <View style={{ width: 4 }} />}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {title ? <Text style={[font.title, s.title]}>{title}</Text> : null}
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/* ---------- Buttons ---------- */
export function Button({ title, onPress, loading, disabled, variant = 'primary', icon, style, small }: {
  title: string; onPress?: () => void; loading?: boolean; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'; icon?: string;
  style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const off = disabled || loading;
  const bg = variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.cardAlt
    : variant === 'danger' ? 'rgba(248,113,113,0.15)' : 'transparent';
  const fg = variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.danger
    : variant === 'ghost' ? colors.accent : colors.text;
  return (
    <Pressable onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.btn, small && { height: 40 }, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.border },
        variant === 'danger' && { borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={[font.button, { color: fg }, small && { fontSize: 14 }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ---------- Inputs ---------- */
export function Input({ label, error, hint, password, icon, style, ...rest }: TextInputProps & {
  label?: string; error?: string; hint?: string; password?: boolean; icon?: string; style?: StyleProp<ViewStyle>;
}) {
  const [hide, setHide] = useState(!!password);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.inputWrap, !!error && { borderColor: colors.danger }]}>
        {icon ? <Icon name={icon} size={18} color={colors.textDim} /> : null}
        <TextInput
          placeholderTextColor={colors.textMute}
          autoCapitalize="none"
          {...rest}
          secureTextEntry={password ? hide : rest.secureTextEntry}
          style={[s.input, rest.multiline && { height: 96, textAlignVertical: 'top', paddingTop: 12 }]}
        />
        {password ? (
          <Pressable onPress={() => setHide(h => !h)} hitSlop={10}>
            <Icon name={hide ? 'eye' : 'eyeOff'} size={18} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export type Option = { label: string; value: string };
export const toOptions = (arr: readonly string[]): Option[] =>
  arr.map(v => ({ value: v, label: humanize(v) }));
export const humanize = (v?: string) => (v ? v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '');

export function Select({ label, value, options, onChange, placeholder = 'Select', error, allowClear }: {
  label?: string; value?: string; options: Option[]; onChange: (v: string) => void;
  placeholder?: string; error?: string; allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const cur = options.find(o => o.value === value);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable style={[s.inputWrap, !!error && { borderColor: colors.danger }]} onPress={() => setOpen(true)}>
        <Text style={[s.input, { paddingTop: 14, color: cur ? colors.text : colors.textMute }]} numberOfLines={1}>
          {cur ? cur.label : placeholder}
        </Text>
        <Icon name="chevronDown" size={18} color={colors.textDim} />
      </Pressable>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.modalBack} onPress={() => setOpen(false)}>
          <View style={[s.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <Text style={[font.cardTitle, { color: colors.text, marginBottom: 8 }]}>{label || placeholder}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {allowClear ? (
                <Pressable style={s.opt} onPress={() => { onChange(''); setOpen(false); }}>
                  <Text style={{ color: colors.textDim }}>Clear</Text>
                </Pressable>
              ) : null}
              {options.map(o => (
                <Pressable key={o.value} style={s.opt} onPress={() => { onChange(o.value); setOpen(false); }}>
                  <Text style={{ color: o.value === value ? colors.accent : colors.text, fontWeight: o.value === value ? '700' : '400' }}>{o.label}</Text>
                  {o.value === value ? <Icon name="check" size={18} color={colors.accent} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ---------- Cards, chips, badges ---------- */
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const C: any = onPress ? Pressable : View;
  return <C onPress={onPress} style={[s.card, style]}>{children}</C>;
}

export function Chip({ label, active, onPress, small }: { label: string; active?: boolean; onPress?: () => void; small?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, small && { paddingVertical: 4 }, active && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
      <Text style={{ color: active ? '#fff' : colors.textDim, fontSize: small ? 11 : 13, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
      {options.map(o => <Chip key={o.value} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} />)}
    </ScrollView>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning, pending_review: colors.warning, submitted: colors.warning, under_review: colors.warning, open: colors.info,
  accepted: colors.success, approved: colors.success, active: colors.success, verified: colors.success,
  fulfilled: colors.success, completed: colors.success, matched: colors.success, resolved: colors.success, available: colors.success,
  rejected: colors.danger, cancelled: colors.danger, suspended: colors.danger, expired: colors.textDim,
  handed_over: colors.info, in_progress: colors.info, full: colors.warning, paused: colors.textDim,
};
export function Badge({ label, color, status }: { label?: string; color?: string; status?: string }) {
  const c = color || (status && STATUS_COLORS[status]) || colors.textDim;
  return (
    <View style={[s.badge, { backgroundColor: c + '26', borderColor: c + '66' }]}>
      <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{label ?? humanize(status)}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.secRow}>
      <Text style={[font.cardTitle, { color: colors.text, fontSize: 17 }]}>{title}</Text>
      {action ? <Pressable onPress={onAction}><Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Avatar({ user, size = 44, label }: { user?: any; size?: number; label?: string }) {
  const url = imageUrl(user?.avatar || user?.photo);
  const name: string = label || user?.fullName || user?.name || '?';
  const ini = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.cardAlt }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: size / 2.7 }}>{ini}</Text>
    </View>
  );
}

export function Row({ label, value, last }: { label: string; value?: React.ReactNode; last?: boolean }) {
  return (
    <View style={[s.rowKV, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.textDim, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>{value ?? '—'}</Text>
    </View>
  );
}

/* ---------- States ---------- */
export function Loader({ full }: { full?: boolean }) {
  return (
    <View style={[{ padding: 24, alignItems: 'center' }, full && { flex: 1, justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function Empty({ icon = 'list', title, text, action, onAction }: { icon?: string; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: 32 }}>
      <View style={s.emptyIcon}><Icon name={icon} size={28} color={colors.accent} /></View>
      <Text style={[font.cardTitle, { color: colors.text, marginTop: 14, textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={{ color: colors.textDim, marginTop: 6, textAlign: 'center' }}>{text}</Text> : null}
      {action ? <Button title={action} onPress={onAction} small style={{ marginTop: 16, paddingHorizontal: 24 }} /> : null}
    </View>
  );
}

export function ErrorBox({ error, onRetry }: { error: any; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: 24 }}>
      <Icon name="alert" size={30} color={colors.danger} />
      <Text style={{ color: colors.text, marginTop: 10, textAlign: 'center' }}>{errMsg(error)}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" small style={{ marginTop: 14, paddingHorizontal: 24 }} /> : null}
    </View>
  );
}

export function InlineMessage({ text, kind = 'error' }: { text?: string; kind?: 'error' | 'success' | 'info' }) {
  if (!text) return null;
  const c = kind === 'error' ? colors.danger : kind === 'success' ? colors.success : colors.info;
  return (
    <View style={{ backgroundColor: c + '1F', borderColor: c + '66', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 }}>
      <Text style={{ color: c, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

/* ---------- Data hooks ---------- */
export function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(undefined);
    try { setData(await fnRef.current()); } catch (e) { setError(e); }
    setLoading(false); setRefreshing(false);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  const refresh = useCallback(() => { setRefreshing(true); run(true); }, [run]);
  return { data, error, loading, refreshing, reload: run, refresh, setData };
}

/** Reload when the screen gains focus (e.g. after creating something). */
export function useFocusReload(reload: (silent?: boolean) => void) {
  const nav = useNavigation<any>();
  const first = useRef(true);
  useEffect(() => nav.addListener('focus', () => {
    if (first.current) { first.current = false; return; }
    reload(true);
  }), [nav, reload]);
}

export function ListScreen<T>({ title, subtitle, header, data, loading, error, reload, refreshing, onRefresh, renderItem, empty, footer, right, back = true }: {
  title: string; subtitle?: string; header?: React.ReactNode; data?: T[]; loading: boolean; error?: any;
  reload: () => void; refreshing: boolean; onRefresh: () => void; renderItem: (i: T) => React.ReactElement;
  empty: { icon?: string; title: string; text?: string; action?: string; onAction?: () => void };
  footer?: React.ReactNode; right?: React.ReactNode; back?: boolean;
}) {
  useFocusReload(reload);
  const bottom = useBottomInset();
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={data ?? []}
        keyExtractor={(i: any, idx) => String(i?._id ?? idx)}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 + bottom, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        ListHeaderComponent={<><Header title={title} subtitle={subtitle} back={back} right={right} />{header}</>}
        renderItem={({ item }) => renderItem(item)}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : <Empty {...empty} />}
      />
      {footer ? <View style={[s.footer, { paddingBottom: 16 + bottom }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  return (
    <View style={[s.inputWrap, { marginBottom: 12 }]}>
      <Icon name="search" size={18} color={colors.textDim} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMute}
        style={s.input} autoCapitalize="none" />
      {value ? <Pressable onPress={() => onChangeText('')} hitSlop={10}><Icon name="x" size={16} color={colors.textDim} /></Pressable> : null}
    </View>
  );
}

export function BottomSpacer() {
  const i = useSafeAreaInsets();
  return <View style={{ height: i.bottom + 8 }} />;
}

/* ---------- date helpers ---------- */
export const fmtDate = (d?: string | Date) => {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtTime = (d?: string | Date) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};
export const fmtDateTime = (d?: string | Date) => (d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—');
export const timeAgo = (d?: string | Date) => {
  if (!d) return '';
  const sec = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} d ago`;
  return fmtDate(d);
};
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  footer: { padding: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
  headRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36, marginBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text },
  subtitle: { color: colors.textDim, marginTop: 4, fontSize: 14 },
  btn: { height: 52, borderRadius: radius.btn, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 14, gap: 10 },
  input: { flex: 1, height: 50, color: colors.text, fontSize: 15, padding: 0 },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  hint: { color: colors.textMute, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.chip, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 12 },
  rowKV: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  modalBack: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, borderWidth: 1, borderColor: colors.border },
  opt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});

/* ---------- Date / time inputs (no native picker dependency) ---------- */
export const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return toYmd(d); };
export const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00').getTime());
export const isHm = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
/** Combine local date (YYYY-MM-DD) + time (HH:mm) into an ISO string. */
export const toIso = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00`).toISOString();

export function DateInput({ label, value, onChange, error, quick = true }: { label?: string; value: string; onChange: (v: string) => void; error?: string; quick?: boolean }) {
  const fmt = (t: string) => {
    const d = t.replace(/\D/g, '').slice(0, 8);
    return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
  };
  return (
    <View>
      <Input label={label} icon="calendar" placeholder="YYYY-MM-DD" value={value} onChangeText={t => onChange(fmt(t))} keyboardType="number-pad" maxLength={10} error={error} style={{ marginBottom: quick ? 8 : 14 }} />
      {quick ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {[['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([l, n]) => (
            <Chip key={String(l)} small label={String(l)} active={value === addDays(n as number)} onPress={() => onChange(addDays(n as number))} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function TimeInput({ label, value, onChange, error }: { label?: string; value: string; onChange: (v: string) => void; error?: string }) {
  const fmt = (t: string) => {
    const d = t.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
  };
  return <Input label={label} icon="clock" placeholder="HH:mm (24h)" value={value} onChangeText={t => onChange(fmt(t))} keyboardType="number-pad" maxLength={5} error={error} />;
}
