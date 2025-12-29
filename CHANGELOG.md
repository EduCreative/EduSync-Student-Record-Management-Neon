
# Changelog

## [3.1.1] - 2025-02-21

### Fixed
- **Schema Update**: Added `password` column to the `profiles` table definition in `README.md` to support custom Neon authentication.
- **Migration Documentation**: Clarified the step required to add the `password` column when importing from Supabase.

## [3.1.0] - 2025-02-21

### Optimized
- **Arrears Calculation**: Re-engineered the "Previous Balance" logic to use efficient Map-based lookups during challan generation, significantly reducing "hanging" issues during bulk processing.
- **Data Fetching**: Improved Neon query efficiency by optimizing `ANY` operator usage and reducing redundant data transformations.
- **Bulk Operations**: Implemented optimized bulk student and user additions using asynchronous batching.
