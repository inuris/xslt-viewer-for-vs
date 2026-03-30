# Project Context

**Project:** XSLT Viewer for VS Code — preview XSLT transformations and manage embedded images.

**Stack:** TypeScript (extension host), Python with `lxml` (transformation), HTML/CSS/JS (webview UI).

**Key files:**
- `src/extension.ts` — activation, commands, webview panel, IPC with Python, image sidebar logic.
- `resources/python/transform.py` — reads JSON `{ xmlContent, xsltContent }` from stdin, writes result bytes to stdout.
- `resources/snippets/xslt-snippets.md` — XSLT snippet definitions (Markdown); built-in snippet list.
- `package.json` — commands (`xslt-viewer.preview`, `xslt-viewer.switchFile`, `xslt-viewer.exportPdf`, `xslt-viewer.showSnippets`), config (`xslt-viewer.pythonPath`, `xslt-viewer.snippetsFile`), menus/keybindings.

**Canonical docs:** See `AI_CONTEXT.md` for workflows, rendering pipeline, auto-detection, click-to-jump, and image management. Keep that file and these instructions in sync when adding or changing features.

---

# Self-Update Instructions (Required)

When you add, change, or remove **any feature, function, or command** in this codebase:

1. **Update `AI_CONTEXT.md`**
   - Add or edit the relevant section (workflows, file responsibilities, new commands).
   - Keep the "Codebase Index & Navigation" and "Core Workflows" sections in sync with the code.
   - If you add new commands in `package.json`, document them and their triggers.

2. **Update Copilot instructions in `.github/copilot-instructions.md` and `.vscode/instructions/`**
   - If the new feature introduces a new pattern, file type, or convention: add or edit the relevant instruction file.
   - If an existing instruction becomes outdated (e.g. new commands, new workflow), update it so future sessions have accurate context.

3. **Keep instructions concise**
   - Prefer updating existing instructions over creating many small ones.
   - Ensure each instruction file's `applyTo` and content still match what the code does.

Apply this protocol whenever you implement or modify user-facing or structural behaviour (commands, webview messages, Python I/O, configuration, workflows). Do not skip updating instructions "for later."
