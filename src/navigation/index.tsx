import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { Icon } from '../ui';
import * as A from '../screens/AuthScreens';
import * as S from '../screens/SocietyScreens';
import * as H from '../screens/HomeScreens';
import * as E from '../screens/ExploreScreens';
import * as N from '../screens/NeedItemScreens';
import * as SP from '../screens/SpaceScreens';
import * as C from '../screens/CommunityScreens';
import * as P from '../screens/ProfileScreens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent },
};
const opts = { headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' as const };

function Tabs() {
  const insets = useSafeAreaInsets();
  const icon = (name: string) => ({ focused }: { focused: boolean }) => (
    <View style={{ width: 48, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.accent : 'transparent' }}>
      <Icon name={name} size={20} color={focused ? colors.accentText : colors.textDim} />
    </View>
  );
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textDim,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62 + insets.bottom, paddingBottom: insets.bottom + 4, paddingTop: 6 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tab.Screen name="HomeTab" component={H.HomeScreen} options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tab.Screen name="ExploreTab" component={E.ExploreScreen} options={{ title: 'Explore', tabBarIcon: icon('users') }} />
      <Tab.Screen name="ActivityTab" component={P.ActivityScreen} options={{ title: 'Activity', tabBarIcon: icon('layers') }} />
      <Tab.Screen name="BookingsTab" component={SP.MyBookingsScreen} options={{ title: 'Bookings', tabBarIcon: icon('calendar') }} />
      <Tab.Screen name="ProfileTab" component={P.ProfileScreen} options={{ title: 'Profile', tabBarIcon: icon('user') }} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { ready, user, active, isGlobalAdmin } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => { AsyncStorage.getItem('nexa.onboarded').then(v => setOnboarded(!!v)).catch(() => setOnboarded(true)); }, []);

  if (!ready || onboarded === null) return <A.SplashScreen />;

  const approved = !!active && active.status === 'active';
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator key={!user ? 'auth' : !approved ? (active ? 'pending' : 'setup') : 'main'} screenOptions={opts}>
        {!user ? (
          <>
            {!onboarded ? <Stack.Screen name="Onboarding" component={A.OnboardingScreen} /> : null}
            <Stack.Screen name="Login" component={A.LoginScreen} />
            <Stack.Screen name="Register" component={A.RegisterScreen} />
            <Stack.Screen name="VerifyEmail" component={A.VerifyEmailScreen} />
            <Stack.Screen name="Forgot" component={A.ForgotScreen} />
            <Stack.Screen name="ResetOtp" component={A.ResetOtpScreen} />
            <Stack.Screen name="ResetPassword" component={A.ResetPasswordScreen} />
          </>
        ) : !approved ? (
          <>
            {active ? <Stack.Screen name="Pending" component={S.PendingScreen} /> : null}
            {isGlobalAdmin && !active ? <Stack.Screen name="AdminHome" component={S.AdminHomeScreen} /> : null}
            <Stack.Screen name="JoinSociety" component={S.JoinSocietyScreen} />
            <Stack.Screen name="CreateSociety" component={S.CreateSocietyScreen} />
            <Stack.Screen name="DeleteAccount" component={P.DeleteAccountScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="Notifications" component={H.NotificationsScreen} />
            <Stack.Screen name="Announcements" component={H.AnnouncementsScreen} />
            <Stack.Screen name="AnnouncementDetail" component={H.AnnouncementDetailScreen} />
            <Stack.Screen name="AnnouncementForm" component={H.AnnouncementFormScreen} />
            <Stack.Screen name="Alerts" component={H.AlertsScreen} />
            <Stack.Screen name="AlertDetail" component={H.AlertDetailScreen} />
            <Stack.Screen name="AlertForm" component={H.AlertFormScreen} />
            <Stack.Screen name="TutorList" component={E.TutorListScreen} />
            <Stack.Screen name="TutorDetail" component={E.TutorDetailScreen} />
            <Stack.Screen name="TutorForm" component={E.TutorFormScreen} />
            <Stack.Screen name="TutorRequests" component={E.TutorRequestsScreen} />
            <Stack.Screen name="ServiceList" component={E.ServiceListScreen} />
            <Stack.Screen name="ServiceDetail" component={E.ServiceDetailScreen} />
            <Stack.Screen name="ServiceForm" component={E.ServiceFormScreen} />
            <Stack.Screen name="NeedMatch" component={N.NeedMatchScreen} />
            <Stack.Screen name="NeedForm" component={N.NeedFormScreen} />
            <Stack.Screen name="NeedDetail" component={N.NeedDetailScreen} />
            <Stack.Screen name="MatchingListings" component={N.MatchingListingsScreen} />
            <Stack.Screen name="ItemList" component={N.ItemListScreen} />
            <Stack.Screen name="ItemDetail" component={N.ItemDetailScreen} />
            <Stack.Screen name="ItemForm" component={N.ItemFormScreen} />
            <Stack.Screen name="ItemRequests" component={N.ItemRequestsScreen} />
            <Stack.Screen name="SpaceList" component={SP.SpaceListScreen} />
            <Stack.Screen name="SpaceDetail" component={SP.SpaceDetailScreen} />
            <Stack.Screen name="SpaceForm" component={SP.SpaceFormScreen} />
            <Stack.Screen name="MyBookings" component={SP.MyBookingsScreen} />
            <Stack.Screen name="ManageBookings" component={SP.ManageBookingsScreen} />
            <Stack.Screen name="RentalList" component={C.RentalListScreen} />
            <Stack.Screen name="MyRentals" component={C.MyRentalsScreen} />
            <Stack.Screen name="RentalDetail" component={C.RentalDetailScreen} />
            <Stack.Screen name="RentalForm" component={C.RentalFormScreen} />
            <Stack.Screen name="CarpoolList" component={C.CarpoolListScreen} />
            <Stack.Screen name="CarpoolDetail" component={C.CarpoolDetailScreen} />
            <Stack.Screen name="CarpoolForm" component={C.CarpoolFormScreen} />
            <Stack.Screen name="CarpoolRequests" component={C.CarpoolRequestsScreen} />
            <Stack.Screen name="DoctorList" component={C.DoctorListScreen} />
            <Stack.Screen name="DoctorDetail" component={C.DoctorDetailScreen} />
            <Stack.Screen name="DoctorForm" component={C.DoctorFormScreen} />
            <Stack.Screen name="DealList" component={C.DealListScreen} />
            <Stack.Screen name="DealDetail" component={C.DealDetailScreen} />
            <Stack.Screen name="DealForm" component={C.DealFormScreen} />
            <Stack.Screen name="AssistanceList" component={C.AssistanceListScreen} />
            <Stack.Screen name="AssistanceDetail" component={C.AssistanceDetailScreen} />
            <Stack.Screen name="AssistanceForm" component={C.AssistanceFormScreen} />
            <Stack.Screen name="ReportForm" component={C.ReportFormScreen} />
            <Stack.Screen name="EditProfile" component={P.EditProfileScreen} />
            <Stack.Screen name="Settings" component={P.SettingsScreen} />
            <Stack.Screen name="ChangePassword" component={P.ChangePasswordScreen} />
            <Stack.Screen name="DeleteAccount" component={P.DeleteAccountScreen} />
            <Stack.Screen name="SwitchSociety" component={P.SwitchSocietyScreen} />
            <Stack.Screen name="JoinSociety" component={S.JoinSocietyScreen} />
            <Stack.Screen name="CreateSociety" component={S.CreateSocietyScreen} />
            <Stack.Screen name="AdminDashboard" component={P.AdminDashboardScreen} />
            <Stack.Screen name="Members" component={P.MembersScreen} />
            <Stack.Screen name="Reports" component={P.ReportsScreen} />
            <Stack.Screen name="SocietySettings" component={P.SocietySettingsScreen} />
            <Stack.Screen name="AuditLog" component={P.AuditLogScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
