import { Redirect } from 'expo-router';

import { useSessionStore } from '@/core/auth/session-store';

/** Entry of the auth flow: first run (no account) registers, otherwise logs in. */
export default function AuthIndex() {
  const hasAccount = useSessionStore((state) => state.hasAccount);
  return <Redirect href={hasAccount ? '/login' : '/register'} />;
}
