import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import { colors, font } from '../theme';
import {
  Avatar, Badge, Button, Card, ChipRow, ErrorBox, Header, Icon, InlineMessage, Input, ListScreen, Loader, Row, Screen, SearchBar,
  fmtDateTime, humanize, timeAgo, useAsync, useDebounced,
} from '../ui';
import { pickAndSetAvatar } from '../lib/upload';

function MySocieties({ navigation, title = 'My societies' }: any) {
  const { memberships, active, setActiveId, isGlobalAdmin } = useAuth();
  const managed = memberships.filter(m => m.role === 'admin');
  const joined = memberships.filter(m => m.role !== 'admin');
  const row = (m: any) => (
    <Card key={m._id} onPress={() => setActiveId(m._id)} style={{ marginBottom: 10, borderColor: m._id === active?._id ? colors.accent : colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={[font.cardTitle, { color: colors.text }]}>{m.society.name}</Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>{[m.society.area, m.society.city].filter(Boolean).join(', ')}</Text>
        {m.role !== 'admin' && (m.block || m.unitLabel) ? <Text style={{ color: colors.textMute, fontSize: 12 }}>{[m.block && `Block ${m.block}`, m.unitLabel].filter(Boolean).join(' · ')}</Text> : null}
      </View>
      {m.status !== 'active' ? <Badge status={m.status} /> : null}
      {m._id === active?._id ? <Badge label="Selected" color={colors.accent} /> : null}
    </Card>
  );
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={st.h2}>{title}</Text>
      {isGlobalAdmin || managed.length ? (
        <>
          <View style={st.groupHead}><Icon name="shield" size={16} color={colors.accent} /><Text style={st.groupText}>Societies I manage (Admin)</Text></View>
          {managed.length ? managed.map(row) : <Text style={{ color: colors.textMute, marginBottom: 10 }}>You haven't created a society yet.</Text>}
          {isGlobalAdmin ? <Button title="Create a new society" icon="plus" variant="outline" onPress={() => navigation.navigate('CreateSociety')} style={{ marginBottom: 14 }} /> : null}
        </>
      ) : null}
      <View style={st.groupHead}><Icon name="users" size={16} color={colors.accent} /><Text style={st.groupText}>Societies I joined (Resident)</Text></View>
      {joined.length ? joined.map(row) : <Text style={{ color: colors.textMute, marginBottom: 10 }}>You haven't joined any society with a code yet.</Text>}
      <Button title="Join a society with a code" icon="key" variant="secondary" onPress={() => navigation.navigate('JoinSociety')} />
    </View>
  );
}

function AccountButtons({ navigation }: any) {
  const { signOut } = useAuth();
  return (
    <View style={{ marginTop: 18, gap: 10 }}>
      <Button title="Log out" icon="logout" variant="secondary" onPress={signOut} />
      <Button title="Delete account" icon="trash" variant="danger" onPress={() => navigation.navigate('DeleteAccount')} />
    </View>
  );
}

const Link = ({ icon, label, sub, onPress, danger, badge }: { icon: string; label: string; sub?: string; onPress: () => void; danger?: boolean; badge?: string }) => (
  <Pressable onPress={onPress} style={st.link}>
    <View style={[st.linkIcon, danger && { backgroundColor: 'rgba(248,113,113,0.15)' }]}><Icon name={icon} size={20} color={danger ? colors.danger : colors.accent} /></View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: danger ? colors.danger : colors.text, fontWeight: '600' }}>{label}</Text>
      {sub ? <Text style={{ color: colors.textDim, fontSize: 12 }}>{sub}</Text> : null}
    </View>
    {badge ? <Badge label={badge} color={colors.accent} /> : null}
    <Icon name="chevronRight" size={18} color={colors.textMute} />
  </Pressable>
);

/* ======================= ACTIVITY ======================= */
export function ActivityScreen({ navigation }: any) {
  const { sid, active, isAdmin } = useAuth();
  const reviewer = !!active?.canReviewAssistance || isAdmin;
  const go = (n: string, p?: any) => navigation.navigate(n, p);
  const pendingReqs = useAsync(() => api.list<any>(`/societies/${sid}/item-requests/received?status=pending`).then(d => d.items.length).catch(() => 0), [sid]);
  const pendingTutor = useAsync(() => api.list<any>(`/societies/${sid}/tutor-requests/received?status=pending`).then(d => d.items.length).catch(() => 0), [sid]);
  const pendingRide = useAsync(() => api.list<any>(`/societies/${sid}/carpool-requests/received?status=pending`).then(d => d.items.length).catch(() => 0), [sid]);
  const refresh = () => { pendingReqs.refresh(); pendingTutor.refresh(); pendingRide.refresh(); };
  return (
    <Screen onRefresh={refresh} refreshing={pendingReqs.refreshing}>
      <Header back={false} title="Activity" subtitle="Everything you've sent and received." />
      <Link icon="handshake" label="Item requests" sub="Borrow, lend and give-away requests" badge={pendingReqs.data ? `${pendingReqs.data} new` : undefined} onPress={() => go('ItemRequests')} />
      <Link icon="list" label="My needs" sub="Items you asked your neighbours for" onPress={() => go('NeedMatch')} />
      <Link icon="cap" label="Tutor requests" sub="Sessions you asked for or received" badge={pendingTutor.data ? `${pendingTutor.data} new` : undefined} onPress={() => go('TutorRequests')} />
      <Link icon="car" label="Ride requests" sub="Carpool seats" badge={pendingRide.data ? `${pendingRide.data} new` : undefined} onPress={() => go('CarpoolRequests')} />
      <Link icon="home" label="My rental listings" sub="Properties you posted" onPress={() => go('MyRentals')} />
      <Link icon="tag" label="My deals" sub="Offers you posted" onPress={() => go('DealList')} />
      <Link icon="heart" label="Family assistance" sub="Private requests" onPress={() => go('AssistanceList')} />
      {isAdmin ? <><Text style={st.h2}>Admin tasks</Text>
        <Link icon="users" label="Member approvals" sub="Pending join requests" onPress={() => go('Members', { status: 'pending' })} />
        <Link icon="calendar" label="Booking approvals" sub="Pending space bookings" onPress={() => go('ManageBookings')} /></> : null}
      {reviewer && !isAdmin ? <Link icon="heart" label="Assistance review" sub="Requests awaiting review" onPress={() => go('AssistanceList')} /> : null}
    </Screen>
  );
}

/* ======================= PROFILE ======================= */
export function ProfileScreen({ navigation }: any) {
  const { user, active, isAdmin, isGlobalAdmin, refreshMe } = useAuth();
  const [err, setErr] = useState('');
  const go = (n: string, p?: any) => navigation.navigate(n, p);
  const changeAvatar = async () => {
    setErr('');
    try { if (await pickAndSetAvatar()) await refreshMe(); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Screen>
      <Header back={false} title="Profile" />
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Pressable onPress={changeAvatar}>
          <Avatar user={user} size={92} />
          <View style={st.camera}><Icon name="camera" size={14} color={colors.accentText} /></View>
        </Pressable>
        <Text style={[font.section, { color: colors.text, marginTop: 12 }]}>{user?.fullName}</Text>
        <Text style={{ color: colors.textDim }}>{user?.email}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {isGlobalAdmin ? <Badge label="Platform admin" color={colors.warning} /> : null}
          {isAdmin ? <Badge label="Society admin" color={colors.accent} /> : null}
          {active?.isVerifiedResident ? <Badge label="Verified resident" color={colors.success} /> : null}
        </View>
      </View>
      <InlineMessage text={err} />
      {active ? <Card style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>Your society</Text>
        <Text style={[font.cardTitle, { color: colors.text }]}>{active.society.name}</Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>{[active.block && `Block ${active.block}`, active.unitLabel].filter(Boolean).join(' · ')}</Text>
      </Card> : null}
      {isAdmin ? <Link icon="shield" label="Admin dashboard" sub="Members, bookings, reports, settings" onPress={() => go('AdminDashboard')} /> : null}
      <Link icon="user" label="Edit profile" onPress={() => go('EditProfile')} />
      <Link icon="bell" label="Notification settings" onPress={() => go('Settings')} />
      <Link icon="lock" label="Change password" onPress={() => go('ChangePassword')} />
      <Link icon="megaphone" label="Announcements" onPress={() => go('Announcements')} />
      <Link icon="alert" label="Emergency alerts" onPress={() => go('Alerts')} />
      <MySocieties navigation={navigation} />
      <AccountButtons navigation={navigation} />
    </Screen>
  );
}

export function EditProfileScreen({ navigation }: any) {
  const { user, refreshMe } = useAuth();
  const [name, setName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setErr(''); setLoading(true);
    try { await api.patch('/users/me', { fullName: name.trim(), phone: phone.replace(/[\s-]/g, ''), bio: bio.trim() }); await refreshMe(); navigation.goBack(); } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Save" onPress={submit} loading={loading} />}>
      <Header title="Edit profile" />
      <InlineMessage text={err} />
      <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Input label="Mobile number" icon="phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Input label="About me" value={bio} onChangeText={setBio} multiline autoCapitalize="sentences" />
      <Row label="Email" value={user?.email} /><Row label="CNIC" value={user?.cnic} last />
    </Screen>
  );
}

export function SettingsScreen() {
  const { user, refreshMe } = useAuth();
  const n = user?.settings?.notifications || {};
  const [vals, setVals] = useState<Record<string, boolean>>({ announcements: true, bookings: true, requests: true, listings: true, community: true, marketing: false, ...n });
  const toggle = async (k: string, v: boolean) => {
    setVals(p => ({ ...p, [k]: v }));
    try { await api.patch('/users/me/settings', { notifications: { [k]: v } }); await refreshMe(); } catch { setVals(p => ({ ...p, [k]: !v })); }
  };
  const rows = [['announcements', 'Announcements'], ['bookings', 'Bookings'], ['requests', 'Requests & responses'], ['listings', 'Listings'], ['community', 'Community updates'], ['marketing', 'Offers & tips']];
  return (
    <Screen>
      <Header title="Notification settings" subtitle="Choose what you hear about. Emergency alerts are always delivered." />
      {rows.map(([k, l]) => (
        <View key={k} style={st.switchRow}>
          <Text style={{ color: colors.text, flex: 1 }}>{l}</Text>
          <Switch value={!!vals[k]} onValueChange={v => toggle(k, v)} trackColor={{ true: colors.teal, false: colors.border }} thumbColor={vals[k] ? colors.accent : colors.textMute} />
        </View>
      ))}
    </Screen>
  );
}

export function ChangePasswordScreen() {
  const { signOut } = useAuth();
  const [cur, setCur] = useState(''); const [p1, setP1] = useState(''); const [p2, setP2] = useState('');
  const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    if (p1 !== p2) return setErr('New passwords do not match.');
    setLoading(true);
    try { await api.patch('/auth/change-password', { currentPassword: cur, newPassword: p1 }); await signOut(); } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Update password" onPress={submit} loading={loading} />}>
      <Header title="Change password" subtitle="You'll be logged out afterwards." />
      <InlineMessage text={err} />
      <Input label="Current password" icon="lock" value={cur} onChangeText={setCur} password />
      <Input label="New password" icon="lock" value={p1} onChangeText={setP1} password hint="8+ characters with a letter and a number" />
      <Input label="Confirm new password" icon="lock" value={p2} onChangeText={setP2} password />
    </Screen>
  );
}

export function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const [pw, setPw] = useState(''); const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
  const submit = async () => {
    setErr(''); setLoading(true);
    try { await api.del('/users/me', { password: pw }); await signOut(); } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Delete my account" variant="danger" onPress={submit} loading={loading} />}>
      <Header title="Delete account" subtitle="This permanently removes your account and cannot be undone." />
      <InlineMessage text={err} />
      <Input label="Confirm with your password" icon="lock" value={pw} onChangeText={setPw} password />
    </Screen>
  );
}

