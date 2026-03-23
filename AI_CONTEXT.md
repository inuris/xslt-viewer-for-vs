# AI Context & Architecture Documentation
> **IMPORTANT:** This file serves as the **Index Database** for the codebase.
> **PROTOCOL:** When modifying features or adding new ones, **YOU MUST UPDATE THIS FILE** to reflect changes in workflows, function responsibilities, or file locations.

**Project:** XSLT Viewer for VS Code
**Type:** VS Code Extension
**Tech Stack:** TypeScript (Extension), Python (lxml backend), HTML/CSS (Webviews).

## 1. Codebase Index & Navigation

### A. Extension Entry & Logic
**File:** `src/extension.ts`
**Description:** The core controller; wires commands, panel, and events only. Delegates to modules below.
- **`activate()`**: Calls `checkDependencies()`, then registers commands, webview panel, event listeners; holds `currentPanel`, `replacePanel`, `exportPanel`, `activeXml`, `activeXslt`, `lastSwitchedTo`, and `runUpdate()` / `triggerAutoUpdate()`.

**Supporting modules (under `src/`):**
- **`transformation.ts`**: `runPythonTransformation()`, `instrumentXslt()` — Python spawn + XSLT line instrumentation.
- **`images.ts`**: `scanImages()`, `handleSaveImage()`, `applyReplaceImage()`, `handleJumpToImage()` — base64 image scan, export, replace, and jump.
- **`filePicker.ts`**: `pickWorkspaceFile()`, `updateXmlStylesheetLink()` — file picker and XML `<?xml-stylesheet href="...">` updates.
- **`navigation.ts`**: `findAndJump()`, `showRange()` — click-to-jump from preview to XSLT source.
– **`webview.ts`**: `getWebviewShell(initialZoom)`, `getReplaceImagePanelHtml()`, `getExportImagePanelHtml()`, `wrapForIframe()` — preview panel HTML (toolbar, zoom, path bar, image sidebar), image dialog panels, and iframe click/hover script injection. `initialZoom` comes from the `xslt-viewer.previewZoom` setting.
- **`formatter.ts`**: `formatXml()` — pure TypeScript XML/XSLT formatter registered as a VS Code document formatting provider for `xml` and `xsl` languages.
- **`setup.ts`**: `checkDependencies()` / `showSetupForced()` — probes Python and lxml availability; opens a setup guide webview panel (`getSetupHtml`) if either is missing or when forced. Panel shows status badges, platform-specific install instructions, copy buttons, a "Check Again" action, a link to the `pythonPath` setting, and a collapsible **Diagnostic Log** showing the raw probe output for each command.
- **`base64Preview.ts`**: `registerBase64Preview()` — registers InlayHintsProvider (compact label `[📷 24KB PNG]` before base64), HoverProvider (image preview on hover), and editor decorations (grayed-out styling on base64 spans) for XML/XSL documents.

### B. Project structure
- **TypeScript (source):** `src/*.ts` — compiled to `out/` (extension entrypoint is `out/extension.js`).
- **Runtime assets (packaged):**
  - **Python:** `resources/python/transform.py` — transformation engine; invoked by the extension.
  - **Snippets:** `resources/snippets/xslt-snippets.md` + `resources/snippets/README.md` — XSLT snippet definitions (Markdown); read at runtime.

### C. Transformation Backend
**File:** `resources/python/transform.py`
**Description:** A standalone Python script acting as the transformation engine.
- **Dependencies:** `lxml` (Required).
- **IO:** Reads JSON `{ xmlContent, xsltContent }` from `stdin`, writes raw bytes to `stdout`.
- **Logic:**
    - Parses XML and XSLT using `lxml`.
    - Patches `msxsl:node-set` to `exsl:node-set` for compatibility.
    - Handles encoding/decoding to avoid UTF-8 issues.
    - Returns the rendered result or exits with error code 1.

