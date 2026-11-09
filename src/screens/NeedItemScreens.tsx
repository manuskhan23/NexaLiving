import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errMsg, imageUrl, qs } from '../api';
import { useAuth } from '../auth';
import { colors, font } from '../theme';
import {
  Badge, Button, Card, ChipRow, DateInput, ErrorBox, Header, Icon, InlineMessage, Input, ListScreen, Loader, Row, Screen,
  SearchBar, Select, TimeInput, addDays, fmtDate, fmtDateTime, humanize, isHm, isYmd, timeAgo, toIso, toOptions, useAsync, useDebounced, useFocusReload,
} from '../ui';
import { ITEM_CATEGORIES, ITEM_CONDITIONS, NEED_KINDS } from '../lib/enums';
import { PhotoStrip } from './HomeScreens';
import { pickAndUploadImages } from '../lib/upload';

const thumb = (it: any) => imageUrl(it?.images?.[0]);

function ItemThumb({ item, size = 76 }: { item: any; size?: number }) {
  const u = thumb(item);
  return u ? <Image source={{ uri: u }} style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.cardAlt }} />
    : <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}><Icon name="gift" color={colors.textMute} /></View>;
}

/* ======================= NEED → MATCH ======================= */
export function NeedMatchScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [tab, setTab] = useState('community');
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const [cat, setCat] = useState('');
  const items = useAsync(() => api.list<any>(`/societies/${sid}/items${qs({ search: dq, category: cat, limit: 30 })}`), [sid, dq, cat]);
  const mine = useAsync(() => api.list<any>(`/societies/${sid}/needs/mine`), [sid]);
  const needs = useAsync(() => api.list<any>(`/societies/${sid}/needs${qs({ search: dq, category: cat, limit: 30 })}`), [sid, dq, cat]);
  useFocusReload(mine.reload);
  const cur = tab === 'community' ? items : tab === 'needs' ? needs : mine;
  return (
    <ListScreen title="Need → Match" subtitle="Find useful items and connect with neighbours." data={cur.data?.items} loading={cur.loading} error={cur.error}
      reload={cur.reload} refreshing={cur.refreshing} onRefresh={cur.refresh}
      right={<Pressable onPress={() => navigation.navigate('ItemRequests')}><Text style={{ color: colors.accent, fontWeight: '600' }}>My requests</Text></Pressable>}
      header={<>
        <ChipRow value={tab} onChange={setTab} options={[{ value: 'community', label: 'Listings' }, { value: 'needs', label: 'Open needs' }, { value: 'mine', label: 'My needs' }]} />
        {tab !== 'mine' ? <><SearchBar value={search} onChangeText={setSearch} placeholder="Search items you need..." />
          <ChipRow value={cat} onChange={setCat} options={[{ value: '', label: 'All categories' }, ...toOptions(ITEM_CATEGORIES)]} /></> : null}
      </>}
      footer={<View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} title="Create Need" icon="plus" onPress={() => navigation.navigate('NeedForm')} />
        <Button style={{ flex: 1 }} title="List an item" variant="secondary" onPress={() => navigation.navigate('ItemForm')} />
      </View>}
      empty={{ icon: 'handshake', title: tab === 'community' ? 'No listings yet' : tab === 'needs' ? 'No open needs' : 'You have no needs yet', text: 'Post what you need, or list something to lend.' }}
      renderItem={(x: any) => tab === 'community' ? (
        <Card onPress={() => navigation.navigate('ItemDetail', { id: x._id })} style={{ flexDirection: 'row', gap: 12 }}>
          <ItemThumb item={x} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
              <Badge status={x.status} /><Badge label={x.listingType === 'giveaway' ? 'Give away' : 'Lend'} color={colors.info} />
            </View>
            <Text style={[font.cardTitle, { color: colors.text }]}>{x.title}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{humanize(x.condition)} · Listed by {x.owner?.fullName}</Text>
          </View>
        </Card>
      ) : (
        <Card onPress={() => navigation.navigate('NeedDetail', { id: x._id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[font.cardTitle, { color: colors.text, flex: 1 }]}>{x.title}</Text><Badge status={x.status} />
          </View>
          <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4 }}>{humanize(x.category)} · {fmtDate(x.neededFrom)} → {fmtDate(x.neededTo)}</Text>
          {tab === 'needs' ? <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 4 }}>Posted by {x.owner?.fullName}</Text> : <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 4 }}>{x.offersCount || 0} offers</Text>}
        </Card>
      )} />
  );
}

