import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errMsg, imageUrl, qs } from '../api';
import { useAuth } from '../auth';
import { colors, font } from '../theme';
import {
  Badge, Button, Card, ChipRow, DateInput, ErrorBox, Header, InlineMessage, Input, ListScreen, Loader, Row, Screen, SearchBar, Select,
  addDays, fmtDate, humanize, isHm, isYmd, timeAgo, toOptions, useAsync, useDebounced,
} from '../ui';
import {
  ASSISTANCE_CATEGORIES, ASSISTANCE_URGENCY, FURNISHING, PROPERTY_TYPES, REPORT_REASONS,
} from '../lib/enums';
import { PhotoStrip } from './HomeScreens';
import { pickAndUploadImages } from '../lib/upload';

const Img = ({ im, h = 150 }: { im?: any; h?: number }) => (im ? <Image source={{ uri: imageUrl(im) }} style={{ height: h, borderRadius: 12, marginBottom: 10, backgroundColor: colors.cardAlt }} /> : null);
const addPhotos = (images: any[], setImages: (i: any[]) => void, setErr: (s: string) => void, max: number) => async () => {
  try { setImages([...images, ...(await pickAndUploadImages(true))].slice(0, max)); } catch (e) { setErr(errMsg(e)); }
};
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/* ======================= RENTALS ======================= */
export function RentalListScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const q = useAsync(() => api.list<any>(`/societies/${sid}/rentals${qs({ propertyType: type, search: dq, limit: 30 })}`), [sid, type, dq]);
  return (
    <ListScreen title="House for Rent" subtitle="Browse rentals in your community." data={q.data?.items} loading={q.loading} error={q.error}
      reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      right={<Pressable onPress={() => navigation.navigate('MyRentals')}><Text style={{ color: colors.accent, fontWeight: '600' }}>My listings</Text></Pressable>}
      header={<><SearchBar value={search} onChangeText={setSearch} placeholder="Search rentals" />
        <ChipRow value={type} onChange={setType} options={[{ value: '', label: 'All' }, ...toOptions(PROPERTY_TYPES)]} /></>}
      footer={<Button title="List a property" icon="plus" onPress={() => navigation.navigate('RentalForm')} />}
      empty={{ icon: 'home', title: 'No rentals listed', text: 'Property owners can list a house or flat here.' }}
      renderItem={r => (
        <Card onPress={() => navigation.navigate('RentalDetail', { id: r._id })}>
          <Img im={r.images?.[0]} />
          <Text style={[font.cardTitle, { color: colors.text }]}>{r.title}</Text>
          <Text style={{ color: colors.accent, fontWeight: '700', marginTop: 4 }}>PKR {Number(r.monthlyRent).toLocaleString()} / month</Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{humanize(r.propertyType)}{r.bedrooms ? ` · ${r.bedrooms} bed` : ''}{r.furnishing ? ` · ${humanize(r.furnishing)}` : ''}</Text>
        </Card>
      )} />
  );
}

