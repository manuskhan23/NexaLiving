import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, TextInput, View, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errMsg, ApiError } from '../api';
import { useAuth } from '../auth';
import { colors, font } from '../theme';
import { Button, Header, Icon, Input, InlineMessage, Screen } from '../ui';

const logo = require('../assets/logo.png');
const { width: W } = Dimensions.get('window');

/* ---------------- Onboarding ---------------- */
const SLIDES = [
  { icon: 'building', title: 'Welcome to NexaLiving', text: 'Your neighbourhood, all in one place. Connect, discover and stay informed.' },
  { icon: 'compass', title: 'Everything Around You', text: 'Find tutors and local services, book community spaces and borrow from neighbours.' },
  { icon: 'users', title: 'Good neighbours. Great connections.', text: 'Share, lend a hand or find your people. A more connected community starts with you.' },
];

export function OnboardingScreen({ navigation }: any) {
  const [i, setI] = useState(0);
  const ref = useRef<FlatList>(null);
  const finish = async () => {
    try { await AsyncStorage.setItem('nexa.onboarded', '1'); } catch {}
    navigation.replace('Login');
  };
  const next = () => {
    if (i >= SLIDES.length - 1) return finish();
    ref.current?.scrollToIndex({ index: i + 1 });
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.tealDeep }}>
      <FlatList ref={ref} data={SLIDES} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        keyExtractor={s => s.title}
        onMomentumScrollEnd={e => setI(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item }) => (
          <View style={{ width: W, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' }}>
            <View style={st.heroIcon}><Icon name={item.icon} size={64} color={colors.accent} strokeWidth={1.4} /></View>
            <Text style={[font.title, { color: '#fff', textAlign: 'center', marginTop: 36 }]}>{item.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 }}>{item.text}</Text>
          </View>
        )} />
      <View style={{ padding: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {SLIDES.map((_, k) => <View key={k} style={{ width: k === i ? 22 : 8, height: 6, borderRadius: 3, backgroundColor: k === i ? colors.accent : 'rgba(255,255,255,0.3)' }} />)}
        </View>
        <Button title={i === SLIDES.length - 1 ? 'Join your community' : 'Continue'} onPress={next} />
        <Pressable onPress={finish} style={{ alignItems: 'center', padding: 14 }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function SplashScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.tealDeep, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={logo} style={{ width: 180, height: 90 }} resizeMode="contain" />
      <Text style={{ color: colors.accent, letterSpacing: 3, fontSize: 11, marginTop: 6 }}>OUR COMMUNITY</Text>
    </View>
  );
}

/* ---------------- Login ---------------- */
export function LoginScreen({ navigation }: any) {
  const { establishSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!email.trim() || !password) return setErr('Enter your email and password.');
    setLoading(true);
    try {
      const d: any = await api.post('/auth/login', { email: email.trim(), password, deviceName: 'NexaLiving App' }, { auth: false });
      await establishSession({ ...d, remember });
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
        try { await api.post('/auth/resend-signup-otp', { email: email.trim() }, { auth: false }); } catch {}
        navigation.navigate('VerifyEmail', { email: email.trim().toLowerCase() });
      } else setErr(errMsg(e));
    }
    setLoading(false);
  };

  return (
    <Screen>
      <Header back={false} />
      <Text style={[font.title, { color: colors.text }]}>Welcome Back</Text>
      <Text style={{ color: colors.textDim, marginBottom: 24, marginTop: 4 }}>Log in to continue</Text>
      <InlineMessage text={err} />
      <Input label="Email" icon="mail" placeholder="name@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Input label="Password" icon="lock" placeholder="••••••••" value={password} onChangeText={setPassword} password />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Pressable onPress={() => setRemember(r => !r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[st.check, remember && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            {remember ? <Icon name="check" size={14} color={colors.accentText} strokeWidth={3} /> : null}
          </View>
          <Text style={{ color: colors.textDim }}>Remember me</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Forgot')}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Forgot Password?</Text>
        </Pressable>
      </View>
      <Button title="Log In" onPress={submit} loading={loading} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
        <Text style={{ color: colors.textDim }}>Don't have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Register')}><Text style={{ color: colors.accent, fontWeight: '700' }}>Sign Up</Text></Pressable>
      </View>
    </Screen>
  );
}

/* ---------------- Register ---------------- */
const CNIC_RE = /^\d{5}-\d{7}-\d$/;
const PHONE_RE = /^(\+92|0)3\d{9}$/;

