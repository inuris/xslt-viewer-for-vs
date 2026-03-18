# Changelog

All notable changes to this extension will be documented in this file.

## 2.1.4

### Fixed
- **Snippets**: Fixed packaged snippet path issues by moving built-in snippets to `resources/snippets/` and updating loading logic so the command works reliably in the VSIX.
- **Formatter**: Prevented formatting from corrupting embedded Base64/data-URI images (including inside CSS and commented blocks) while keeping CSS formatting working.

