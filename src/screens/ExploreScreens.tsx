import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errMsg, qs } from '../api';
import { useAuth } from '../auth';
import { colors, font } from '../theme';
import {
  Avatar, Badge, Button, Card, Chip, ChipRow, Empty, ErrorBox, Header, Icon, InlineMessage, Input, ListScreen, Loader,
  Row, Screen, SearchBar, Select, humanize, timeAgo, toOptions, useAsync, useDebounced, useFocusReload,
} from '../ui';
import { FEE_UNITS, SERVICE_CATEGORIES, TEACHING_MODES, TUTOR_GRADES, TUTOR_SUBJECTS } from '../lib/enums';
import { PhotoStrip } from './HomeScreens';
import { pickAndUploadImages } from '../lib/upload';

/* ======================= EXPLORE ======================= */
const CATS = [
  { icon: 'cap', label: 'Find a Tutor', sub: 'Learn a little more', to: 'TutorList' },
  { icon: 'tool', label: 'Home Services', sub: 'Help for your home', to: 'ServiceList' },
  { icon: 'handshake', label: 'Need → Match', sub: 'Borrow from neighbours', to: 'NeedMatch' },
  { icon: 'building', label: 'Community Spaces', sub: 'Make room for moments', to: 'SpaceList' },
  { icon: 'home', label: 'House for Rent', sub: 'Browse local rentals', to: 'RentalList' },
  { icon: 'gift', label: 'Give Away', sub: 'Share items for free', to: 'ItemList', params: { type: 'giveaway' } },
  { icon: 'car', label: 'Carpool', sub: 'Share rides', to: 'CarpoolList' },
  { icon: 'stethoscope', label: 'Nearby Doctors', sub: 'Local directory', to: 'DoctorList' },
  { icon: 'tag', label: 'Local Deals', sub: 'A little local value', to: 'DealList' },
  { icon: 'megaphone', label: 'Announcements', sub: 'Official notices', to: 'Announcements' },
  { icon: 'alert', label: 'Emergency Alerts', sub: 'Urgent updates', to: 'Alerts' },
  { icon: 'heart', label: 'Family Assistance', sub: 'Private, verified help', to: 'AssistanceList' },
];

export function ExploreScreen({ navigation }: any) {
  const [q, setQ] = useState('');
  const list = CATS.filter(c => c.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Screen>
      <Header back={false} title="Explore" subtitle="Discover everything around your neighbourhood." />
      <SearchBar value={q} onChangeText={setQ} placeholder="What are you looking for?" />
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginVertical: 8 }}>Explore Categories</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {list.map(c => (
          <Pressable key={c.label} style={st.tile} onPress={() => navigation.navigate(c.to, c.params)}>
            <Icon name={c.icon} size={26} color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '700', marginTop: 12 }}>{c.label}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{c.sub}</Text>
          </Pressable>
        ))}
      </View>
      {!list.length ? <Empty icon="search" title="Nothing found" /> : null}
    </Screen>
  );
}

/* ======================= TUTORS ======================= */
const feeText = (t: any) => {
  const unit = t.feeUnit === 'per_hour' ? 'Hour' : 'Month';
  if (!t.feeMin && !t.feeMax) return 'Fee on request';
  return t.feeMax && t.feeMax !== t.feeMin ? `PKR ${t.feeMin}–${t.feeMax} / ${unit}` : `PKR ${t.feeMin || t.feeMax} / ${unit}`;
};