export function MyRentalsScreen({ navigation }: any) {
  const { sid } = useAuth();
  const q = useAsync(() => api.list<any>(`/societies/${sid}/rentals/mine`), [sid]);
  return (
    <ListScreen title="My listings" data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      empty={{ icon: 'home', title: 'You have no rentals listed' }}
      renderItem={r => (
        <Card onPress={() => navigation.navigate('RentalDetail', { id: r._id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[font.cardTitle, { color: colors.text, flex: 1 }]}>{r.title}</Text><Badge status={r.status} /></View>
          <Text style={{ color: colors.textDim, marginTop: 4 }}>PKR {Number(r.monthlyRent).toLocaleString()} / month</Text>
        </Card>
      )} />
  );
}

export function RentalDetailScreen({ route, navigation }: any) {
  const { sid, user, isAdmin } = useAuth();
  const { id } = route.params;
  const q = useAsync(() => api.get<any>(`/societies/${sid}/rentals/${id}`), [id]);
  const r = q.data?.rental || q.data;
  const mine = r && String(r.owner?._id || r.owner) === user?._id;
  const inq = useAsync(async () => (mine ? api.list<any>(`/societies/${sid}/rentals/${id}/inquiries`) : { items: [] }), [id, mine]);
  const [msg, setMsg] = useState('');
  const [visit, setVisit] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>, after?: () => void) => { setBusy(true); setErr(''); try { await fn(); after ? after() : q.reload(true); } catch (e) { setErr(errMsg(e)); } setBusy(false); };
  return (
    <Screen>
      <Header title="Rental details" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : r && (
        <>
          <Img im={r.images?.[0]} h={200} />
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}><Badge status={r.status} /><Badge label={humanize(r.propertyType)} color={colors.info} /></View>
          <Text style={[font.section, { color: colors.text }]}>{r.title}</Text>
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 20, marginTop: 4 }}>PKR {Number(r.monthlyRent).toLocaleString()} / month</Text>
          <Card style={{ marginTop: 12 }}>
            {r.bedrooms != null ? <Row label="Bedrooms" value={String(r.bedrooms)} /> : null}
            {r.bathrooms != null ? <Row label="Bathrooms" value={String(r.bathrooms)} /> : null}
            {r.furnishing ? <Row label="Furnishing" value={humanize(r.furnishing)} /> : null}
            {r.securityDeposit ? <Row label="Security deposit" value={`PKR ${r.securityDeposit}`} /> : null}
            {r.block ? <Row label="Block" value={r.block} /> : null}
            <Row label="Owner" value={r.owner?.fullName} last />
          </Card>
          {r.description ? <Text style={{ color: colors.textDim, marginTop: 12, lineHeight: 21 }}>{r.description}</Text> : null}
          <InlineMessage text={err} />
          {mine ? (
            <>
              <View style={{ gap: 10, marginTop: 14 }}>
                {['active', 'paused', 'rented'].filter(s => s !== r.status && r.status !== 'pending_review' && r.status !== 'rejected').map(s => (
                  <Button key={s} variant="secondary" title={`Mark as ${s}`} loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/rentals/${id}/status`, { status: s }))} />))}
                <Button variant="danger" title="Delete listing" loading={busy} onPress={() => run(() => api.del(`/societies/${sid}/rentals/${id}`), () => navigation.goBack())} />
              </View>
              <Text style={st.h2}>Inquiries</Text>
              {(inq.data?.items || []).length ? inq.data!.items.map((i: any) => (
                <Card key={i._id} style={{ marginBottom: 10 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{i.inquirer?.fullName}{i.inquirer?.phone ? ` · ${i.inquirer.phone}` : ''}</Text>
                  <Text style={{ color: colors.textDim, marginTop: 4 }}>{i.message}</Text>
                  {i.visitPreference ? <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 4 }}>Visit: {i.visitPreference}</Text> : null}
                </Card>)) : <Text style={{ color: colors.textMute }}>No inquiries yet.</Text>}
            </>
          ) : (
            <>
              {isAdmin && r.status === 'pending_review' ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Button style={{ flex: 1 }} title="Approve" onPress={() => run(() => api.patch(`/societies/${sid}/rentals/${id}/review`, { approved: true }))} />
                  <Button style={{ flex: 1 }} variant="danger" title="Reject" onPress={() => run(() => api.patch(`/societies/${sid}/rentals/${id}/review`, { approved: false, note: 'Does not meet listing rules' }))} />
                </View>) : null}
              {r.status === 'active' ? (done ? <InlineMessage kind="success" text="Inquiry sent to the owner." /> : (
                <>
                  <Text style={st.h2}>Contact owner</Text>
                  <Input placeholder="Hello, is this still available?" value={msg} onChangeText={setMsg} multiline autoCapitalize="sentences" />
                  <Input placeholder="Preferred visit time (optional)" value={visit} onChangeText={setVisit} />
                  <Button title="Send inquiry" loading={busy} onPress={() => { if (!msg.trim()) return setErr('Write a message.'); run(() => api.post(`/societies/${sid}/rentals/${id}/inquiries`, { message: msg.trim(), visitPreference: visit.trim() || undefined }), () => setDone(true)); }} />
                </>)) : null}
              <Pressable onPress={() => navigation.navigate('ReportForm', { targetType: 'rental', targetId: id })} style={{ alignItems: 'center', marginTop: 16 }}><Text style={{ color: colors.textMute }}>Report this listing</Text></Pressable>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

export function RentalFormScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [f, setF] = useState({ title: '', propertyType: '', monthlyRent: '', securityDeposit: '', bedrooms: '', bathrooms: '', furnishing: '', block: '', description: '' });
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (f.title.trim().length < 5 || !f.propertyType || !(Number(f.monthlyRent) >= 0) || f.monthlyRent === '') return setErr('Title (5+), property type and monthly rent are required.');
    if (!images.length) return setErr('Add at least one photo.');
    setLoading(true);
    try {
      await api.post(`/societies/${sid}/rentals`, { title: f.title.trim(), propertyType: f.propertyType, monthlyRent: Number(f.monthlyRent), securityDeposit: num(f.securityDeposit),
        bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms), furnishing: f.furnishing || undefined, block: f.block.trim() || undefined, description: f.description.trim() || undefined, images });
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Submit listing" onPress={submit} loading={loading} />}>
      <Header title="List a property" subtitle="New listings may need admin approval." />
      <InlineMessage text={err} />
      <PhotoStrip images={images} onAdd={addPhotos(images, setImages, setErr, 10)} onRemove={i => setImages(images.filter((_, k) => k !== i))} />
      <Input label="Title" value={f.title} onChangeText={set('title')} placeholder="2-bed upper portion near park" autoCapitalize="sentences" />
      <Select label="Property type" value={f.propertyType} options={toOptions(PROPERTY_TYPES)} onChange={set('propertyType')} />
      <Input label="Monthly rent (PKR)" value={f.monthlyRent} onChangeText={set('monthlyRent')} keyboardType="number-pad" />
      <Input label="Security deposit (PKR)" value={f.securityDeposit} onChangeText={set('securityDeposit')} keyboardType="number-pad" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Input style={{ flex: 1 }} label="Bedrooms" value={f.bedrooms} onChangeText={set('bedrooms')} keyboardType="number-pad" />
        <Input style={{ flex: 1 }} label="Bathrooms" value={f.bathrooms} onChangeText={set('bathrooms')} keyboardType="number-pad" />
      </View>
      <Select label="Furnishing" value={f.furnishing} options={toOptions(FURNISHING)} onChange={set('furnishing')} allowClear />
      <Input label="Block" value={f.block} onChangeText={set('block')} />
      <Input label="Description" value={f.description} onChangeText={set('description')} multiline autoCapitalize="sentences" />
    </Screen>
  );
}

/* ======================= CARPOOL ======================= */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function CarpoolListScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const q = useAsync(() => api.list<any>(`/societies/${sid}/carpools${qs({ search: dq, limit: 30 })}`), [sid, dq]);
  return (
    <ListScreen title="Carpool" subtitle="Share rides with neighbours." data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      right={<Pressable onPress={() => navigation.navigate('CarpoolRequests')}><Text style={{ color: colors.accent, fontWeight: '600' }}>Requests</Text></Pressable>}
      header={<SearchBar value={search} onChangeText={setSearch} placeholder="Search destination" />}
      footer={<Button title="Offer a ride" icon="plus" onPress={() => navigation.navigate('CarpoolForm')} />}
      empty={{ icon: 'car', title: 'No rides yet', text: 'Offer a ride to share the commute.' }}
      renderItem={c => (
        <Card onPress={() => navigation.navigate('CarpoolDetail', { id: c._id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[font.cardTitle, { color: colors.text, flex: 1 }]}>{c.fromLabel} → {c.toLabel}</Text><Badge status={c.status} /></View>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4 }}>{c.departureTime} · {c.schedule?.type === 'recurring' ? (c.schedule.days || []).map((d: number) => DAYS[d]).join(', ') : fmtDate(c.schedule?.date)}</Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>Driver {c.driver?.fullName} · {c.availableSeats ?? c.totalSeats}/{c.totalSeats} seats{c.costPerSeat ? ` · PKR ${c.costPerSeat}` : ''}</Text>
        </Card>
      )} />
  );
}

export function CarpoolDetailScreen({ route }: any) {
  const { sid, user } = useAuth();
  const { id } = route.params;
  const q = useAsync(() => api.get<any>(`/societies/${sid}/carpools/${id}`), [id]);
  const c = q.data?.ride || q.data;
  const mine = c && String(c.driver?._id || c.driver) === user?._id;
  const [seats, setSeats] = useState('1');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>, after?: () => void) => { setBusy(true); setErr(''); try { await fn(); after ? after() : q.reload(true); } catch (e) { setErr(errMsg(e)); } setBusy(false); };
  return (
    <Screen>
      <Header title="Ride details" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : c && (
        <>
          <Badge status={c.status} />
          <Text style={[font.section, { color: colors.text, marginTop: 8 }]}>{c.fromLabel} → {c.toLabel}</Text>
          <Card style={{ marginTop: 12 }}>
            <Row label="Departure" value={c.departureTime} />{c.returnTime ? <Row label="Return" value={c.returnTime} /> : null}
            <Row label="Schedule" value={c.schedule?.type === 'recurring' ? (c.schedule.days || []).map((d: number) => DAYS[d]).join(', ') : fmtDate(c.schedule?.date)} />
            <Row label="Seats" value={`${c.availableSeats ?? c.totalSeats} of ${c.totalSeats}`} />
            {c.costPerSeat ? <Row label="Cost per seat" value={`PKR ${c.costPerSeat}`} /> : null}
            {c.vehicle ? <Row label="Vehicle" value={c.vehicle} /> : null}
            <Row label="Driver" value={c.driver?.fullName} last={!(c.contactPhone || c.driver?.phone)} />{c.contactPhone || c.driver?.phone ? <Row label="Phone" value={c.contactPhone || c.driver?.phone} last /> : null}
          </Card>
          {c.notes ? <Text style={{ color: colors.textDim, marginTop: 12 }}>{c.notes}</Text> : null}
          <InlineMessage text={err} />
          {mine ? (c.status === 'active' || c.status === 'full' ? <Button title="Cancel ride" variant="danger" style={{ marginTop: 14 }} loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/carpools/${id}/cancel`, {}))} /> : null)
            : done ? <InlineMessage kind="success" text="Seat request sent to the driver." /> : c.status === 'active' ? (
              <>
                <Text style={st.h2}>Request a seat</Text>
                <Input label="Seats" value={seats} onChangeText={setSeats} keyboardType="number-pad" />
                <Input label="Message" value={msg} onChangeText={setMsg} multiline autoCapitalize="sentences" />
                <Button title="Request seat" loading={busy} onPress={() => run(() => api.post(`/societies/${sid}/carpools/${id}/requests`, { seats: Number(seats) || 1, message: msg.trim() || undefined }), () => setDone(true))} />
              </>) : null}
        </>
      )}
    </Screen>
  );
}

