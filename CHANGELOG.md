
# Changelog

## [3.2.3] - 2025-02-21

### Changed
- **Visual Branding**: Introduced "Neon Cyan" accent colors and glow effects across the UI to visually distinguish the Neon-powered edition.
- **Logo**: Added an electric cyan glow to the EduSync logo.
- **Sidebar**: Updated active navigation states with neon accents.

## [3.2.2] - 2025-02-21

### Fixed
- **Module Resolution**: Renamed `logs` directory to `user-logs` to resolve Vercel build error `TS2307`.

## [3.2.1] - 2025-02-21

### Fixed
- **Build Error**: Resolved `TS2307` error on Vercel by removing explicit `.tsx` extension from `UserLogsPage` import in `Layout.tsx`.
- **Cleanup**: Completely removed Supabase from `index.html` importmap.

## [3.2.0] - 2025-02-21

### Changed
- **Database Migration**: Fully moved to Neon Serverless Postgres.
- **Image Storage**: Switched to Base64-in-Postgres for student photos and school logos, removing the need for Supabase Storage.
- **Authentication**: Replaced Supabase Auth with custom Neon-based manual authentication.
