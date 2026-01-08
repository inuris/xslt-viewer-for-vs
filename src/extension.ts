import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {
    console.log('XSLT Viewer is active');

    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let activeXml: vscode.TextDocument | undefined;
    let activeXslt: vscode.TextDocument | undefined;
    let updateTimeout: NodeJS.Timeout | undefined;

    // Helper: Trigger Debounced Update
    const triggerAutoUpdate = () => {
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            if (currentPanel && currentPanel.visible && activeXml && activeXslt) {
                runUpdate();
            }
        }, 500);
    };

    // Helper: Run Transformation
    const runUpdate = async () => {
        if (!currentPanel || !activeXml || !activeXslt) return;
        try {
             const instrumented = instrumentXslt(activeXslt.getText());
             const result = await runPythonTransformation(context, activeXml.getText(), instrumented);
             currentPanel.webview.html = getWebviewContent(result);
        } catch (e: any) {
             currentPanel.webview.html = getWebviewError(e.message || String(e));
        }
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

        // Determine context (Is user in XML or XSLT?)
        if (doc.languageId === 'xml' || doc.fileName.endsWith('.xml')) {
             if (doc.getText().includes('<xsl:stylesheet') || doc.getText().includes('<xsl:transform')) {
                 // Is XSLT
                 selectedXslt = doc;
                 const xmlDoc = await pickWorkspaceFile('Select an XML file to transform', ['xml']);
                 if (xmlDoc) selectedXml = xmlDoc;
             } else {
                 // Is XML
                 selectedXml = doc;
                 // 1. Try to auto-detect XSLT from xml-stylesheet PI
                 const match = doc.getText().match(/<\?xml-stylesheet\s+.*href=["']([^"']+)["'].*\?>/);
                 if (match) {
                     const xsltRelPath = match[1];
                     const xmlDir = path.dirname(doc.uri.fsPath);
                     const absPath = path.resolve(xmlDir, xsltRelPath);
                     
                     try {
                        const uri = vscode.Uri.file(absPath);
                        selectedXslt = await vscode.workspace.openTextDocument(uri);
                        // Auto-open the XSLT file to enable click-to-jump context
                        await vscode.window.showTextDocument(selectedXslt, vscode.ViewColumn.One, true); 
                        vscode.window.setStatusBarMessage(`Auto-detected XSLT: ${xsltRelPath}`, 3000);
                     } catch (e) {
                         console.log('Linked XSLT not found:', absPath);
                     }
                 }

                 // 2. Fallback to manual selection
                 if (!selectedXslt) {
                    selectedXslt = await pickWorkspaceFile('Select the XSLT stylesheet', ['xsl', 'xslt']);
                 }
             }
        } else if (doc.languageId === 'xsl' || doc.fileName.endsWith('.xsl') || doc.fileName.endsWith('.xslt')) {
             selectedXslt = doc;
             const xmlDoc = await pickWorkspaceFile('Select an XML file to transform', ['xml']);
             if (xmlDoc) selectedXml = xmlDoc;
        } else {
            vscode.window.showErrorMessage('Active file is not XML or XSLT');
            return;
        }

        if (!selectedXml || !selectedXslt) {
            return; // User cancelled
        }

        // Update State
        activeXml = selectedXml;
        activeXslt = selectedXslt;

        // Create or show panel
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.Two);
        } else {
            currentPanel = vscode.window.createWebviewPanel(
                'xsltPreview',
                'XSLT Preview',
                vscode.ViewColumn.Two,
                { 
                    enableScripts: true,
                    // Allow modals (like print dialog) by not restricting sandbox too much.
                    // Actually, VS Code Webviews are sandboxed naturally.
                    // We need to try to not use specific sandbox restrictions if possible, 
                    // but createWebviewPanel options don't have 'sandbox' property directly exposed in basic types sometimes.
                    // However, we can try to rely on 'enableScripts: true' being enough usually.
                    // If 'print()' is blocked, we might be in a restricted mode.
                }
            );
            currentPanel.onDidDispose(() => { currentPanel = undefined; }, null, context.subscriptions);
        }

        // Show the Image Sidebar
        vscode.commands.executeCommand('xslt-viewer-images.focus');

        // Handle messages from the Webview (Click-to-Jump)
        currentPanel.webview.onDidReceiveMessage(message => {
            if (message.command === 'jumpToCode' && activeXslt) {
                if (message.line) {
                    const line = parseInt(message.line) - 1; // 0-based
                    if (line >= 0 && line < activeXslt.lineCount) {
                        const range = new vscode.Range(line, 0, line, 0);
                        vscode.window.showTextDocument(activeXslt, {
                            viewColumn: vscode.ViewColumn.One,
                            selection: range
                        });
                        vscode.window.activeTextEditor?.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    }
                } else {
                     findAndJump(activeXslt, message);
                }
            }
        }, undefined, context.subscriptions);

        currentPanel.webview.html = getWebviewLoading();
        runUpdate();        
    });

    context.subscriptions.push(disposablePreview);
    
    // Register the Webview View Provider for the "Embedded Images" sidebar
	const sidebarProvider = new ImageSidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('xslt-viewer-images', sidebarProvider)
	);

     // Event Listeners
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        sidebarProvider.refresh();
        if (!editor || !currentPanel || !currentPanel.visible) return;

        const doc = editor.document;
        // If we switched to one of the active pair, just ensure they are set (already set)
        if (doc === activeXml || doc === activeXslt) return;

        // Auto-switch for new XML files with linked XSLT
        if (doc.languageId === 'xml' || doc.fileName.endsWith('.xml')) {
             const text = doc.getText();
             const match = text.match(/<\?xml-stylesheet\s+.*href=["']([^"']+)["'].*\?>/);
             if (match) {
                 const xsltRelPath = match[1];
                 const xmlDir = path.dirname(doc.uri.fsPath);
                 const absPath = path.resolve(xmlDir, xsltRelPath);
                 try {
                     const uri = vscode.Uri.file(absPath);
                     const newXslt = await vscode.workspace.openTextDocument(uri);
                     activeXml = doc;
                     activeXslt = newXslt;
                     triggerAutoUpdate();
                     vscode.window.setStatusBarMessage(`Preview auto-switched to ${path.basename(doc.fileName)}`, 3000);
                 } catch (e) {
                     // ignore
                 }
             }
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        // Update Sidebar
        if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
            sidebarProvider.refresh();
        }
        // Update Preview
        if (activeXml && e.document.uri.toString() === activeXml.uri.toString()) triggerAutoUpdate();
        if (activeXslt && e.document.uri.toString() === activeXslt.uri.toString()) triggerAutoUpdate();
    }));

    // Command: Switch Linked File
    context.subscriptions.push(vscode.commands.registerCommand('xslt-viewer.switchFile', async () => {
        let editor = vscode.window.activeTextEditor;
        // Robustness: If no active editor (focus in sidebar), try first visible text editor
        if (!editor && vscode.window.visibleTextEditors.length > 0) {
            editor = vscode.window.visibleTextEditors[0];
        }
        
        if (!editor) return;

        const doc = editor.document;
        const text = doc.getText();
        const dir = path.dirname(doc.uri.fsPath);

        if (doc.languageId === 'xml' || doc.fileName.endsWith('.xml')) {
            // XML -> XSLT
            const match = text.match(/<\?xml-stylesheet\s+.*href=["']([^"']+)["'].*\?>/);
            if (match) {
                const targetPath = path.resolve(dir, match[1]);
                try {
                    const doc = await vscode.workspace.openTextDocument(targetPath);
                    vscode.window.showTextDocument(doc);
                } catch {
                     vscode.window.showErrorMessage(`Linked XSLT not found: ${match[1]}`);
                }
            } else {
                 vscode.window.showInformationMessage('No linked XSLT found in this XML.');
            }
        } else {
            // XSLT -> XML
            // Search open documents first
            const openDocs = vscode.workspace.textDocuments;
            const targetName = path.basename(doc.fileName);
            
            // Heuristic A: Open docs that reference this XSLT
            const candidates: vscode.TextDocument[] = [];
            for (const d of openDocs) {
                if (d.fileName.endsWith('.xml') && d.getText().includes(targetName)) {
                     candidates.push(d);
                }
            }

            if (candidates.length === 1) {
                 vscode.window.showTextDocument(candidates[0]);
                 return;
            } else if (candidates.length > 1) {
                 const selected = await vscode.window.showQuickPick(candidates.map(d => d.fileName), { placeHolder: 'Select referencing XML' });
                 if (selected) {
                     const d = candidates.find(c => c.fileName === selected);
                     if(d) vscode.window.showTextDocument(d);
                 }
                 return;
            }

            // Heuristic B: Same filename but .xml? (foo.xsl -> foo.xml)
            const potentialXml = doc.uri.fsPath.replace(/\.(xslt|xsl)$/, '.xml');
            try {
                 // We use stat to check existence because we don't have fs imported as 'fs' (only in 'fs' namespace if imported).
                 // Actually we can use workspace.fs.stat for async check or openTextDocument to try.
                 const d = await vscode.workspace.openTextDocument(potentialXml);
                 vscode.window.showTextDocument(d);
                 return;
            } catch (e) {
                // Ignore
            }
            
            vscode.window.showInformationMessage('Could not find a linked XML file in open editors.');
        }
    }));

    // Command: Export PDF (Updated to Open in Browser)
    context.subscriptions.push(vscode.commands.registerCommand('xslt-viewer.exportPdf', async () => {
         if (!activeXml || !activeXslt) {
             vscode.window.showErrorMessage('No active XSLT transformation to export.');
             return;
         }

         try {
             // 1. Generate clean HTML
             const resultHtml = await runPythonTransformation(context, activeXml.getText(), activeXslt.getText());
             
             // 2. Save to temp file
             // We use a specific name pattern locally so the browser can find it easily
             const tempDir = os.tmpdir();
             const tempFile = path.join(tempDir, `xslt_preview_${Date.now()}.html`);
             
             // Note: We need to import 'fs' and 'os'
             const fs = require('fs');
             fs.writeFileSync(tempFile, resultHtml, 'utf-8');

             // 3. Open in System Browser
             const uri = vscode.Uri.file(tempFile);
             await vscode.env.openExternal(uri);
             
             vscode.window.showInformationMessage('Preview opened in browser. Press Ctrl+P to save as PDF.');

         } catch (e: any) {
             vscode.window.showErrorMessage('Failed to export: ' + e.message);
         }
    }));
}