export function CarpoolFormScreen({ navigation }: any) {
  const { sid } = useAuth();
  const { user } = useAuth();
  const [f, setF] = useState({ fromLabel: '', toLabel: '', departureTime: '08:00', totalSeats: '3', costPerSeat: '', vehicle: '', notes: '', date: addDays(1), contactPhone: user?.phone || '' });
  const [type, setType] = useState('recurring');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (f.fromLabel.trim().length < 2 || f.toLabel.trim().length < 2) return setErr('Enter where you start and where you are going.');
    if (!isHm(f.departureTime)) return setErr('Departure time must look like 08:00.');
    if (!/^(\+92|0)3\d{9}$/.test(f.contactPhone.replace(/[\s-]/g, ''))) return setErr('Enter a valid contact mobile number (03XXXXXXXXX).');
    if (type === 'once' && !isYmd(f.date)) return setErr('Enter a valid date.');
    if (type === 'recurring' && !days.length) return setErr('Pick at least one day.');
    setLoading(true);
    try {
      await api.post(`/societies/${sid}/carpools`, { fromLabel: f.fromLabel.trim(), toLabel: f.toLabel.trim(), departureTime: f.departureTime, totalSeats: Number(f.totalSeats) || 1, contactPhone: f.contactPhone.replace(/[\s-]/g, ''),
        costPerSeat: num(f.costPerSeat), vehicle: f.vehicle.trim() || undefined, notes: f.notes.trim() || undefined, genderPreference: 'any',
        schedule: type === 'once' ? { type, date: new Date(f.date + 'T00:00:00').toISOString() } : { type, days } });
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Publish ride" onPress={submit} loading={loading} />}>
      <Header title="Offer a ride" />
      <InlineMessage text={err} />
      <Input label="From" value={f.fromLabel} onChangeText={set('fromLabel')} placeholder="Block 7 Gate" autoCapitalize="words" />
      <Input label="To" value={f.toLabel} onChangeText={set('toLabel')} placeholder="Saddar" autoCapitalize="words" />
      <Input label="Departure time (HH:mm)" value={f.departureTime} onChangeText={set('departureTime')} />
      <ChipRow value={type} onChange={setType} options={[{ value: 'recurring', label: 'Repeats weekly' }, { value: 'once', label: 'One time' }]} />
      {type === 'once' ? <DateInput label="Date" value={f.date} onChange={set('date')} /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {DAYS.map((d, i) => <Pressable key={d} onPress={() => setDays(days.includes(i) ? days.filter(x => x !== i) : [...days, i])}
            style={[st.day, days.includes(i) && { backgroundColor: colors.teal, borderColor: colors.teal }]}><Text style={{ color: days.includes(i) ? '#fff' : colors.textDim }}>{d}</Text></Pressable>)}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Input style={{ flex: 1 }} label="Seats" value={f.totalSeats} onChangeText={set('totalSeats')} keyboardType="number-pad" />
        <Input style={{ flex: 1 }} label="Cost / seat (PKR)" value={f.costPerSeat} onChangeText={set('costPerSeat')} keyboardType="number-pad" />
      </View>
      <Input label="Contact mobile" icon="phone" value={f.contactPhone} onChangeText={set('contactPhone')} keyboardType="phone-pad" />
      <Input label="Vehicle" value={f.vehicle} onChangeText={set('vehicle')} placeholder="White Suzuki Cultus" />
      <Input label="Notes" value={f.notes} onChangeText={set('notes')} multiline autoCapitalize="sentences" />
    </Screen>
  );
}

export function CarpoolRequestsScreen() {
  const { sid } = useAuth();
  const [tab, setTab] = useState('received');
  const q = useAsync(() => api.list<any>(`/societies/${sid}/carpool-requests/${tab}`), [sid, tab]);
  const act = async (id: string, a: string) => { try { await api.patch(`/societies/${sid}/carpool-requests/${id}/${a}`, {}); q.reload(true); } catch {} };
  return (
    <ListScreen title="Ride requests" data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<ChipRow value={tab} onChange={setTab} options={[{ value: 'received', label: 'Received' }, { value: 'sent', label: 'Sent' }]} />}
      empty={{ icon: 'car', title: 'No requests' }}
      renderItem={r => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[font.cardTitle, { color: colors.text, flex: 1 }]}>{r.ride?.fromLabel} → {r.ride?.toLabel}</Text><Badge status={r.status} />
          </View>
          <Text style={{ color: colors.textDim, marginTop: 4 }}>{tab === 'received' ? `${r.passenger?.fullName} · ` : ''}{r.seats} seat(s)</Text>
          {r.message ? <Text style={{ color: colors.text, marginTop: 4 }}>{r.message}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {tab === 'received' && r.status === 'pending' ? <><Button small style={{ flex: 1 }} title="Accept" onPress={() => act(r._id, 'accept')} /><Button small style={{ flex: 1 }} variant="danger" title="Decline" onPress={() => act(r._id, 'reject')} /></> : null}
            {tab === 'sent' && ['pending', 'accepted'].includes(r.status) ? <Button small style={{ flex: 1 }} variant="danger" title="Cancel" onPress={() => act(r._id, 'cancel')} /> : null}
          </View>
        </Card>
      )} />
  );
}

