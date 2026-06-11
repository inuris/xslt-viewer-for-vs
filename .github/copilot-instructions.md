# Project Context

**Project:** XSLT Viewer for VS Code — preview XSLT transformations and manage embedded images.

**Stack:** TypeScript (extension host), Python with `lxml` (transformation), HTML/CSS/JS (webview UI).

**Key files:**
- `src/extension.ts` — activation, commands, webview panel, IPC with Python, image sidebar logic (including temporary live replace-image preview lifecycle and replace-dialog targeting context).
- `resources/python/transform.py` — reads JSON `{ xmlContent, xsltContent }` from stdin, writes result bytes to stdout.
- `resources/snippets/xslt-snippets.md` — XSLT snippet definitions (Markdown); built-in snippet list.
- `package.json` — commands (`xslt-viewer.preview`, `xslt-viewer.switchFile`, `xslt-viewer.exportPdf`, `xslt-viewer.showSnippets`), config (`xslt-viewer.pythonPath`, `xslt-viewer.snippetsFile`), menus/keybindings.
- Local debug packaging script: `npm run vsix:local` (compile + `npx vsce package`).

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

3. **Update `CHANGELOG.md`**
   - Add a short bullet under the next version (increment the last number from the latest entry, e.g. `2.2.1` → `2.2.2`) under `### Added`, `### Changed`, or `### Fixed` as appropriate.
   - Keep entries brief (one line).

4. **Keep instructions concise**
   - Prefer updating existing instructions over creating many small ones.
   - Ensure each instruction file's `applyTo` and content still match what the code does.

Apply this protocol whenever you implement or modify user-facing or structural behaviour (commands, webview messages, Python I/O, configuration, workflows). Do not skip updating instructions "for later."

---

# Agent Hotfix & Release Workflow

When the user asks for a **bug fix / debug in AI Agent** and indicates auto-release intent, follow this workflow:

1. **Detect + Fix**
   - Reproduce or inspect the reported issue.
   - Implement the smallest safe fix.
   - Validate via available checks (build/tests/manual verification notes).

2. **Versioning + Changelog (Patch only)**
   - For minor bugfixes, bump the patch version in `CHANGELOG.md` (x.y.z -> x.y.(z+1)).
   - Add one concise bullet under `### Fixed` (or `### Changed` if more accurate).

3. **Git + Publish (auto for minor bugfixes)**
   - Stage changed files.
   - Commit with a concise message.
   - Push to remote.
   - Run `publish-app.bat` from repo root (publish script syncs `package.json` version from latest `CHANGELOG.md` heading before publish).

4. **Require confirmation for bigger updates**
   - If the change is not a small bugfix (new feature, behavior redesign, command/config changes, breaking risk, or multi-file refactor), stop and ask for confirmation before running git push and publish.

5. **Safety guardrails**
   - Never run destructive git commands.
   - If validation fails or publish fails, stop and report clearly.

---

# Agent Operating Principles (Adopted)

Apply these defaults for non-trivial coding tasks to improve agent quality and maintainability:

1. **Think Before Coding**
   - State assumptions when requirements are ambiguous.
   - If multiple valid interpretations exist, ask one concise clarifying question before implementing.
   - Prefer explicit tradeoffs over silent guesses.

2. **Simplicity First**
   - Implement the minimum code that solves the requested problem.
   - Do not add speculative options, abstractions, or configuration unless explicitly requested.
   - If a solution feels overengineered, simplify before finalizing.

3. **Surgical Changes**
   - Touch only lines related to the request.
   - Do not refactor unrelated code, style, comments, or naming in the same patch.
   - Keep existing project style/patterns unless change is required for correctness.

4. **Goal-Driven Verification**
   - Define concrete success criteria per task (build, tests, or reproducible manual checks).
   - For bug fixes, reproduce first when feasible, then verify the fix and check for regressions.
   - For multi-step work, implement incrementally with validation after each major step.

**Pragmatic mode:** For obvious one-line/trivial edits, apply these principles with lightweight rigor to avoid slowing down simple tasks.
