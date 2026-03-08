import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { runPythonTransformation, instrumentXslt } from './transformation';
import { scanImages, handleSaveImage, handleReplaceImage, handleJumpToImage } from './images';
import { pickWorkspaceFile, updateXmlStylesheetLink } from './filePicker';
import { findAndJump } from './navigation';
import { getWebviewShell, wrapForIframe } from './webview';

export function activate(context: vscode.ExtensionContext) {
    console.log('XSLT Viewer is active');

    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let activeXml: vscode.TextDocument | undefined;
    let activeXslt: vscode.TextDocument | undefined;
    let updateTimeout: NodeJS.Timeout | undefined;

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
            resultHtml = `<h2 style="color:red">Transformation Error</h2><pre>${msg}</pre>`;
        }

        const wrappedHtml = wrapForIframe(resultHtml);
        const images = scanImages([activeXml, activeXslt]);

        currentPanel.webview.postMessage({
            command: 'update',
            html: wrappedHtml,
            images,
            filename: path.basename(activeXml.fileName),
        });
    };

    const disposablePreview = vscode.commands.registerCommand('xslt-viewer.preview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const doc = editor.document;
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

        if (!currentPanel) {
            currentPanel = vscode.window.createWebviewPanel(
                'xsltPreview',
                'XSLT Preview',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            currentPanel.webview.html = getWebviewShell();

            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            }, null, context.subscriptions);

            currentPanel.webview.onDidReceiveMessage(async message => {
                switch (message.command) {
                    case 'jumpToCode':
                        if (activeXslt) findAndJump(activeXslt, message);
                        break;
                    case 'switchFile':
                        vscode.commands.executeCommand('xslt-viewer.switchFile');
                        break;
                    case 'exportPdf':
                        vscode.commands.executeCommand('xslt-viewer.exportPdf');
                        break;
                    case 'saveImage':
                        await handleSaveImage(message.base64, message.mime);
                        break;
                    case 'replaceImage':
                        await handleReplaceImage(message.range);
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

        // Focus left pane so Explorer file clicks open there; keep preview pane with only the preview tab
        const docToFocus = activeXml ?? activeXslt;
        if (docToFocus) {
            vscode.window.showTextDocument(docToFocus, {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: false,
            });
        }
    });

    context.subscriptions.push(disposablePreview);

    // Keep preview pane (right) for preview only: move any text editor tab that appears there to the left
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!currentPanel || !currentPanel.visible || !editor) return;
            const group = vscode.window.tabGroups.activeTabGroup;
            if (group.viewColumn !== vscode.ViewColumn.Two) return;
            // A text editor became active in the right pane; move it to the left
            vscode.window.showTextDocument(editor.document, {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: false,
            });
        })
    );

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
        vscode.commands.registerCommand('xslt-viewer.switchFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const doc = editor.document;

            if (activeXml && activeXslt) {
                if (doc.uri.toString() === activeXml.uri.toString()) {
                    vscode.window.showTextDocument(activeXslt);
                } else {
                    vscode.window.showTextDocument(activeXml);
                }
            } else {
                vscode.window.showInformationMessage('No active transformation pair.');
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
}