/* ======================= DOCTORS ======================= */
export function DoctorListScreen({ navigation }: any) {
  const { sid, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('');
  const dq = useDebounced(search);
  const specs = useAsync(() => api.list<string>(`/societies/${sid}/doctors/specialities`).then(d => d.items).catch(() => []), [sid]);
  const q = useAsync(() => api.list<any>(`/societies/${sid}/doctors${qs({ search: dq, speciality: spec, limit: 30 })}`), [sid, dq, spec]);
  return (
    <ListScreen title="Nearby Doctors" subtitle="A local directory — not a diagnosis service." data={q.data?.items} loading={q.loading} error={q.error}
      reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<><SearchBar value={search} onChangeText={setSearch} placeholder="Search doctors" />
        {specs.data?.length ? <ChipRow value={spec} onChange={setSpec} options={[{ value: '', label: 'All' }, ...specs.data.map((s: any) => ({ value: String(s), label: String(s) }))]} /> : null}</>}
      footer={isAdmin ? <Button title="Add a doctor" icon="plus" onPress={() => navigation.navigate('DoctorForm')} /> : undefined}
      empty={{ icon: 'stethoscope', title: 'No doctors listed', text: isAdmin ? 'Add trusted local doctors.' : 'Your admin has not added any doctors yet.' }}
      renderItem={d => (
        <Card onPress={() => navigation.navigate('DoctorDetail', { id: d._id })}>
          <Text style={[font.cardTitle, { color: colors.text }]}>{d.name}</Text>
          <Text style={{ color: colors.accent, fontSize: 13 }}>{d.speciality}</Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4 }}>{d.clinicName}{d.consultationFee ? ` · PKR ${d.consultationFee}` : ''}</Text>
          {d.emergencyAvailable ? <View style={{ marginTop: 6 }}><Badge label="Emergency" color={colors.danger} /></View> : null}
        </Card>
      )} />
  );
}

