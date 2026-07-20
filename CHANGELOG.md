# Changelog

All notable changes to this extension will be documented in this file.

## 2.2.32

### Added
- **Snippets**: Added "Convert Number to Vietnamese Words" snippet (reads a number as Vietnamese currency text, e.g. `numberToVietnamese`).

## 2.2.31

### Fixed
- **Preview**: Fixed a bug where the click-to-jump line instrumentation could corrupt XML comments containing a `<word` sequence (e.g. `<!-- ... <myVar ... -->`), silently breaking the XSLT's element nesting and causing misleading errors like "element template only allowed as child of stylesheet". Instrumentation now skips comments/CDATA sections entirely.
- **Transformation errors**: Python transform script now reports precise line/column diagnostics for XML/XSLT syntax and compile errors instead of a bare libxslt message.

## 2.2.30

### Fixed
- **Formatter**: Preserve one leading/trailing space in inline text nodes (e.g. `<i>(VAT rate) </i>0%`) so mixed HTML/XSLT content does not lose intentional word spacing.

## 2.2.29

### Changed
- **Replace Image**: Rename section to **Resize**; Opacity is now a 0–100% slider on its own row.
- **Replace Image**: Resize / Opacity / Hue / Saturation / Brightness edit the **original** image when nothing is uploaded or pasted; once a new image is provided, the same controls apply to that image.

## 2.2.28

### Added
- **Replace Image**: Hue / Saturation / Brightness sliders (Photoshop-style ranges) with live preview and baked-in Replace output.

## 2.2.27

### Changed
- **Snippets**: Updated built-in XSLT snippets.

## 2.2.26

### Changed
- **Snippets**: Updated built-in XSLT snippets.

## 2.2.25

### Changed
- **Snippets**: Updated "Update STT by TChat" snippet to hide STT for `TChat = 4` and support `Remark` display fallback.

## 2.2.24

### Changed
- **Snippets**: Updated "Convert Number to Vietnamese Words" snippet to support negative values.

## 2.2.23

### Fixed
- **Snippets**: Fixed missing closing `</xsl:choose>` tag in "Add Signature Block" snippet.

## 2.2.22

### Changed
- **Snippets**: Updated "Convert Number to Vietnamese Words" snippet with improved formatting and added call example.

## 2.2.21

### Changed
- **Snippets**: Renamed "Number to Vietnamese" snippet label to "Convert Number to Vietnamese Words" for clarity.

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

