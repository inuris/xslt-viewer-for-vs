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
– **`webview.ts`**: `getWebviewShell(initialZoom)`, `getEditImagePanelHtml()`, `wrapForIframe()` — preview panel HTML (toolbar, zoom, path bar, image sidebar), the combined Edit Image dialog, and iframe click/hover script injection. `initialZoom` comes from the `xslt-viewer.previewZoom` setting.
- **`formatter.ts`**: `formatXml()` — pure TypeScript XML/XSLT formatter registered as a VS Code document formatting provider for `xml` and `xsl` languages.
- **`setup.ts`**: `checkDependencies()` / `showSetupForced()` — probes Python and lxml availability; opens a setup guide webview panel (`getSetupHtml`) if either is missing or when forced. Panel shows status badges, platform-specific install instructions, copy buttons, a "Check Again" action, a link to the `pythonPath` setting, and a collapsible **Diagnostic Log** showing the raw probe output for each command.
- **`base64Preview.ts`**: `registerBase64Preview()` — registers InlayHintsProvider (compact label `[📷 24KB PNG]` before base64), HoverProvider (image preview on hover), and editor decorations (grayed-out styling on base64 spans) for XML/XSL documents.
- **`styleEdit.ts`**: `applyInlineStyleEdit(doc, line, prop, value)` — locates the literal output tag in the XSLT source whose start line matches a preview `data-source-line`, then adds/updates `width`/`height` inside that tag's inline `style="..."` (creating the attribute if absent). Backs the Preview Pane's W/H quick-edit icons (§9). Its tag-matching regex intentionally mirrors `instrumentXslt()`'s exactly, so line numbers line up 1:1 between the preview and the source.

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
- **`npm run vsix:local`**: Local debugging package workflow; runs compile then creates a VSIX (`npx vsce package`) for local install/testing.
- **`publish-app.bat`**: Publish helper script that reads the latest version from the top `CHANGELOG.md` heading (`## x.y.z`), syncs `package.json` version to match, then publishes to VS Code Marketplace and Open VSX without auto-increment.

## 2. Core Workflows

### 1. Rendering Pipeline (IPC)
1. **Trigger:** `runUpdate()` calls `runPythonTransformation()`.
2. **Instrumentation:** XSLT source is passed through `instrumentXslt()` (in TS) to add `data-source-line` attributes. This is a whole-document scan (not line-by-line) that explicitly skips `<!-- comments -->` and `<![CDATA[ ]]>` sections — a comment containing a `<word`-like sequence must never be treated as a tag, or it corrupts the comment terminator and cascades into confusing libxslt structural errors (e.g. "element X only allowed as child of stylesheet").
3. **Execution:**
   - Spawns a child process: `[pythonPath] resources/python/transform.py`.
   - Sends JSON payload via `stdin`.
4. **Output:**
   - Receives HTML via `stdout`.
   - Wraps HTML with `wrapForIframe()` (injects click-to-jump + hover tooltip scripts).
   - On error, `transform.py` parses XML/XSLT strictly first to capture precise line/column syntax diagnostics, then falls back to a recovering parser; if XSLT compilation or application then fails, the strict-parse diagnostics are appended to the raised error so line numbers are visible in the "Transformation Error" panel.
   - Posts `{ command: 'update', html, images, relativePath, switchButtonLabel }` to the webview.
   - If error (stderr), displays an error message in the Webview.