export function RegisterScreen({ navigation }: any) {
  const [f, setF] = useState({ fullName: '', email: '', phone: '', cnic: '', password: '', confirm: '', adminCode: '' });
  const [showAdmin, setShowAdmin] = useState(false);
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [fe, setFe] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));

  const formatCnic = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 13);
    const a = d.slice(0, 5), b = d.slice(5, 12), c = d.slice(12);
    return [a, b, c].filter(Boolean).join('-');
  };

  const submit = async () => {
    setErr('');
    const e: Record<string, string> = {};
    if (f.fullName.trim().length < 2) e.fullName = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
    if (!PHONE_RE.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'Use a Pakistani mobile e.g. 03001234567';
    if (!CNIC_RE.test(f.cnic)) e.cnic = 'Format: XXXXX-XXXXXXX-X';
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = '8+ characters with a letter and a number';
    if (f.confirm !== f.password) e.confirm = 'Passwords do not match';
    setFe(e);
    if (Object.keys(e).length) return;
    if (!agree) return setErr('Please accept the Terms & Conditions.');
    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.replace(/[\s-]/g, ''),
        cnic: f.cnic, password: f.password, adminCode: showAdmin ? f.adminCode.trim() : '',
      }, { auth: false });
      navigation.navigate('VerifyEmail', { email: f.email.trim().toLowerCase() });
    } catch (x) { setErr(errMsg(x)); }
    setLoading(false);
  };

  return (
    <Screen>
      <Header title="Create Account" subtitle="Your next connection is closer than you think." />
      <InlineMessage text={err} />
      <Input label="Full Name" icon="user" placeholder="Zain Ali" value={f.fullName} onChangeText={set('fullName')} autoCapitalize="words" error={fe.fullName} />
      <Input label="Email" icon="mail" placeholder="zainali@email.com" value={f.email} onChangeText={set('email')} keyboardType="email-address" error={fe.email} />
      <Input label="Mobile Number" icon="phone" placeholder="03001234567" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={fe.phone} />
      <Input label="CNIC" icon="shield" placeholder="12345-1234567-1" value={f.cnic} onChangeText={v => set('cnic')(formatCnic(v))} keyboardType="number-pad" error={fe.cnic} />
      <Input label="Password" icon="lock" placeholder="••••••••" value={f.password} onChangeText={set('password')} password error={fe.password} />
      <Input label="Confirm Password" icon="lock" placeholder="••••••••" value={f.confirm} onChangeText={set('confirm')} password error={fe.confirm} />
      {showAdmin ? (
        <Input label="Admin Code" icon="key" placeholder="NEXA-XXXX-XXXX" value={f.adminCode} onChangeText={set('adminCode')} autoCapitalize="characters"
          hint="Only if you were given an admin signup code." />
      ) : (
        <Pressable onPress={() => setShowAdmin(true)} style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.textDim, fontSize: 13 }}>Have an admin code? <Text style={{ color: colors.accent, fontWeight: '600' }}>Register as admin</Text></Text>
        </Pressable>
      )}
      <Pressable onPress={() => setAgree(a => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <View style={[st.check, agree && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
          {agree ? <Icon name="check" size={14} color={colors.accentText} strokeWidth={3} /> : null}
        </View>
        <Text style={{ color: colors.textDim }}>I agree to <Text style={{ color: colors.accent, fontWeight: '600' }}>Terms & Conditions</Text></Text>
      </Pressable>
      <Button title="Sign Up" onPress={submit} loading={loading} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 22 }}>
        <Text style={{ color: colors.textDim }}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Login')}><Text style={{ color: colors.accent, fontWeight: '700' }}>Login</Text></Pressable>
      </View>
    </Screen>
  );
}

/* ---------------- OTP input ---------------- */
export function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 20 }}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[st.otpBox, value.length === i && { borderColor: colors.accent }]}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{value[i] || ''}</Text>
        </View>
      ))}
      <TextInput ref={ref} value={value} onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" maxLength={6} autoFocus style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
    </Pressable>
  );
}

function useCountdown(start = 30) {
  const [n, setN] = useState(start);
  useEffect(() => {
    if (n <= 0) return;
    const t = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(t);
  }, [n]);
  return [n, () => setN(start)] as const;
}

