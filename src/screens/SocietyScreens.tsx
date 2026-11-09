import React, { useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import { colors, font } from '../theme';
import { Avatar, Button, Card, Chip, Header, Icon, InlineMessage, Input, Row, Screen, Badge, humanize } from '../ui';

/* ---------------- Join a society ---------------- */
const RES_TYPES = [
  { v: 'owner', l: 'Owner' }, { v: 'tenant', l: 'Tenant' }, { v: 'family_member', l: 'Family member' },
];

const logo = require('../assets/logo.png');

export function JoinSocietyScreen({ navigation }: any) {
  const { refreshMe, isGlobalAdmin, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [soc, setSoc] = useState<any>(null);
  const [block, setBlock] = useState('');
  const [unit, setUnit] = useState('');
  const [type, setType] = useState('owner');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminErr, setAdminErr] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);

  const becomeAdmin = async () => {
    setAdminErr('');
    if (!adminCode.trim()) return setAdminErr('Enter your admin code.');
    setAdminBusy(true);
    try {
      await api.post('/users/me/become-admin', { adminCode: adminCode.trim() });
      await refreshMe();
    } catch (e) { setAdminErr(errMsg(e)); }
    setAdminBusy(false);
  };

  const lookup = async () => {
    setErr('');
    if (code.trim().length !== 8) return setErr('The society join code has 8 characters.');
    setLoading(true);
    try {
      const r: any = await api.get(`/societies/lookup?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      const d = r.society || r;
      setSoc(d);
      if (d.blocks?.length === 1) setBlock(d.blocks[0]);
    } catch (e: any) { setSoc(null); setErr(e.status === 404 ? 'No society found with that code.' : errMsg(e)); }
    setLoading(false);
  };

  const submit = async () => {
    setErr('');
    if (!block.trim() || !unit.trim()) return setErr('Enter your block and house / unit number.');
    setLoading(true);
    try {
      await api.post('/societies/join', {
        joinCode: code.trim().toUpperCase(), block: block.trim(), unitLabel: unit.trim(), residentType: type,
        note: note.trim() || undefined,
      });
      await refreshMe();
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };

  return (
    <Screen>
      <Header back={navigation.canGoBack()} />
      {!isGlobalAdmin ? <Image source={logo} style={{ width: 150, height: 75, marginBottom: 16, borderRadius: 14 }} resizeMode="contain" /> : null}
      <Text style={[font.title, { color: colors.text }]}>Join your society</Text>
      <Text style={{ color: colors.textDim, marginTop: 4, marginBottom: 20 }}>Ask your society admin for the 8-character join code.</Text>
      <InlineMessage text={err} />
      <Input label="Join code" icon="key" placeholder="e.g. AB12CD34" value={code} onChangeText={t => { setCode(t.toUpperCase()); setSoc(null); }}
        autoCapitalize="characters" maxLength={8} />
      {!soc ? (
        <Button title="Find society" onPress={lookup} loading={loading} />
      ) : (
        <>
          <Card style={{ marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="building" color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[font.cardTitle, { color: colors.text }]}>{soc.name}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>{[soc.area, soc.city].filter(Boolean).join(', ')} · {soc.memberCount} members</Text>
            </View>
          </Card>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 6, fontSize: 13 }}>Block</Text>
          {soc.blocks?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {soc.blocks.map((b: string) => <Chip key={b} label={b} active={b === block} onPress={() => setBlock(b)} />)}
            </View>
          ) : <Input placeholder="e.g. Block 7" value={block} onChangeText={setBlock} />}
          <Input label="House / Unit number" icon="home" placeholder="e.g. 14-B" value={unit} onChangeText={setUnit} />
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 6, fontSize: 13 }}>I am a</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {RES_TYPES.map(t => <Chip key={t.v} label={t.l} active={type === t.v} onPress={() => setType(t.v)} />)}
          </View>
          <Input label="Note to admin (optional)" placeholder="Anything that helps verify you" value={note} onChangeText={setNote} multiline />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 18 }}>
            <Icon name="lock" size={14} color={colors.textMute} />
            <Text style={{ color: colors.textMute, fontSize: 12, flex: 1 }}>Your membership must be verified before accessing private community features.</Text>
          </View>
          <Button title="Submit for Verification" onPress={submit} loading={loading} />
        </>
      )}
      {isGlobalAdmin ? (
        <Button title="Create a new society" variant="outline" icon="plus" style={{ marginTop: 16 }} onPress={() => navigation.navigate('CreateSociety')} />
      ) : (
        <View style={{ marginTop: 28 }}>
          <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 10 }}>Other options</Text>
          {showAdmin ? (
            <Card style={{ marginBottom: 10 }}>
              <InlineMessage text={adminErr} />
              <Input label="Admin code" icon="key" placeholder="NEXA-XXXX-XXXX" value={adminCode} onChangeText={setAdminCode} autoCapitalize="characters" style={{ marginBottom: 10 }} />
              <Button title="Confirm admin code" small loading={adminBusy} onPress={becomeAdmin} />
            </Card>
          ) : (
            <Button title="Become an admin" icon="shield" variant="outline" style={{ marginBottom: 10 }} onPress={() => setShowAdmin(true)} />
          )}
        </View>
      )}
      <Button title="Log out" icon="logout" variant="secondary" style={{ marginTop: 10 }} onPress={signOut} />
      <Button title="Delete account" icon="trash" variant="danger" style={{ marginTop: 10 }} onPress={() => navigation.navigate('DeleteAccount')} />
    </Screen>
  );
}

/* ---------------- Admin home (platform admin without a society) ---------------- */
// Landing page after login for a platform admin who doesn't manage or belong to any society yet.
// Creating or joining a society is the admin's choice from here, never forced.
export function AdminHomeScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const first = (user?.fullName || '').split(' ')[0] || 'Admin';
  const perks = [
    { icon: 'building', text: 'Create societies and share their join code with residents' },
    { icon: 'users', text: 'Approve residents and manage members' },
    { icon: 'bell', text: 'Post announcements and emergency alerts' },
    { icon: 'shield', text: 'Review reports, deals and assistance requests' },
  ];
  return (
    <Screen>
      <Header back={false} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Avatar user={user} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={[font.title, { color: colors.text }]}>Welcome, {first}</Text>
          <View style={{ flexDirection: 'row', marginTop: 4 }}><Badge label="Platform admin" color={colors.warning} /></View>
        </View>
      </View>

      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="building" color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[font.cardTitle, { color: colors.text }]}>No society yet</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>Create one when you're ready. You'll become its admin.</Text>
          </View>
        </View>
        <Button title="Create a society" icon="plus" onPress={() => navigation.navigate('CreateSociety')} />
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <Text style={[font.cardTitle, { color: colors.text }]}>Join an existing society</Text>
        <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2, marginBottom: 10 }}>Have an 8-character join code from another admin?</Text>
        <Button title="Join with a code" icon="key" variant="outline" onPress={() => navigation.navigate('JoinSociety')} />
      </Card>

      <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 10 }}>As a platform admin you can</Text>
      {perks.map(p => (
        <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon name={p.icon} size={16} color={colors.accent} />
          <Text style={{ color: colors.text, flex: 1, fontSize: 13 }}>{p.text}</Text>
        </View>
      ))}

      <Button title="Log out" icon="logout" variant="secondary" style={{ marginTop: 18 }} onPress={signOut} />
      <Button title="Delete account" icon="trash" variant="danger" style={{ marginTop: 10 }} onPress={() => navigation.navigate('DeleteAccount')} />
    </Screen>
  );
}

/* ---------------- Create society (platform admin) ---------------- */
export function CreateSocietyScreen({ navigation }: any) {
  const { refreshMe, setActiveId, signOut } = useAuth();
  const [f, setF] = useState({ name: '', area: '', city: '', description: '', blocks: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const busyRef = useRef(false);
  const submit = async () => {
    if (busyRef.current) return; // ignore repeat taps
    setErr('');
    if (f.name.trim().length < 3 || f.area.trim().length < 2) return setErr('Society name (3+) and area (2+) are required.');
    busyRef.current = true;
    setLoading(true);
    try {
      const blocks = f.blocks.split(',').map(b => b.trim()).filter(Boolean);
      const d: any = await api.post('/societies', {
        name: f.name.trim(), area: f.area.trim(), city: f.city.trim() || undefined,
        description: f.description.trim() || undefined, blocks: blocks.length ? blocks : undefined,
      });
      if (d?.membership?._id) await setActiveId(d.membership._id);
      await refreshMe();
      if (navigation.canGoBack()) navigation.popToTop();
    } catch (e) { setErr(errMsg(e)); }
    busyRef.current = false;
    setLoading(false);
  };
  return (
    <Screen>
      <Header title="Create society" subtitle="You will become its admin and get a join code to share." />
      <InlineMessage text={err} />
      <Input label="Society name" value={f.name} onChangeText={set('name')} placeholder="Green Valley Residency" autoCapitalize="words" />
      <Input label="Area" value={f.area} onChangeText={set('area')} placeholder="Gulshan-e-Iqbal" autoCapitalize="words" />
      <Input label="City" value={f.city} onChangeText={set('city')} placeholder="Karachi" autoCapitalize="words" />
      <Input label="Blocks (comma separated) (optional)" value={f.blocks} onChangeText={set('blocks')} placeholder="A, B, C" hint="Residents choose from these when joining." />
      <Input label="Description" value={f.description} onChangeText={set('description')} multiline />
      <Button title="Create society" onPress={submit} loading={loading} />
      <Button title="Join with a code instead" variant="ghost" style={{ marginTop: 8 }} onPress={() => navigation.navigate('JoinSociety')} />
      <Button title="Log out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

/* ---------------- Pending verification / verified ---------------- */
export function PendingScreen({ navigation }: any) {
  const { active, user, refreshMe, signOut, isGlobalAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = async () => {
    setBusy(true); setMsg('');
    try {
      const d: any = await api.get('/auth/me');
      const m = (d.memberships || []).find((x: any) => x._id === active?._id);
      if (m?.status === 'active') setVerified(true);
      else if (!m || m.status === 'rejected') { await refreshMe(); }
      else setMsg(m.status === 'suspended' ? 'Your membership is suspended. Contact your society admin.' : 'Still pending. Your society admin has not reviewed it yet.');
    } catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };

  if (verified) {
    return (
      <Screen scroll={false} footer={<Button title="Go to Home" onPress={refreshMe} />}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 130, height: 130, borderRadius: 65, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={70} color={colors.accentText} strokeWidth={3} />
          </View>
          <Text style={[font.title, { color: colors.text, marginTop: 28 }]}>You're Verified!</Text>
          <Text style={{ color: colors.textDim, marginTop: 6 }}>Welcome to your community.</Text>
        </View>
      </Screen>
    );
  }

  const suspended = active?.status === 'suspended';
  return (
    <Screen onRefresh={refresh} refreshing={busy}>
      <Header back={false} />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.tealDeep, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="clock" size={40} color={colors.accent} />
        </View>
        <Text style={[font.title, { color: colors.text, marginTop: 20, textAlign: 'center' }]}>{suspended ? 'Membership Suspended' : 'Verification in Progress'}</Text>
        <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 8 }}>
          {suspended ? 'Please contact your society admin.' : 'Your community membership request has been submitted. The society admin will review your information.'}
        </Text>
        <View style={{ marginTop: 14 }}><Badge status={suspended ? 'suspended' : 'pending'} label={suspended ? 'Suspended' : 'Pending Verification'} /></View>
      </View>
      <Card style={{ marginTop: 24 }}>
        <Text style={[font.cardTitle, { color: colors.text, marginBottom: 6 }]}>Submitted Information</Text>
        <Row label="Full name" value={user?.fullName} />
        <Row label="Email" value={user?.email} />
        <Row label="Phone" value={user?.phone} />
        <Row label="Society" value={active?.society?.name} />
        <Row label="Block" value={active?.block} />
        <Row label="House / Unit" value={active?.unitLabel} />
        <Row label="Resident type" value={humanize(active?.residentType)} last />
      </Card>
      <InlineMessage text={msg} kind="info" />
      <View style={{ height: 18 }} />
      <Button title="Refresh Status" onPress={refresh} loading={busy} />
      <Button title="Join a different society" variant="outline" style={{ marginTop: 10 }} onPress={() => navigation.navigate('JoinSociety')} />
      {isGlobalAdmin ? <Button title="Create a society" variant="ghost" style={{ marginTop: 6 }} onPress={() => navigation.navigate('CreateSociety')} /> : null}
      <Button title="Log out" variant="ghost" onPress={signOut} style={{ marginTop: 6 }} />
    </Screen>
  );
}