export function NeedFormScreen({ navigation }: any) {
  const { sid } = useAuth();
  const [f, setF] = useState({ title: '', description: '', category: '', from: addDays(0), fromTime: '10:00', to: addDays(1), toTime: '10:00' });
  const [kind, setKind] = useState('item');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (f.title.trim().length < 3 || !f.category) return setErr('A title (3+ characters) and category are required.');
    if (!isYmd(f.from) || !isYmd(f.to) || !isHm(f.fromTime) || !isHm(f.toTime)) return setErr('Enter valid dates (YYYY-MM-DD) and times (HH:mm).');
    const from = toIso(f.from, f.fromTime), to = toIso(f.to, f.toTime);
    if (new Date(to) <= new Date(from)) return setErr('The end must be after the start.');
    setLoading(true);
    try {
      const d: any = await api.post(`/societies/${sid}/needs`, { kind, title: f.title.trim(), description: f.description.trim() || undefined, category: f.category, neededFrom: from, neededTo: to, visibility: 'community' });
      navigation.replace('MatchingListings', { needId: d.need._id, matches: d.matches, title: d.need.title });
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title="Submit Request" onPress={submit} loading={loading} />}>
      <Header title="Create a Need Request" subtitle="Tell your community what you're looking for." />
      <InlineMessage text={err} />
      <ChipRow value={kind} onChange={setKind} options={toOptions(NEED_KINDS).map(o => ({ ...o, label: o.value === 'item' ? 'An item' : 'Help' }))} />
      <Input label="Request title" value={f.title} onChangeText={set('title')} placeholder="Drill machine" autoCapitalize="sentences" />
      <Select label="Category" value={f.category} options={toOptions(ITEM_CATEGORIES)} onChange={set('category')} />
      <Input label="Describe what you need" value={f.description} onChangeText={set('description')} multiline autoCapitalize="sentences" />
      <DateInput label="Needed from" value={f.from} onChange={set('from')} />
      <TimeInput label="Start time" value={f.fromTime} onChange={set('fromTime')} />
      <DateInput label="Return by" value={f.to} onChange={set('to')} />
      <TimeInput label="End time" value={f.toTime} onChange={set('toTime')} />
    </Screen>
  );
}

export function MatchingListingsScreen({ route, navigation }: any) {
  const { sid } = useAuth();
  const { needId, title } = route.params;
  const q = useAsync<{ items: any[] }>(async () => route.params.matches ? { items: route.params.matches as any[] } : api.list<any>(`/societies/${sid}/needs/${needId}/matches`), [needId]);
  return (
    <ListScreen title="Matching Listings" subtitle={q.data ? `We found ${q.data.items.length} listing${q.data.items.length === 1 ? '' : 's'} that may help with "${title}".` : undefined}
      data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      empty={{ icon: 'search', title: 'No matches yet', text: 'Your request is posted. Neighbours can now offer you items — you will be notified.', action: 'Back to Need → Match', onAction: () => navigation.popToTop() }}
      footer={<Button title="View my request" onPress={() => navigation.replace('NeedDetail', { id: needId })} />}
      renderItem={m => (
        <Card onPress={() => navigation.navigate('ItemDetail', { id: m.item._id, needId })} style={{ flexDirection: 'row', gap: 12 }}>
          <ItemThumb item={m.item} />
          <View style={{ flex: 1 }}>
            <Text style={[font.cardTitle, { color: colors.text }]}>{m.item.title}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>{humanize(m.item.condition)} · {m.owner?.fullName || 'Neighbour'}{m.owner?.block ? ` · Block ${m.owner.block}` : ''}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {(m.matchReasons || []).slice(0, 3).map((r: string) => <Badge key={r} label={r} color={colors.accent} />)}
            </View>
          </View>
        </Card>
      )} />
  );
}

