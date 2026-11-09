import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errMsg, imageUrl, qs } from '../api';
import { useAuth } from '../auth';
import { colors, font } from '../theme';
import {
  Badge, Button, Card, ChipRow, DateInput, ErrorBox, Header, InlineMessage, Input, ListScreen, Loader, Row, Screen, Select,
  addDays, fmtDate, fmtDateTime, fmtTime, isYmd, toOptions, useAsync,
} from '../ui';
import { EVENT_TYPES } from '../lib/enums';

const SLOT_COLOR: Record<string, string> = { available: colors.accent, pending: colors.warning, booked: colors.danger, blocked: colors.textMute, too_soon: colors.textMute };

export function SpaceListScreen({ navigation }: any) {
  const { sid, isAdmin } = useAuth();
  const q = useAsync(() => api.list<any>(`/societies/${sid}/spaces`), [sid]);
  return (
    <ListScreen title="Community Spaces" subtitle="Book halls and shared spaces." data={q.data?.items} loading={q.loading} error={q.error}
      reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      right={<Pressable onPress={() => navigation.navigate('MyBookings')}><Text style={{ color: colors.accent, fontWeight: '600' }}>My bookings</Text></Pressable>}
      footer={isAdmin ? <Button title="Add a space" icon="plus" onPress={() => navigation.navigate('SpaceForm')} /> : undefined}
      empty={{ icon: 'building', title: 'No spaces yet', text: isAdmin ? 'Add a hall or ground so residents can book it.' : 'Your admin has not added any spaces yet.' }}
      renderItem={s => (
        <Card onPress={() => navigation.navigate('SpaceDetail', { id: s._id })}>
          {s.images?.[0] ? <Image source={{ uri: imageUrl(s.images[0]) }} style={{ height: 130, borderRadius: 12, marginBottom: 10, backgroundColor: colors.cardAlt }} /> : null}
          <Text style={[font.cardTitle, { color: colors.text }]}>{s.name}</Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>Capacity {s.capacity} · {s.fee ? `PKR ${s.fee}` : 'Free'}</Text>
        </Card>
      )} />
  );
}

