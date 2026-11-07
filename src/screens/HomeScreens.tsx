import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errMsg, imageUrl, qs } from '../api';
import { useAuth } from '../auth';
import { colors, font } from '../theme';
import {
  Avatar, Badge, Button, Card, ChipRow, Empty, ErrorBox, Header, Icon, InlineMessage, Input, ListScreen, Loader,
  Option, Row, Screen, SearchBar, Select, humanize, fmtDate, fmtDateTime, timeAgo, toOptions, useAsync, useDebounced, useFocusReload,
} from '../ui';
import { ALERT_TYPES, ALERT_SEVERITIES, ANNOUNCEMENT_CATEGORIES } from '../lib/enums';
import { pickAndUploadImages } from '../lib/upload';

const logo = require('../assets/logo.png');

/* ======================= HOME ======================= */
export function HomeScreen({ navigation }: any) {
  const { user, active, sid, unread, isAdmin, refreshMe } = useAuth();
  const ann = useAsync(() => api.list<any>(`/societies/${sid}/announcements${qs({ limit: 3 })}`), [sid]);
  const alerts = useAsync(() => api.list<any>(`/societies/${sid}/alerts${qs({ status: 'active', limit: 3 })}`).catch(() => ({ items: [] })), [sid]);
  const soc = useAsync(() => (isAdmin ? api.get<any>(`/societies/${sid}`) : Promise.resolve(null)), [sid, isAdmin]);
  const joinCode = (soc.data?.society || soc.data)?.joinCode;
  useFocusReload(ann.reload);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = (user?.fullName || '').split(' ')[0];
  const go = (n: string, p?: any) => navigation.navigate(n, p);
  const refresh = () => { ann.refresh(); alerts.refresh(); refreshMe().catch(() => {}); };

  const quick = [
    { icon: 'cap', label: 'Find a Tutor', to: 'TutorList', primary: true },
    { icon: 'calendar', label: 'Book a Space', to: 'SpaceList' },
    { icon: 'handshake', label: 'Need → Match', to: 'NeedMatch' },
  ];
  const services = [
    { icon: 'tool', label: 'Local Services', to: 'ServiceList' },
    { icon: 'home', label: 'House for Rent', to: 'RentalList' },
    { icon: 'car', label: 'Carpool', to: 'CarpoolList' },
    { icon: 'stethoscope', label: 'Nearby Doctors', to: 'DoctorList' },
  ];

  return (
    <Screen onRefresh={refresh} refreshing={ann.refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => go('ProfileTab')}><Avatar user={user} size={46} /></Pressable>
        <Pressable style={st.societyPill} onPress={() => go('SwitchSociety')}>
          <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{active?.society?.name}</Text>
          <Icon name="chevronDown" size={16} color={colors.textDim} />
        </Pressable>
        <Pressable onPress={() => go('Notifications')} style={st.bell} hitSlop={8}>
          <Icon name="bell" size={22} />
          {unread > 0 ? <View style={st.dot}><Text style={{ color: colors.accentText, fontSize: 9, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text></View> : null}
        </Pressable>
      </View>

      <Text style={[font.title, { color: colors.text, marginTop: 20 }]}>{greet}, {first}</Text>
      <Text style={{ color: colors.textDim, marginTop: 2 }}>Welcome back to {active?.society?.name}</Text>

      {(alerts.data?.items || []).filter((a: any) => a.status === 'active').slice(0, 1).map((a: any) => (
        <Card key={a._id} onPress={() => go('AlertDetail', { id: a._id })} style={{ marginTop: 16, backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.5)', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Icon name="alert" color={colors.danger} size={26} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 11 }}>EMERGENCY · {humanize(a.type).toUpperCase()}</Text>
            <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{a.title}</Text>
          </View>
          <Icon name="chevronRight" size={18} color={colors.danger} />
        </Card>
      ))}

      {isAdmin && joinCode ? (
        <Card onPress={() => go('AdminDashboard')} style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="key" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>Your society join code</Text>
            <Text selectable style={{ color: colors.accent, fontSize: 22, fontWeight: '800', letterSpacing: 3 }}>{joinCode}</Text>
          </View>
          <Icon name="chevronRight" size={18} color={colors.textMute} />
        </Card>
      ) : null}

      <View style={st.banner}>
        <Image source={logo} style={{ width: 120, height: 60 }} resizeMode="contain" />
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 6 }}>A neighbourhood.{'\n'}A little closer.</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4, fontSize: 12 }}>Your Community, Connected.</Text>
      </View>

      <Text style={st.h2}>Quick Actions</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {quick.map(q => (
          <Pressable key={q.label} onPress={() => go(q.to)} style={[st.quick, q.primary && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
            <Icon name={q.icon} size={24} color={q.primary ? '#fff' : colors.accent} />
            <Text style={{ color: q.primary ? '#fff' : colors.text, fontSize: 12, fontWeight: '600', marginTop: 8 }}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={st.rowBetween}>
        <Text style={st.h2}>Community Services</Text>
        <Pressable onPress={() => go('ExploreTab')}><Text style={st.link}>See all ›</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {services.map(q => (
          <Pressable key={q.label} onPress={() => go(q.to)} style={{ flex: 1, alignItems: 'center' }}>
            <View style={st.svc}><Icon name={q.icon} size={24} color={colors.accent} /></View>
            <Text style={{ color: colors.textDim, fontSize: 11, textAlign: 'center', marginTop: 6 }}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={st.rowBetween}>
        <Text style={st.h2}>Community Updates</Text>
        <Pressable onPress={() => go('Announcements')}><Text style={st.link}>View All</Text></Pressable>
      </View>
      {ann.loading ? <Loader /> : ann.error ? <ErrorBox error={ann.error} onRetry={ann.reload} /> :
        (ann.data?.items.length ? ann.data.items.map(a => <AnnouncementCard key={a._id} a={a} onPress={() => go('AnnouncementDetail', { id: a._id })} />)
          : <Empty icon="megaphone" title="No announcements yet" text={isAdmin ? 'Post the first update for your community.' : 'Official notices will appear here.'}
            action={isAdmin ? 'Post announcement' : undefined} onAction={() => go('AnnouncementForm')} />)}

      <Text style={st.h2}>Around Your Community</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable style={[st.around, { backgroundColor: colors.cardAlt }]} onPress={() => go('ItemList', { type: 'giveaway' })}>
          <Icon name="gift" size={26} color={colors.accent} />
          <Text style={{ color: colors.text, fontWeight: '700', marginTop: 10 }}>Give Away</Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>Share useful items with neighbours.</Text>
        </Pressable>
        <Pressable style={[st.around, { backgroundColor: colors.tealDeep }]} onPress={() => go('DealList')}>
          <Icon name="tag" size={26} color={colors.accent} />
          <Text style={{ color: colors.text, fontWeight: '700', marginTop: 10 }}>Local Deals</Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>Discover nearby offers.</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

export function AnnouncementCard({ a, onPress }: { a: any; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {a.isPinned ? <Icon name="flag" size={14} color={colors.accent} /> : null}
        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800' }}>{a.isPinned ? 'PINNED · ' : ''}{humanize(a.category).toUpperCase()}</Text>
        {a.isRead === false ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
      </View>
      <Text style={[font.cardTitle, { color: colors.text }]}>{a.title}</Text>
      <Text style={{ color: colors.textDim, marginTop: 4, fontSize: 13 }} numberOfLines={2}>{a.body}</Text>
      <Text style={{ color: colors.textMute, marginTop: 8, fontSize: 12 }}>{timeAgo(a.publishedAt || a.createdAt)}</Text>
    </Card>
  );
}

/* ======================= NOTIFICATIONS ======================= */
const NOTIF_ICON: Record<string, string> = {
  booking: 'calendar', announcement: 'megaphone', tutor: 'cap', need: 'handshake', item: 'gift', member: 'users',
  alert: 'alert', rental: 'home', service: 'tool', carpool: 'car', deal: 'tag', assistance: 'heart',
};
const notifIcon = (t = '') => NOTIF_ICON[Object.keys(NOTIF_ICON).find(k => t.toLowerCase().includes(k)) || ''] || 'bell';

export function NotificationsScreen() {
  const { setUnread } = useAuth();
  const [tab, setTab] = useState('all');
  const q = useAsync(() => api.list<any>(`/notifications${qs({ unread: tab === 'unread' ? 'true' : undefined, limit: 50 })}`), [tab]);
  const open = async (n: any) => {
    if (!n.readAt) {
      try { await api.patch(`/notifications/${n._id}/read`); q.setData(d => d && { ...d, items: d.items.map(x => x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x) });
        const c: any = await api.get('/notifications/unread-count'); setUnread(c.count); } catch {}
    }
  };
  const readAll = async () => {
    try { await api.patch('/notifications/read-all'); setUnread(0); q.reload(true); } catch {}
  };
  return (
    <ListScreen title="Notifications" subtitle="You're all caught up with your community" data={q.data?.items} loading={q.loading}
      error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      right={<Pressable onPress={readAll}><Text style={st.link}>Mark all read</Text></Pressable>}
      header={<View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 14 }}>
        {['all', 'unread'].map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', backgroundColor: tab === t ? colors.teal : 'transparent' }}>
            <Text style={{ color: tab === t ? '#fff' : colors.textDim, fontWeight: '600' }}>{humanize(t)}</Text>
          </Pressable>))}
      </View>}
      empty={{ icon: 'bell', title: 'No notifications', text: 'New updates from your community show up here.' }}
      renderItem={n => (
        <Card onPress={() => open(n)} style={{ flexDirection: 'row', gap: 12, opacity: n.readAt ? 0.7 : 1 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={notifIcon(n.type)} size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[font.cardTitle, { color: colors.text, fontSize: 15 }]}>{n.title}</Text>
            {n.body ? <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 2 }}>{n.body}</Text> : null}
            <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 4 }}>{timeAgo(n.createdAt)}</Text>
          </View>
          {!n.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 }} /> : null}
        </Card>
      )} />
  );
}

/* ======================= ANNOUNCEMENTS ======================= */
export function AnnouncementsScreen({ navigation }: any) {
  const { sid, isAdmin } = useAuth();
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const q = useAsync(() => api.list<any>(`/societies/${sid}/announcements${qs({ category: cat, search: dq, limit: 30 })}`), [sid, cat, dq]);
  const opts: Option[] = [{ value: 'all', label: 'All' }, ...toOptions(ANNOUNCEMENT_CATEGORIES)];
  return (
    <ListScreen title="Community Announcements" subtitle="Important updates from your society." data={q.data?.items} loading={q.loading} error={q.error}
      reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<><SearchBar value={search} onChangeText={setSearch} placeholder="Search announcements" /><ChipRow options={opts} value={cat} onChange={setCat} /></>}
      empty={{ icon: 'megaphone', title: 'No announcements', text: 'Nothing matches right now.' }}
      footer={isAdmin ? <Button title="New announcement" icon="plus" onPress={() => navigation.navigate('AnnouncementForm')} /> : undefined}
      renderItem={a => <AnnouncementCard a={a} onPress={() => navigation.navigate('AnnouncementDetail', { id: a._id })} />} />
  );
}

