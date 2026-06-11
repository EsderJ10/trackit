import { Stack, useLocalSearchParams } from 'expo-router';

import { getModule } from '@/core/module-registry';
import { EmptyState, Screen } from '@/ui';

/**
 * Generic mount point for a module's single root screen. Modules that ship
 * their own route files under `app/modules/<id>/` override this automatically
 * (static segments win over the dynamic `[moduleId]` segment).
 */
export default function ModuleRoute() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const module = getModule(moduleId);

  if (!module) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Not found' }} />
        <EmptyState
          title="Module not found"
          description={`No registered module with id "${moduleId}".`}
        />
      </Screen>
    );
  }

  const ModuleScreen = module.ModuleScreen;

  return (
    <>
      <Stack.Screen options={{ title: module.meta.name }} />
      {ModuleScreen ? (
        <ModuleScreen />
      ) : (
        <Screen>
          <EmptyState
            title={module.meta.name}
            description="This module has no screen yet."
          />
        </Screen>
      )}
    </>
  );
}