async function pickWorkspaceFile(prompt: string, extensions: string[]): Promise<vscode.TextDocument | undefined> {
    const files = await vscode.workspace.findFiles(`**/*.{${extensions.join(',')}}`, '**/node_modules/**');
    
    if (files.length === 0) {
        vscode.window.showErrorMessage(`No .${extensions[0]} files found in workspace`);
        return undefined;
    }

    const result = await vscode.window.showQuickPick(files.map(f => f.fsPath), {
        placeHolder: prompt
    });

    if (result) {
        return await vscode.workspace.openTextDocument(result);
    }
    return undefined;
}

function findAndJump(doc: vscode.TextDocument, info: any) {
    const text = doc.getText();
    let offset = -1;

    // Search Strategy (Best Effort)
    // 1. Exact ID
    if (info.id) {
        offset = text.indexOf(`id="${info.id}"`);
        if (offset === -1) offset = text.indexOf(`id='${info.id}'`);
    }

    // 2. Class Name (if ID not found)
    if (offset === -1 && info.className) {
        // Try exact first class match just in case
        const firstClass = info.className.split(' ')[0];
        if (firstClass) {
            offset = text.indexOf(`class="${firstClass}`);
            if (offset === -1) offset = text.indexOf(`class='${firstClass}`);
        }
        // If exact whole class string
        if (offset === -1) {
            offset = text.indexOf(`class="${info.className}"`);
        }
    }

    // 3. Tag Name + Attribute (generic)
    if (offset === -1 && info.tag && info.className) {
        // Try <div class="foo...
        const search = `<${info.tag} class="${info.className.split(' ')[0]}`;
        offset = text.indexOf(search);
    }
    
    // 4. Just Tag Name (Weakest, but fallback)
    if (offset === -1 && info.tag && !['div', 'span', 'p'].includes(info.tag)) {
        // Only jump to unique-ish tags
        offset = text.indexOf(`<${info.tag}`);
    }

    if (offset > -1) {
        const position = doc.positionAt(offset);
        vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
            selection: new vscode.Selection(position, position)
        });
    } else {
        vscode.window.setStatusBarMessage(`Could not find source for <${info.tag}>`, 3000);
    }
}