export function NeedDetailScreen({ route, navigation }: any) {
  const { sid, user } = useAuth();
  const { id } = route.params;
  const q = useAsync(() => api.get<any>(`/societies/${sid}/needs/${id}`), [id]);
  const n = q.data?.need;
  const mineNeed = n && String(n.owner?._id || n.owner) === user?._id;
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>, then?: () => void) => { setBusy(true); setErr(''); try { await fn(); then ? then() : q.reload(true); } catch (e) { setErr(errMsg(e)); } setBusy(false); };
  const steps = [
    { t: 'Request Submitted', d: n && fmtDateTime(n.createdAt), done: true },
    { t: 'Waiting for Owner', d: n?.status === 'open' ? `${(n.offers || []).length} offer(s) so far` : 'Owner responded', done: n?.status !== 'open' },
    { t: 'Accepted / Declined', d: humanize(n?.status), done: ['matched', 'fulfilled'].includes(n?.status) },
    { t: 'Handover Coordination', d: 'Arrange pickup details', done: n?.status === 'fulfilled' },
  ];
  return (
    <Screen>
      <Header title="Request Status" subtitle="Track your community request." />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : n && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}><Text style={{ color: colors.textDim, fontSize: 12 }}>Item</Text><Text style={[font.section, { color: colors.text }]}>{n.title}</Text></View>
              <Badge status={n.status} />
            </View>
            <View style={{ height: 10 }} />
            <Row label="Needed from" value={fmtDateTime(n.neededFrom)} /><Row label="Return by" value={fmtDateTime(n.neededTo)} />
            <Row label="Category" value={humanize(n.category)} /><Row label="Posted by" value={n.owner?.fullName} last />
            {n.description ? <Text style={{ color: colors.textDim, marginTop: 10 }}>{n.description}</Text> : null}
          </Card>
          <InlineMessage text={err} />

          {mineNeed ? (
            <>
              <Text style={st.h2}>Request timeline</Text>
              {steps.map((s, i) => (
                <View key={s.t} style={{ flexDirection: 'row', gap: 12, marginBottom: 6 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: s.done ? colors.accent : colors.card, borderWidth: 1.5, borderColor: s.done ? colors.accent : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                      {s.done ? <Icon name="check" size={13} color={colors.accentText} strokeWidth={3} /> : null}
                    </View>
                    {i < steps.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border }} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 10 }}><Text style={{ color: colors.text, fontWeight: '600' }}>{s.t}</Text><Text style={{ color: colors.textDim, fontSize: 12 }}>{s.d}</Text></View>
                </View>
              ))}
              <Text style={st.h2}>Offers ({(n.offers || []).length})</Text>
              {(n.offers || []).length ? n.offers.map((o: any) => (
                <Card key={o._id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.text, flex: 1 }}>{o.message}</Text><Badge status={o.status === 'declined' ? 'rejected' : o.status} /></View>
                  <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 4 }}>{timeAgo(o.createdAt)}</Text>
                  {n.status === 'open' && o.status === 'pending' ? <Button small title="Accept offer" style={{ marginTop: 10 }} loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/needs/${id}/offers/${o._id}/accept`, {}))} /> : null}
                </Card>
              )) : <Text style={{ color: colors.textMute }}>No offers yet.</Text>}
              {n.status === 'open' ? (
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Button title="See matching listings" variant="secondary" onPress={() => navigation.navigate('MatchingListings', { needId: id, title: n.title })} />
                  <Button title="Mark as fulfilled" variant="secondary" loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/needs/${id}/close`, { outcome: 'fulfilled' }))} />
                  <Button title="Cancel request" variant="danger" loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/needs/${id}/close`, { outcome: 'cancelled' }))} />
                </View>
              ) : null}
              {n.status === 'matched' ? <Button title="Mark as fulfilled" style={{ marginTop: 12 }} loading={busy} onPress={() => run(() => api.patch(`/societies/${sid}/needs/${id}/close`, { outcome: 'fulfilled' }))} /> : null}
            </>
          ) : (
            <>
              <Text style={st.h2}>Offer to help</Text>
              {q.data?.myOffer ? <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.text }}>Your offer was sent</Text><Badge status={q.data.myOffer.status === 'declined' ? 'rejected' : q.data.myOffer.status} /></View></Card> : n.status === 'open' ? (
                <>
                  <Input placeholder="Tell them how you can help (e.g. I have a cordless drill)" value={msg} onChangeText={setMsg} multiline autoCapitalize="sentences" />
                  <Button title="Send offer" loading={busy} onPress={() => { if (!msg.trim()) return setErr('Write a short message.'); run(() => api.post(`/societies/${sid}/needs/${id}/offers`, { message: msg.trim() })); }} />
                </>
              ) : <Text style={{ color: colors.textMute }}>This request is no longer open.</Text>}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/* ======================= ITEMS ======================= */
export function ItemListScreen({ route, navigation }: any) {
  const { sid } = useAuth();
  const [type, setType] = useState(route.params?.type || 'giveaway');
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const q = useAsync(() => api.list<any>(`/societies/${sid}/items${qs({ listingType: type, search: dq, limit: 30 })}`), [sid, type, dq]);
  return (
    <ListScreen title={type === 'giveaway' ? 'Give Away' : 'Borrow & Lend'} subtitle={type === 'giveaway' ? 'Free items from your neighbours.' : 'Borrow items from neighbours.'}
      data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<><ChipRow value={type} onChange={setType} options={[{ value: 'giveaway', label: 'Give away' }, { value: 'lend', label: 'Borrow / lend' }]} />
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search items" /></>}
      footer={<Button title="List an item" icon="plus" onPress={() => navigation.navigate('ItemForm', { type })} />}
      empty={{ icon: 'gift', title: 'Nothing here yet', text: 'List something useful for your neighbours.' }}
      renderItem={x => (
        <Card onPress={() => navigation.navigate('ItemDetail', { id: x._id })} style={{ flexDirection: 'row', gap: 12 }}>
          <ItemThumb item={x} />
          <View style={{ flex: 1 }}>
            <Badge status={x.status} />
            <Text style={[font.cardTitle, { color: colors.text, marginTop: 4 }]}>{x.title}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>{humanize(x.condition)} · {x.owner?.fullName}</Text>
          </View>
        </Card>
      )} />
  );
}

export function ItemDetailScreen({ route, navigation }: any) {
  const { sid, user } = useAuth();
  const { id, needId } = route.params;
  const q = useAsync(() => api.get<any>(`/societies/${sid}/items/${id}`), [id]);
  const it = q.data?.item || q.data;
  const mine = it && String(it.owner?._id || it.owner) === user?._id;
  const [from, setFrom] = useState(addDays(1));
  const [days, setDays] = useState('1');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = async () => {
    setErr('');
    const body: any = { message: msg.trim() || undefined, needId };
    if (it.listingType === 'lend') {
      if (!isYmd(from) || !(Number(days) >= 1)) return setErr('Enter a valid start date and number of days.');
      const s = new Date(from + 'T10:00:00'); const e = new Date(s); e.setDate(e.getDate() + Number(days));
      body.startAt = s.toISOString(); body.endAt = e.toISOString();
    }
    setBusy(true);
    try { await api.post(`/societies/${sid}/items/${id}/requests`, body); setDone(true); } catch (e) { setErr(errMsg(e)); }
    setBusy(false);
  };
  const setStatus = async (status: string) => { setBusy(true); try { await api.patch(`/societies/${sid}/items/${id}/status`, { status }); q.reload(true); } catch (e) { setErr(errMsg(e)); } setBusy(false); };
  const remove = async () => { setBusy(true); try { await api.del(`/societies/${sid}/items/${id}`); navigation.goBack(); } catch (e) { setErr(errMsg(e)); } setBusy(false); };
  return (
    <Screen>
      <Header title="Listing details" />
      {q.loading ? <Loader /> : q.error ? <ErrorBox error={q.error} onRetry={q.reload} /> : it && (
        <>
          {thumb(it) ? <Image source={{ uri: thumb(it) }} style={{ height: 200, borderRadius: 16, marginBottom: 14, backgroundColor: colors.card }} /> : null}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}><Badge status={it.status} /><Badge label={it.listingType === 'giveaway' ? 'Give away' : 'Lend'} color={colors.info} /></View>
          <Text style={[font.section, { color: colors.text }]}>{it.title}</Text>
          <Card style={{ marginTop: 12 }}>
            <Row label="Condition" value={humanize(it.condition)} /><Row label="Category" value={humanize(it.category)} />
            <Row label="Owner" value={it.owner?.fullName} />
            {it.listingType === 'lend' ? <Row label="Max borrow" value={`${it.maxBorrowDays || 3} days`} /> : null}
            {it.pickupNote ? <Row label="Pickup" value={it.pickupNote} /> : null}
            <Row label="Deposit" value={it.depositNote || 'None'} last />
          </Card>
          <Text style={st.h2}>About</Text>
          <Text style={{ color: colors.textDim, lineHeight: 21 }}>{it.description || 'No description.'}</Text>
          <InlineMessage text={err} />
          {mine ? (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Button title="Edit listing" variant="secondary" onPress={() => navigation.navigate('ItemForm', { item: it })} />
              {it.status === 'available' ? <Button title="Pause listing" variant="secondary" loading={busy} onPress={() => setStatus('paused')} /> : null}
              {it.status === 'paused' ? <Button title="Make available" variant="secondary" loading={busy} onPress={() => setStatus('available')} /> : null}
              {it.listingType === 'giveaway' && it.status !== 'given_away' ? <Button title="Mark as given away" variant="secondary" loading={busy} onPress={() => setStatus('given_away')} /> : null}
              <Button title="Delete listing" variant="danger" loading={busy} onPress={remove} />
            </View>
          ) : done ? <View style={{ marginTop: 16 }}><InlineMessage kind="success" text="Request sent. You'll be notified when the owner responds." /><Button title="View my requests" onPress={() => navigation.navigate('ItemRequests')} /></View>
            : it.status === 'available' ? (
              <View style={{ marginTop: 16 }}>
                <Text style={st.h2}>Request this item</Text>
                {it.listingType === 'lend' ? <><DateInput label="Start date" value={from} onChange={setFrom} /><Input label="Number of days" value={days} onChangeText={setDays} keyboardType="number-pad" /></> : null}
                <Input label="Message" value={msg} onChangeText={setMsg} multiline placeholder="Say hello and when you can pick it up" autoCapitalize="sentences" />
                <Button title="Send request" onPress={request} loading={busy} />
                <Pressable onPress={() => navigation.navigate('ReportForm', { targetType: 'item', targetId: id })} style={{ alignItems: 'center', marginTop: 16 }}><Text style={{ color: colors.textMute }}>Report this listing</Text></Pressable>
              </View>
            ) : <Text style={{ color: colors.textMute, marginTop: 16 }}>This item is not available right now.</Text>}
        </>
      )}
    </Screen>
  );
}

export function ItemFormScreen({ route, navigation }: any) {
  const { sid } = useAuth();
  const ex = route.params?.item;
  const [f, setF] = useState({ title: ex?.title || '', description: ex?.description || '', category: ex?.category || '', condition: ex?.condition || 'good',
    pickupNote: ex?.pickupNote || '', depositNote: ex?.depositNote || '', maxBorrowDays: String(ex?.maxBorrowDays || 3), tags: (ex?.tags || []).join(', ') });
  const [type, setType] = useState(ex?.listingType || route.params?.type || 'giveaway');
  const [images, setImages] = useState<any[]>(ex?.images || []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setErr('');
    if (f.title.trim().length < 3 || !f.category) return setErr('A title (3+ characters) and category are required.');
    if (!images.length) return setErr('Add at least one photo.');
    setLoading(true);
    try {
      const body: any = { title: f.title.trim(), description: f.description.trim() || undefined, category: f.category, condition: f.condition, images,
        pickupNote: f.pickupNote.trim() || undefined, depositNote: f.depositNote.trim() || undefined,
        tags: f.tags.split(",").map((t: string) => t.trim()).filter(Boolean), maxBorrowDays: Number(f.maxBorrowDays) || 3 };
      if (ex) await api.patch(`/societies/${sid}/items/${ex._id}`, body); else await api.post(`/societies/${sid}/items`, { ...body, listingType: type });
      navigation.goBack();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen footer={<Button title={ex ? 'Save listing' : 'Publish listing'} onPress={submit} loading={loading} />}>
      <Header title={ex ? 'Edit listing' : 'List an item'} />
      <InlineMessage text={err} />
      {!ex ? <ChipRow value={type} onChange={setType} options={[{ value: 'giveaway', label: 'Give away' }, { value: 'lend', label: 'Lend' }]} /> : null}
      <PhotoStrip images={images} onAdd={async () => { try { setImages([...images, ...(await pickAndUploadImages(true))].slice(0, 6)); } catch (e) { setErr(errMsg(e)); } }} onRemove={i => setImages(images.filter((_, k) => k !== i))} />
      <Input label="Title" value={f.title} onChangeText={set('title')} placeholder="Drill machine" autoCapitalize="sentences" />
      <Select label="Category" value={f.category} options={toOptions(ITEM_CATEGORIES)} onChange={set('category')} />
      <Select label="Condition" value={f.condition} options={toOptions(ITEM_CONDITIONS)} onChange={set('condition')} />
      <Input label="Description" value={f.description} onChangeText={set('description')} multiline autoCapitalize="sentences" />
      <Input label="Tags (comma separated)" value={f.tags} onChangeText={set('tags')} />
      {type === 'lend' ? <Input label="Max borrow days" value={f.maxBorrowDays} onChangeText={set('maxBorrowDays')} keyboardType="number-pad" /> : null}
      <Input label="Pickup note" value={f.pickupNote} onChangeText={set('pickupNote')} placeholder="e.g. Collect from gate, after 6pm" />
      <Input label="Deposit note (optional)" value={f.depositNote} onChangeText={set('depositNote')} />
    </Screen>
  );
}

/* ======================= ITEM REQUESTS (sent / received) ======================= */
export function ItemRequestsScreen() {
  const { sid } = useAuth();
  const [tab, setTab] = useState('received');
  const q = useAsync(() => api.list<any>(`/societies/${sid}/item-requests/${tab}`), [sid, tab]);
  const act = async (id: string, action: string) => { try { await api.patch(`/societies/${sid}/item-requests/${id}/${action}`, {}); q.reload(true); } catch {} };
  return (
    <ListScreen title="Item requests" data={q.data?.items} loading={q.loading} error={q.error} reload={q.reload} refreshing={q.refreshing} onRefresh={q.refresh}
      header={<ChipRow value={tab} onChange={setTab} options={[{ value: 'received', label: 'Received' }, { value: 'sent', label: 'Sent' }]} />}
      empty={{ icon: 'handshake', title: 'No requests' }}
      renderItem={r => (
        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ItemThumb item={r.item} size={56} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[font.cardTitle, { color: colors.text, flex: 1 }]}>{r.item?.title}</Text><Badge status={r.status} /></View>
              {tab === 'received' ? <Text style={{ color: colors.textDim, fontSize: 12 }}>From {r.requester?.fullName}</Text> : null}
              {r.startAt ? <Text style={{ color: colors.textDim, fontSize: 12 }}>{fmtDate(r.startAt)} → {fmtDate(r.endAt)}</Text> : null}
              {r.message ? <Text style={{ color: colors.text, marginTop: 4 }}>{r.message}</Text> : null}
              {r.reason ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{r.reason}</Text> : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {tab === 'received' && r.status === 'pending' ? <><Button small title="Accept" style={{ flex: 1 }} onPress={() => act(r._id, 'accept')} /><Button small title="Decline" variant="danger" style={{ flex: 1 }} onPress={() => act(r._id, 'reject')} /></> : null}
            {tab === 'received' && r.status === 'accepted' ? <Button small title="Mark handed over" style={{ flex: 1 }} onPress={() => act(r._id, 'handover')} /> : null}
            {tab === 'received' && r.status === 'handed_over' && r.type === 'lend' ? <Button small title="Mark returned" style={{ flex: 1 }} onPress={() => act(r._id, 'return')} /> : null}
            {tab === 'sent' && ['pending', 'accepted'].includes(r.status) ? <Button small title="Cancel" variant="danger" style={{ flex: 1 }} onPress={() => act(r._id, 'cancel')} /> : null}
          </View>
        </Card>
      )} />
  );
}

const st = StyleSheet.create({
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 10 },
});
