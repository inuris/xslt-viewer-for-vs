---
applyTo: "**/*.ts"
---

# Extension TypeScript

- Use `vscode` API for editor, workspace, commands, webview; register disposables on `context.subscriptions`.
- Python is invoked via `child_process.spawn(pythonPath, [scriptPath])`; send JSON to stdin, read result from stdout.
- Webview: use `postMessage` for extension ↔ webview; handle commands like `update` (optional `highlightLine`), `highlightPreviewLine`, `jumpToCode`, `switchFile`, `exportPdf`, `saveImage`, `replaceImage`, `replaceImageDelete` (clear embedded image), `jumpToImage`, and temporary replace-preview commands (`replaceImagePreview` / `replaceImagePreviewReset` from dialog, `previewReplaceImage` / `previewResetImage` in preview shell).
- Replace dialog UX: width/height/opacity edits are preview-only until user confirms; Cancel resets temporary preview, Replace commits final base64 (including resize/opacity transforms).
- Replace dialog context: show the selected image source line so users can identify which embedded image is currently being edited.
- Local debug packaging: use `npm run vsix:local` to compile and build a local VSIX before manual install/testing.
- Paths: use `context.asAbsolutePath()` and `path.join()` for extension-relative paths; use `path` and `vscode.Uri` for workspace paths.
- When adding new commands or webview messages, register in `package.json` and document in `AI_CONTEXT.md` and these instructions.
- Release workflow: for user-requested minor bugfixes, prefer end-to-end flow (fix -> validate -> update `CHANGELOG.md` next patch version -> commit/push -> run `publish-app.bat`). `publish-app.bat` now syncs `package.json` version from the latest `CHANGELOG.md` heading before publishing. For bigger updates, ask confirmation before push/publish.
