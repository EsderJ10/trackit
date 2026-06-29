import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Text, TextField } from '@/ui';

import { accountBackend } from './account-backend';
import { useSessionStore } from './session-store';
import { AccountError } from './types';

const MIN_PASSWORD = 6;

export function AccountSettings() {
  const user = useSessionStore((state) => state.user);
  const logout = useSessionStore((state) => state.logout);
  const [changing, setChanging] = useState(false);

  if (!user) return null;

  return (
    <Card className="gap-3">
      <View>
        <Text variant="label">{user.displayName ?? user.username}</Text>
        <Text variant="muted" className="mt-1">
          {user.email ?? `Signed in as ${user.username}`}
        </Text>
      </View>

      {changing ? (
        <ChangePasswordForm onDone={() => setChanging(false)} />
      ) : (
        <View className="flex-row gap-3">
          <Button
            label="Change password"
            variant="secondary"
            size="md"
            className="flex-1"
            onPress={() => setChanging(true)}
          />
          <Button
            label="Log out"
            variant="danger"
            size="md"
            className="flex-1"
            onPress={() => void logout()}
          />
        </View>
      )}
    </Card>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    if (next.length < MIN_PASSWORD) {
      setError(`New password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await accountBackend.changePassword({ current, next });
      onDone();
    } catch (e) {
      setError(
        e instanceof AccountError ? e.message : 'Could not change password.',
      );
      setBusy(false);
    }
  }

  return (
    <View className="gap-3">
      <TextField
        label="Current password"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
      />
      <TextField
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoCapitalize="none"
      />
      <TextField
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        error={error}
      />
      <View className="flex-row gap-3">
        <Button
          label="Cancel"
          variant="ghost"
          size="md"
          className="flex-1"
          disabled={busy}
          onPress={onDone}
        />
        <Button
          label="Save"
          size="md"
          className="flex-1"
          loading={busy}
          onPress={save}
        />
      </View>
    </View>
  );
}
