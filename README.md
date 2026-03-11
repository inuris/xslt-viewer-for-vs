# XSLT Viewer for VS Code

Preview XML and XSLT with interactive, real-time refresh; XML/XSLT formatter.

## Core features

- **Live in-editor XSLT preview** – run XML + XSLT and see the result directly in a VS Code panel, no browser needed.  
  `![XSLT live preview](assets/xslt-preview.gif)`

- **Click-to-jump from preview to XSLT** – click in the rendered HTML to jump to the exact XSLT line that produced it.  
  `![Click preview to jump to XSLT](assets/xslt-click.gif)`

- **Embedded image sidebar (export & replace)** – list, export, and swap base64 images (backgrounds, logos, etc.) in one click.  
  `![Manage embedded images](assets/xslt-image.gif)`

Other capabilities:

- XML & XSLT formatter (Format Document) with configurable indent (`xslt-viewer.formatIndentSize`).
- Export preview to browser / PDF.

## Requirements

- **Python 3** with the **lxml** library installed (used for running the XSLT transformation).
  - In VS Code, open the Command Palette (Ctrl + Shift + P) and type **XSLT Viewer: Check Python & lxml Setup**.
  - The **Quick Start** page will detect Python and `lxml` for you and show platform-specific install commands if anything is missing.