function runPythonTransformation(context: vscode.ExtensionContext, xml: string, xslt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = context.asAbsolutePath(path.join('src', 'python', 'transform.py'));
        
        // Get URI of the python script to scope configuration correctly? 
        // Or just use global/workspace config. Workspace config is better.
        const config = vscode.workspace.getConfiguration('xslt-viewer');
        const pythonPath = config.get<string>('pythonPath') || 'python';

        const process = cp.spawn(pythonPath, [scriptPath]);
        
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => { stdout += data.toString(); });
        process.stderr.on('data', (data) => { stderr += data.toString(); });

        process.on('close', (code) => {
            if (code !== 0) {
                // Enhance error message with details
                const msg = stderr || stdout || 'Unknown error';
                reject(new Error(`Python script failed (using '${pythonPath}'): ${msg}`));
            } else {
                resolve(stdout);
            }
        });

        process.on('error', (err) => {
            reject(new Error(`Failed to start python process: ${err.message}. Is Python installed?`));
        });

        // Write to stdin
        const input = JSON.stringify({ xmlContent: xml, xsltContent: xslt });
        process.stdin.write(input);
        process.stdin.end();
    });
}

function getWebviewLoading() {
    return `<!DOCTYPE html><html><body><h1>Rendering...</h1></body></html>`;
}

