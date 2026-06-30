import { Dumbbell, History as HistoryIcon } from 'lucide-react-native';

import type { TrackerModule } from '@/core/types/module';
import { colors } from '@/ui';

import { seedProgramTemplates } from './program-templates';
import { seedGym, seedMuscleLandmarks } from './seed';
import { ActiveWorkoutBar } from './widgets/ActiveWorkoutBar';
import { GymDashboardWidget } from './widgets/GymDashboardWidget';
import { GymProfileWidget } from './widgets/GymProfileWidget';
import { GymSettingsPanel } from './widgets/GymSettingsPanel';

// Catalog must seed before program templates that reference it.
function seedGymModule(db: Parameters<typeof seedGym>[0]): void {
  seedGym(db);
  seedMuscleLandmarks(db);
  seedProgramTemplates(db);
}

export const gymModule: TrackerModule = {
  meta: {
    id: 'gym',
    name: 'Gym',
    description: 'Plan routines and log your workouts',
    icon: Dumbbell,
    color: colors.gym,
    version: '1.0.0',
  },
  DashboardWidget: GymDashboardWidget,
  // Reached at /modules/gym via its own nested stack (app/modules/gym/).
  ownsRouteStack: true,
  // Pinned resume-workout bar above the tab bar, visible app-wide while a session
  // is open (renders null otherwise).
  GlobalBar: ActiveWorkoutBar,
  ProfileWidget: GymProfileWidget,
  SettingsPanel: GymSettingsPanel,
  primaryTabs: [
    { name: 'train', title: 'Train', icon: Dumbbell },
    { name: 'history', title: 'History', icon: HistoryIcon },
  ],
  seed: seedGymModule,
};
