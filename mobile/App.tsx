import 'react-native-get-random-values'; // must precede any `uuid` import
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { PinProvider } from './src/auth/PinLock';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <PinProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </PinProvider>
    </SafeAreaProvider>
  );
}
