import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Thin, impure wrapper around `expo-notifications` for the rest timer's
 * "rest over" alert. Isolated here so the rest-timer store stays a simple state
 * container and so the native dependency has a single seam. Only LOCAL
 * notifications are used (no push tokens) — these work in Expo Go on SDK 54.
 */

const CHANNEL_ID = 'rest-timer';

let configured = false;

/**
 * Set the foreground presentation handler and (on Android) the notification
 * channel. Idempotent — safe to call on every workout mount. Android sound +
 * heads-up come from the channel, not the payload, so the channel must exist.
 */
export function configureRestNotifications(): void {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: false,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
}

/**
 * Ensure notification permission, requesting it once if undetermined. Returns
 * whether it's granted. Called on workout mount so the prompt is contextual.
 */
export async function ensureRestPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted;
}

/**
 * Schedule the "rest over" alert `seconds` from now. Returns its id (to cancel
 * on skip/reschedule) or null if it couldn't be scheduled.
 */
export async function scheduleRestEnd(seconds: number): Promise<string | null> {
  if (seconds < 1) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest complete',
        body: 'Time for your next set.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
  } catch {
    return null;
  }
}

/** Cancel a scheduled alert. A no-op if it already fired or the id is unknown. */
export async function cancelRestEnd(id: string | null): Promise<void> {
  if (id == null) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered / unknown id — harmless.
  }
}
