import { Dumbbell } from 'lucide-react-native';

import type { TrackerModule } from '@/core/types/module';
import { colors } from '@/ui';

import { seedGym } from './seed';
import { GymDashboardWidget } from './widgets/GymDashboardWidget';

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
  seed: seedGym,
};