export function SpaceDetailScreen({ route, navigation }: any) {
  const { sid, isAdmin } = useAuth();
  const { id } = route.params;
  const sp = useAsync(() => api.get<any>(`/societies/${sid}/spaces/${id}`).then(d => d.space), [id]);
  const [date, setDate] = useState(addDays(1));
  const av = useAsync(async () => (isYmd(date) ? api.get<any>(`/societies/${sid}/spaces/${id}/availability?date=${date}`) : null), [id, date]);
  const [sel, setSel] = useState<number[]>([]);
  const [f, setF] = useState({ eventTitle: '', eventType: 'meeting', guests: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const s = sp.data;
  const slots: any[] = av.data?.slots || [];

  const tap = (i: number) => {
    if (slots[i].status !== 'available') return;
    if (!sel.length) return setSel([i]);
    const lo = Math.min(sel[0], i), hi = Math.max(sel[sel.length - 1], i);
    const range = []; for (let k = lo; k <= hi; k++) range.push(k);
    if (range.some(k => slots[k].status !== 'available')) return setSel([i]);
    setSel(sel.length === 1 && sel[0] === i ? [] : range);
  };

  const book = async () => {
    setErr('');
    if (!sel.length) return setErr('Select the time slots you need.');
    if (f.eventTitle.trim().length < 3) return setErr('Give your event a title (3+ characters).');
    if (!(Number(f.guests) >= 1)) return setErr('Enter the number of guests.');
    setLoading(true);
    try {
      await api.post(`/societies/${sid}/spaces/${id}/bookings`, {
        eventTitle: f.eventTitle.trim(), eventType: f.eventType, startAt: slots[sel[0]].start, endAt: slots[sel[sel.length - 1]].end,
        guestCount: Number(f.guests), notes: f.notes.trim() || undefined,
      });
      setDone(true);
    } catch (e) { setErr(errMsg(e)); av.reload(true); setSel([]); }
    setLoading(false);
  };

  return (
    <Screen>
      <Header title={s?.name || 'Space'} right={isAdmin && s ? <Pressable onPress={() => navigation.navigate('SpaceForm', { space: s })}><Text style={{ color: colors.accent, fontWeight: '600' }}>Edit</Text></Pressable> : undefined} />
      {sp.loading ? <Loader /> : sp.error ? <ErrorBox error={sp.error} onRetry={sp.reload} /> : s && (
        <>
          {s.images?.[0] ? <Image source={{ uri: imageUrl(s.images[0]) }} style={{ height: 170, borderRadius: 16, marginBottom: 14, backgroundColor: colors.card }} /> : null}
          <Card>
            <Row label="Capacity" value={`${s.capacity} guests`} /><Row label="Fee" value={s.fee ? `PKR ${s.fee}` : 'Free'} />
            <Row label="Slot length" value={`${s.slotMinutes || 60} minutes`} /><Row label="Notice" value={`${s.minNoticeHours || 0} hours`} last />
          </Card>
          {s.description ? <Text style={{ color: colors.textDim, marginTop: 12, lineHeight: 21 }}>{s.description}</Text> : null}
          {s.rules ? <Text style={{ color: colors.textMute, marginTop: 8, fontSize: 12 }}>Rules: {s.rules}</Text> : null}

          {done ? <View style={{ marginTop: 18 }}><InlineMessage kind="success" text="Booking request sent. An admin will approve it — you'll see the status under My bookings." /><Button title="My bookings" onPress={() => navigation.replace('MyBookings')} /></View> : (
            <>
              <Text style={st.h2}>Check availability</Text>
              <DateInput value={date} onChange={d => { setDate(d); setSel([]); }} />
              {av.loading ? <Loader /> : av.data && !av.data.isOpen ? <Text style={{ color: colors.textMute }}>The space is closed on this day.</Text> : (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {slots.map((sl, i) => {
                      const on = sel.includes(i); const c = SLOT_COLOR[sl.status];
                      return (
                        <Pressable key={sl.start} onPress={() => tap(i)} style={[st.slot, { borderColor: c, backgroundColor: on ? colors.accent : 'transparent', opacity: sl.status === 'available' ? 1 : 0.45 }]}>
                          <Text style={{ color: on ? colors.accentText : c, fontSize: 12, fontWeight: '600' }}>{fmtTime(sl.start)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={{ color: colors.textMute, fontSize: 11, marginTop: 8 }}>Green = available · amber = pending approval · red = booked. Tap a start slot then an end slot.</Text>
                </>
              )}
              {sel.length ? (
                <>
                  <Text style={st.h2}>Your event</Text>
                  <Text style={{ color: colors.accent, marginBottom: 10 }}>{fmtDate(slots[sel[0]].start)} · {fmtTime(slots[sel[0]].start)} – {fmtTime(slots[sel[sel.length - 1]].end)}</Text>
                  <InlineMessage text={err} />
                  <Input label="Event title" value={f.eventTitle} onChangeText={set('eventTitle')} autoCapitalize="sentences" />
                  <Select label="Event type" value={f.eventType} options={toOptions(EVENT_TYPES)} onChange={set('eventType')} />
                  <Input label="Number of guests" value={f.guests} onChangeText={set('guests')} keyboardType="number-pad" />
                  <Input label="Notes (optional)" value={f.notes} onChangeText={set('notes')} multiline autoCapitalize="sentences" />
                  <Button title="Request booking" onPress={book} loading={loading} />
                </>
              ) : err ? <InlineMessage text={err} /> : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

export function SpaceFormScreen({ route, navigation }: any) {
  const { sid } = useAuth();
  const ex = route.params?.space;
  const [f, setF] = useState({ name: ex?.name || '', description: ex?.description || '', capacity: String(ex?.capacity || ''), fee: String(ex?.fee ?? ''),
    open: ex?.openingHours?.[0]?.open || '09:00', close: ex?.openingHours?.[0]?.close || '22:00', slot: String(ex?.slotMinutes || 60),
    notice: String(ex?.minNoticeHours ?? 24), rules: ex?.rules || '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (f.name.trim().length < 2 || !(Number(f.capacity) >= 1)) return setErr('Name and capacity are required.');
    setLoading(true);
    try {
      const body: any = { name: f.name.trim(), description: f.description.trim() || undefined, capacity: Number(f.capacity), fee: Number(f.fee) || 0,
        slotMinutes: Number(f.slot), minNoticeHours: Number(f.notice) || 0, minBookingMinutes: Number(f.slot), maxBookingMinutes: Number(f.slot) * 8,
        maxAdvanceDays: 60, rules: f.rules.trim() || undefined,
        openingHours: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, open: f.open, close: f.close })) };
      if (ex) await api.patch(`/societies/${sid}/spaces/${ex._id}`, body); else await api.post(`/societies/${sid}/spaces`, body);
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  const remove = async () => { try { await api.del(`/societies/${sid}/spaces/${ex._id}`); navigation.popToTop(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <Screen footer={<Button title={ex ? 'Save space' : 'Add space'} onPress={submit} loading={loading} />}>
      <Header title={ex ? 'Edit space' : 'Add a space'} />
      <InlineMessage text={err} />
      <Input label="Name" value={f.name} onChangeText={set('name')} placeholder="Community Hall" autoCapitalize="words" />
      <Input label="Description" value={f.description} onChangeText={set('description')} multiline autoCapitalize="sentences" />
      <Input label="Capacity (guests)" value={f.capacity} onChangeText={set('capacity')} keyboardType="number-pad" />
      <Input label="Fee (PKR, 0 = free)" value={f.fee} onChangeText={set('fee')} keyboardType="number-pad" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Input style={{ flex: 1 }} label="Opens (HH:mm)" value={f.open} onChangeText={set('open')} />
        <Input style={{ flex: 1 }} label="Closes (HH:mm)" value={f.close} onChangeText={set('close')} />
      </View>
      <Select label="Slot length" value={f.slot} options={[{ value: '30', label: '30 minutes' }, { value: '60', label: '1 hour' }, { value: '120', label: '2 hours' }]} onChange={set('slot')} />
      <Input label="Minimum notice (hours)" value={f.notice} onChangeText={set('notice')} keyboardType="number-pad" />
      <Input label="Rules" value={f.rules} onChangeText={set('rules')} multiline autoCapitalize="sentences" />
      {ex ? <Button title="Delete space" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}

/* ======================= BOOKINGS ======================= */
export function MyBookingsScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [when, setWhen] = useState('upcoming');
  const q = useAsync(() => api.list<any>(`/societies/${sid}/bookings/mine${qs({ when })}`), [sid, when]);
  const cancel = async (id: string) => { try { await api.patch(`/societies/${sid}/bookings/${id}/cancel`, {}); q.reload(true); } catch {} };
  return (
    <ListScreen title="Bookings" subtitle="Your space reservations." data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<ChipRow value={when} onChange={setWhen} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />}
      empty={{ icon: 'calendar', title: 'No bookings', text: 'Book a community space for your next event.', action: 'Browse spaces', onAction: () => navigation.navigate('SpaceList') }}
      renderItem={b => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[font.cardTitle, { color: colors.text, flex: 1 }]}>{b.eventTitle}</Text><Badge status={b.status} /></View>
          <Text style={{ color: colors.textDim, marginTop: 4 }}>{b.space?.name || b.spaceName}</Text>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{fmtDateTime(b.startAt)} – {fmtTime(b.endAt)} · {b.guestCount} guests</Text>
          {b.rejectionReason || b.reason ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{b.rejectionReason || b.reason}</Text> : null}
          {['pending', 'approved'].includes(b.status) && when === 'upcoming' ? <Button small variant="danger" title="Cancel booking" style={{ marginTop: 10 }} onPress={() => cancel(b._id)} /> : null}
        </Card>
      )} />
  );
}

export function ManageBookingsScreen() {
  const { sid } = useAuth();
  const [status, setStatus] = useState('pending');
  const q = useAsync(() => api.list<any>(`/societies/${sid}/bookings${qs({ status, limit: 40 })}`), [sid, status]);
  const [err, setErr] = useState('');
  const act = async (id: string, action: 'approve' | 'reject') => {
    setErr('');
    try { await api.patch(`/societies/${sid}/bookings/${id}/${action}`, action === 'reject' ? { reason: 'Not available for this slot' } : {}); q.reload(true); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <ListScreen title="Manage bookings" data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<><InlineMessage text={err} /><ChipRow value={status} onChange={setStatus} options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' }]} /></>}
      empty={{ icon: 'calendar', title: 'No bookings' }}
      renderItem={b => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[font.cardTitle, { color: colors.text, flex: 1 }]}>{b.eventTitle}</Text><Badge status={b.status} /></View>
          <Text style={{ color: colors.textDim, marginTop: 4 }}>{b.space?.name} · by {b.requester?.fullName}</Text>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>{fmtDateTime(b.startAt)} – {fmtTime(b.endAt)} · {b.guestCount} guests</Text>
          {b.conflictsWith?.length ? <Text style={{ color: colors.warning, fontSize: 12, marginTop: 4 }}>Overlaps {b.conflictsWith.length} other pending request(s)</Text> : null}
          {b.status === 'pending' ? <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button small title="Approve" style={{ flex: 1 }} onPress={() => act(b._id, 'approve')} /><Button small title="Reject" variant="danger" style={{ flex: 1 }} onPress={() => act(b._id, 'reject')} />
          </View> : null}
        </Card>
      )} />
  );
}

const st = StyleSheet.create({
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  slot: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
});
