# XSLT Viewer for VS Code

A powerful extension to preview XSLT transformations in real-time within Visual Studio Code.

## Features

- **Real-time Preview**: See your XSLT changes instantly as you type (500 ms debounce).
- **Auto-Detection**: Automatically detects linked XSLT stylesheets via `<?xml-stylesheet href="..." ?>` and auto-pairs on file switch.
- **Source Mapping**: Click any element in the preview to jump to the corresponding line in your XSLT source code.
- **Element Dimension Tooltip**: Hover over elements in the preview to see their rendered width × height.
- **Zoom Control**: Scale the preview to 25 %, 50 %, 75 %, or 100 % from the toolbar dropdown.
- **Path Bar & File Switch**: A path bar shows which file is currently being previewed. Click the **XSLT / XML** button (or use the `Switch to Linked XML/XSLT` command) to toggle between the paired XML and XSLT files in the editor.
- **Embedded Image Manager**: The preview panel sidebar lists all base64-encoded images found in the active XML/XSLT with their format and byte size. From the sidebar you can:
  - **Jump** — reveal the image in the editor.
  - **Export** — save to a file or copy the raw base64 string.
  - **Replace** — upload a new image file or paste a base64 string, with optional resize (width × height) and aspect-ratio lock.
- **XML/XSLT Formatter**: Provides a document formatter for XML and XSL files (Format Document / `Shift+Alt+F`). Child tags are placed on new lines with configurable indentation; text content is preserved exactly.
- **PDF Export**: Export the rendered preview to PDF by opening it in the system browser (`Ctrl+P` to print).

## Requirements

This extension requires **Python** to be installed on your system.

1. Python 3.x
2. `lxml` library — install with:
   ```
   pip install lxml
   ```

> **Tip:** Run `install.bat` (Windows) to install all Node and Python dependencies in one step.

## Keyboard Shortcut

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+X` / `Cmd+Alt+X` | Open / refresh XSLT Preview |
| `Shift+Alt+F` | Format XML/XSLT document (VS Code default) |

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `xslt-viewer.pythonPath` | `"python"` | Path to the Python interpreter (must have `lxml` installed). |
| `xslt-viewer.formatIndentSize` | `4` | Number of spaces per indent level when formatting XML/XSLT. |

## Known Issues

- Ensure `lxml` is installed in the Python environment pointed to by `xslt-viewer.pythonPath`.
- XSLT features that rely on extension functions not supported by `lxml` may not render.

## Release Notes

### 0.1.0

- **XML/XSLT Formatter**: Document formatter for XML and XSL files with configurable indent size.
- **Image Export**: Save embedded base64 images to a file or copy the raw base64 string.
- **Image Replace**: Replace embedded images by uploading a file or pasting base64; supports resize with aspect-ratio lock.
- **Zoom Control**: Preview zoom dropdown (25 %, 50 %, 75 %, 100 %).
- **Path Bar**: Shows the relative path of the currently previewed file with an inline Switch button.
- **Hover Tooltip**: Displays element dimensions (W × H) on hover in the preview.
- **Smart File Switching**: Toggle between XML and XSLT with the path-bar button, editor toolbar button, or keyboard command; label updates to reflect the opposite file.
- **Layout Enforcement**: Preview panel stays pinned to the right column; any text editor opened in the right column is automatically moved to the left.

### 0.0.1

Initial release of XSLT Viewer for VS Code.
