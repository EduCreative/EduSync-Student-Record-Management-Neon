
# Changelog

## [3.2.1] - 2025-02-21

### Fixed
- **Build Error**: Resolved `TS2307` error on Vercel by removing explicit `.tsx` extension from `UserLogsPage` import in `Layout.tsx`.
- **Cleanup**: Completely removed Supabase from `index.html` importmap.

## [3.2.0] - 2025-02-21

### Changed
- **Database Migration**: Fully moved to Neon Serverless Postgres.
- **Image Storage**: Switched to Base64-in-Postgres for student photos and school logos, removing the need for Supabase Storage.
- **Authentication**: Replaced Supabase Auth with custom Neon-based manual authentication.