### 2. Auto-Detection & Pairing
The extension attempts to intelligently pair XML and XSLT files:
- **From XML:** Checks for `<?xml-stylesheet href="...">`.
- **From XSLT:** Prompts user to pick an XML file.
- **Auto-update:** When the active editor switches to a different XML file with a stylesheet link, the pair is updated automatically — **unless the preview is locked** (see below), in which case this re-pairing is skipped entirely and the current pair keeps previewing.
- **Manual:** `xslt-viewer.switchFile` command toggles between the active XML and XSLT, updating the path bar label. Unaffected by the lock (it toggles within the same pair, it doesn't re-pair to a different file).
- **Lock toggle:** `previewLocked` (module-scoped state in `extension.ts`, not persisted) guards the `onDidChangeActiveTextEditor` re-pairing listener. Toggled via the toolbar's Lock button (`🔓 Lock` / `🔒 Locked`, left of the Zoom dropdown) — webview sends `{ command: 'toggleLock', locked }`; extension stores it and passes the current value into `getWebviewShell(initialZoom, previewLocked)` whenever the panel (re)opens so the button reflects reality.

### 3. "Click-to-Jump" Navigation (and reverse: cursor → preview highlight)
- **Frontend (Webview):** The rendered HTML contains elements with `data-source-line` (injected by `instrumentXslt`).
- **Interaction (preview → code):** User clicks an element in the preview.
- **Message:** Webview iframe sends `{ command: 'jumpToCode', line: ... }` to the outer shell, which forwards it to the Extension.
- **Action:** Extension calls `findAndJump()` to open `activeXslt` and reveal the specific line. Path bar and switch button label update accordingly.
- **Reverse (code → preview):** When `xslt-viewer.highlightPreviewOnXsltCursor` is true (default), moving the cursor in the **active XSLT** editor sends `highlightPreviewLine` to the shell, which `postMessage`s `highlightSourceLine` into the preview iframe. Elements matching `[data-source-line="<line>"]` get class `xslt-preview-line-highlight` (purple `#AB47BC` outline + shadow, chosen to stand out from common invoice blues) and scroll into view. If the exact line has no mapped output node (for example, cursor on `xsl:value-of` text inside a block), the iframe falls back upward to the nearest previous line that has `data-source-line` so the closest parent output tag is highlighted. After each full preview refresh (`update`), `highlightLine` is included in the same message and applied on iframe `load` to avoid racing `srcdoc` replacement. Highlight is cleared when the active editor is not the XSLT file (e.g. XML or another tab) or when the editor loses focus without a matching XSLT document.

### 4. Hover Tooltip (Dimensions + Selector)
- **Script:** Injected by `wrapForIframe()` into the iframe content.
- **Behavior:** On `mouseover` of any `[data-source-line]` element, shows a floating tooltip with a CSS-style selector line (`tag#id`, else `tag.firstClass`, else bare `tag` — e.g. `td.input-name`, `span#header`) above an `offsetWidth × offsetHeight` line. Parent element gets a dashed outline for context.

### 5. Embedded Image Management (Preview Sidebar)
- **Location:** Right sidebar panel inside `getWebviewShell()` (toggled by "🖼️ Images" button).
- **Scanner:** `scanImages()` in `images.ts` — finds Base64 data URIs in the active XML and XSLT documents via regex.
- **Sidebar View:** Lists images with thumbnail, format, byte size, and pixel dimensions (resolved via `onload`).
- **Actions:**
    - **Jump:** `handleJumpToImage()` — reveal the image line in the editor.
    - **Edit** (merged Export+Replace): Opens `getEditImagePanelHtml()` panel — single dialog with **Upload...** and **Save as...** side by side, and a Base64 textarea pre-filled with the current image's data URI (overwrite it, or upload a file, to replace; leave it and hit **Save as...** to just export what's currently in the field via `handleSaveImage()`). **Crop**, **Resize**, **Opacity** (0–100% slider), and **Hue / Saturation / Brightness** apply to the **original** image when nothing is uploaded/pasted (edit-in-place); once a new image is provided, the same controls apply to that new image (with fit-to-original-slot resize when maintain-ratio is on). Live preview updates without writing to disk. **Cancel** resets preview. **Replace** commits via `applyReplaceImage(range, dataUri)`. **Delete image** clears the data URI via `applyReplaceImage(range, '')`.
    - **Crop (avatar-upload-style mini editor):** A 260×180 `<canvas>` (`#crop-canvas`) shows the active source image (uploaded/pasted, else original) letterboxed to fit, with `state.cropScale`/`cropOffsetX`/`cropOffsetY` mapping natural image px ↔ canvas display px. A draggable `#crop-rect` div (dashed border, `box-shadow: 0 0 0 9999px` for the dark mask outside it) overlays the canvas with 8 handles (4 corners + 4 edges, `data-h="nw|n|ne|e|se|s|sw|w"`). `state.crop = {x,y,w,h}` is always stored in **natural image px**. Dragging a handle resizes from that edge/corner (`onCropDragMove`, clamped to the image bounds and a 10px minimum via `clampCrop`); dragging the rect body (no `data-h`) moves it. On drag end (`onCropDragEnd`), the Width/Height number boxes snap to the crop's size and `state.ratio` updates so "maintain aspect ratio" locks to the new crop shape. **Reset crop** (`#btn-crop-reset`) restores the full image and resets Width/Height to natural size. The crop resets to full extent whenever the active source changes (new upload/paste swaps in a differently-sized image — same reset behavior the Resize boxes already had). Crop composes with Resize/Opacity/HSB in one pass: `buildPreviewDataUri()` now always draws via the 9-arg `ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)` form, where `sx/sy/sw/sh` come from `state.crop` (or the full image when uncropped) and `w/h` are the Width/Height boxes — so cropping to a region and then typing a different Width/Height scales the cropped region to that output size in one step.

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
- **Implementation:** `formatXml()` in `formatter.ts` — tokenizer-based formatter that indents child tags vertically, keeps opening tags on one line (attributes are whitespace-normalized outside quotes), normalizes XML comments to compact one-line `<!-- ... -->` form, and normalizes text-node **ASCII whitespace only** (`\t`, `\n`, `\r`, space) into single spaces to avoid unintended word/line splits in literal text output. Non-ASCII/invisible spacing characters (for example `U+00A0`) are preserved. Probable encoded payload-like text blobs are left untouched.
- **Config:** Indent size from `xslt-viewer.formatIndentSize` setting.

