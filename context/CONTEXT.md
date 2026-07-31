<!-- context-sync: a40eb41c948e4273b2d22a075e57f07bf8e6364f | 2026-07-31 -->

# XSLT Viewer for VS Code — Context

## Recent Changes
- 2026-07-29: Preview Pane: Lock toggle (stop auto-switch when opening another XML), hover tooltip now shows a CSS-style selector, and a Photoshop-style edge-drag to resize an active element's width/height (replaced an earlier W/H badge+slider design that was scrapped) — released as **2.2.33**.
- 2026-07-20: Added "Convert Number to Vietnamese Words" XSLT snippet — **2.2.32**.
- 2026-07-16: Fixed `instrumentXslt()` corrupting XML comments containing a `<word`-like sequence (caused misleading libxslt structural errors); transform errors now report precise line/column diagnostics — **2.2.31**.
- 2026-07-14: Formatter preserves one leading/trailing space in inline text nodes for mixed HTML/XSLT content — **2.2.30**.
- 2026-07-14: Replace Image: resize/opacity/Hue-Saturation-Brightness controls now edit the original image in place with live preview — **2.2.29** / **2.2.28**.
- 2026-07-06: Updated built-in XSLT snippets; added auto font-size for long strings — **2.2.27**.

---

## 1. Project Snapshot
**XSLT Viewer** is a VS Code extension (published on the VS Code Marketplace and Open VSX as `inuris.xslt-viewer-vs`) that live-previews an XML file transformed through an XSLT stylesheet in a side panel, with click-to-jump navigation between the rendered output and the XSLT source, an embedded-image manager, and an XML/XSLT formatter. It's a port of an earlier "XSLT Viewer Cloud" web app (Flask + custom VFS/Monaco) onto VS Code's native editor/filesystem, keeping the same Python/`lxml` transformation backend. Stack: TypeScript (extension host, `src/*.ts`), Python + `lxml` (the actual XSLT transform, `resources/python/transform.py`), HTML/CSS/vanilla JS (the webview preview panel, generated as template strings from `src/webview.ts`). Current maturity: **actively published, in active feature development** (current version `2.2.33`, ~30+ prior published patch releases).

## 2. Architecture
Single-process VS Code extension, no build step beyond `tsc`. Everything lives in `extension.ts`'s `activate()` closure and a handful of focused modules it delegates to.

Rendering pipeline (the core loop):
```
XML doc + XSLT doc (edited in VS Code)
        │  (on save/change, debounced 500ms — triggerAutoUpdate)
        ▼
instrumentXslt(xsltText)         [transformation.ts]
  → injects data-source-line="N" onto every literal output tag
        │
        ▼
runPythonTransformation()        [transformation.ts]
  → spawns `python resources/python/transform.py`
  → stdin: {xmlContent, xsltContent} JSON, stdout: rendered HTML bytes
        │
        ▼
wrapForIframe(html)               [webview.ts]
  → injects click-to-jump / hover-tooltip / edge-drag-resize <script>
        │
        ▼
postMessage({command:'update', html, images, ...}) → webview panel
  → iframe.srcdoc = html  (preview pane, ViewColumn.Two)
```
Interaction flows back the other way over `postMessage`: clicking a rendered element sends `jumpToCode` (extension moves the XSLT cursor); moving the XSLT cursor sends `highlightPreviewLine` back into the iframe (reverse highlight); dragging an element's border sends `editElementStyle` (extension patches the XSLT source's inline `style`, then re-runs the pipeline). See `AI_CONTEXT.md` §2–§3 for the exact message contracts.

A second, independent flow is the **document formatter** (`formatter.ts`): a pure-TS tokenizer registered as a `DocumentFormattingEditProvider` for `xml`/`xsl` — no Python involved, whitespace rules documented in `src/formatter-rules.md`.

## 3. Key Files Map

