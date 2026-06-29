import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, TextField } from '@/ui';

import { accountBackend } from '../account-backend';
import { useSessionStore } from '../session-store';
import { AccountError } from '../types';
import { AuthScreen } from './AuthScreen';

export function LoginScreen() {
  const router = useRouter();
  const setUser = useSessionStore((state) => state.setUser);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!identifier.trim() || !password) {
      setError('Enter your username/email and password.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const user = await accountBackend.login({ identifier, password });
      // Adopting the user flips the root gate to the app — no manual navigation.
      setUser(user);
    } catch (e) {
      setError(
        e instanceof AccountError ? e.message : 'Could not sign in. Try again.',
      );
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to your TrackIt account."
    >
      <View className="gap-4">
        <TextField
          label="Username or email"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={error}
        />
      </View>
      <View className="gap-3">
        <Button label="Sign in" loading={busy} onPress={submit} />
        <Button
          label="Create an account"
          variant="ghost"
          disabled={busy}
          onPress={() => router.replace('/register')}
        />
      </View>
    </AuthScreen>
  );
}