export function DoctorDetailScreen({ route, navigation }: any) {
  const { sid, isAdmin } = useAuth();
  const q = useAsync(() => api.get<any>(`/societies/${sid}/doctors/${route.params.id}`), [route.params.id]);
  const d = q.data?.doctor || q.data;
  return (
    <Screen>
      <Header title="Doctor" right={isAdmin && d ? <Pressable onPress={() => navigation.navigate('DoctorForm', { doctor: d })}><Text style={{ color: colors.accent, fontWeight: '600' }}>Edit</Text></Pressable> : undefined} />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : d && (
        <>
          <Text style={[font.section, { color: colors.text }]}>{d.name}</Text>
          <Text style={{ color: colors.accent, marginBottom: 12 }}>{d.speciality}</Text>
          <Card>
            {d.qualifications ? <Row label="Qualifications" value={d.qualifications} /> : null}
            {d.clinicName ? <Row label="Clinic" value={d.clinicName} /> : null}
            {d.clinicAddress ? <Row label="Address" value={d.clinicAddress} /> : null}
            {d.phone ? <Row label="Phone" value={d.phone} /> : null}
            {d.consultationFee ? <Row label="Fee" value={`PKR ${d.consultationFee}`} /> : null}
            <Row label="Emergency" value={d.emergencyAvailable ? 'Available' : 'No'} last />
          </Card>
          {isAdmin ? <Button title="Remove doctor" variant="danger" style={{ marginTop: 14 }} onPress={async () => { try { await api.del(`/societies/${sid}/doctors/${d._id}`); navigation.goBack(); } catch {} }} /> : null}
        </>
      )}
    </Screen>
  );
}

