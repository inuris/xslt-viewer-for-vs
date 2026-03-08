# AI Context & Architecture Documentation
> **IMPORTANT:** This file serves as the **Index Database** for the codebase.
> **PROTOCOL:** When modifying features or adding new ones, **YOU MUST UPDATE THIS FILE** to reflect changes in workflows, function responsibilities, or file locations.

**Project:** XSLT Viewer for VS Code
**Type:** VS Code Extension
**Tech Stack:** TypeScript (Extension), Python (lxml backend), HTML/CSS (Webviews).

## 1. Codebase Index & Navigation

### A. Extension Entry & Logic
**File:** `src/extension.ts`
**Description:** The core controller for the extension.
- **`activate()`**: Registers commands, views, and event listeners.
- **`activeXml` / `activeXslt`**: Tracks the currently "paired" files for transformation.
- **`runUpdate()`**: Orchestrates the transformation steps.
- **`instrumentXslt()`**: Injects `data-source-line` attributes into XSLT for click-to-jump navigation.
- **`ImageSidebarProvider`**: Manages the "Embedded Images" sidebar view (webview-based).

### B. Transformation Backend
**File:** `src/python/transform.py`
**Description:** A standalone Python script acting as the transformation engine.
- **Dependencies:** `lxml` (Required).
- **IO:** Reads JSON `{ xmlContent, xsltContent }` from `stdin`, writes raw bytes to `stdout`.
- **Logic:**
    - Parses XML and XSLT using `lxml`.
    - Patches `msxsl:node-set` to `exsl:node-set` for compatibility.
    - Handles encoding/decoding to avoid UTF-8 issues.
    - Returns the rendered result or exits with error code 1.

### C. Configuration & Setup
- **`package.json`**:
    - `xslt-viewer-sidebar`: Defines the sidebar container.
    - `xslt-viewer.pythonPath`: Configuration setting to specify the Python interpreter (crucial for users with multiple environments).
- **`install.bat`**: Helper script to `npm install`, `npm run compile`, and `pip install lxml` for first-time setup.

## 2. Core Workflows

### 1. Rendering Pipeline (IPC)
1. **Trigger:** `runUpdate()` calls `runPythonTransformation()`.
2. **Instrumentation:** XSLT source is passed through `instrumentXslt()` (in TS) to add line mapping attributes.
3. **Execution:**
   - Spawns a child process: `[pythonPath] src/python/transform.py`.
   - Sends JSON payload via `stdin`.
4. **Output:** 
   - Receives HTML via `stdout`.
   - Injects HTML into the `currentPanel` Webview via `getWebviewContent()`.
   - If error (stderr), displays an error page in the Webview via `getWebviewError()`.

### 2. Auto-Detection & Pairing
The extension attempts to intelligently pair XML and XSLT files:
- **From XML:** Checks for `<?xml-stylesheet href="..."?>`.
- **From XSLT:** Scans open editors for XML files referencing the current stylesheet.
- **Manual:** `xslt-viewer.switchFile` command allows manual pairing via QuickPick.

### 3. "Click-to-Jump" Navigation
- **Frontend (Webview):** The rendered HTML contains elements with `data-source-line` (injected by `instrumentXslt`).
- **Interaction:** User clicks an element in the preview.
- **Message:** Webview sends `{ command: 'jumpToCode', line: ... }` to Extension.
- **Action:** Extension opens the `activeXslt` document and reveals the specific line.

### 4. Embedded Image Management (Sidebar)
- **Frontend:** A Webview View Provider (`ImageSidebarProvider`).
- **Scanner:** Finds Base64 data URIs in the active document (regex based).
- **Sidebar View:** Lists images with metadata (size, mime type).
- **Actions:**
    - **Jump:** Reveal the image line in the editor.
    - **Download/Edit:** (Planned/Partially Implemented in Webview script).
    - **Export PDF:** Triggers `xslt-viewer.exportPdf` which opens the rendered HTML in the system browser for printing.

## 3. Comparison with Web App (`ref/`)
This project is a port of the "XSLT Viewer Cloud" (Web App).
- **Storage:** Removed Custom VFS. Uses VS Code's native file system.
- **Editor:** Removed Custom Monaco setup. Uses VS Code's native editor.
- **Backend:** Retained the Python `lxml` logic, but moved from a Flask/HTTP server to a direct CLI script interface (`transform.py`).
- **Webview:** Replaces the IFrame preview. The instrumentation logic was ported from `preview.js` to `extension.ts`.

## 4. Maintenance Memory (Update Protocol)
**When to update this file:**
1. **New Commands:** If `package.json` commands change.
2. **Python Logic:** If `transform.py` logic (e.g., arguments or return format) changes.
3. **Webview Features:** If new interaction modes are added to the Preview or Sidebar webviews.

**Cursor instructions:** Project rules live in `.cursor/rules/`. When adding or changing features or functions, **also update** the relevant `.mdc` rules and this file. See the rule `self-update-instructions.mdc` for the required self-update protocol.