### 7. PDF Export
- **Command:** `xslt-viewer.exportPdf` — re-runs transformation (without instrumentation), writes HTML to a temp file, opens in the system browser for `Ctrl+P` printing.

### 8. Layout Management & Snippets
- **Behavior:** Preview panel opens in `ViewColumn.Two`. When any text editor appears in `ViewColumn.Two`, it is automatically moved to `ViewColumn.One` to keep the preview pane clean.
- **Context menu:** The editor context menu for XML/XSLT files exposes `XSLT: Insert Snippet` (`xslt-viewer.showSnippets`), which opens a Quick Pick of XSLT templates and inserts the chosen snippet at the cursor. Snippets are loaded from `resources/snippets/xslt-snippets.md` (Markdown with `` ```xml `` / `` ```xsl `` code blocks for IDE highlighting) or from `xslt-viewer.snippetsFile`. See `resources/snippets/README.md` for the format.

### 9. W/H Edge-Drag Resize (Preview Pane)
- **Activation (element, not just line):** The `document click` handler inside `wrapForIframe()`'s script activates the *exact* clicked `[data-source-line]` element synchronously (`activateElements([target], line)`) — it does not wait on the editor round-trip. This matters because multiple output tags can share one source line (e.g. `<td>` and a nested `<span>` on the same line); re-deriving "the" element from a line number alone via `querySelectorAll` can land on the wrong one (usually the outer/parent tag, since it comes first in document order). The click path sidesteps that ambiguity by keeping a reference to the actual clicked node.
- **Echo suppression:** The click also still posts `jumpToCode`, which moves the XSLT editor cursor and round-trips back as a `highlightSourceLine` message (§ "Click-to-Jump", reverse cursor-sync). Since that message only carries a line number, re-running it would re-derive the (possibly wrong) element and clobber the precise click activation. The script records `lastClickLine`/`lastClickAt` and ignores a `highlightSourceLine` echo for the same line within ~1s of the click. Genuine cursor-only moves (the user clicking around in the XSLT editor, not the preview) are unaffected and still highlight via `highlightPreviewForSourceLine()`'s querySelectorAll + fallback-walk.
- **Edge-drag handles (Photoshop-style, the only editing affordance — no badges/popup):** Four invisible 6px hit-strips (`.xslt-edge-handle`, `ew-resize`/`ns-resize` cursor, highlight on hover) sit flush on the active element's left/right/top/bottom borders (`positionEdgeHandles()`, called on activation and on `scroll`/`resize` — never hidden by those, only repositioned). Mousedown on one starts a `document`-level `mousemove`/`mouseup` drag (`startEdgeDrag` → `onEdgeDragMove`/`onEdgeDragEnd`) that live-resizes width (left/right handles) or height (top/bottom handles) with a floating px label following the cursor, and commits through `commitStyleValue()` on mouseup. Left/top handles invert the sign (dragging left/up *increases* size, since the element's near edge is what's conceptually being pulled). Drag is not clamped to the parent's size, only to `>= 0`.
- **Post-drag click suppression:** A completed drag's `mouseup` usually lands with the pointer no longer over the handle (it moved during the drag), so the browser synthesizes a `click` on whatever's underneath — often the outer body/table, which has no `data-source-line`. Left unhandled, that stray click fell into the main click handler's "else" branch and deactivated (and re-jumped to) the just-edited element, forcing a re-activate to keep editing. `onEdgeDragEnd` now sets a one-shot `justDragged` flag; the document click handler swallows exactly the next click when it's set, without touching the current activation. A genuine subsequent click (not drag-tail) still deactivates/re-jumps normally.
- **Zero = remove:** Dragging to `0` doesn't set `width:0px` — it removes the `width`/`height` declaration entirely (and drops the whole `style=""` attribute if that was its only declaration).
- **Apply:** Commit posts `{ command: 'editElementStyle', line, prop: 'width'|'height', value }` (an empty `value` means "remove") up through the webview shell to the extension, which calls `styleEdit.ts`'s `applyInlineStyleEdit()` against `activeXslt` and, on success, calls `runUpdate()` to re-render from the now-edited source.
- **Known limits:** Only edits literal/static XSLT output tags (same constraint as click-to-jump/`instrumentXslt`). If two output tags start on the same source line, a *cursor-driven* (not click-driven) activation still targets the first one in source order — the click path doesn't have this ambiguity. Always writes/removes an inline `style` declaration, which by CSS specificity overrides any class-based or legacy `width=""`/`height=""` attribute sizing regardless of where the original value came from.