export function TutorListScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const dq = useDebounced(search);
  const q = useAsync(() => api.list<any>(`/societies/${sid}/tutors${qs({ search: dq, subject, grade, limit: 30 })}`), [sid, dq, subject, grade]);
  const me = useAsync(() => api.get<any>(`/societies/${sid}/tutors/me`).then(d => d.tutor).catch(() => null), [sid]);
  useFocusReload(me.reload);
  return (
    <ListScreen title="Find a Tutor" subtitle="Connect with experienced tutors nearby." data={q.data?.items} loading={q.loading} error={q.error}
      reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      right={<View style={{ flexDirection: 'row', gap: 14 }}>
        <Pressable onPress={() => navigation.navigate('TutorRequests')}><Text style={{ color: colors.accent, fontWeight: '600' }}>Requests</Text></Pressable>
        <Pressable onPress={() => navigation.navigate('TutorForm')}><Text style={{ color: colors.accent, fontWeight: '600' }}>{me.data ? 'My profile' : 'Become a tutor'}</Text></Pressable>
      </View>}
      header={<>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search subject or tutor..." />
        <ChipRow options={[{ value: '', label: 'All subjects' }, ...toOptions(TUTOR_SUBJECTS)]} value={subject} onChange={setSubject} />
        <ChipRow options={[{ value: '', label: 'All grades' }, ...toOptions(TUTOR_GRADES)]} value={grade} onChange={setGrade} />
      </>}
      empty={{ icon: 'cap', title: 'No tutors found', text: 'Try a different filter, or offer your own lessons.', action: 'Become a tutor', onAction: () => navigation.navigate('TutorForm') }}
      renderItem={t => (
        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Avatar user={{ ...t.user, avatar: t.photo?.url ? t.photo : t.user?.avatar }} size={54} />
            <View style={{ flex: 1 }}>
              <Text style={[font.cardTitle, { color: colors.text }]}>{t.user?.fullName}</Text>
              <Text style={{ color: colors.textDim, fontSize: 13 }}>{t.headline}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {(t.subjects || []).slice(0, 3).map((s: string) => <Badge key={s} label={humanize(s)} color={colors.accent} />)}
            {t.experienceYears ? <Badge label={`${t.experienceYears} yrs`} color={colors.info} /> : null}
            {t.isVerified ? <Badge label="Verified" color={colors.success} /> : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{feeText(t)}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>{(t.teachingMode || []).map(humanize).join(' · ')}</Text>
          </View>
          <Button title="View Profile" small style={{ marginTop: 12 }} onPress={() => navigation.navigate('TutorDetail', { id: t._id })} />
        </Card>
      )} />
  );
}

export function TutorDetailScreen({ route, navigation }: any) {
  const { sid } = useAuth();
  const { id } = route.params;
  const q = useAsync(() => api.get<any>(`/societies/${sid}/tutors/${id}`), [id]);
  const t = q.data?.tutor;
  const [f, setF] = useState({ studentName: '', grade: '', subject: '', mode: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));

  const send = async () => {
    setErr('');
    if (f.studentName.trim().length < 2 || !f.grade || !f.subject || !f.mode) return setErr('Student name, grade, subject and mode are required.');
    setLoading(true);
    try {
      await api.post(`/societies/${sid}/tutors/${id}/requests`, {
        studentName: f.studentName.trim(), grade: f.grade, subjects: [f.subject], preferredMode: f.mode, message: f.message.trim() || undefined,
      });
      setDone(true); q.reload(true);
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  const report = () => navigation.navigate('ReportForm', { targetType: 'tutor', targetId: id });
  const mine = q.data?.myRequest;

  return (
    <Screen>
      <Header title="Meet your tutor" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : t && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar user={{ ...t.user, avatar: t.photo?.url ? t.photo : t.user?.avatar }} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={[font.section, { color: colors.text }]}>{t.user?.fullName}</Text>
                <Text style={{ color: colors.textDim }}>{t.headline}</Text>
                {t.isVerified ? <View style={{ marginTop: 6 }}><Badge label="Verified" color={colors.success} /></View> : null}
              </View>
            </View>
            <View style={{ height: 14 }} />
            <Row label="Experience" value={`${t.experienceYears ?? 0} years`} />
            <Row label="Fee" value={feeText(t)} />
            <Row label="Mode" value={(t.teachingMode || []).map(humanize).join(', ')} />
            <Row label="Grades" value={(t.grades || []).map(humanize).join(', ')} />
            <Row label="Subjects" value={(t.subjects || []).map(humanize).join(', ')} last />
          </Card>
          <Text style={st.h2}>About</Text>
          <Text style={{ color: colors.textDim, lineHeight: 21 }}>{t.bio || 'No description provided.'}</Text>
          {t.qualifications ? <Text style={{ color: colors.textDim, marginTop: 8 }}>Qualifications: {t.qualifications}</Text> : null}

          <Text style={st.h2}>Request a session</Text>
          {mine && mine.status !== 'cancelled' ? (
            <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.text }}>Your request for {mine.studentName}</Text><Badge status={mine.status} /></View>
              {mine.status === 'accepted' ? <Text style={{ color: colors.success, marginTop: 8 }}>Accepted — contact the tutor on {t.phone}{t.whatsapp ? ` / WhatsApp ${t.whatsapp}` : ''}.</Text> : null}
            </Card>
          ) : done ? <InlineMessage kind="success" text="Request sent. The tutor will confirm the schedule. No payment is collected here." /> : (
            <>
              <InlineMessage text={err} />
              <Input label="Student name" value={f.studentName} onChangeText={set('studentName')} autoCapitalize="words" />
              <Select label="Student grade" value={f.grade} options={toOptions(TUTOR_GRADES)} onChange={set('grade')} />
              <Select label="Subject" value={f.subject} options={toOptions(t.subjects || TUTOR_SUBJECTS)} onChange={set('subject')} />
              <Select label="Preferred mode" value={f.mode} options={toOptions(t.teachingMode || TEACHING_MODES)} onChange={set('mode')} />
              <Input label="Message" value={f.message} onChangeText={set('message')} multiline placeholder="Tell the tutor what kind of learning support you need." autoCapitalize="sentences" />
              <Button title="Send Request" onPress={send} loading={loading} />
            </>
          )}
          <Pressable onPress={report} style={{ alignItems: 'center', marginTop: 18 }}><Text style={{ color: colors.textMute }}>Report this profile</Text></Pressable>
        </>
      )}
    </Screen>
  );
}