function getWebviewError(error: string) {
     return `<!DOCTYPE html><html><body style="color:red"><h1>Error</h1><pre>${error}</pre></body></html>`;
}

function instrumentXslt(xsltContent: string): string {
    const lines = xsltContent.split('\n');
    const instrumentedLines = lines.map((line, index) => {
        const lineNum = index + 1;
        // Regex to find start tags of literal result elements
        // Matches <TAG ... > but excludes </TAG>, <xsl:TAG, <?xml, <!, etc.
        return line.replace(/<(?!(?:\/|xsl:|[\?!]))([a-zA-Z0-9_:-]+)([^>]*)>/g, (match, tagName, attributes) => {
            // Avoid double injection
            if (attributes.includes('data-source-line')) return match;
            return `<${tagName} data-source-line="${lineNum}"${attributes}>`;
        });
    });
    return instrumentedLines.join('\n');
}

function getWebviewContent(content: string) {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { cursor: default; }
        .highlight-hover {
            outline: 2px solid orange !important;
            cursor: pointer;
            background-color: rgba(255, 165, 0, 0.1);
        }
        /* Make sure tooltip is visible */
        #preview-tooltip {
            position: fixed;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 10000;
            display: none;
            font-family: monospace;
            white-space: nowrap;
        }
    </style>
</head>
<body>
    <div id="preview-tooltip"></div>
    ${content}
    <script>
        const vscode = acquireVsCodeApi();
        const tooltip = document.getElementById('preview-tooltip');
        let lastHighlighted = null;

        document.addEventListener('mouseover', (e) => {
            // Remove previous
            if (lastHighlighted) {
                lastHighlighted.classList.remove('highlight-hover');
                lastHighlighted = null;
            }
            if (tooltip) tooltip.style.display = 'none';

            // Find target
            const target = e.target.closest('[data-source-line]');
            if (target) {
                target.classList.add('highlight-hover');
                lastHighlighted = target;
                
                // Show tooltip
                const line = target.getAttribute('data-source-line');
                if (tooltip && line) {
                    tooltip.textContent = 'Line: ' + line;
                    tooltip.style.display = 'block';
                    tooltip.style.left = (e.clientX + 10) + 'px';
                    tooltip.style.top = (e.clientY + 10) + 'px';
                }
            }
        });
        
        document.addEventListener('mousemove', (e) => {
             if (tooltip && tooltip.style.display === 'block') {
                tooltip.style.left = (e.clientX + 10) + 'px';
                tooltip.style.top = (e.clientY + 10) + 'px';
             }
        });

        document.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.target.closest('[data-source-line]');
            
            if (target) {
                const line = target.getAttribute('data-source-line');
                vscode.postMessage({
                    command: 'jumpToCode',
                    line: line
                });
            } else {
                // Fallback to text matching
                const t = e.target;
                vscode.postMessage({
                    command: 'jumpToCode',
                    tag: t.tagName.toLowerCase(),
                    className: t.className,
                    id: t.id,
                    content: t.innerText ? t.innerText.slice(0, 50).replace(/\\s+/g, ' ').trim() : ''
                });
            }
        }, true);

        // Listen for print command
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'print') {
                console.log('Received print command');
                // Ensure focus before printing
                window.focus();
                setTimeout(() => {
                    window.print();
                }, 100);
            }
        });
    </script>
