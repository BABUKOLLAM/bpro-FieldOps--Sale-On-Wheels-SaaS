import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { usePinLock } from '../auth/PinLock';
import { useTranslation } from '../i18n/LanguageContext';
import LoginScreen from '../screens/auth/LoginScreen';
import PinGateScreen from '../screens/auth/PinGateScreen';
import HomeScreen from '../screens/HomeScreen';
import SpotBillingScreen from '../screens/billing/SpotBillingScreen';
import TripScreen from '../screens/trips/TripScreen';
import ExpenseScreen from '../screens/expenses/ExpenseScreen';
import ReceiptScreen from '../screens/receipts/ReceiptScreen';
import OrderScreen from '../screens/orders/OrderScreen';
import ReturnScreen from '../screens/returns/ReturnScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { isLoading: pinLoading, isUnlocked } = usePinLock();
  const { t } = useTranslation();

  if (authLoading || pinLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // PIN gate takes priority: even an already-authenticated session
  // (valid JWT still in Keychain) requires the device PIN/biometric on
  // every cold start before the app — or the refresh token — is usable.
  if (!isUnlocked) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="PinGate" component={PinGateScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: t.nav.home }}
            />
            <Stack.Screen
              name="SpotBilling"
              component={SpotBillingScreen}
              options={{ title: t.nav.spotBilling }}
            />
            <Stack.Screen
              name="Trip"
              component={TripScreen}
              options={{ title: t.nav.trip }}
            />
            <Stack.Screen
              name="Expense"
              component={ExpenseScreen}
              options={{ title: t.nav.expense }}
            />
            <Stack.Screen
              name="Receipt"
              component={ReceiptScreen}
              options={{ title: t.nav.collection }}
            />
            <Stack.Screen
              name="Order"
              component={OrderScreen}
              options={{ title: t.nav.order }}
            />
            <Stack.Screen
              name="Return"
              component={ReturnScreen}
              options={{ title: t.nav.return }}
            />
            <Stack.Screen
              name="Attendance"
              component={AttendanceScreen}
              options={{ title: t.nav.attendance }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