export function TutorFormScreen({ navigation }: any) {
  const { sid, user } = useAuth();
  const mine = useAsync(() => api.get<any>(`/societies/${sid}/tutors/me`).then(d => d.tutor).catch(() => null), [sid]);
  if (mine.loading) return <Screen><Loader /></Screen>;
  return <TutorFormInner existing={mine.data} sid={sid} phone={user?.phone || ''} navigation={navigation} />;
}

function TutorFormInner({ existing: ex, sid, phone, navigation }: any) {
  const [f, setF] = useState({
    headline: ex?.headline || '', bio: ex?.bio || '', qualifications: ex?.qualifications || '', phone: ex?.phone || phone || '',
    whatsapp: ex?.whatsapp || '', feeMin: String(ex?.feeMin ?? ''), feeMax: String(ex?.feeMax ?? ''), feeUnit: ex?.feeUnit || 'per_month',
    experienceYears: String(ex?.experienceYears ?? ''),
  });
  const [subjects, setSubjects] = useState<string[]>(ex?.subjects || []);
  const [grades, setGrades] = useState<string[]>(ex?.grades || []);
  const [modes, setModes] = useState<string[]>(ex?.teachingMode || []);
  const [photo, setPhoto] = useState<any[]>(ex?.photo?.url ? [ex.photo] : []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const toggle = (arr: string[], setArr: (a: string[]) => void, v: string) => setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const submit = async () => {
    setErr('');
    if (f.headline.trim().length < 5) return setErr('Headline needs at least 5 characters.');
    if (!subjects.length || !grades.length || !modes.length) return setErr('Choose at least one subject, grade and teaching mode.');
    if (!photo.length) return setErr('Please add a profile photo.');
    setLoading(true);
    try {
      const body: any = {
        headline: f.headline.trim(), bio: f.bio.trim(), qualifications: f.qualifications.trim(), phone: f.phone.replace(/[\s-]/g, ''),
        whatsapp: f.whatsapp.trim() ? f.whatsapp.replace(/[\s-]/g, '') : '', subjects, grades, teachingMode: modes, availability: ex?.availability || [],
        feeMin: Number(f.feeMin) || 0, feeMax: Number(f.feeMax) || 0, feeUnit: f.feeUnit, experienceYears: Number(f.experienceYears) || 0, photo: photo[0],
      };
      if (ex) await api.patch(`/societies/${sid}/tutors/me`, body); else await api.post(`/societies/${sid}/tutors/profile`, body);
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  const remove = async () => { try { await api.del(`/societies/${sid}/tutors/me`); navigation.goBack(); } catch (e) { setErr(errMsg(e)); } };

  const Multi = ({ label, options, value, onToggle }: { label: string; options: readonly string[]; value: string[]; onToggle: (v: string) => void }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(o => <Chip key={o} label={humanize(o)} active={value.includes(o)} onPress={() => onToggle(o)} />)}</View>
    </View>
  );
  return (
    <Screen footer={<Button title={ex ? 'Save profile' : 'Create tutor profile'} onPress={submit} loading={loading} />}>
      <Header title={ex ? 'My tutor profile' : 'Create tutor profile'} subtitle="Introduce yourself to families in your community." />
      <InlineMessage text={err} />
      <PhotoStrip label="Profile photo" images={photo} onAdd={async () => { try { setPhoto((await pickAndUploadImages(false)).slice(0, 1)); } catch (e) { setErr(errMsg(e)); } }} onRemove={() => setPhoto([])} />
      <Input label="Headline" value={f.headline} onChangeText={set('headline')} placeholder="Mathematics & Physics tutor" autoCapitalize="sentences" />
      <Input label="About you" value={f.bio} onChangeText={set('bio')} multiline autoCapitalize="sentences" />
      <Input label="Qualifications" value={f.qualifications} onChangeText={set('qualifications')} autoCapitalize="sentences" />
      <Multi label="Subjects" options={TUTOR_SUBJECTS} value={subjects} onToggle={v => toggle(subjects, setSubjects, v)} />
      <Multi label="Grades" options={TUTOR_GRADES} value={grades} onToggle={v => toggle(grades, setGrades, v)} />
      <Multi label="Teaching mode" options={TEACHING_MODES} value={modes} onToggle={v => toggle(modes, setModes, v)} />
      <Input label="Phone" icon="phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Input label="WhatsApp (optional)" icon="phone" value={f.whatsapp} onChangeText={set('whatsapp')} keyboardType="phone-pad" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Input style={{ flex: 1 }} label="Fee from (PKR)" value={f.feeMin} onChangeText={set('feeMin')} keyboardType="number-pad" />
        <Input style={{ flex: 1 }} label="Fee to (PKR)" value={f.feeMax} onChangeText={set('feeMax')} keyboardType="number-pad" />
      </View>
      <Select label="Fee unit" value={f.feeUnit} options={toOptions(FEE_UNITS)} onChange={set('feeUnit')} />
      <Input label="Years of experience" value={f.experienceYears} onChangeText={set('experienceYears')} keyboardType="number-pad" />
      {ex ? <Button title="Delete my tutor profile" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}

export function TutorRequestsScreen() {
  const { sid } = useAuth();
  const [tab, setTab] = useState('received');
  const q = useAsync(() => api.list<any>(`/societies/${sid}/tutor-requests/${tab}`), [sid, tab]);
  const act = async (id: string, action: 'accept' | 'reject' | 'cancel') => {
    try { await api.patch(`/societies/${sid}/tutor-requests/${id}/${action}`, {}); q.reload(true); } catch {}
  };
  return (
    <ListScreen title="Tutor requests" data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<ChipRow value={tab} onChange={setTab} options={[{ value: 'received', label: 'Received' }, { value: 'sent', label: 'Sent' }]} />}
      empty={{ icon: 'cap', title: 'No requests' }}
      renderItem={r => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[font.cardTitle, { color: colors.text }]}>{r.studentName}</Text><Badge status={r.status} />
          </View>
          <Text style={{ color: colors.textDim, marginTop: 4 }}>{tab === 'received' ? `From ${r.requester?.fullName}` : `To ${r.tutorUser?.fullName}`} · {humanize(r.grade)} · {(r.subjects || []).map(humanize).join(', ')}</Text>
          {r.message ? <Text style={{ color: colors.text, marginTop: 6 }}>{r.message}</Text> : null}
          {tab === 'sent' && r.status === 'accepted' && r.tutorUser?.phone ? <Text style={{ color: colors.success, marginTop: 6 }}>Call: {r.tutorUser.phone}</Text> : null}
          <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 6 }}>{timeAgo(r.createdAt)}</Text>
          {r.status === 'pending' ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              {tab === 'received' ? <>
                <Button small title="Accept" style={{ flex: 1 }} onPress={() => act(r._id, 'accept')} />
                <Button small title="Decline" variant="danger" style={{ flex: 1 }} onPress={() => act(r._id, 'reject')} />
              </> : <Button small title="Cancel request" variant="danger" style={{ flex: 1 }} onPress={() => act(r._id, 'cancel')} />}
            </View>
          ) : null}
        </Card>
      )} />
  );
}

