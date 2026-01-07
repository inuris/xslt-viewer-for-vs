# AI Context & Architecture Documentation
> **IMPORTANT:** This file serves as the **Index Database** for the codebase.
> **PROTOCOL:** When modifying features or adding new ones, **YOU MUST UPDATE THIS FILE** to reflect changes in workflows, function responsibilities, or file locations.

**Project:** XSLT Viewer Cloud (Client-Side)
**Type:** Web-based IDE for XML/XSLT
**Tech Stack:** Vanilla JS (ES Modules), Monaco Editor, VFS (In-Memory/LocalStorage).

## 1. Codebase Index & Navigation

### A. Explorer Pane (Sidebar)
**File:** `static/js/modules/explorer.js`
**Object:** `FileExplorer` (Singleton)

| Function / Method | Description | Dependencies |
| :--- | :--- | :--- |
| `init()` | Initializes event listeners, context menu, and initial load. | `vfs.js`, `editor.js` |
| `loadDirectory(path)` | Loads files for the given path into `this.files` and calls `render()`. | `vfs.listFiles()` |
| `render()` | Generates the HTML `<li>` elements for the file list. | DOM |
| `revealFile(path)` | Navigate to directory, scroll into view, and **select** the file. | `loadDirectory` |
| `handleItemClick(e)` | Handles single clicks (select) and double clicks (open). | `openSelected()` |
| `openSelected()` | Opens the currently selected file in the Editor. | `editor.openFile()` |
| `deleteSelected()` | Deletes the selected file/folder. | `vfs.deleteFile()` |
| `renameSelected()` | Triggers inline rename input. | `vfs.renameFile()` |
| `handleContextMenu(e)` | Shows the custom right-click menu. | `templates/components/sidebar.html` |
| `initZipUpload()` | Handles Zip file drag-and-drop and input change. | `vfs.loadZip()` |

### B. Editor Pane (Main Area)
**File:** `static/js/modules/editor.js`
**Module Scope:** Manages `monaco` instance and `tabs` array.

| Function / Method | Description | Dependencies |
| :--- | :--- | :--- |
| `initEditor()` | Loads Monaco AMD loader, configures themes, keybindings (Ctrl+S). | `monaco-editor` |
| `openFile(path)` | Creates/activates a tab for the given path. Loads content from VFS. | `vfs.readFile()` |
| `activateTab(id)` | Switches the active editor view to the specified tab. Sycs with Explorer. | `explorer.revealFile()` |
| `saveCurrentFile()` | Writes editor content to VFS and triggers LZ-String compression. | `vfs.saveFile()` |
| `renderTabs()` | Re-renders the tab strip HTML based on the `tabs` state. | DOM |
| `checkForLinkedXslt(tab)` | Auto-detects `<?xml-stylesheet ...?>` to enable Split View. | `xml-stylesheet` PI |
| `closeTab(id)` | Closes a tab. Prompts if unsaved changes exist. | `modals.html` |

### C. Preview Pane (Right/Bottom Panel)
**File:** `static/js/modules/preview.js`
**Functionality:** Handles Rendering and IFrame.

| Function / Method | Description | Dependencies |
| :--- | :--- | :--- |
| `initPreview()` | Sets up zoom controls, print button, and IFrame listeners. | `index.html` |
| `renderClientSide(...)` | Main entry point. Decides between SSR or CSR (Fallbacks). | `XSLTProcessor` |
| `preprocessXslt(...)` | **Critical:** Patches `msxsl:node-set` to `exsl:node-set` and inlines imports. | `vfs.readFile` |
| `resolvePath(base, rel)`| Resolves relative paths (e.g., `../style.xsl`) for imports. | String manipulation |

### D. File System (Buffer)
**File:** `static/js/modules/vfs.js`
**Object:** `vfs` (Singleton)

| Function / Method | Description | Storage Key |
| :--- | :--- | :--- |
| `saveFile(path, content)`| Compresses (LZ-String) and saves content to LocalStorage. | `vfs_data` |
| `readFile(path)` | Decompresses and returns content. | `vfs_data` |
| `loadZip(file)` | Parses Zip file using `JSZip` and populates VFS. | `jszip` library |
| `getSize()` | Calculates used storage space. | - |

### E. Layout & UI
**File:** `static/js/modules/layout.js`
**Functionality:** Resizers, Theme toggles, 2-Col/3-Col switching.

| Function / Method | Description | CSS Vars |
| :--- | :--- | :--- |
| `initLayout()` | Binds layout toggle button and restore preferences. | `--sidebar-width` |
| `mouseDownHandler` | Handles Drag-to-Resize for Sidebar. | `--sidebar-width` |
| `vResizer` logic | Handles Drag-to-Resize for Preview Pane (Vertical/Horizontal). | `--preview-height/width` |

## 2. Core Workflows

### 1. Rendering Pipeline (Hybrid)
1. **User Edit:** content changes in `editor.js`.
2. **Trigger:** `renderClientSide()` called in `preview.js`.
3. **Normalization:**
   - XSLT is parsed.
   - `msxsl` namespaces patched to `exslt`.
   - Imports/Includes are recursively fetched from VFS and inlined (Blob URLs).
4. **Execution:**
   - **Attempt 1 (Server):** POST to `/api/render` (Python `lxml`).
   - **Fallback (Client):** If Server fails (500/404), use browser `XSLTProcessor`.
5. **Output:** HTML injected into `<iframe>`.

### 2. Base64 Optimization Flow
1. **Load:** `base64_manager.js` detects huge base64 strings.
2. **Detach:** Replaces string with short ID `__BASE64_IMAGE_...`.
3. **Edit:** Developer works with clean, short text.
4. **Save/Render:** `attachBase64()` reintegrates original data before processing.

### 3. Storage Architecture
- **Layer 1:** Memory (JS Map). Fast access.
- **Layer 2:** Navigation Persistence (`localStorage`).
- **Compression:** All text data compressed via `LZString.compressToUTF16` before storage.

## 3. Maintenance Memory (Update Protocol)
**When to update this file:**
1. **New Modules:** If a new JS module is created in `static/js/modules/`.
2. **Refactoring:** If a core function (like `renderClientSide` or `loadDirectory`) is renamed or moved.
3. **New UI Panes:** If a new panel (e.g., "Console" or "Debugger") is added.
4. **Workflow Changes:** If the rendering pipeline or storage logic changes.

## 4. Development Rules (Vibing-Code)
1. **No Build Step:** Keep it simple. Use native ES Modules (`import ... from ...`).
2. **State:** `editor.js` is the source of truth for open tabs.
3. **Styling:** `static/css/` contains component-specific CSS. Dark/Light mode supported via body class.
4. **Error Handling:** Fail gracefully in `preview.js` (show error in iframe) rather than crashing the app.

## 5. Future Tasks / Known Limitations
- **Formatting:** Currently server-side. Move to client-side (`xml-formatter` lib) for full offline capability.
- **Click-to-Jump:** Syncing Preview scroll/click to Editor line is currently disabled in Client-Side rendering mode (requires source mapping).