| Path | Purpose |
|---|---|
| `src/extension.ts` | `activate()` — wires every command, the webview panel, and all event listeners. Holds the extension's mutable state (`activeXml`, `activeXslt`, `currentPanel`, `previewLocked`, etc.) as closures. |
| `src/webview.ts` | All webview HTML as template strings: `getWebviewShell()` (toolbar/path-bar/iframe shell), `wrapForIframe()` (click-to-jump + hover tooltip + edge-drag-resize script injected into the *rendered preview* iframe), plus the Replace-Image/Export-Image dialog panels. |
| `src/transformation.ts` | `runPythonTransformation()` (spawns the Python backend) and `instrumentXslt()` (injects `data-source-line`). |
| `src/styleEdit.ts` | `applyInlineStyleEdit()` — locates the XSLT output tag at a given `data-source-line` and adds/updates/removes its inline `style` width/height. Backs the edge-drag resize feature. |
| `src/images.ts` | Base64 image scan/export/replace/jump for the preview's image sidebar. |
| `src/navigation.ts` | `findAndJump()` — opens the XSLT doc and reveals a line/id/class match. |
| `src/filePicker.ts` | XML↔XSLT pairing helpers (`pickWorkspaceFile`, `updateXmlStylesheetLink`). |
| `src/formatter.ts` + `src/formatter-rules.md` | The XML/XSLT formatter implementation and its whitespace-handling rules (with XML/XPath spec citations). |
| `src/setup.ts` | First-run Python/`lxml` dependency check + setup guide webview. |
| `src/base64Preview.ts` | Inline base64-image hints/hover/decorations directly in the XML/XSLT editor (separate from the preview panel). |
| `resources/python/transform.py` | The actual transformation engine (stdin JSON → stdout HTML bytes via `lxml`). |
| `resources/snippets/xslt-snippets.md` | Built-in XSLT snippet definitions (Markdown, parsed at runtime). |
| `package.json` | Commands, config (`xslt-viewer.*` settings), menus, keybindings — see §7. |
| `AI_CONTEXT.md` | **The deep technical/workflow reference** — file-by-file responsibilities and every interaction workflow in detail. Actively wired into this repo's Cursor/Copilot tooling (see §5); keep using and updating it as-is, this CONTEXT.md is a complementary top-level entry point, not a replacement. |
| `publish-app.bat` / `publish-env.bat` (gitignored, not present in repo) | Release script — see §6. |

## 4. Features

| Feature | Status | Location / Notes |
|---|---|---|
| Live XSLT preview panel | Done | `extension.ts`, `webview.ts`, `transform.py` |
| Click-to-jump (preview → XSLT source) + reverse cursor sync | Done | `navigation.ts`, `extension.ts`, `webview.ts` |
| Preview Lock toggle (stop auto re-pairing on file open) | Done | `extension.ts` (`previewLocked`), toolbar in `webview.ts` |
| Hover tooltip: CSS selector + `W × H` dimensions | Done | `webview.ts` (`wrapForIframe`) |
| W/H edge-drag resize (Photoshop-style border drag) | Done | `webview.ts`, `styleEdit.ts` |
| Embedded image manager (scan/export/replace, resize/opacity/HSB) | Done | `images.ts`, `webview.ts` |
| XML/XSLT formatter | Done | `formatter.ts` + `formatter-rules.md` |
| XSLT snippet insertion | Done | `extension.ts`, `resources/snippets/` |
| PDF export | Done | `extension.ts` (`exportPdf` command) |
| First-run Python/`lxml` setup check | Done | `setup.ts` |
| Inline base64-image hints in editor | Done | `base64Preview.ts` |
| Automated test suite | **Not started** | `package.json`'s `test` script points at `out/test/runTest.js`, but no `src/test/` exists — `npm test` will fail if run today |

## 5. Conventions & Patterns
- **`data-source-line` is the load-bearing contract.** `instrumentXslt()` (transformation.ts), the click/hover/edge-drag script in `wrapForIframe()` (webview.ts), and the tag-locator in `styleEdit.ts` all independently re-implement the *same* tag-matching regex and line-counting logic so that a `data-source-line` value in the rendered preview maps 1:1 back to the correct tag in the un-instrumented XSLT source. If you change one, change all three, or the mapping silently drifts.
- **Multi-tool AI-agent instructions already exist and are actively used:** `AI_CONTEXT.md` (self-updating index, `alwaysApply` rule in its own header), `.cursor/rules/*.mdc` (Cursor, `alwaysApply: true`), `.github/copilot-instructions.md`, `.vscode/instructions/*.md`. All of them explicitly say "update `AI_CONTEXT.md`" whenever behavior changes — keep doing that; this file doesn't replace that protocol.
- **Agent operating principles** (from `.github/copilot-instructions.md`, worth following generally): think before coding and state assumptions when ambiguous; implement the minimum that solves the request, no speculative abstractions; touch only lines related to the request (no drive-by refactors); define concrete success criteria and validate (build/compile-check at minimum) before calling something done.
- **Versioning:** every release just increments the patch digit (`2.2.x`) regardless of whether the change is a feature or a fix — there's no historical use of minor/major bumps.
- **`publish-app.bat` reads the version from the *first* `## x.y.z` heading in `CHANGELOG.md`** and syncs `package.json` to match before publishing — always add the CHANGELOG entry (newest on top) before/alongside the version bump.
- Webview code is plain vanilla JS inside TS template-literal strings (`src/webview.ts`) — not compiled/type-checked by `tsc`. Verify it by extracting the `<script>` bodies and running `node --check` on them (and ideally a jsdom smoke test for anything stateful) after edits, since a template-literal typo is otherwise invisible to `tsc --noEmit`.
- Line-ending care: this project is authored on Windows; a whole-file diff where the byte-size delta equals the line count is almost always CRLF/LF noise, not a real change.

