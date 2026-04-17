# Changelog

All notable changes to this extension will be documented in this file.

## 2.2.20

### Fixed
- Minor bugs fixed.

## 2.2.19

### Fixed
- **Formatter**: Restrict whitespace trimming/collapsing to ASCII whitespace only, preserving non-ASCII invisible spaces used in source files.

## 2.2.18

### Fixed
- **Formatter**: Keep opening-tag attributes on one line and compact XML comments by trimming line breaks/multi-space into single-line `<!-- ... -->` output.

## 2.2.17

### Fixed
- Minor bugs fixed.

## 2.2.16

### Fixed
- **Formatter**: Normalize text-node line breaks/tabs to single spaces so literal text in XSLT does not get split into unintended wrapped lines after formatting.

## 2.2.15

### Fixed
- Minor bugs fixed.

## 2.2.14

### Fixed
- Minor bugs fixed.

## 2.2.13

### Changed
- **Replace image**: Added a target line indicator in the Replace dialog to show which embedded image is currently being edited.

## 2.2.12

### Changed
- **Replace image**: Added an Opacity (%) control (default 100) to live preview and apply opacity-adjusted base64 output on Replace.

## 2.2.11

### Changed
- **Replace image**: Added live temporary preview while picking/resizing a replacement image; Cancel (or close) restores the old preview image, and Replace commits the change.

## 2.2.10

### Fixed
- Minor bugs fixed.

## 2.2.9

### Fixed
- Minor bugs fixed.

## 2.2.8

### Fixed
- **Search result reveal**: Prevent losing focus to Search results when "Reveal in Explorer" is used; extension no longer steals focus from other views.

## 2.2.7

### Fixed
- **Replace image**: Skip old-image size suggestion when the existing image is 1×1 (placeholder); the new image's natural size is suggested instead.

## 2.2.6

### Added
- **Snippets**: Add more snippets

## 2.2.5

### Added
- **Snippets**: Add more snippets

## 2.2.4

### Changed
- **XSLT auto-select**: When only one XSLT file exists in the current folder, it is selected automatically without showing a pick list.
- **Context menu label**: Renamed from `XSLT: Preview Transformation` to `XSLT: Preview`.

## 2.2.1

### Added
- **Preview ↔ XSLT sync**: While the XSLT editor is active, the preview highlights output element(s) whose `data-source-line` matches the cursor line (reverse of click-to-jump). Toggle with setting `xslt-viewer.highlightPreviewOnXsltCursor` (default: on).

### Changed
- **Preview highlight color**: Cursor-sync outline uses purple (`#AB47BC`) instead of blue so it stays visible on invoices that use blue styling.
- **Preview line fallback**: When the cursor is on inner XSLT text lines (for example `xsl:value-of`) that do not map directly to an output node, preview highlight now falls back to the nearest previous mapped line (closest parent output tag).

## 2.1.4

### Added
- **Replace Image panel**: **Delete image** button (red label) removes the embedded data URI at the selected range (replaces with an empty string).

### Fixed
- **Snippets**: Fixed packaged snippet path issues by moving built-in snippets to `resources/snippets/` and updating loading logic so the command works reliably in the VSIX.
- **Formatter**: Prevented formatting from corrupting embedded Base64/data-URI images (including inside CSS and commented blocks) while keeping CSS formatting working.

