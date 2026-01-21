
# Changelog

## [3.5.1] - 2025-02-21

### Fixed
- **Vercel Build**: Resolved `TS6133` error regarding unused variables in `ChallanScannerPage.tsx`.
- **Header (Mobile)**: Reduced padding and hidden additional text labels on very small screens to ensure icons do not overflow the viewport.

## [3.5.0] - 2025-02-21

### Improved
- **Header Responsiveness**: Overhauled the header layout for mobile devices. Non-essential text labels are now hidden on small screens to prevent horizontal overflow, while critical icons remain accessible.
- **Dynamic Text Handling**: School names now truncate gracefully on mobile to prioritize action buttons.

## [3.4.11] - 2025-02-21
- **Challan Scanner (Mobile)**: Fixed an issue where the camera would close immediately after opening on mobile devices.