## 6. Setup / Run / Build
```bash
npm install
npm run compile        # tsc -p ./
npm run watch          # tsc -watch, for active dev
npm run vsix:local      # compile + npx vsce package → local .vsix for manual install/testing
```
Requires **Python 3 + `lxml`** on the machine running the extension (`pip install lxml`) — `xslt-viewer.pythonPath` setting controls the interpreter used; `install.bat` automates first-time setup on Windows (`npm install` + `npm run compile` + `pip install lxml`).

**Release** (`publish-app.bat`, Windows batch, run locally — not from this cloud sandbox, see §8):
1. Add a `## x.y.z` entry at the top of `CHANGELOG.md`.
2. Run `publish-app.bat` — it syncs `package.json`'s version to that heading, then runs `vsce publish` (VS Code Marketplace) and `ovsx publish` (Open VSX).
3. Needs a local `publish-env.bat` (gitignored, **never commit it**) setting `VSCODE_MARKETPLACE_TOKEN` and `OVSX_PAT` — copy the pattern from the script's own header comment, do not paste real tokens into chat/commits.

No CI pipeline in this repo; publishing is manual/local.

## 7. Integrations & Dependencies
- **VS Code Extension API** (`engines.vscode: ^1.96.0`) — commands, webview panels, document formatting provider, inlay hints/hover/decorations.
- **Python + `lxml`** (external runtime dependency, not npm) — the actual XSLT engine; the extension only shells out to it.
- **VS Code Marketplace** (`vsce publish`) and **Open VSX** (`ovsx publish`, `open-vsx.org` — used by Cursor/VSCodium) — both require network access and a personal access token; not reachable from network-restricted sandboxes.
- Config surface (`xslt-viewer.*` in `package.json` → `contributes.configuration`): `pythonPath`, `formatIndentSize`, `previewZoom` (persisted per-workspace on change), `snippetsFile`, `highlightPreviewOnXsltCursor`.

## 8. Known Issues / Gotchas
- **Publishing cannot run from a network-restricted cloud sandbox.** `marketplace.visualstudio.com` and `open-vsx.org` are typically not on a cloud sandbox's network allowlist (`CONNECT tunnel failed, 403` was the observed failure). `npm run compile` / `vsce package` (build only, no publish) work fine anywhere. Actual publish needs to run on a machine with real internet access (`publish-app.bat` locally), or the built `.vsix` can be uploaded manually via each marketplace's web publisher portal.
- **No test suite exists** despite `package.json`'s `test`/`pretest` scripts referencing `out/test/runTest.js` — that path is never generated. Don't assume `npm test` verifies anything until a `src/test/` suite is actually added.
- **Multiple output tags on the same XSLT source line share one `data-source-line`.** Click-driven preview activation keeps a direct reference to the exact clicked DOM element specifically to avoid this ambiguity; a purely line-number-driven lookup (e.g. the reverse cursor→preview highlight, which only has a line number to go on) can land on the first match in document order (usually the outer/parent tag) instead of the intended inner one.
- **`instrumentXslt()` must never treat text inside XML comments or CDATA as tags** — a comment containing a `<word`-like sequence previously corrupted the comment terminator and cascaded into confusing libxslt structural errors (fixed in 2.2.31, but the regex-based instrumentation approach means any future change to the tag-matching pattern needs to re-verify comment/CDATA skipping).
- Never write real publish tokens (`VSCODE_MARKETPLACE_TOKEN`, `OVSX_PAT`) or git push tokens into any tracked file — `publish-env.bat` is gitignored for exactly this reason. If a real token is ever pasted into a chat/file upload, treat it as compromised and recommend rotating it even after the immediate task is done.

## 9. Open TODOs / Next Steps
- Actually publish **2.2.33** — `CHANGELOG.md`/`package.json` are already synced and the VSIX builds clean; just needs `publish-app.bat` run locally, or the built `.vsix` uploaded manually to both marketplace portals.
- Rotate/revoke the VS Marketplace + Open VSX tokens that were shared via file upload during the 2.2.33 release attempt, once publishing is confirmed done.
- Consider adding an actual test suite, or removing the dead `test`/`pretest` scripts from `package.json` if none is planned.