</body>
</html>`;
}

// Image Sidebar Provider (Webview View)
class ImageSidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'ready': {
                    this.refresh();
                    break;
                }
                case 'jump': {
                    if (vscode.window.activeTextEditor) {
                        const range = new vscode.Range(
                            data.range.startLine, data.range.startChar, 
                            data.range.endLine, data.range.endChar
                        );
                        vscode.window.activeTextEditor.selection = new vscode.Selection(range.start, range.end);
                        vscode.window.activeTextEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    }
                    break;
                }
                case 'download': {
                     this.handleDownload(data.base64, data.mime);
                     break;
                }
                case 'replace': {
                     this.handleReplace(data.range);
                     break;
                }
                case 'switchFile': {
                     vscode.commands.executeCommand('xslt-viewer.switchFile');
                     break;
                }
                case 'exportPdf': {
                     console.log('Received exportPdf message from sidebar');
                     vscode.commands.executeCommand('xslt-viewer.exportPdf');
                     break;
                }
            }
        });

        // Initial load
        this.refresh();
    }

    public refresh() {
        console.log('Refreshing Image List...');
        if (this._view) {
            let editor = vscode.window.activeTextEditor;
            // Fallback: If no active editor (e.g. focus is on sidebar), try to find the first visible text editor
            if (!editor && vscode.window.visibleTextEditors.length > 0) {
                editor = vscode.window.visibleTextEditors[0];
            }

            if (!editor) {
                console.log('No active editor found.');
                this._view.webview.postMessage({ type: 'update', images: [] });
                return;
            }

            const text = editor.document.getText();
            console.log(`Scanning document: ${editor.document.fileName} (${text.length} chars)`);

            // Regex for Base64 Images
            // 1. Matches standard src="data:..." (terminates at " or ')
            // 2. Matches css url('data:...') (terminates at ')
            // 3. Matches css url(data:...) (terminates at ))
            // We use a set of terminators: " ' ) \s
            const regex = /data:image\/(?:png|jpg|jpeg|gif|svg\+xml|webp);base64,([^"'\)\s]+)/g;
            
            const images = [];
            let match;
            
            try {
                while ((match = regex.exec(text)) !== null) {
                    const fullMatch = match[0];
                    const base64Content = match[1];
                    const cleanBase64 = base64Content.replace(/\s/g, ''); // Should already be clean due to regex but just in case
                    
                    const startPos = editor.document.positionAt(match.index);
                    const endPos = editor.document.positionAt(match.index + fullMatch.length);
                    
                    // Extract mime type
                    const mimeMatch = fullMatch.match(/data:(image\/[a-z+]+);/);
                    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
                    
                    images.push({
                        fullMatch: fullMatch, 
                        mime: mime,
                        base64: cleanBase64, 
                        line: startPos.line + 1,
                        size: (cleanBase64.length / 1024).toFixed(1) + ' KB',
                        range: {
                            startLine: startPos.line,
                            startChar: startPos.character,
                            endLine: endPos.line,
                            endChar: endPos.character
                        }
                    });
                }
                console.log(`Found ${images.length} images.`);
                this._view.webview.postMessage({ type: 'update', images: images });
            } catch (error) {
                console.error('Error scanning for images:', error);
            }
        }
    }

    private async handleDownload(base64Data: string, mime: string) {
        const extension = mime.split('/')[1].replace('svg+xml', 'svg');
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`image.${extension}`),
            filters: { 'Images': [extension, 'png', 'jpg', 'svg'] }
        });

        if (uri) {
            try {
                const buffer = Buffer.from(base64Data, 'base64');
                await vscode.workspace.fs.writeFile(uri, new Uint8Array(buffer));
                vscode.window.showInformationMessage('Image saved successfully!');
            } catch (e: any) {
                vscode.window.showErrorMessage('Failed to save image: ' + e.message);
            }
        }
    }

    private async handleReplace(rangeObj: any) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Image to Encode',
            filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }
        });

        if (uris && uris[0]) {
             try {
                 const fileData = await vscode.workspace.fs.readFile(uris[0]);
                 const b64 = Buffer.from(fileData).toString('base64');
                 
                 // Determine mime type from extension
                 const fname = uris[0].fsPath.toLowerCase();
                 let mime = 'image/png';
                 if (fname.endsWith('.jpg') || fname.endsWith('.jpeg')) mime = 'image/jpeg';
                 if (fname.endsWith('.gif')) mime = 'image/gif';
                 if (fname.endsWith('.svg')) mime = 'image/svg+xml';
                 if (fname.endsWith('.webp')) mime = 'image/webp';

                 const newString = `data:${mime};base64,${b64}`;
                 
                 const range = new vscode.Range(
                     rangeObj.startLine, rangeObj.startChar,
                     rangeObj.endLine, rangeObj.endChar
                 );
                 
                 await editor.edit(editBuilder => {
                     editBuilder.replace(range, newString);
                 });
                 vscode.window.showInformationMessage('Image replaced successfully!');
                 // No need to manually refresh, the event listener will trigger onDidChangeTextDocument
             } catch (e: any) {
                 vscode.window.showErrorMessage('Error processing file: ' + e.message);
             }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-foreground); }
                .header-actions {
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    margin-bottom: 10px;
                }
                .btn-switch {
                    width: 100%;
                    padding: 6px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 11px;
                }
                .btn-switch:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .image-item {
                    display: flex;
                    align-items: center;
                    background: var(--vscode-sideBar-background);
                    border: 1px solid var(--vscode-widget-border);
                    margin-bottom: 8px;
                    padding: 5px;
                    border-radius: 4px;
                }
                .thumb {
                    width: 50px;
                    height: 50px;
                    object-fit: contain;
                    background: #333; /* Checkerboard substitute */
                    margin-right: 10px;
                    cursor: pointer;
                    border: 1px solid #444;
                }
                .info {
                    flex: 1;
                    overflow: hidden;
                    font-size: 11px;
                }
                .info div {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 2px;
                }
                .actions {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    cursor: pointer;
                    padding: 2px 6px;
                    font-size: 10px;
                    border-radius: 2px;
                }
                button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .btn-icon { font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header-actions">
                 <button class="btn-switch" onclick="switchFile()">
                    <span>↔</span> Switch XML/XSLT
                 </button>
                 <button class="btn-switch" style="margin-top: 5px;" onclick="exportPdf()">
                    <span>📄</span> Export Preview to PDF
                 </button>
            </div>
            <div id="image-list">Scanning...</div>
            <script>
                const vscode = acquireVsCodeApi();
                const list = document.getElementById('image-list');

                // Notify extension we are ready
                vscode.postMessage({ type: 'ready' });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'update':
                            render(message.images);
                            break;
                    }
                });

                function switchFile() {
                    vscode.postMessage({ type: 'switchFile' });
                }

                function exportPdf() {
                    vscode.postMessage({ type: 'exportPdf' });
                }

                function render(images) {
                    if (images.length === 0) {
                        list.innerHTML = '<p>No embedded images found.</p>';
                        return;
                    }
                    
                    list.innerHTML = images.map((img, index) => {
                         // We use the full match (data uri) for the thumbnail
                         return \`
                         <div class="image-item">
                            <img class="thumb" src="\${img.fullMatch}" onclick="jump(\${index})" title="Jump to Line \${img.line}" />
                            <div class="info">
                                <div><strong>Line \${img.line}</strong></div>
                                <div>\${img.mime.replace('image/', '')}</div>
                                <div>\${img.size}</div>
                            </div>
                            <div class="actions">
                                <button onclick="download(\${index})" title="Download">⬇ Save</button>
                                <button onclick="replace(\${index})" title="Replace">✎ Edit</button>
                            </div>
                         </div>
                         \`;
                    }).join('');
                    
                    // Store images for actions
                    window.currentImages = images;
                }

                function jump(index) {
                    const img = window.currentImages[index];
                    vscode.postMessage({ type: 'jump', range: img.range });
                }
                
                function download(index) {
                    const img = window.currentImages[index];
                    vscode.postMessage({ type: 'download', base64: img.base64, mime: img.mime });
                }
                
                function replace(index) {
                     const img = window.currentImages[index];
                     vscode.postMessage({ type: 'replace', range: img.range });
                }
            </script>
        </body>
        </html>`;
    }
}
