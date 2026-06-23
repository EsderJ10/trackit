import { Dumbbell, History as HistoryIcon } from 'lucide-react-native';

import type { TrackerModule } from '@/core/types/module';
import { colors } from '@/ui';

import { seedProgramTemplates } from './program-templates';
import { seedGym, seedMuscleLandmarks } from './seed';
import { GymDashboardWidget } from './widgets/GymDashboardWidget';
import { GymProfileWidget } from './widgets/GymProfileWidget';
import { GymSettingsPanel } from './widgets/GymSettingsPanel';

/** Seed the exercise catalog first, then the program templates that reference it. */
function seedGymModule(db: Parameters<typeof seedGym>[0]): void {
  seedGym(db);
  seedMuscleLandmarks(db);
  seedProgramTemplates(db);
}

/**
 * The Gym tracking module. Ships its own route files under `app/modules/gym/`
 * for its routine → workout → history flow, so it omits `ModuleScreen`.
 */
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
  ProfileWidget: GymProfileWidget,
  SettingsPanel: GymSettingsPanel,
  primaryTabs: [
    { name: 'train', title: 'Train', icon: Dumbbell },
    { name: 'history', title: 'History', icon: HistoryIcon },
  ],
  seed: seedGymModule,
};
