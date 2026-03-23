# Changelog

All notable changes to this extension will be documented in this file.

## 2.1.4

### Added
- **Replace Image panel**: **Delete image** button (red label) removes the embedded data URI at the selected range (replaces with an empty string).

### Fixed
- **Snippets**: Fixed packaged snippet path issues by moving built-in snippets to `resources/snippets/` and updating loading logic so the command works reliably in the VSIX.
- **Formatter**: Prevented formatting from corrupting embedded Base64/data-URI images (including inside CSS and commented blocks) while keeping CSS formatting working.

