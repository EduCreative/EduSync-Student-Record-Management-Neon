
// This file is deprecated as Supabase has been removed in favor of Neon.
// It is kept as a placeholder to avoid breaking potential loose references during build.

export const supabase = {
    auth: {
        resetPasswordForEmail: async () => ({ error: { message: "Auth service migrated to Neon." } }),
    }
} as any;