/* ======================= LOCAL SERVICES ======================= */
const Stars = ({ v }: { v: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Icon name="star" size={14} color={colors.warning} fill={colors.warning} />
    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{v ? v.toFixed(1) : 'New'}</Text>
  </View>
);

export function ServiceListScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const dq = useDebounced(search);
  const q = useAsync(() => api.list<any>(`/societies/${sid}/services${qs({ search: dq, category: cat, limit: 30 })}`), [sid, dq, cat]);
  return (
    <ListScreen title="Home Services" subtitle="Find professionals for your everyday needs." data={q.data?.items} loading={q.loading} error={q.error}
      reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      right={<Pressable onPress={() => navigation.navigate('ServiceForm')}><Text style={{ color: colors.accent, fontWeight: '600' }}>Offer a service</Text></Pressable>}
      header={<><SearchBar value={search} onChangeText={setSearch} placeholder="Search a service..." />
        <ChipRow value={cat} onChange={setCat} options={[{ value: '', label: 'All' }, ...toOptions(SERVICE_CATEGORIES)]} /></>}
      empty={{ icon: 'tool', title: 'No providers yet', text: 'Be the first to list a service.', action: 'Offer a service', onAction: () => navigation.navigate('ServiceForm') }}
      renderItem={s => (
        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Avatar user={{ avatar: s.images?.[0] }} label={s.providerName} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={[font.cardTitle, { color: colors.text }]}>{s.providerName}</Text>
              <Text style={{ color: colors.textDim, fontSize: 13 }}>{humanize(s.category)}{s.businessName ? ` · ${s.businessName}` : ''}</Text>
            </View>
            <Stars v={s.avgRating} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {s.reviewCount ? <Badge label={`${s.reviewCount} reviews`} color={colors.info} /> : null}
            {s.isVerified ? <Badge label="Verified" color={colors.success} /> : null}
            {s.emergencyAvailable ? <Badge label="Emergency" color={colors.danger} /> : null}
          </View>
          {s.priceNote ? <Text style={{ color: colors.text, fontWeight: '700', marginTop: 10 }}>{s.priceNote}</Text> : null}
          <Button title="View provider" small style={{ marginTop: 12 }} onPress={() => navigation.navigate('ServiceDetail', { id: s._id })} />
        </Card>
      )} />
  );
}

