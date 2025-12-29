
# Changelog

## [3.0.0] - 2025-02-21

### Changed
- **Architectural Migration**: Moved from Supabase to **Neon Serverless Postgres**.
- **Database Engine**: Replaced `@supabase/supabase-js` with `@neondatabase/serverless` for direct SQL querying.
- **Auth Flow**: Implemented custom authentication logic against the Neon database.
- **Pausing Fix**: Resolved the 7-day manual hibernation issue by leveraging Neon's automatic wakeup.
- **Stability**: Simplified data fetching logic to reduce client-side "hanging" during large data synchronizations.

### Removed
- **Supabase Dependencies**: Removed all references to Supabase Auth, Storage, and Database clients.