### D. Configuration & Setup
- **`package.json`**:
    - `xslt-viewer.pythonPath`: Path to the Python interpreter (default: `python`).
    - `xslt-viewer.formatIndentSize`: Number of spaces per indent level when formatting (default: `4`).
    - `xslt-viewer.previewZoom`: Default preview zoom level (25/50/75/100). Read from user settings only.
    - `xslt-viewer.snippetsFile`: Optional path to a custom XSLT snippets file (Markdown .md); empty = use built-in `resources/snippets/xslt-snippets.md`.
    - Commands: `xslt-viewer.preview`, `xslt-viewer.switchFile`, `xslt-viewer.exportPdf`, `xslt-viewer.showSetup`, `xslt-viewer.showSnippets`.
    - Keyboard shortcut: `Ctrl+Alt+X` / `Cmd+Alt+X` for preview.
- **`install.bat`**: Helper script to `npm install`, `npm run compile`, and `pip install lxml` for first-time setup.

## 2. Core Workflows

### 1. Rendering Pipeline (IPC)
1. **Trigger:** `runUpdate()` calls `runPythonTransformation()`.
2. **Instrumentation:** XSLT source is passed through `instrumentXslt()` (in TS) to add `data-source-line` attributes.
3. **Execution:**
   - Spawns a child process: `[pythonPath] resources/python/transform.py`.
   - Sends JSON payload via `stdin`.
4. **Output:**
   - Receives HTML via `stdout`.
   - Wraps HTML with `wrapForIframe()` (injects click-to-jump + hover tooltip scripts).
   - Posts `{ command: 'update', html, images, relativePath, switchButtonLabel }` to the webview.
   - If error (stderr), displays an error message in the Webview.

### 2. Auto-Detection & Pairing
The extension attempts to intelligently pair XML and XSLT files:
- **From XML:** Checks for `<?xml-stylesheet href="...">`.
- **From XSLT:** Prompts user to pick an XML file.
- **Auto-update:** When the active editor switches to a different XML file with a stylesheet link, the pair is updated automatically.
- **Manual:** `xslt-viewer.switchFile` command toggles between the active XML and XSLT, updating the path bar label.

### 3. "Click-to-Jump" Navigation
- **Frontend (Webview):** The rendered HTML contains elements with `data-source-line` (injected by `instrumentXslt`).
- **Interaction:** User clicks an element in the preview.
- **Message:** Webview iframe sends `{ command: 'jumpToCode', line: ... }` to the outer shell, which forwards it to the Extension.
- **Action:** Extension calls `findAndJump()` to open `activeXslt` and reveal the specific line. Path bar and switch button label update accordingly.

### 4. Hover Tooltip (Dimensions)
- **Script:** Injected by `wrapForIframe()` into the iframe content.
- **Behavior:** On `mouseover` of any `[data-source-line]` element, shows a floating tooltip with `offsetWidth × offsetHeight`. Parent element gets a dashed outline for context.

### 5. Embedded Image Management (Preview Sidebar)
- **Location:** Right sidebar panel inside `getWebviewShell()` (toggled by "🖼️ Images" button).
- **Scanner:** `scanImages()` in `images.ts` — finds Base64 data URIs in the active XML and XSLT documents via regex.
- **Sidebar View:** Lists images with thumbnail, format, byte size, and pixel dimensions (resolved via `onload`).
- **Actions:**
    - **Jump:** `handleJumpToImage()` — reveal the image line in the editor.
    - **Export:** Opens `getExportImagePanelHtml()` panel — save to file via `handleSaveImage()` or copy raw base64.
    - **Replace:** Opens `getReplaceImagePanelHtml()` panel — upload file or paste base64; supports width × height resize with aspect-ratio lock. **Delete image** (red text) clears the data URI at the scan range (empty string) via `applyReplaceImage(range, '')`. Normal replace uses `applyReplaceImage(range, dataUri)`.

### 6. Dependency Setup Check (First-Run)
- **Trigger:** Called immediately in `activate()` via `checkDependencies()` from `setup.ts`.
- **Detection:** Spawns `[pythonPath] --version` and `[pythonPath] -c "import lxml"` as child processes.
- **On failure (or forced):** Opens / reveals a singleton `xsltViewerSetup` webview panel in `ViewColumn.One` with:
    - Status badges for Python and lxml.
    - Tabbed platform-specific install steps (Windows `winget`, macOS `brew`, Linux `apt`), ordered by the current OS (`process.platform`).
    - Copy buttons for each terminal command.
    - **Check Again** — shows a "Checking…" loading state, re-runs detection; disposes panel and shows success notification if all good.
    - **Save** — inline input for `pythonPath`; saving updates the setting via `workspace.getConfiguration().update()` without opening the Settings UI (avoids Cursor freeze when reopening settings repeatedly).
    - **Diagnostic Log** (`<details>`) — shows the Python path used, the exact command probed, exit status, and raw stdout/stderr for both probes.
