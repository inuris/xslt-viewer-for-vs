# XSLT Viewer for VS Code

A powerful extension to preview XSLT transformations in real-time within Visual Studio Code.

## Features

- **Real-time Preview**: See your XSLT changes instantly as you type.
- **Auto-Detection**: Automatically detects linked XSLT stylesheets in your XML files (`<?xml-stylesheet ... ?>`).
- **Source Mapping**: Click elements in the preview to jump to the corresponding line in your XSLT source code (supported where possible).
- **Embedded Image Manager**: Detects, views, extracts, and replaces base64 encoded images directly within your XML/XSLT.
- **PDF Export**: Export your rendered preview to PDF via the browser.

## Requirements

This extension requires **Python** to be installed on your system.
1. Python 3.x
2. `lxml` library (`pip install lxml`)

## Extension Settings

This extension contributes the following settings:

* `xslt-viewer.pythonPath`: Path to the Python interpreter to use (default: `python`).

## Known Issues

- Ensure `lxml` is installed in the python environment pointed to by `xslt-viewer.pythonPath`.

## Release Notes

### 0.0.1

Initial release of XSLT Viewer for VS Code.
