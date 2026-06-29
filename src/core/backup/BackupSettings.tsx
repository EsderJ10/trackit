import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Download, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Icon, Text, colors } from '@/ui';

import { exportBackup, restoreBackup } from './backup';

type Busy = 'export' | 'import' | null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export function BackupSettings() {
  const [busy, setBusy] = useState<Busy>(null);

  async function onExport() {
    setBusy('export');
    try {
      const now = Date.now();
      const json = exportBackup(now);
      const stamp = new Date(now).toISOString().slice(0, 10);
      const file = new File(Paths.cache, `trackit-backup-${stamp}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export TrackIt backup',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Backup saved', file.uri);
      }
    } catch (error) {
      Alert.alert('Export failed', errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function doRestore(uri: string) {
    setBusy('import');
    try {
      const json = await new File(uri).text();
      const result = restoreBackup(json);
      if (result.ok) {
        Alert.alert(
          'Restore complete',
          `Restored ${result.rowCount} rows across ${result.tableCount} tables.`,
        );
      } else {
        Alert.alert('Restore failed', result.error);
      }
    } catch (error) {
      Alert.alert('Restore failed', errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function onImport() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    Alert.alert(
      'Restore backup?',
      'This replaces all current tracking data with the backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            void doRestore(asset.uri);
          },
        },
      ],
    );
  }

  return (
    <Card className="gap-3">
      <Text variant="muted">
        Your data lives only on this device. Export a backup you can keep, and
        restore it on a fresh install.
      </Text>
      <Button
        label="Export backup"
        variant="secondary"
        size="md"
        loading={busy === 'export'}
        disabled={busy !== null}
        leftIcon={<Icon icon={Download} size={18} color={colors.fg} />}
        onPress={() => {
          void onExport();
        }}
      />
      <Button
        label="Import backup"
        variant="secondary"
        size="md"
        loading={busy === 'import'}
        disabled={busy !== null}
        leftIcon={<Icon icon={Upload} size={18} color={colors.fg} />}
        onPress={() => {
          void onImport();
        }}
      />
    </Card>
  );
}