### 10. Quick-Edit Toolbar (Bold + Color, Preview Pane)
- **Trigger/lifecycle:** A small floating toolbar (`.xslt-quick-toolbar`, Word-style) shows next to the active element alongside the §9 edge-drag handles — same activation source (`activateElements()`), same teardown (`clearPreviewLineHighlight()` → `hideQuickToolbar()`), same never-hide-on-scroll/resize rule (`positionQuickToolbar()` runs on `scroll`/`resize`/edge-drag-move, mirroring `positionEdgeHandles()`). Positioned centered above the element's bounding rect, flipping below if that would clip off the top of the viewport.
- **Bold:** A `B` button toggles `font-weight`. State read via `getComputedStyle(el).fontWeight` (numeric ≥ 600, or `'bold'`/`'bolder'`) so it reflects inherited/class-based bold too, not just an existing inline style. Toggling off removes the declaration (same empty-value-means-remove convention as §9) rather than writing `font-weight: normal`.
- **Color:** A swatch button shows the element's current computed text color (`getComputedStyle(el).color`, converted `rgb(...)` → hex via `rgbStringToHex()`) and opens a hidden native `<input type="color">` on click (`.xslt-qt-color-input`, positioned off-screen, triggered via `.click()`). `input` events live-preview the color directly on the element without committing; `change` (picker closed/confirmed) commits via the same `editElementStyle` message path as §9.
- **Message path:** Both reuse `commitGenericStyle(prop, value)` → `{ command: 'editElementStyle', line, prop: 'font-weight'|'color', value }`. `extension.ts`'s handler and `styleEdit.ts`'s `applyInlineStyleEdit()` widened their prop whitelist from `'width'|'height'` to the `StyleProp` union (`'width'|'height'|'font-weight'|'color'`) — the underlying attribute-patching regex logic was already prop-name-generic, no other changes needed there.
- **Click-outside safety:** Toolbar buttons and the color input call `e.stopPropagation()` in their own listeners (same pattern as the edge-drag handles) so a click on them never bubbles to the main `document` click handler, which would otherwise treat it as "clicked outside the active element" and deactivate.
- **Gotcha (template-literal double-escaping):** `wrapForIframe()`'s entire injected script is one JS template literal in `webview.ts`; a *single* backslash in a regex literal written inside it (e.g. `\d`, `\s`, `\(`) gets silently eaten by the outer template literal's own string-escape processing before the text ever reaches the browser — `\d` becomes a literal `d`, changing the regex's meaning without any compile error. `rgbStringToHex()`'s regex therefore uses doubled backslashes (`\\d`, `\\s`, `\\(`) in the TS source so a *single* backslash survives into the actual runtime regex. (Pre-existing example of the same trap, left as-is since out of scope here: `parsePx()`'s regex has this bug too but is masked by a bounding-rect fallback whenever it fails to match, so it never surfaced.)
- **Gotcha (webview clicks steal `activeTextEditor`, breaking "restore what I was editing"):** Any `editElementStyle` commit (§9 or §10) triggers `runUpdate()`, which does a *full* iframe reload (`frame.srcdoc = ...`) — this wipes all script state (`activeEditEl`, highlight classes, edge handles, quick toolbar) and the only thing that restores it is the `update` message's `highlightLine`, echoed back into the fresh iframe as `highlightSourceLine` once it loads. `runUpdate()` originally derived `highlightLine` solely from `vscode.window.activeTextEditor`'s cursor position — but clicking a button *inside the webview* (the Bold toggle, the color input) moves VS Code focus to the webview panel, which can leave `activeTextEditor` undefined or stale, silently dropping `highlightLine` and losing the just-edited element's activation on reload. Fixed by giving `runUpdate(forceHighlightLine?: number)` an explicit override, and having the `editElementStyle` handler call `runUpdate(message.line)` — the line just edited is always known precisely from the message itself, so restoring activation no longer depends on editor-focus state at all. (Width/height edge-drag happened to work before this fix only because its activating click had already moved the cursor via `jumpToCode`/`findAndJump`, and nothing after that stole focus again before the drag committed — the toolbar's buttons don't have that lucky timing.)
- **Gotcha (a second, delayed, unforced reload was clobbering the fix above):** `applyInlineStyleEdit()`'s `editor.edit()` on `activeXslt` fires `workspace.onDidChangeTextDocument`, which independently calls `triggerAutoUpdate()` — a 500ms-debounced **bare** `runUpdate()` (no forced line) meant for the "user is typing in the XSLT source" case. Left alone, that timer was still pending when the `editElementStyle` handler did its own immediate `runUpdate(message.line)`, and fired ~500ms later with an unforced (cursor-dependent, i.e. broken per the gotcha above) `highlightLine`, silently re-wiping the just-restored activation a moment after it appeared. This is what made the Bold/color fix above look like it wasn't working at all. Fixed by having the `editElementStyle` handler clear `updateTimeout` (the pending debounce) right after `applyInlineStyleEdit()` resolves, before doing its own authoritative `runUpdate(message.line)` — there's nothing left for the stale timer to clobber. (This fixed Bold; the color picker's "opens then vanishes" turned out to be a separate cause — see the next gotcha.)
- **Gotcha (color picker closing synthesizes a stray click, same story as edge-drag mouseup):** Once the two reload races above were fixed, the color picker still appeared to "vanish and re-activate `<body>`" after the user picked a color. Cause: dismissing a native `<input type="color">` popup (picking a color, Escape, or clicking away) synthesizes a `click` on whatever's under the pointer at that moment — not the color input itself, since the OS/browser color popup renders at arbitrary screen coordinates far from the small toolbar swatch. That stray click landed in the main `document` click handler's "else" branch (no `data-source-line` under it, typically `<body>`), deactivating the just-recolored element — structurally the exact same bug as §9's post-edge-drag stray click. Fixed by setting `justDragged` from `qtColorInput`'s `change` listener so the very next click is swallowed. A `blur`-based version was also tried, to additionally cover a same-value dismissal (Escape, or reopening/closing without picking) that doesn't fire `change` — reverted after it made the *opening* click itself intermittently flaky (picker sometimes wouldn't open, activation lost to `<body>` instead): `blur` timing relative to the native popup's actual open/close isn't reliable across Chromium/Electron builds, and appeared to fire early enough in some runs that its `justDragged` got consumed by an unrelated click before the real dismissal happened. `change`-only is narrower (dismissing without changing anything can still lose activation) but doesn't destabilize the common "pick a color" path.
- **Gotcha (color picker silently no-ops when triggered indirectly):** The first cut of the color control was a small square "swatch" *button* that called a separate hidden `<input type="color">`'s `.click()` to open the native picker. Inside the sandboxed preview iframe (`sandbox="allow-scripts allow-same-origin"`, `srcdoc`-loaded → opaque-ish origin), that indirect/synthetic `.click()` on a hidden input silently failed to open anything. Fixed by making `.xslt-qt-color-input` the directly visible, directly clickable control in the toolbar (small via plain `width`/`height`/`border`/`padding`, no `-webkit-appearance:none` or `::-webkit-color-swatch*` overrides — those were also tried and dropped, since forcing the native control's internal rendering appeared to correlate with the picker intermittently failing to open at all) — a genuine user click on a plainly-styled native color input is the most reliable option; there's no separate trigger button anymore.