export function DoctorFormScreen({ route, navigation }: any) {
  const { sid } = useAuth();
  const ex = route.params?.doctor;
  const [f, setF] = useState({ name: ex?.name || '', speciality: ex?.speciality || '', qualifications: ex?.qualifications || '', clinicName: ex?.clinicName || '', clinicAddress: ex?.clinicAddress || '', phone: ex?.phone || '', consultationFee: String(ex?.consultationFee ?? '') });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (f.name.trim().length < 2 || f.speciality.trim().length < 2) return setErr('Name and speciality are required.');
    setLoading(true);
    try {
      const body: any = { name: f.name.trim(), speciality: f.speciality.trim(), qualifications: f.qualifications.trim() || undefined, clinicName: f.clinicName.trim() || undefined, clinicAddress: f.clinicAddress.trim() || undefined, phone: f.phone.trim() || undefined, consultationFee: num(f.consultationFee) };
      if (ex) await api.patch(`/societies/${sid}/doctors/${ex._id}`, body); else await api.post(`/societies/${sid}/doctors`, body);
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Save doctor" onPress={submit} loading={loading} />}>
      <Header title={ex ? 'Edit doctor' : 'Add a doctor'} />
      <InlineMessage text={err} />
      <Input label="Name" value={f.name} onChangeText={set('name')} autoCapitalize="words" />
      <Input label="Speciality" value={f.speciality} onChangeText={set('speciality')} placeholder="Paediatrician" autoCapitalize="words" />
      <Input label="Qualifications" value={f.qualifications} onChangeText={set('qualifications')} />
      <Input label="Clinic name" value={f.clinicName} onChangeText={set('clinicName')} />
      <Input label="Clinic address" value={f.clinicAddress} onChangeText={set('clinicAddress')} />
      <Input label="Phone" icon="phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Input label="Consultation fee (PKR)" value={f.consultationFee} onChangeText={set('consultationFee')} keyboardType="number-pad" />
    </Screen>
  );
}

/* ======================= DEALS ======================= */
export function DealListScreen({ navigation }: any) {
  const { sid, isAdmin } = useAuth();
  const [tab, setTab] = useState('live');
  const live = useAsync(() => api.list<any>(`/societies/${sid}/deals`), [sid]);
  const pend = useAsync(() => api.list<any>(`/societies/${sid}/deals/pending`).catch(() => ({ items: [] as any[] })), [sid, isAdmin]);
  const mine = useAsync(() => api.list<any>(`/societies/${sid}/deals/mine`), [sid]);
  const cur = tab === 'live' ? live : tab === 'pending' ? pend : mine;
  const review = async (id: string, approved: boolean) => { try { await api.patch(`/societies/${sid}/deals/${id}/review`, { approved, note: approved ? undefined : 'Does not meet deal guidelines' }); pend.reload(true); live.reload(true); } catch {} };
  const opts = [{ value: 'live', label: 'Deals' }, { value: 'mine', label: 'My deals' }, ...(isAdmin ? [{ value: 'pending', label: 'To review' }] : [])];
  return (
    <ListScreen title="Local Deals" subtitle="Offers from shops near you." data={cur.data?.items} loading={cur.loading} error={cur.error} reload={cur.reload} refreshing={cur.refreshing} onRefresh={cur.refresh}
      header={<ChipRow value={tab} onChange={setTab} options={opts} />}
      footer={<Button title="Post a deal" icon="plus" onPress={() => navigation.navigate('DealForm')} />}
      empty={{ icon: 'tag', title: 'No deals' }}
      renderItem={d => (
        <Card onPress={tab === 'pending' ? undefined : () => navigation.navigate('DealDetail', { id: d._id })}>
          <Img im={d.image} h={120} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[font.cardTitle, { color: colors.text, flex: 1 }]}>{d.title}</Text>{tab !== 'live' ? <Badge status={d.status} /> : null}</View>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>{d.shopName}</Text>
          {d.discountLabel ? <Text style={{ color: colors.accent, fontWeight: '800', marginTop: 4 }}>{d.discountLabel}</Text> : null}
          {tab === 'pending' ? <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}><Button small style={{ flex: 1 }} title="Approve" onPress={() => review(d._id, true)} /><Button small style={{ flex: 1 }} variant="danger" title="Reject" onPress={() => review(d._id, false)} /></View> : null}
        </Card>
      )} />
  );
}

export function DealDetailScreen({ route, navigation }: any) {
  const { sid, user, isAdmin } = useAuth();
  const q = useAsync(() => api.get<any>(`/societies/${sid}/deals/${route.params.id}`), [route.params.id]);
  const d = q.data?.deal || q.data;
  const mine = d && String(d.owner?._id || d.owner || d.createdBy) === user?._id;
  return (
    <Screen>
      <Header title="Deal" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : d && (
        <>
          <Img im={d.image} h={180} />
          <Text style={[font.section, { color: colors.text }]}>{d.title}</Text>
          <Text style={{ color: colors.textDim }}>{d.shopName}</Text>
          {d.discountLabel ? <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 20, marginVertical: 8 }}>{d.discountLabel}</Text> : null}
          {d.description ? <Text style={{ color: colors.text, lineHeight: 21 }}>{d.description}</Text> : null}
          <Card style={{ marginTop: 12 }}>
            {d.shopLocation ? <Row label="Location" value={d.shopLocation} /> : null}
            {d.shopPhone ? <Row label="Phone" value={d.shopPhone} /> : null}
            {d.terms ? <Row label="Terms" value={d.terms} /> : null}
            <Row label="Status" value={humanize(d.status)} last />
          </Card>
          {mine || isAdmin ? <Button title="Delete deal" variant="danger" style={{ marginTop: 14 }} onPress={async () => { try { await api.del(`/societies/${sid}/deals/${d._id}`); navigation.goBack(); } catch {} }} /> : null}
        </>
      )}
    </Screen>
  );
}

