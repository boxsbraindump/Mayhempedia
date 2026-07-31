# Mayhempedia changelog

Release history for the Mayhempedia desktop companion. League/ARAM game patch notes live separately in `data/patch-notes.json`.

## [0.1.2] - 2026-07-25

0.1.2 expands the route library with new ARAM: Mayhem playstyles, makes the right route easier to reach from the home screen, and brings the companion up to the 26.15 Mayhem update.

### Added
- Added 11 new official-style routes for Akshan, Briar, Gwen, Hwei, Ivern, Jarvan IV, Morgana, Neeko, Rell, Soraka, and Volibear.
- Added curated Combo Plays to explain useful augment and item interactions.
- Added New labels to recently published routes and homepage picks.
- Added visible desktop app version information in the sidebar.

### Changed
- Refined the Command Center with four focused new-route picks, complete six-item builds, and core augments at a glance.
- Opening a homepage route now lands directly on that exact Combat File route instead of the champion default.
- Reworked Combat File and overlay spacing so core augments, alternatives, starter items, and final items scan more cleanly.
- Updated tactical notes to League of Legends 26.15 and limited the view to ARAM: Mayhem changes.
- Tightened the Command Center layout by aligning the Champion Codex and recent matches, while removing low-value count cards.

### Fixed
- Corrected Mayhem augment icons, names, and localized patch-note content through 26.15.
- Fixed mixed-language labels in the English interface and improved long augment-name readability.
- Kept local match history capped and displayed as 20 saved games maximum.
- Removed the misleading in-app update page; public release availability is now handled by the packaged release flow.

## [0.1.1] - 2026-07-18

The first public Windows installer for Mayhempedia, with the Champion Codex, local-first client integration, and update checks.

### Added
- Published the first installable Windows beta.
- Added configurable hotkeys and the initial desktop release flow.
- Added a public homepage with the Combat File preview.

### Changed
- None

### Fixed
- None

## [0.1.0] - 2026-07-15

The first Mayhempedia test build connected the Electron desktop shell to the League Client read-only interface.

### Added
- Added the initial Electron desktop companion.
- Connected to League Client state without reading game memory or automating gameplay.
- Added the first Champion Codex and ARAM build data views.

### Changed
- None

### Fixed
- None
