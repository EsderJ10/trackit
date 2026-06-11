import { Dashboard } from '@/core/dashboard/Dashboard';
import { Screen } from '@/ui';

export default function DashboardRoute() {
  return (
    <Screen edges={['top']}>
      <Dashboard />
    </Screen>
  );
}