export function DealFormScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [f, setF] = useState({ shopName: '', title: '', description: '', discountLabel: '', terms: '', shopLocation: '', shopPhone: '' });
  const [image, setImage] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (f.shopName.trim().length < 2 || f.title.trim().length < 3) return setErr('Shop name and deal title are required.');
    setLoading(true);
    try {
      const body: any = { ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || undefined])), image: image[0] };
      await api.post(`/societies/${sid}/deals`, body);
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Submit deal" onPress={submit} loading={loading} />}>
      <Header title="Post a deal" subtitle="Deals may need admin approval." />
      <InlineMessage text={err} />
      <PhotoStrip label="Banner" images={image} onAdd={async () => { try { setImage((await pickAndUploadImages(false)).slice(0, 1)); } catch (e) { setErr(errMsg(e)); } }} onRemove={() => setImage([])} />
      <Input label="Shop name" value={f.shopName} onChangeText={set('shopName')} autoCapitalize="words" />
      <Input label="Deal title" value={f.title} onChangeText={set('title')} autoCapitalize="sentences" />
      <Input label="Discount label" value={f.discountLabel} onChangeText={set('discountLabel')} placeholder="20% OFF" />
      <Input label="Description" value={f.description} onChangeText={set('description')} multiline autoCapitalize="sentences" />
      <Input label="Terms" value={f.terms} onChangeText={set('terms')} />
      <Input label="Shop location" value={f.shopLocation} onChangeText={set('shopLocation')} />
      <Input label="Shop phone" icon="phone" value={f.shopPhone} onChangeText={set('shopPhone')} keyboardType="phone-pad" />
    </Screen>
  );
}

/* ======================= FAMILY ASSISTANCE ======================= */
export function AssistanceListScreen({ navigation }: any) {
  const { sid, active } = useAuth();
  const reviewer = !!active?.canReviewAssistance || active?.role === 'admin';
  const [tab, setTab] = useState('mine');
  const mine = useAsync(() => api.list<any>(`/societies/${sid}/assistance/mine`), [sid]);
  const all = useAsync(async () => (reviewer ? api.list<any>(`/societies/${sid}/assistance`) : { items: [] as any[] }), [sid, reviewer]);
  const cur = tab === 'mine' ? mine : all;
  return (
    <ListScreen title="Family Assistance" subtitle="Private, verified support. Only authorised reviewers can read your details." data={cur.data?.items} loading={cur.loading} error={cur.error}
      reload={cur.reload} refreshing={cur.refreshing} onRefresh={cur.refresh}
      header={reviewer ? <ChipRow value={tab} onChange={setTab} options={[{ value: 'mine', label: 'My requests' }, { value: 'review', label: 'To review' }]} /> : undefined}
      footer={<Button title="Request assistance" icon="heart" onPress={() => navigation.navigate('AssistanceForm')} />}
      empty={{ icon: 'heart', title: 'No requests', text: 'If your family needs support, you can ask privately.' }}
      renderItem={a => (
        <Card onPress={() => navigation.navigate('AssistanceDetail', { id: a._id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[font.cardTitle, { color: colors.text }]}>{humanize(a.category)}</Text><Badge status={a.status} /></View>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4 }}>Urgency: {humanize(a.urgency)} · {timeAgo(a.createdAt)}{tab === 'review' && a.requester?.fullName ? ` · ${a.requester.fullName}` : ''}</Text>
        </Card>
      )} />
  );
}