export function ServiceDetailScreen({ route, navigation }: any) {
  const { sid, user } = useAuth();
  const { id } = route.params;
  const q = useAsync(() => api.get<any>(`/societies/${sid}/services/${id}`), [id]);
  const rv = useAsync(() => api.list<any>(`/societies/${sid}/services/${id}/reviews`), [id]);
  const s = q.data?.service || q.data;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = s && String(s.owner?._id || s.owner) === user?._id;
  const post = async () => {
    setErr(''); setBusy(true);
    try { await api.post(`/societies/${sid}/services/${id}/reviews`, { rating, comment: comment.trim() || undefined }); setComment(''); q.reload(true); rv.reload(true); }
    catch (e) { setErr(errMsg(e)); }
    setBusy(false);
  };
  return (
    <Screen>
      <Header title="Service Provider" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : s && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar user={{ avatar: s.images?.[0] }} label={s.providerName} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={[font.section, { color: colors.text }]}>{s.providerName}</Text>
                <Text style={{ color: colors.textDim }}>{humanize(s.category)}</Text>
                <View style={{ marginTop: 6 }}><Stars v={s.avgRating} /></View>
              </View>
            </View>
            <View style={{ height: 12 }} />
            {s.priceNote ? <Row label="Price" value={s.priceNote} /> : null}
            {s.availability ? <Row label="Availability" value={s.availability} /> : null}
            {s.phone ? <Row label="Phone" value={s.phone} /> : null}
            {s.whatsapp ? <Row label="WhatsApp" value={s.whatsapp} /> : null}
            <Row label="Service areas" value={(s.serviceAreas || []).join(', ') || undefined} last />
          </Card>
          <Text style={st.h2}>About</Text>
          <Text style={{ color: colors.textDim, lineHeight: 21 }}>{s.description || 'No description provided.'}</Text>
          {mine ? <Button title="Edit my listing" variant="secondary" style={{ marginTop: 14 }} onPress={() => navigation.navigate('ServiceForm', { service: s })} /> : null}

          <Text style={st.h2}>Reviews</Text>
          {!mine ? (
            <Card style={{ marginBottom: 12 }}>
              <InlineMessage text={err} />
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                {[1, 2, 3, 4, 5].map(n => <Pressable key={n} onPress={() => setRating(n)}><Icon name="star" size={28} color={colors.warning} fill={n <= rating ? colors.warning : 'none'} /></Pressable>)}
              </View>
              <Input placeholder="Share your experience (optional)" value={comment} onChangeText={setComment} multiline autoCapitalize="sentences" />
              <Button title="Post review" small onPress={post} loading={busy} />
            </Card>
          ) : null}
          {rv.loading ? <Loader /> : (rv.data?.items.length ? rv.data.items.map(r => (
            <Card key={r._id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Avatar user={r.user} size={34} /><Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{r.user?.fullName}</Text><Stars v={r.rating} />
              </View>
              {r.comment ? <Text style={{ color: colors.textDim, marginTop: 8 }}>{r.comment}</Text> : null}
            </Card>
          )) : <Text style={{ color: colors.textMute }}>No reviews yet.</Text>)}
          <Pressable onPress={() => navigation.navigate('ReportForm', { targetType: 'service', targetId: id })} style={{ alignItems: 'center', marginTop: 18 }}><Text style={{ color: colors.textMute }}>Report this listing</Text></Pressable>
        </>
      )}
    </Screen>
  );
}

