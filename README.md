# XSLT Viewer for VS Code

Preview XML and XSLT with interactive, real-time refresh; XML/XSLT formatter.

## Core features

- **Preview XML and XSLT with interactive, real-time refresh**
  - Run XSLT on XML and see the rendered HTML update as you edit.
  - Click elements in the preview to jump back to the corresponding XSLT line.
  - Keep the preview fixed on the right while you edit on the left.

- **XML & XSLT formatter**
  - Use **Format Document** (`Shift+Alt+F` or right-click → **Format Document**) in any `.xml` or `.xsl`/`.xslt` file.
  - Indents tags with a configurable indent size (`xslt-viewer.formatIndentSize`, default `4`).
  - Preserves meaningful content while cleaning up structure.

- **Quick image replace and PDF export**
  - Detect embedded base64 images in the preview and:
    - **Replace** them via file upload or pasted base64, with optional resize.
    - **Export** images to files or copy their base64.
  - **Export Preview to PDF**: open the rendered preview in your browser and print to PDF.

## Requirements

- **Python 3** with the **lxml** library installed (used for running the XSLT transformation).
  - In VS Code, open the Command Palette (Ctrl + Shift + P) and type **XSLT Viewer: Check Python & lxml Setup**.
  - The **Quick Start** page will detect Python and `lxml` for you and show platform-specific install commands if anything is missing.
