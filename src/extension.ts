import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('XSLT Viewer is active');

    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    const disposablePreview = vscode.commands.registerCommand('xslt-viewer.preview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const doc = editor.document;
        let xmlContent = '';
        let xsltContent = '';
        let xsltDoc: vscode.TextDocument | undefined;

        // Determine context (Is user in XML or XSLT?)
        // Simple logic: If .xsl/.xslt, ask for XML. If .xml, ask for XSLT.
        if (doc.languageId === 'xml' || doc.fileName.endsWith('.xml')) {
             if (doc.getText().includes('<xsl:stylesheet') || doc.getText().includes('<xsl:transform')) {
                 // Is XSLT
                 xsltDoc = doc;
                 xsltContent = doc.getText();
                 const xmlDoc = await pickWorkspaceFile('Select an XML file to transform', ['xml']);
                 if (xmlDoc) xmlContent = xmlDoc.getText();
             } else {
                 // Is XML
                 xmlContent = doc.getText();
                 xsltDoc = await pickWorkspaceFile('Select the XSLT stylesheet', ['xsl', 'xslt']);
                 if (xsltDoc) xsltContent = xsltDoc.getText();
             }
        } else if (doc.languageId === 'xsl' || doc.fileName.endsWith('.xsl') || doc.fileName.endsWith('.xslt')) {
             xsltDoc = doc;
             xsltContent = doc.getText();
             const xmlDoc = await pickWorkspaceFile('Select an XML file to transform', ['xml']);
             if (xmlDoc) xmlContent = xmlDoc.getText();
        } else {
            vscode.window.showErrorMessage('Active file is not XML or XSLT');
            return;
        }

        if (!xmlContent || !xsltContent || !xsltDoc) {
            return; // User cancelled
        }

        // Create or show panel
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.Two);
        } else {
            currentPanel = vscode.window.createWebviewPanel(
                'xsltPreview',
                'XSLT Preview',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );
            currentPanel.onDidDispose(() => { currentPanel = undefined; }, null, context.subscriptions);
        }

        // Handle messages from the Webview (Click-to-Jump)
        currentPanel.webview.onDidReceiveMessage(message => {
            if (message.command === 'jumpToCode' && xsltDoc) {
                if (message.line) {
                    const line = parseInt(message.line) - 1; // 0-based
                    if (line >= 0 && line < xsltDoc.lineCount) {
                        const range = new vscode.Range(line, 0, line, 0);
                        vscode.window.showTextDocument(xsltDoc, {
                            viewColumn: vscode.ViewColumn.One,
                            selection: range
                        });
                        vscode.window.activeTextEditor?.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    }
                } else {
                     findAndJump(xsltDoc, message);
                }
            }
        }, undefined, context.subscriptions);

        currentPanel.webview.html = getWebviewLoading();

        try {
            // Instrument XSLT to add line numbers to literal elements
            const instrumentedgXslt = instrumentXslt(xsltContent);
            const result = await runPythonTransformation(context, xmlContent, instrumentedgXslt);
            currentPanel.webview.html = getWebviewContent(result);
        } catch (e: any) {
            currentPanel.webview.html = getWebviewError(e.message || String(e));
        }
    });

    context.subscriptions.push(disposablePreview);
    
    // Register a Tree Data Provider for the "Embedded Images" view
	const imageProvider = new ImageTreeDataProvider();
	vscode.window.registerTreeDataProvider('xslt-viewer-images', imageProvider);
    
    // Refresh the tree view when the file changes
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => imageProvider.refresh()));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
            imageProvider.refresh();
        }
    }));

    // Command: Reveal Image
    context.subscriptions.push(vscode.commands.registerCommand('xslt-viewer.revealImage', (range: vscode.Range) => {
        if (vscode.window.activeTextEditor) {
            vscode.window.activeTextEditor.selection = new vscode.Selection(range.start, range.end);
            vscode.window.activeTextEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
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
        const pythonPath = 'python'; // Assume python is in PATH. Ideally, use Python extension API to get interpreter.

        const process = cp.spawn(pythonPath, [scriptPath]);
        
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => { stdout += data.toString(); });
        process.stderr.on('data', (data) => { stderr += data.toString(); });

        process.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python script failed: ${stderr}`));
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

        document.addEventListener('dblclick', (e) => {
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
    </script>
</body>
</html>`;
}

// Image List View Provider
class ImageTreeDataProvider implements vscode.TreeDataProvider<ImageItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ImageItem | undefined | null | void> = new vscode.EventEmitter<ImageItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ImageItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ImageItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ImageItem): Thenable<ImageItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return Promise.resolve([]);
        }

        const text = editor.document.getText();
        const regex = /data:image\/(?:png|jpg|jpeg|gif|svg\+xml|webp);base64,[A-Za-z0-9+/=]+/g;
        const items: ImageItem[] = [];

        let match;
        while ((match = regex.exec(text)) !== null) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);
            
            // Create a short label like "Image (png) - Line 10"
            const typeMatch = match[0].match(/image\/([a-z+]+);/);
            const imgType = typeMatch ? typeMatch[1] : 'unknown';
            const label = `Image (${imgType}) - Line ${startPos.line + 1}`;
            
            items.push(new ImageItem(label, range, vscode.TreeItemCollapsibleState.None));
        }

        return Promise.resolve(items);
    }
}

class ImageItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly range: vscode.Range,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `Click to reveal ${label}`;
        this.description = `Len: ${range.end.character - range.start.character}`;
        
        this.command = {
            command: 'xslt-viewer.revealImage',
            title: 'Reveal Image',
            arguments: [range]
        };
    }
}