export function SwitchSocietyScreen({ navigation }: any) {
  return (
    <Screen>
      <Header title="My societies" subtitle="Tap a society to switch to it." />
      <MySocieties navigation={navigation} title="" />
    </Screen>
  );
}

/* ======================= ADMIN ======================= */
export function AdminDashboardScreen({ navigation }: any) {
  const { sid, active } = useAuth();
  const q = useAsync(() => api.get<any>(`/societies/${sid}`), [sid]);
  const stats = useAsync(() => api.get<any>(`/societies/${sid}/admin/stats`).then(d => d.stats), [sid]);
  const s = stats.data || {};
  const soc = q.data?.society || q.data;
  const go = (n: string, p?: any) => navigation.navigate(n, p);
  const tiles = [
    { l: 'Active members', v: s.active }, { l: 'Pending members', v: s.pendingMembers, to: 'Members', p: { status: 'pending' } },
    { l: 'Pending bookings', v: s.pendingBookings, to: 'ManageBookings' }, { l: 'Open reports', v: s.openReports, to: 'Reports' },
    { l: 'Spaces', v: s.spaces, to: 'SpaceList' }, { l: 'Open needs', v: s.needs },
  ];
  return (
    <Screen onRefresh={() => { stats.refresh(); q.refresh(); }} refreshing={stats.refreshing}>
      <Header title="Admin dashboard" subtitle={active?.society?.name} />
      {soc?.joinCode ? (
        <Card style={{ marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>Society join code — share with residents</Text>
          <Text selectable style={{ color: colors.accent, fontSize: 30, fontWeight: '800', letterSpacing: 4, marginVertical: 6 }}>{soc.joinCode}</Text>
          <Button small variant="secondary" title="Generate new code" onPress={async () => { try { await api.post(`/societies/${sid}/join-code/regenerate`); q.reload(true); } catch {} }} />
        </Card>
      ) : null}
      {stats.loading ? <Loader /> : stats.error ? <ErrorBox error={stats.error} onRetry={stats.reload} /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {tiles.map(t => (
            <Pressable key={t.l} onPress={t.to ? () => go(t.to!, t.p) : undefined} style={st.stat}>
              <Text style={{ color: colors.accent, fontSize: 28, fontWeight: '800' }}>{t.v ?? 0}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>{t.l}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={st.h2}>Manage</Text>
      <Link icon="users" label="Members" sub="Approve, verify, promote, suspend" onPress={() => go('Members')} />
      <Link icon="calendar" label="Bookings" sub="Approve or reject space bookings" onPress={() => go('ManageBookings')} />
      <Link icon="building" label="Community spaces" sub="Add halls and set opening hours" onPress={() => go('SpaceList')} />
      <Link icon="flag" label="Reports" sub="Moderate reported content" onPress={() => go('Reports')} />
      <Link icon="megaphone" label="Post announcement" onPress={() => go('AnnouncementForm')} />
      <Link icon="alert" label="Send emergency alert" onPress={() => go('AlertForm')} />
      <Link icon="settings" label="Society settings" onPress={() => go('SocietySettings')} />
      <Link icon="list" label="Audit log" onPress={() => go('AuditLog')} />
      <MySocieties navigation={navigation} />
      <AccountButtons navigation={navigation} />
    </Screen>
  );
}

export function MembersScreen({ route }: any) {
  const { sid, user } = useAuth();
  const [status, setStatus] = useState(route.params?.status || 'active');
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const q = useAsync(() => api.list<any>(`/societies/${sid}/members?status=${status}&search=${encodeURIComponent(dq)}&limit=50`), [sid, status, dq]);
  const [err, setErr] = useState('');
  const act = async (m: any, path: string, body: any = {}, method: 'patch' | 'del' = 'patch') => {
    setErr('');
    try { await (method === 'patch' ? api.patch(`/societies/${sid}/members/${m._id}/${path}`, body) : api.del(`/societies/${sid}/members/${m._id}`, body)); q.reload(true); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <ListScreen title="Members" data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<><InlineMessage text={err} /><SearchBar value={search} onChangeText={setSearch} placeholder="Search members" />
        <ChipRow value={status} onChange={setStatus} options={['pending', 'active', 'suspended', 'rejected'].map(s => ({ value: s, label: humanize(s) }))} /></>}
      empty={{ icon: 'users', title: 'No members here' }}
      renderItem={m => {
        const u = m.user || {};
        const me = String(u._id || u) === user?._id;
        return (
          <Card>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Avatar user={u} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={[font.cardTitle, { color: colors.text }]}>{u.fullName}</Text>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>{[m.block && `Block ${m.block}`, m.unitLabel, humanize(m.residentType)].filter(Boolean).join(' · ')}</Text>
                {u.phone ? <Text style={{ color: colors.textDim, fontSize: 12 }}>{u.phone}</Text> : null}
                {m.note ? <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 2 }}>“{m.note}”</Text> : null}
              </View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}><Badge label={m.role === 'admin' ? 'Admin' : 'Resident'} color={colors.info} />{m.isVerifiedResident ? <Badge label="Verified" color={colors.success} /> : null}</View>
            </View>
            {status === 'pending' ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Button small style={{ flex: 1 }} title="Approve & verify" onPress={() => act(m, 'approve', { markVerified: true })} />
                <Button small style={{ flex: 1 }} variant="danger" title="Reject" onPress={() => act(m, 'reject', { reason: 'Could not verify your details' })} />
              </View>
            ) : status === 'active' && !me ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <Button small variant="secondary" title={m.isVerifiedResident ? 'Unverify' : 'Verify'} onPress={() => act(m, 'verify', { isVerifiedResident: !m.isVerifiedResident })} />
                <Button small variant="secondary" title={m.role === 'admin' ? 'Make resident' : 'Make admin'} onPress={() => act(m, 'role', { role: m.role === 'admin' ? 'resident' : 'admin' })} />
                <Button small variant="secondary" title={m.canReviewAssistance ? 'Remove reviewer' : 'Make reviewer'} onPress={() => act(m, 'permissions', { canReviewAssistance: !m.canReviewAssistance })} />
                <Button small variant="danger" title="Suspend" onPress={() => act(m, 'suspend', { suspended: true, reason: 'Suspended by admin' })} />
              </View>
            ) : status === 'suspended' ? (
              <Button small style={{ marginTop: 12 }} title="Reinstate" onPress={() => act(m, 'suspend', { suspended: false })} />
            ) : null}
          </Card>
        );
      }} />
  );
}

export function ReportsScreen() {
  const { sid } = useAuth();
  const [status, setStatus] = useState('open');
  const q = useAsync(() => api.list<any>(`/societies/${sid}/reports?status=${status}&limit=50`), [sid, status]);
  const [err, setErr] = useState('');
  const resolve = async (r: any, action: string) => {
    setErr('');
    try { await api.patch(`/societies/${sid}/reports/resolve`, { reportId: r._id, action, resolutionNote: 'Reviewed by admin' }); q.reload(true); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <ListScreen title="Reports" data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<><InlineMessage text={err} /><ChipRow value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]} /></>}
      empty={{ icon: 'flag', title: 'No reports', text: 'Nothing needs moderation.' }}
      renderItem={r => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[font.cardTitle, { color: colors.text }]}>{humanize(r.targetType)}</Text><Badge label={humanize(r.reason)} color={colors.warning} /></View>
          {r.details ? <Text style={{ color: colors.textDim, marginTop: 6 }}>{r.details}</Text> : null}
          <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 6 }}>{timeAgo(r.createdAt)}</Text>
          {r.status === 'open' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <Button small variant="secondary" title="Dismiss" onPress={() => resolve(r, 'dismiss')} />
            <Button small variant="secondary" title="Warn" onPress={() => resolve(r, 'warn')} />
            <Button small variant="danger" title="Remove content" onPress={() => resolve(r, 'remove_content')} />
          </View> : null}
        </Card>
      )} />
  );
}

