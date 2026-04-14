import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { runPythonTransformation, instrumentXslt } from './transformation';
import { scanImages, handleSaveImage, applyReplaceImage, handleJumpToImage, type ImageInfo } from './images';
import { pickWorkspaceFile, updateXmlStylesheetLink } from './filePicker';
import { findAndJump } from './navigation';
import { getWebviewShell, getReplaceImagePanelHtml, getExportImagePanelHtml, wrapForIframe } from './webview';
import { formatXml } from './formatter';
import { checkDependencies, showSetupForced } from './setup';
import { registerBase64Preview } from './base64Preview';

// ─── Transformation error helpers ────────────────────────────────────────────

/** True when the error is caused by a missing/broken Python environment rather than bad XML/XSLT. */
function isPythonEnvError(msg: string): boolean {
    const m = msg.toLowerCase();
    return (
        m.includes('enoent') ||
        m.includes('no module named') ||
        m.includes('modulenotfounderror') ||
        m.includes('importerror') ||
        m.includes('cannot find') ||
        m.includes('spawnsyncsignal') ||
        m.includes('spawn') && m.includes('failed')
    );
}

function escForHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── XSLT Snippets (Markdown .md file) ───────────────────────────────────────

interface XsltSnippetEntry {
    label: string;
    detail?: string;
    body: string;
}

/** Parse Markdown snippet file: ## Label, optional detail, then ```xml or ```xsl code block. Body gets syntax highlighting in the IDE. */
function parseSnippetMd(raw: string): XsltSnippetEntry[] {
    const out: XsltSnippetEntry[] = [];
    const re = /^##\s+(.+)$\r?\n([\s\S]*?)^```(?:xml|xsl)?\s*\r?\n([\s\S]*?)^```/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const label = m[1].trim();
        const detailBlock = m[2].trim();
        const detail = detailBlock.split(/\r?\n/)[0]?.trim() || undefined;
        const body = m[3].replace(/\r\n/g, '\n').trimEnd();
        if (label) out.push({ label, detail, body });
    }
    return out;
}

function loadXsltSnippets(context: vscode.ExtensionContext): XsltSnippetEntry[] {
    const config = vscode.workspace.getConfiguration('xslt-viewer');
    const customPath = config.get<string>('snippetsFile')?.trim();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

    let filePath: string;
    if (customPath) {
        filePath = path.isAbsolute(customPath) ? customPath : path.join(workspaceRoot, customPath);
        if (!path.extname(filePath)) filePath = filePath + '.md';
    } else {
        filePath = path.join(context.extensionPath, 'resources', 'snippets', 'xslt-snippets.md');
    }

    try {
        if (!fs.existsSync(filePath)) return [];
        const raw = fs.readFileSync(filePath, 'utf-8');
        return parseSnippetMd(raw);
    } catch (e) {
        console.warn('XSLT Viewer: failed to load snippets from', filePath, e);
        return [];
    }
}

// ─── Transformation error helpers ────────────────────────────────────────────

