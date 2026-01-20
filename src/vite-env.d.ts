// FIX: The reference to "vite/client" was failing to resolve, likely due to a configuration issue
// outside the scope of editable files. Replaced the reference with an explicit definition
// of ImportMetaEnv to ensure import.meta.env is correctly typed for the application.
// See: https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // FIX: Added VITE_NEON_DATABASE_URL to satisfy TypeScript checks in src/lib/neonClient.ts
  readonly VITE_NEON_DATABASE_URL: string;
  // FIX: Added VITE_GOOGLE_CLIENT_ID to satisfy TypeScript checks in src/utils/googleDriveService.ts
  readonly VITE_GOOGLE_CLIENT_ID: string;

  // Standard Vite environment variables
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}