## 3. Webview Shell Structure (`getWebviewShell`)
- **Path Bar** (`#path-bar`): Shows `relativePath` of the currently previewed file + a Switch button (label: "XSLT" or "XML").
- **Toolbar** (`#toolbar`): Export PDF button | Lock toggle (`🔓 Lock` / `🔒 Locked`) | Zoom dropdown (25/50/75/100%) | Images sidebar toggle. The Lock button sits immediately left of the Zoom dropdown and, when on, prevents the preview from auto-switching to a different XML file's pair (see §2). The zoom dropdown is initialized from `xslt-viewer.previewZoom`, and changes are sent back via `setPreviewZoom` to persist the last choice.
- **Content Area** (`#main-container`): `<iframe id="preview-frame">` (sandboxed) + collapsible `#sidebar` (250 px, hidden by default).
- **Messages from Extension:** `update` (full refresh; may include `highlightLine` for post-load cursor sync), `setSwitchLabel`, `setPath`, `setLockState` (sync the Lock button, e.g. on panel re-init), `highlightPreviewLine` (cursor moved in XSLT; `line` or `null` to clear — also drives the W/H icons inside the iframe, §9), `previewReplaceImage` (temporary live image swap), `previewResetImage` (restore original preview HTML).
- **Messages to Extension:** `jumpToCode`, `switchFile`, `exportPdf`, `editImage`, `jumpToImage`, `toggleLock` (`{ locked: boolean }`), `editElementStyle` (`{ line, prop: 'width'|'height'|'font-weight'|'color', value }`, forwarded from the iframe — see §9/§10; empty `value` means "remove the declaration"). The Edit Image panel also sends `editImageReady`, `editImagePickFile`, `editImageSave`, `editImagePreview`, `editImagePreviewReset`, `editImageApply`, `editImageDelete`, `editImageCancel`.

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

### Agent Hotfix & Release Workflow
- For user-requested **minor bugfixes** in AI Agent mode, the expected operational flow is:
    1) detect/reproduce, 2) implement smallest safe fix, 3) validate, 4) bump `CHANGELOG.md` patch version (`x.y.z -> x.y.(z+1)`), 5) commit + push, 6) run `publish-app.bat`.
- For **bigger updates** (new features, behavior redesign, settings/commands changes, broad refactors, or higher risk), the agent must ask for confirmation before push/publish.
- If validation or publish fails, stop and report status instead of continuing release steps.

**Cursor instructions:** Project rules live in `.cursor/rules/`. When adding or changing features or functions, **also update** the relevant `.mdc` rules and this file. See the rule `self-update-instructions.mdc` for the required self-update protocol.