/** Error page rendered in the preview iframe when Python/lxml is the root cause. */
function buildPythonEnvErrorHtml(msg: string): string {
    return `<!DOCTYPE html><html><body style="margin:0;font-family:sans-serif;background:#fff">
<div style="padding:28px;max-width:540px">
    <h2 style="color:#c0392b;margin:0 0 10px">⚠️ Python Environment Error</h2>
    <p style="margin:0 0 16px;line-height:1.6;color:#333">
        The transformation could not run because <strong>Python</strong> or the
        <strong>lxml</strong> package was not found. Check your setup and try again.
    </p>
    <pre style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:12px;
                font-size:12px;overflow:auto;white-space:pre-wrap;color:#555;margin-bottom:20px">${escForHtml(msg)}</pre>
    <button onclick="window.parent.postMessage({command:'showSetup'},'*')"
            style="background:#0e639c;color:#fff;border:none;padding:9px 18px;
                   border-radius:4px;cursor:pointer;font-size:13px;font-weight:600">
        ⚙️ Open Setup Guide
    </button>
</div>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    console.log('XSLT Viewer is active');
    checkDependencies(context);
    registerBase64Preview(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('xslt-viewer.showSetup', () => showSetupForced(context))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xslt-viewer.showSnippets', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor to insert a snippet into.');
                return;
            }

            const languageId = editor.document.languageId;
            if (languageId !== 'xsl' && languageId !== 'xml') {
                vscode.window.showInformationMessage('XSLT snippets are only available in XML / XSLT files.');
                return;
            }

            const snippets = loadXsltSnippets(context);
            if (snippets.length === 0) {
                vscode.window.showWarningMessage(
                    'No XSLT snippets found. Edit resources/snippets/xslt-snippets.md or set xslt-viewer.snippetsFile.'
                );
                return;
            }

            const items: vscode.QuickPickItem[] = snippets.map(s => ({
                label: s.label,
                detail: s.detail ?? '',
            }));

            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an XSLT snippet to insert',
                matchOnDetail: true,
            });
            if (!picked) return;

            const snippet = snippets.find(s => s.label === picked.label);
            if (!snippet?.body) return;

            await editor.edit(editBuilder => {
                for (const sel of editor.selections) {
                    editBuilder.insert(sel.active, snippet.body);
                }
            });
        })
    );

    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let replacePanel: vscode.WebviewPanel | undefined = undefined;
    let replacePendingInit: { range: ImageInfo['range']; currentImageDataUri: string } | null = null;
    let exportPanel: vscode.WebviewPanel | undefined = undefined;
    let exportPendingInit: { base64: string; mime: string; fullMatch: string } | null = null;
    let activeXml: vscode.TextDocument | undefined;
    let activeXslt: vscode.TextDocument | undefined;
    let updateTimeout: NodeJS.Timeout | undefined;
    let highlightPreviewThrottle: NodeJS.Timeout | undefined;
    /** Which of the pair was last shown by Switch File (so we can toggle when e.g. Preview has focus) */
    let lastSwitchedTo: 'xml' | 'xslt' | null = null;

    const postHighlightPreviewLine = (line: number | null) => {
        if (!currentPanel?.visible) return;
        currentPanel.webview.postMessage({ command: 'highlightPreviewLine', line });
    };

    const scheduleHighlightPreviewFromXslt = (editor: vscode.TextEditor) => {
        if (!currentPanel?.visible || !activeXslt) return;
        const cfg = vscode.workspace.getConfiguration('xslt-viewer');
        if (!cfg.get<boolean>('highlightPreviewOnXsltCursor')) return;
        if (editor.document.uri.toString() !== activeXslt.uri.toString()) {
            postHighlightPreviewLine(null);
            return;
        }
        const line = editor.selection.active.line + 1;
        if (highlightPreviewThrottle) clearTimeout(highlightPreviewThrottle);
        highlightPreviewThrottle = setTimeout(() => {
            highlightPreviewThrottle = undefined;
            postHighlightPreviewLine(line);
        }, 120);
    };

    const triggerAutoUpdate = () => {
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            if (currentPanel && currentPanel.visible && activeXml && activeXslt) {
                runUpdate();
            }
        }, 500);
    };

    const runUpdate = async () => {
        if (!currentPanel || !activeXml || !activeXslt) return;

        let resultHtml = '';
        try {
            const instrumented = instrumentXslt(activeXslt.getText());
            resultHtml = await runPythonTransformation(context, activeXml.getText(), instrumented);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            resultHtml = isPythonEnvError(msg)
                ? buildPythonEnvErrorHtml(msg)
                : `<h2 style="color:red;font-family:sans-serif;padding:16px">Transformation Error</h2><pre style="padding:0 16px;font-size:12px">${escForHtml(msg)}</pre>`;
        }

        const wrappedHtml = wrapForIframe(resultHtml);
        const images = scanImages([activeXml, activeXslt]);

        const editor = vscode.window.activeTextEditor;
        let switchButtonLabel: string;
        let currentDoc: vscode.TextDocument;
        if (editor?.document.uri.toString() === activeXml.uri.toString()) {
            switchButtonLabel = 'XSLT';
            currentDoc = activeXml;
        } else if (editor?.document.uri.toString() === activeXslt.uri.toString()) {
            switchButtonLabel = 'XML';
            currentDoc = activeXslt;
        } else {
            switchButtonLabel = lastSwitchedTo === 'xml' ? 'XSLT' : 'XML';
            currentDoc = lastSwitchedTo === 'xml' ? activeXml : activeXslt;
        }

        const cfgHl = vscode.workspace.getConfiguration('xslt-viewer');
        let highlightLine: number | undefined = undefined;
        if (cfgHl.get<boolean>('highlightPreviewOnXsltCursor')) {
            const edHl = vscode.window.activeTextEditor;
            if (edHl && activeXslt && edHl.document.uri.toString() === activeXslt.uri.toString()) {
                highlightLine = edHl.selection.active.line + 1;
            }
        }

        currentPanel.webview.postMessage({
            command: 'update',
            html: wrappedHtml,
            images,
            filename: path.basename(currentDoc.fileName),
            relativePath: vscode.workspace.asRelativePath(currentDoc.uri),
            switchButtonLabel,
            ...(highlightLine !== undefined ? { highlightLine } : {}),
        });
    };

    const disposablePreview = vscode.commands.registerCommand('xslt-viewer.preview', async (resourceUri?: vscode.Uri) => {
        let doc: vscode.TextDocument;
        if (resourceUri) {
            try {
                doc = await vscode.workspace.openTextDocument(resourceUri);
            } catch {
                vscode.window.showErrorMessage('Could not open the selected file.');
                return;
            }
        } else {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found. Open a file or right‑click a file in the Explorer.');
                return;
            }
            doc = editor.document;
        }

        let selectedXml: vscode.TextDocument | undefined;
        let selectedXslt: vscode.TextDocument | undefined;

        if (doc.languageId === 'xml' || doc.fileName.endsWith('.xml')) {
            if (doc.getText().includes('<xsl:stylesheet') || doc.getText().includes('<xsl:transform')) {
                selectedXslt = doc;
                const xmlDoc = await pickWorkspaceFile('Select an XML file to transform', ['xml']);
                if (xmlDoc) selectedXml = xmlDoc;
            } else {
                selectedXml = doc;
                const match = doc.getText().match(/<\?xml-stylesheet\s+.*href=["']([^"']+)["'].*\?>/);
                if (match) {
                    const xsltRelPath = match[1];
                    const xmlDir = path.dirname(doc.uri.fsPath);
                    const absPath = path.resolve(xmlDir, xsltRelPath);
                    try {
                        selectedXslt = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
                    } catch {
                        console.log('Linked XSLT not found:', absPath);
                    }
                }
                if (!selectedXslt) {
                    const currentDir = vscode.Uri.file(path.dirname(doc.uri.fsPath));
                    selectedXslt = await pickWorkspaceFile(
                        'Select the XSLT stylesheet (Current Folder)',
                        ['xsl', 'xslt'],
                        currentDir
                    );
                    if (selectedXslt) {
                        await updateXmlStylesheetLink(selectedXml, selectedXslt);
                    }
                }
            }
        } else if (
            doc.languageId === 'xsl' ||
            doc.fileName.endsWith('.xsl') ||
            doc.fileName.endsWith('.xslt')
        ) {
            selectedXslt = doc;
            const xmlDoc = await pickWorkspaceFile('Select an XML file to transform', ['xml']);
            if (xmlDoc) selectedXml = xmlDoc;
        } else {
            vscode.window.showErrorMessage('Active file is not XML or XSLT');
            return;
        }

        if (!selectedXml || !selectedXslt) return;

        activeXml = selectedXml;
        activeXslt = selectedXslt;

        // Ensure layout: code on the left (One), preview on the right (Two)
        const docToFocus = activeXml ?? activeXslt;
        await vscode.window.showTextDocument(docToFocus, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
        });
        lastSwitchedTo = docToFocus === activeXml ? 'xml' : 'xslt';

        if (!currentPanel) {
            currentPanel = vscode.window.createWebviewPanel(
                'xsltPreview',
                'XSLT Preview',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            // Read only the **user** (Global) value for previewZoom, ignoring any workspace override.
            const inspected = vscode.workspace
                .getConfiguration()
                .inspect<number>('xslt-viewer.previewZoom');
            const initialZoom = inspected?.globalValue ?? inspected?.defaultValue ?? 100;

            currentPanel.webview.html = getWebviewShell(initialZoom);

            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            }, null, context.subscriptions);

            currentPanel.webview.onDidReceiveMessage(async message => {
                switch (message.command) {
                    case 'showSetup':
                        vscode.commands.executeCommand('xslt-viewer.showSetup');
                        break;
                    case 'jumpToCode':
                        if (activeXslt) {
                            findAndJump(activeXslt, message);
                            lastSwitchedTo = 'xslt';
                            if (currentPanel?.visible) {
                                currentPanel.webview.postMessage({ command: 'setSwitchLabel', label: 'XML' });
                                currentPanel.webview.postMessage({
                                    command: 'setPath',
                                    relativePath: vscode.workspace.asRelativePath(activeXslt.uri),
                                });
                            }
                        }
                        break;
                    case 'switchFile':
                        vscode.commands.executeCommand('xslt-viewer.switchFile');
                        break;
                    case 'exportPdf':
                        vscode.commands.executeCommand('xslt-viewer.exportPdf');
                        break;
                    case 'exportImage':
                        exportPendingInit = {
                            base64: message.base64 || '',
                            mime: message.mime || 'image/png',
                            fullMatch: message.fullMatch || '',
                        };
                        if (!exportPanel) {
                            exportPanel = vscode.window.createWebviewPanel(
                                'xsltExportImage',
                                'Export Image',
                                vscode.ViewColumn.One,
                                { enableScripts: true }
                            );
                            exportPanel.onDidDispose(() => {
                                exportPanel = undefined;
                                exportPendingInit = null;
                            }, null, context.subscriptions);
                            exportPanel.webview.onDidReceiveMessage(async (msg: { command: string; base64?: string; mime?: string }) => {
                                if (!exportPanel) return;
                                if (msg.command === 'exportImageReady' && exportPendingInit) {
                                    exportPanel.webview.postMessage({
                                        command: 'init',
                                        base64: exportPendingInit.base64,
                                        mime: exportPendingInit.mime,
                                        fullMatch: exportPendingInit.fullMatch,
                                    });
                                    exportPendingInit = null;
                                }
                                if (msg.command === 'exportImageSave' && msg.base64 && msg.mime) {
                                    await handleSaveImage(msg.base64, msg.mime);
                                }
                                if (msg.command === 'exportImageClose') {
                                    exportPanel.dispose();
                                }
                            }, undefined, context.subscriptions);
                        }
                        exportPanel.webview.html = getExportImagePanelHtml(Date.now());
                        exportPanel.reveal(vscode.ViewColumn.One);
                        break;
                    case 'replaceImage':
                        replacePendingInit = {
                            range: message.range,
                            currentImageDataUri: message.fullMatch || '',
                        };
                        if (!replacePanel) {
                            replacePanel = vscode.window.createWebviewPanel(
                                'xsltReplaceImage',
                                'Replace Image',
                                vscode.ViewColumn.One,
                                { enableScripts: true }
                            );
                            replacePanel.onDidDispose(() => {
                                if (currentPanel) {
                                    currentPanel.webview.postMessage({ command: 'previewResetImage' });
                                }
                                replacePanel = undefined;
                                replacePendingInit = null;
                            }, null, context.subscriptions);
                            replacePanel.webview.onDidReceiveMessage(async (msg: { command: string; dataUri?: string; oldDataUri?: string; range?: ImageInfo['range'] }) => {
                                if (!replacePanel) return;
                                if (msg.command === 'replaceImageReady' && replacePendingInit) {
                                    replacePanel.webview.postMessage({
                                        command: 'init',
                                        range: replacePendingInit.range,
                                        currentImageDataUri: replacePendingInit.currentImageDataUri,
                                    });
                                    replacePendingInit = null;
                                }
                                if (msg.command === 'replaceImagePickFile') {
                                    const uris = await vscode.window.showOpenDialog({
                                        filters: { Images: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] },
                                    });
                                    if (uris?.[0]) {
                                        const buf = fs.readFileSync(uris[0].fsPath);
                                        const b64 = buf.toString('base64');
                                        const ext = path.extname(uris[0].fsPath).toLowerCase();
                                        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.svg' ? 'image/svg+xml' : ext === '.webp' ? 'image/webp' : 'image/png';
                                        replacePanel.webview.postMessage({
                                            command: 'replaceImageFileData',
                                            dataUri: `data:${mime};base64,${b64}`,
                                        });
                                    }
                                }
                                if (msg.command === 'replaceImagePreview' && msg.dataUri && msg.oldDataUri && currentPanel) {
                                    currentPanel.webview.postMessage({
                                        command: 'previewReplaceImage',
                                        oldDataUri: msg.oldDataUri,
                                        previewDataUri: msg.dataUri,
                                    });
                                }
                                if (msg.command === 'replaceImagePreviewReset' && currentPanel) {
                                    currentPanel.webview.postMessage({ command: 'previewResetImage' });
                                }
                                if (msg.command === 'replaceImageApply' && msg.range && msg.dataUri) {
                                    await applyReplaceImage(msg.range, msg.dataUri);
                                    replacePanel.dispose();
                                    if (currentPanel && activeXml && activeXslt) runUpdate();
                                }
                                if (msg.command === 'replaceImageDelete' && msg.range) {
                                    await applyReplaceImage(msg.range, '');
                                    replacePanel.dispose();
                                    if (currentPanel && activeXml && activeXslt) runUpdate();
                                }
                                if (msg.command === 'replaceImageCancel') {
                                    if (currentPanel) {
                                        currentPanel.webview.postMessage({ command: 'previewResetImage' });
                                    }
                                    replacePanel.dispose();
                                }
                            }, undefined, context.subscriptions);
                        }
                        replacePanel.webview.html = getReplaceImagePanelHtml(Date.now());
                        replacePanel.reveal(vscode.ViewColumn.One);
                        break;
                    case 'jumpToImage':
                        await handleJumpToImage(message.range);
                        break;
                }
            }, undefined, context.subscriptions);
        } else {
            currentPanel.reveal(vscode.ViewColumn.Two);
        }

        runUpdate();
    });

    context.subscriptions.push(disposablePreview);

    // Keep preview pane (right) for preview only: move any text editor tab that appears there to the left
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!currentPanel || !currentPanel.visible || !editor) return;
            const group = vscode.window.tabGroups.activeTabGroup;
            if (group.viewColumn !== vscode.ViewColumn.Two) return;
            // A text editor became active in the right pane; move it to the left
            // and keep focus on the preview/webview in the right pane.
            vscode.window.showTextDocument(editor.document, {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: true,
            });
        })
    );

    // No API to lock the preview pane; we only move any text editor tab that opens in the right pane to the left (see handler above).

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async editor => {
            if (!editor || !currentPanel || !currentPanel.visible) return;
            const doc = editor.document;
            if (doc.languageId === 'xml' || doc.fileName.endsWith('.xml')) {
                const text = doc.getText();
                const match = text.match(/<\?xml-stylesheet\s+.*href=["']([^"']+)["'].*\?>/);
                if (match) {
                    const xsltRelPath = match[1];
                    const xmlDir = path.dirname(doc.uri.fsPath);
                    const absPath = path.resolve(xmlDir, xsltRelPath);
                    try {
                        const newXslt = await vscode.workspace.openTextDocument(
                            vscode.Uri.file(absPath)
                        );
                        activeXml = doc;
                        activeXslt = newXslt;
                        triggerAutoUpdate();
                    } catch {
                        // ignore
                    }
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            if (activeXml && e.document.uri.toString() === activeXml.uri.toString())
                triggerAutoUpdate();
            if (activeXslt && e.document.uri.toString() === activeXslt.uri.toString())
                triggerAutoUpdate();
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => {
            scheduleHighlightPreviewFromXslt(e.textEditor);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!currentPanel?.visible || !activeXslt) return;
            const cfg = vscode.workspace.getConfiguration('xslt-viewer');
            if (!cfg.get<boolean>('highlightPreviewOnXsltCursor')) return;
            if (!editor) {
                postHighlightPreviewLine(null);
                return;
            }
            if (editor.document.uri.toString() !== activeXslt.uri.toString()) {
                postHighlightPreviewLine(null);
                return;
            }
            scheduleHighlightPreviewFromXslt(editor);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xslt-viewer.switchFile', async () => {
            if (!activeXml || !activeXslt) {
                vscode.window.showInformationMessage('No active transformation pair.');
                return;
            }

            const editor = vscode.window.activeTextEditor;
            const doc = editor?.document;

            if (doc?.uri.toString() === activeXml.uri.toString()) {
                await vscode.window.showTextDocument(activeXslt, { viewColumn: vscode.ViewColumn.One });
                lastSwitchedTo = 'xslt';
            } else if (doc?.uri.toString() === activeXslt.uri.toString()) {
                await vscode.window.showTextDocument(activeXml, { viewColumn: vscode.ViewColumn.One });
                lastSwitchedTo = 'xml';
            } else {
                // No editor or different file (e.g. Preview focused): toggle from last shown
                if (lastSwitchedTo === 'xslt') {
                    await vscode.window.showTextDocument(activeXml, { viewColumn: vscode.ViewColumn.One });
                    lastSwitchedTo = 'xml';
                } else {
                    await vscode.window.showTextDocument(activeXslt, { viewColumn: vscode.ViewColumn.One });
                    lastSwitchedTo = 'xslt';
                }
            }
            if (currentPanel?.visible) {
                const shownDoc = lastSwitchedTo === 'xml' ? activeXml : activeXslt;
                currentPanel.webview.postMessage({
                    command: 'setSwitchLabel',
                    label: lastSwitchedTo === 'xml' ? 'XSLT' : 'XML',
                });
                currentPanel.webview.postMessage({
                    command: 'setPath',
                    relativePath: vscode.workspace.asRelativePath(shownDoc.uri),
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xslt-viewer.exportPdf', async () => {
            if (!activeXml || !activeXslt) {
                vscode.window.showErrorMessage('No active transformation.');
                return;
            }
            try {
                const resultHtml = await runPythonTransformation(
                    context,
                    activeXml.getText(),
                    activeXslt.getText()
                );
                const tempFile = path.join(os.tmpdir(), `xslt_preview_${Date.now()}.html`);
                fs.writeFileSync(tempFile, resultHtml, 'utf-8');
                await vscode.env.openExternal(vscode.Uri.file(tempFile));
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                vscode.window.showErrorMessage('Failed to export: ' + msg);
            }
        })
    );

    // Simple XML/XSLT formatter: indent tags, preserve all text (including spaces) unchanged
    const formatter = (document: vscode.TextDocument) => {
        const size = vscode.workspace.getConfiguration('xslt-viewer').get<number>('formatIndentSize') ?? 4;
        const formatted = formatXml(document.getText(), size);
        const lastLine = document.lineAt(document.lineCount - 1);
        const fullRange = new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
        return [vscode.TextEdit.replace(fullRange, formatted)];
    };
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            [{ language: 'xml' }, { language: 'xsl' }],
            { provideDocumentFormattingEdits: formatter }
        )
    );
}