export function ServiceFormScreen({ route, navigation }: any) {
  const { sid, user } = useAuth();
  const ex = route.params?.service;
  const [f, setF] = useState({
    category: ex?.category || '', providerName: ex?.providerName || user?.fullName || '', businessName: ex?.businessName || '', description: ex?.description || '',
    phone: ex?.phone || user?.phone || '', whatsapp: ex?.whatsapp || '', priceNote: ex?.priceNote || '', availability: ex?.availability || '',
    serviceAreas: (ex?.serviceAreas || []).join(', '),
  });
  const [emergency, setEmergency] = useState(!!ex?.emergencyAvailable);
  const [images, setImages] = useState<any[]>(ex?.images || []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (!f.category || f.providerName.trim().length < 2) return setErr('Category and provider name are required.');
    setLoading(true);
    try {
      const body: any = {
        category: f.category, providerName: f.providerName.trim(), businessName: f.businessName.trim() || undefined, description: f.description.trim() || undefined,
        phone: f.phone.trim() || undefined, whatsapp: f.whatsapp.trim() || undefined, priceNote: f.priceNote.trim() || undefined, availability: f.availability.trim() || undefined,
        serviceAreas: f.serviceAreas.split(",").map((x: string) => x.trim()).filter(Boolean), emergencyAvailable: emergency, images,
      };
      if (ex) await api.patch(`/societies/${sid}/services/${ex._id}`, body); else await api.post(`/societies/${sid}/services`, body);
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  const remove = async () => { try { await api.del(`/societies/${sid}/services/${ex._id}`); navigation.popToTop(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Screen footer={<Button title={ex ? 'Save listing' : 'Submit for verification'} onPress={submit} loading={loading} />}>
      <Header title={ex ? 'Edit service' : 'Create Service Profile'} subtitle="Introduce your services to residents in the community." />
      <InlineMessage text={err} />
      <PhotoStrip images={images} onAdd={async () => { try { setImages([...images, ...(await pickAndUploadImages(true))].slice(0, 6)); } catch (e) { setErr(errMsg(e)); } }} onRemove={i => setImages(images.filter((_, k) => k !== i))} />
      <Input label="Your / provider name" value={f.providerName} onChangeText={set('providerName')} autoCapitalize="words" />
      <Input label="Business / service name" value={f.businessName} onChangeText={set('businessName')} autoCapitalize="words" />
      <Select label="Service category" value={f.category} options={toOptions(SERVICE_CATEGORIES)} onChange={set('category')} />
      <Input label="Short description" value={f.description} onChangeText={set('description')} multiline autoCapitalize="sentences" />
      <Input label="Phone" icon="phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Input label="WhatsApp" icon="phone" value={f.whatsapp} onChangeText={set('whatsapp')} keyboardType="phone-pad" />
      <Input label="Price note" value={f.priceNote} onChangeText={set('priceNote')} placeholder="e.g. PKR 5,000 / visit" />
      <Input label="Availability" value={f.availability} onChangeText={set('availability')} placeholder="Mon–Sat, 9am–6pm" />
      <Input label="Service areas (comma separated)" value={f.serviceAreas} onChangeText={set('serviceAreas')} />
      <Pressable onPress={() => setEmergency(e => !e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <View style={[st.check, emergency && { backgroundColor: colors.accent, borderColor: colors.accent }]}>{emergency ? <Icon name="check" size={14} color={colors.accentText} strokeWidth={3} /> : null}</View>
        <Text style={{ color: colors.text }}>Available for emergencies</Text>
      </Pressable>
      {ex ? <Button title="Delete listing" variant="danger" onPress={remove} /> : null}
      <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 10 }}>New listings may need society admin approval before they appear to residents.</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  tile: { width: '47.5%', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, minHeight: 112 },
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