/* ---------------- Verify email (signup OTP) ---------------- */
export function VerifyEmailScreen({ route }: any) {
  const { email } = route.params;
  const { establishSession } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('We emailed you a 6-digit code.');
  const [left, restart] = useCountdown(30);
  const masked = email.replace(/^(.).*(@.*)$/, '$1***$2');

  const verify = async () => {
    setErr('');
    if (otp.length !== 6) return setErr('Enter the 6-digit code.');
    setLoading(true);
    try {
      const d: any = await api.post('/auth/verify-signup-otp', { email, otp, deviceName: 'NexaLiving App' }, { auth: false });
      await establishSession(d);
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  const resend = async () => {
    setErr('');
    try {
      await api.post('/auth/resend-signup-otp', { email }, { auth: false });
      setInfo('A new code has been sent to your email.');
      restart();
    } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Screen>
      <Header />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={st.otpIcon}><Icon name="mail" size={26} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[font.title, { color: colors.text, fontSize: 24 }]}>Verify your email</Text>
          <Text style={{ color: colors.textDim }}>Code sent to {masked}</Text>
        </View>
      </View>
      <InlineMessage text={err} />
      <InlineMessage text={info} kind="info" />
      <OtpInput value={otp} onChange={setOtp} />
      <Text style={{ color: colors.textDim, textAlign: 'center', marginBottom: 18 }}>
        {left > 0 ? `Resend code in 00:${String(left).padStart(2, '0')}` : ''}
      </Text>
      <Button title="Verify & continue" onPress={verify} loading={loading} />
      <Button title="Resend code" variant="ghost" onPress={resend} disabled={left > 0} style={{ marginTop: 8 }} />
    </Screen>
  );
}

/* ---------------- Forgot / reset ---------------- */
export function ForgotScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter a valid email.');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() }, { auth: false });
      navigation.navigate('ResetOtp', { email: email.trim().toLowerCase() });
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen>
      <Header title="Forgot Password" subtitle="Enter your email and we'll send you a 6-digit code." />
      <InlineMessage text={err} />
      <Input label="Email" icon="mail" placeholder="name@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Button title="Send code" onPress={submit} loading={loading} />
    </Screen>
  );
}

export function ResetOtpScreen({ route, navigation }: any) {
  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [left, restart] = useCountdown(30);
  const verify = async () => {
    setErr('');
    if (otp.length !== 6) return setErr('Enter the 6-digit code.');
    setLoading(true);
    try {
      const d: any = await api.post('/auth/verify-reset-otp', { email, otp }, { auth: false });
      navigation.replace('ResetPassword', { resetToken: d.resetToken });
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  const resend = async () => {
    try { await api.post('/auth/forgot-password', { email }, { auth: false }); restart(); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Screen>
      <Header title="Enter the code" subtitle={`We emailed a 6-digit code to ${email}`} />
      <InlineMessage text={err} />
      <OtpInput value={otp} onChange={setOtp} />
      <Button title="Verify code" onPress={verify} loading={loading} />
      <Button title={left > 0 ? `Resend code in ${left}s` : 'Resend code'} variant="ghost" onPress={resend} disabled={left > 0} style={{ marginTop: 8 }} />
    </Screen>
  );
}

export function ResetPasswordScreen({ route, navigation }: any) {
  const { resetToken } = route.params;
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const ok = (r: boolean) => ({ color: r ? colors.success : colors.textMute, fontSize: 12 });
  const submit = async () => {
    setErr('');
    if (p1 !== p2) return setErr('Passwords do not match.');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { resetToken, newPassword: p1 }, { auth: false });
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };
  return (
    <Screen>
      <Header title="Create New Password" subtitle="Choose a strong password you haven't used before." />
      <InlineMessage text={err} />
      <Input label="New Password" icon="lock" value={p1} onChangeText={setP1} password placeholder="New password" />
      <Input label="Confirm Password" icon="lock" value={p2} onChangeText={setP2} password placeholder="Confirm password" />
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <Text style={ok(p1.length >= 8)}>8+ characters</Text>
        <Text style={ok(/[A-Za-z]/.test(p1))}>1 letter</Text>
        <Text style={ok(/\d/.test(p1))}>1 number</Text>
      </View>
      <Button title="Reset Password" onPress={submit} loading={loading} />
    </Screen>
  );
}

const st = StyleSheet.create({
  heroIcon: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(0,230,118,0.12)', alignItems: 'center', justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  otpBox: { width: 46, height: 56, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  otpIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
