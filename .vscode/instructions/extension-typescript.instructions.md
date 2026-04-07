---
applyTo: "**/*.ts"
---

# Extension TypeScript

- Use `vscode` API for editor, workspace, commands, webview; register disposables on `context.subscriptions`.
- Python is invoked via `child_process.spawn(pythonPath, [scriptPath])`; send JSON to stdin, read result from stdout.
- Webview: use `postMessage` for extension ↔ webview; handle commands like `update` (optional `highlightLine`), `highlightPreviewLine`, `jumpToCode`, `switchFile`, `exportPdf`, `saveImage`, `replaceImage`, `replaceImageDelete` (clear embedded image), `jumpToImage`.
- Paths: use `context.asAbsolutePath()` and `path.join()` for extension-relative paths; use `path` and `vscode.Uri` for workspace paths.
- When adding new commands or webview messages, register in `package.json` and document in `AI_CONTEXT.md` and these instructions.
- Release workflow: for user-requested minor bugfixes, prefer end-to-end flow (fix -> validate -> update `CHANGELOG.md` next patch version -> commit/push -> run `publish-app.bat`). For bigger updates, ask confirmation before push/publish.