export function AnnouncementDetailScreen({ route, navigation }: any) {
  const { sid, isAdmin } = useAuth();
  const { id } = route.params;
  const q = useAsync(() => api.get<any>(`/societies/${sid}/announcements/${id}`).then(d => d.announcement), [id]);
  const a = q.data;
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<any>, back = false) => {
    setBusy(true);
    try { await fn(); back ? navigation.goBack() : q.reload(true); } catch { q.setData(a); }
    setBusy(false);
  };
  return (
    <Screen footer={<Button title="Back to Announcements" variant="primary" icon="back" onPress={() => navigation.goBack()} />}>
      <Header title="Announcement" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : a && (
        <>
          {a.images?.[0] ? <Image source={{ uri: imageUrl(a.images[0]) }} style={{ height: 180, borderRadius: 16, marginBottom: 14, backgroundColor: colors.card }} /> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <Badge label={humanize(a.category)} color={colors.accent} />
            {a.isPinned ? <Badge label="Pinned" color={colors.warning} /> : null}
          </View>
          <Text style={[font.section, { color: colors.text }]}>{a.title}</Text>
          <Card style={{ marginTop: 14 }}>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 23 }}>{a.body}</Text>
            <View style={{ height: 12 }} />
            <Row label="Published" value={fmtDateTime(a.publishedAt || a.createdAt)} />
            <Row label="Published by" value="Society Administration" last={!a.expiresAt} />
            {a.expiresAt ? <Row label="Expires" value={fmtDate(a.expiresAt)} last /> : null}
          </Card>
          {isAdmin ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button style={{ flex: 1 }} variant="secondary" small title={a.isPinned ? 'Unpin' : 'Pin'} loading={busy}
                onPress={() => act(() => api.patch(`/societies/${sid}/announcements/${id}/pin`, { isPinned: !a.isPinned }))} />
              <Button style={{ flex: 1 }} variant="secondary" small title="Edit" onPress={() => navigation.navigate('AnnouncementForm', { announcement: a })} />
              <Button style={{ flex: 1 }} variant="danger" small title="Delete" loading={busy}
                onPress={() => act(() => api.del(`/societies/${sid}/announcements/${id}`), true)} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

export function AnnouncementFormScreen({ route, navigation }: any) {
  const { sid } = useAuth();
  const ex = route.params?.announcement;
  const [title, setTitle] = useState(ex?.title || '');
  const [body, setBody] = useState(ex?.body || '');
  const [category, setCategory] = useState(ex?.category || 'general');
  const [images, setImages] = useState<any[]>(ex?.images || []);
  const [pin, setPin] = useState(!!ex?.isPinned);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const addImg = async () => { try { setImages([...images, ...(await pickAndUploadImages(true))].slice(0, 5)); } catch (e) { setErr(errMsg(e)); } };
  const submit = async () => {
    setErr('');
    if (title.trim().length < 3 || !body.trim()) return setErr('A title (3+ characters) and a message are required.');
    setLoading(true);
    try {
      const payload: any = { title: title.trim(), body: body.trim(), category, isPinned: pin, images };
      if (ex) await api.patch(`/societies/${sid}/announcements/${ex._id}`, payload);
      else await api.post(`/societies/${sid}/announcements`, { ...payload, notify: true });
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title={ex ? 'Save changes' : 'Publish announcement'} onPress={submit} loading={loading} />}>
      <Header title={ex ? 'Edit announcement' : 'New announcement'} />
      <InlineMessage text={err} />
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="Community Water Maintenance" autoCapitalize="sentences" />
      <Select label="Category" value={category} options={toOptions(ANNOUNCEMENT_CATEGORIES)} onChange={setCategory} />
      <Input label="Message" value={body} onChangeText={setBody} multiline placeholder="Write the details residents need to know" autoCapitalize="sentences" />
      <PhotoStrip images={images} onAdd={addImg} onRemove={i => setImages(images.filter((_, k) => k !== i))} />
      <Pressable onPress={() => setPin(p => !p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 }}>
        <View style={[st.check, pin && { backgroundColor: colors.accent, borderColor: colors.accent }]}>{pin ? <Icon name="check" size={14} color={colors.accentText} strokeWidth={3} /> : null}</View>
        <Text style={{ color: colors.text }}>Pin to the top</Text>
      </Pressable>
    </Screen>
  );
}

export function PhotoStrip({ images, onAdd, onRemove, label = 'Photos' }: { images: any[]; onAdd: () => void; onRemove: (i: number) => void; label?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {images.map((im, i) => (
          <View key={i}>
            <Image source={{ uri: imageUrl(im) }} style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: colors.card }} />
            <Pressable onPress={() => onRemove(i)} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: 3 }}>
              <Icon name="x" size={12} />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={onAdd} style={{ width: 84, height: 84, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" color={colors.textDim} />
          <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 4 }}>Add</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/* ======================= ALERTS ======================= */
export function AlertsScreen({ navigation }: any) {
  const { sid, isAdmin } = useAuth();
  const q = useAsync(() => api.list<any>(`/societies/${sid}/alerts${qs({ limit: 30 })}`), [sid]);
  return (
    <ListScreen title="Emergency Alerts" subtitle="Urgent notices from society admins." data={q.data?.items} loading={q.loading} error={q.error}
      reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      empty={{ icon: 'shield', title: 'No alerts', text: 'All clear. Urgent notices will show up here.' }}
      footer={isAdmin ? <Button title="Send emergency alert" icon="alert" variant="danger" onPress={() => navigation.navigate('AlertForm')} /> : undefined}
      renderItem={a => (
        <Card onPress={() => navigation.navigate('AlertDetail', { id: a._id })}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <Badge label={humanize(a.type)} color={colors.danger} /><Badge status={a.status} />
          </View>
          <Text style={[font.cardTitle, { color: colors.text }]}>{a.title}</Text>
          <Text style={{ color: colors.textDim, marginTop: 4 }} numberOfLines={2}>{a.message}</Text>
          <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 8 }}>{timeAgo(a.createdAt)}</Text>
        </Card>
      )} />
  );
}

export function AlertDetailScreen({ route }: any) {
  const { sid, isAdmin } = useAuth();
  const { id } = route.params;
  const q = useAsync(() => api.get<any>(`/societies/${sid}/alerts/${id}`), [id]);
  const a = q.data?.alert || q.data;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<any>) => { setBusy(true); setErr(''); try { await fn(); q.reload(true); } catch (e) { setErr(errMsg(e)); } setBusy(false); };
  return (
    <Screen>
      <Header title="Alert" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : a && (
        <>
          <InlineMessage text={err} />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <Badge label={humanize(a.type)} color={colors.danger} /><Badge label={humanize(a.severity)} color={colors.warning} /><Badge status={a.status} />
          </View>
          <Text style={[font.section, { color: colors.text }]}>{a.title}</Text>
          <Card style={{ marginTop: 14 }}>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{a.message}</Text>
            <View style={{ height: 10 }} />
            {a.location ? <Row label="Location" value={a.location} /> : null}
            <Row label="Sent" value={fmtDateTime(a.createdAt)} last />
          </Card>
          {a.status === 'active' ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              {a.acknowledgedByMe ? <Badge label="You acknowledged this alert" color={colors.success} /> : <Button title="I have seen this" icon="check" loading={busy} onPress={() => run(() => api.post(`/societies/${sid}/alerts/${id}/acknowledge`))} />}
              {isAdmin ? <Button title="Mark resolved" variant="secondary" loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/alerts/${id}/resolve`, { resolutionNote: 'Resolved by society admin' }))} /> : null}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

export function AlertFormScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [f, setF] = useState({ type: 'security', severity: 'high', title: '', message: '', location: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (f.title.trim().length < 3 || !f.message.trim()) return setErr('Title and message are required.');
    setLoading(true);
    try {
      await api.post(`/societies/${sid}/alerts`, { ...f, title: f.title.trim(), message: f.message.trim(), location: f.location.trim() || undefined });
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Send alert to all residents" variant="danger" onPress={submit} loading={loading} />}>
      <Header title="Emergency alert" subtitle="Residents are notified immediately." />
      <InlineMessage text={err} />
      <Select label="Type" value={f.type} options={toOptions(ALERT_TYPES)} onChange={set('type')} />
      <Select label="Severity" value={f.severity} options={toOptions(ALERT_SEVERITIES)} onChange={set('severity')} />
      <Input label="Title" value={f.title} onChangeText={set('title')} autoCapitalize="sentences" />
      <Input label="Message" value={f.message} onChangeText={set('message')} multiline autoCapitalize="sentences" />
      <Input label="Location (optional)" value={f.location} onChangeText={set('location')} />
    </Screen>
  );
}

const st = StyleSheet.create({
  societyPill: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: colors.border },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  banner: { marginTop: 18, borderRadius: 18, padding: 18, backgroundColor: colors.tealDeep, borderWidth: 1, borderColor: colors.teal },
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13, marginTop: 12 },
  quick: { flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'flex-start', minHeight: 92, justifyContent: 'space-between' },
  svc: { width: 58, height: 58, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  around: { flex: 1, borderRadius: 16, padding: 16, minHeight: 120, borderWidth: 1, borderColor: colors.border },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
