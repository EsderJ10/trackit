import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text, TextField } from '@/ui';

import { accountBackend } from '../account-backend';
import { useSessionStore } from '../session-store';
import { AccountError } from '../types';
import { AuthScreen } from './AuthScreen';

const MIN_USERNAME = 3;
const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

/** Create the device's single local account. */
export function RegisterScreen() {
  const router = useRouter();
  const setUser = useSessionStore((state) => state.setUser);
  const hasAccount = useSessionStore((state) => state.hasAccount);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  function validate(): FieldErrors | null {
    const next: FieldErrors = {};
    if (username.trim().length < MIN_USERNAME) {
      next.username = `At least ${MIN_USERNAME} characters.`;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      next.email = 'Enter a valid email.';
    }
    if (password.length < MIN_PASSWORD) {
      next.password = `At least ${MIN_PASSWORD} characters.`;
    }
    if (confirm !== password) {
      next.confirm = 'Passwords do not match.';
    }
    return Object.keys(next).length ? next : null;
  }

  async function submit() {
    if (busy) return;
    const invalid = validate();
    if (invalid) {
      setErrors(invalid);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const user = await accountBackend.register({
        username,
        email: email.trim() || undefined,
        password,
      });
      setUser(user);
    } catch (e) {
      setErrors({
        form:
          e instanceof AccountError
            ? e.message
            : 'Could not create the account. Try again.',
      });
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title="Create account"
      subtitle="Your data stays on this device."
    >
      <View className="gap-4">
        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          error={errors.username}
        />
        <TextField
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
          error={errors.password}
        />
        <TextField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={errors.confirm ?? errors.form}
        />
      </View>
      <View className="gap-3">
        <Text variant="caption" className="text-center text-warning">
          There is no password recovery. If you forget it, the only way back in
          is erasing the app — which deletes all your data.
        </Text>
        <Button label="Create account" loading={busy} onPress={submit} />
        {hasAccount ? (
          <Button
            label="I already have an account"
            variant="ghost"
            disabled={busy}
            onPress={() => router.replace('/login')}
          />
        ) : null}
      </View>
    </AuthScreen>
  );
}