- **`xslt-viewer.showSetup` command** — calls `showSetupForced(context)`, always opens the panel (even when all dependencies are healthy). Useful for debugging unknown transformation errors.

### 7. XML/XSLT Formatter
- **Provider:** Registered for `xml` and `xsl` languages via `vscode.languages.registerDocumentFormattingEditProvider`.
- **Implementation:** `formatXml()` in `formatter.ts` — tokenizer-based formatter that indents child tags vertically while preserving all text content exactly (no changes to whitespace inside text nodes).
- **Config:** Indent size from `xslt-viewer.formatIndentSize` setting.

### 7. PDF Export
- **Command:** `xslt-viewer.exportPdf` — re-runs transformation (without instrumentation), writes HTML to a temp file, opens in the system browser for `Ctrl+P` printing.

### 8. Layout Management & Snippets
- **Behavior:** Preview panel opens in `ViewColumn.Two`. When any text editor appears in `ViewColumn.Two`, it is automatically moved to `ViewColumn.One` to keep the preview pane clean.
- **Context menu:** The editor context menu for XML/XSLT files exposes `XSLT: Insert Snippet` (`xslt-viewer.showSnippets`), which opens a Quick Pick of XSLT templates and inserts the chosen snippet at the cursor. Snippets are loaded from `resources/snippets/xslt-snippets.md` (Markdown with `` ```xml `` / `` ```xsl `` code blocks for IDE highlighting) or from `xslt-viewer.snippetsFile`. See `resources/snippets/README.md` for the format.

## 3. Webview Shell Structure (`getWebviewShell`)
- **Path Bar** (`#path-bar`): Shows `relativePath` of the currently previewed file + a Switch button (label: "XSLT" or "XML").
- **Toolbar** (`#toolbar`): Export PDF button | Zoom dropdown (25/50/75/100%) | Images sidebar toggle. The dropdown is initialized from `xslt-viewer.previewZoom`, and changes are sent back via `setPreviewZoom` to persist the last choice.
- **Content Area** (`#main-container`): `<iframe id="preview-frame">` (sandboxed) + collapsible `#sidebar` (250 px, hidden by default).
- **Messages from Extension:** `update` (full refresh), `setSwitchLabel`, `setPath`.
- **Messages to Extension:** `jumpToCode`, `switchFile`, `exportPdf`, `exportImage`, `replaceImage`, `jumpToImage`. Replace panel also sends `replaceImageReady`, `replaceImagePickFile`, `replaceImageApply`, `replaceImageDelete`, `replaceImageCancel`.

## 4. Comparison with Web App (`ref/`)
This project is a port of the "XSLT Viewer Cloud" (Web App).
- **Storage:** Removed Custom VFS. Uses VS Code's native file system.
- **Editor:** Removed Custom Monaco setup. Uses VS Code's native editor.
- **Backend:** Retained the Python `lxml` logic, but moved from a Flask/HTTP server to a direct CLI script interface (`transform.py`).
- **Webview:** Replaces the IFrame preview. The instrumentation logic was ported from `preview.js` to `extension.ts`.

## 5. Maintenance Memory (Update Protocol)
**When to update this file:**
1. **New Commands:** If `package.json` commands change.
2. **Python Logic:** If `transform.py` logic (e.g., arguments or return format) changes.
3. **Webview Features:** If new interaction modes are added to the Preview or Sidebar webviews.
4. **New Modules:** If new `.ts` files are added under `src/`.

**Cursor instructions:** Project rules live in `.cursor/rules/`. When adding or changing features or functions, **also update** the relevant `.mdc` rules and this file. See the rule `self-update-instructions.mdc` for the required self-update protocol.