export function AssistanceDetailScreen({ route }: any) {
  const { sid, active } = useAuth();
  const reviewer = !!active?.canReviewAssistance || active?.role === 'admin';
  const q = useAsync(() => api.get<any>(`/societies/${sid}/assistance/${route.params.id}`), [route.params.id]);
  const a = q.data?.request || q.data?.assistance || q.data;
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>) => { setBusy(true); setErr(''); try { await fn(); q.reload(true); } catch (e) { setErr(errMsg(e)); } setBusy(false); };
  // Must match allowedTransitions in server/src/routes/assistance.routes.ts.
  const NEXT_STATUS: Record<string, string[]> = {
    submitted: ['under_review', 'rejected'],
    under_review: ['verified', 'rejected'],
    verified: ['in_progress', 'fulfilled'],
    in_progress: ['fulfilled'],
  };
  const nextStatuses = a ? NEXT_STATUS[a.status] || [] : [];
  return (
    <Screen>
      <Header title="Assistance request" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : a && (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}><Badge status={a.status} /><Badge label={humanize(a.urgency)} color={colors.warning} /></View>
          <Text style={[font.section, { color: colors.text }]}>{humanize(a.category)}</Text>
          <Card style={{ marginTop: 12 }}>
            {a.details ? <Text style={{ color: colors.text, lineHeight: 21 }}>{a.details}</Text> : <Text style={{ color: colors.textMute }}>Details are private.</Text>}
            <View style={{ height: 10 }} />
            {a.preferredContact ? <Row label="Contact via" value={a.preferredContact} /> : null}
            {a.householdSize ? <Row label="Household" value={String(a.householdSize)} /> : null}
            <Row label="Submitted" value={fmtDate(a.createdAt)} last />
          </Card>
          <InlineMessage text={err} />
          {reviewer ? (
            <>
              <Text style={st.h2}>Reviewer actions</Text>
              {nextStatuses.length === 0 ? <Text style={{ color: colors.textMute }}>This request is {humanize(a.status).toLowerCase()}. No further status changes.</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {nextStatuses.map(s => <Button key={s} small variant={s === 'rejected' ? 'danger' : 'secondary'} title={humanize(s)} loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/assistance/${a._id}/status`, { status: s }))} />)}
              </View>
              <Input style={{ marginTop: 14 }} placeholder="Internal note (reviewers only)" value={note} onChangeText={setNote} multiline autoCapitalize="sentences" />
              <Button title="Add note" small variant="secondary" loading={busy} onPress={() => { if (!note.trim()) return; run(() => api.post(`/societies/${sid}/assistance/${a._id}/notes`, { note: note.trim() })).then(() => setNote('')); }} />
            </>
          ) : ['submitted', 'under_review'].includes(a.status) ? <Button title="Cancel request" variant="danger" style={{ marginTop: 14 }} loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/assistance/${a._id}/cancel`, {}))} /> : null}
        </>
      )}
    </Screen>
  );
}

export function AssistanceFormScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [f, setF] = useState({ category: '', urgency: 'medium', details: '', preferredContact: '', bestTimeToContact: '', householdSize: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (!f.category || !f.details.trim()) return setErr('Choose a category and describe what you need.');
    setLoading(true);
    try {
      await api.post(`/societies/${sid}/assistance`, { category: f.category, urgency: f.urgency, details: f.details.trim(), preferredContact: f.preferredContact.trim() || undefined, bestTimeToContact: f.bestTimeToContact.trim() || undefined, householdSize: num(f.householdSize) });
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Submit privately" onPress={submit} loading={loading} />}>
      <Header title="Request assistance" subtitle="Your details are encrypted and visible only to authorised reviewers." />
      <InlineMessage text={err} />
      <Select label="Category" value={f.category} options={toOptions(ASSISTANCE_CATEGORIES)} onChange={set('category')} />
      <Select label="Urgency" value={f.urgency} options={toOptions(ASSISTANCE_URGENCY)} onChange={set('urgency')} />
      <Input label="Describe what you need" value={f.details} onChangeText={set('details')} multiline autoCapitalize="sentences" />
      <Input label="Preferred contact (phone / WhatsApp)" value={f.preferredContact} onChangeText={set('preferredContact')} />
      <Input label="Best time to contact" value={f.bestTimeToContact} onChangeText={set('bestTimeToContact')} />
      <Input label="Household size" value={f.householdSize} onChangeText={set('householdSize')} keyboardType="number-pad" />
    </Screen>
  );
}

/* ======================= REPORTS ======================= */
export function ReportFormScreen({ route, navigation }: any) {
  const { sid } = useAuth();
  const { targetType, targetId } = route.params;
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const submit = async () => {
    setErr('');
    if (!reason) return setErr('Choose a reason.');
    setLoading(true);
    try { await api.post(`/societies/${sid}/reports`, { targetType, targetId, reason, details: details.trim() || undefined }); setDone(true); } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={done ? <Button title="Done" onPress={() => navigation.goBack()} /> : <Button title="Submit report" onPress={submit} loading={loading} />}>
      <Header title="Report" subtitle="Tell your admins what's wrong. Reports are confidential." />
      {done ? <InlineMessage kind="success" text="Thanks — an admin will review this." /> : (
        <>
          <InlineMessage text={err} />
          <Select label="Reason" value={reason} options={toOptions(REPORT_REASONS)} onChange={setReason} />
          <Input label="Details (optional)" value={details} onChangeText={setDetails} multiline autoCapitalize="sentences" />
        </>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  day: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
});
