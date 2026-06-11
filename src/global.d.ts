// Drizzle's generated Expo migrations import `.sql` files as string modules.
declare module '*.sql' {
  const content: string;
  export default content;
}
