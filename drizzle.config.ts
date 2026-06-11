import type { Config } from 'drizzle-kit';

export default {
  schema: './src/core/db/schema.ts',
  out: './src/core/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