export function SocietySettingsScreen() {
  const { sid, refreshMe } = useAuth();
  const q = useAsync(() => api.get<any>(`/societies/${sid}`), [sid]);
  const soc = q.data?.society || q.data;
  if (q.loading) return <Screen><Loader /></Screen>;
  return <SettingsInner soc={soc} sid={sid} refreshMe={refreshMe} />;
}
function SettingsInner({ soc, sid, refreshMe }: any) {
  const [s, setS] = useState({ requireListingApproval: soc?.settings?.requireListingApproval ?? true, allowResidentDeals: soc?.settings?.allowResidentDeals ?? true });
  const [name, setName] = useState(soc?.name || '');
  const [area, setArea] = useState(soc?.area || '');
  const [blocks, setBlocks] = useState((soc?.blocks || []).join(', '));
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setErr(''); setMsg(''); setLoading(true);
    try {
      await api.patch(`/societies/${sid}`, { name: name.trim(), area: area.trim(), blocks: blocks.split(',').map((b: string) => b.trim()).filter(Boolean) });
      await api.patch(`/societies/${sid}/settings`, s);
      await refreshMe(); setMsg('Saved.');
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Save settings" onPress={save} loading={loading} />}>
      <Header title="Society settings" />
      <InlineMessage text={err} /><InlineMessage text={msg} kind="success" />
      <Input label="Society name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Input label="Area" value={area} onChangeText={setArea} autoCapitalize="words" />
      <Input label="Blocks (comma separated) (optional)" value={blocks} onChangeText={setBlocks} />
      {([['requireListingApproval', 'Require admin approval for rentals & services'], ['allowResidentDeals', 'Allow residents to post deals']] as const).map(([k, l]) => (
        <View key={k} style={st.switchRow}>
          <Text style={{ color: colors.text, flex: 1 }}>{l}</Text>
          <Switch value={!!(s as any)[k]} onValueChange={v => setS(p => ({ ...p, [k]: v }))} trackColor={{ true: colors.teal, false: colors.border }} thumbColor={(s as any)[k] ? colors.accent : colors.textMute} />
        </View>
      ))}
    </Screen>
  );
}

export function AuditLogScreen() {
  const { sid } = useAuth();
  const q = useAsync(() => api.list<any>(`/societies/${sid}/admin/audit-logs?limit=50`), [sid]);
  return (
    <ListScreen title="Audit log" data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      empty={{ icon: 'list', title: 'No activity yet' }}
      renderItem={l => (
        <Card><Text style={{ color: colors.text, fontWeight: '600' }}>{humanize(l.action)}</Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{l.actor?.fullName || 'System'} · {fmtDateTime(l.createdAt)}</Text></Card>
      )} />
  );
}

const st = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  linkIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  groupText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  stat: { width: '47.5%', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
});
