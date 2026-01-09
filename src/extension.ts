import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('XSLT Viewer is active');

    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let activeXml: vscode.TextDocument | undefined;
    let activeXslt: vscode.TextDocument | undefined;
    let updateTimeout: NodeJS.Timeout | undefined;

    // --- Helpers ---

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
        } catch (e: any) {
             resultHtml = `<h2 style="color:red">Transformation Error</h2><pre>${e.message}</pre>`;
        }

        const wrappedHtml = wrapForIframe(resultHtml);
        const images = scanImages([activeXml, activeXslt]);

        currentPanel.webview.postMessage({
            command: 'update',
            html: wrappedHtml,
            images: images,
            filename: path.basename(activeXml.fileName)
        });
    };

    // --- Command Registration ---

    const disposablePreview = vscode.commands.registerCommand('xslt-viewer.preview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const doc = editor.document;
        let selectedXml: vscode.TextDocument | undefined;
        let selectedXslt: vscode.TextDocument | undefined;

        // Auto-Detect Logic
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
                     } catch (e) {
                         console.log('Linked XSLT not found:', absPath);
                     }
                 }
                 if (!selectedXslt) {
                    const currentDir = vscode.Uri.file(path.dirname(doc.uri.fsPath));
                    selectedXslt = await pickWorkspaceFile('Select the XSLT stylesheet (Current Folder)', ['xsl', 'xslt'], currentDir);
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

        if (!selectedXml || !selectedXslt) return;

        activeXml = selectedXml;
        activeXslt = selectedXslt;

        // Initialize Panel
        if (!currentPanel) {
            currentPanel = vscode.window.createWebviewPanel(
                'xsltPreview',
                'XSLT Preview',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            // Set the Shell (Static UI)
            currentPanel.webview.html = getWebviewShell();

            currentPanel.onDidDispose(() => { currentPanel = undefined; }, null, context.subscriptions);

            // Message Handling
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
                         handleSaveImage(message.base64, message.mime);
                         break;
                    case 'replaceImage':
                         handleReplaceImage(message.range);
                         break;
                    case 'jumpToImage':
                         handleJumpToImage(message.range);
                         break;
                }
            }, undefined, context.subscriptions);
        } else {
            currentPanel.reveal(vscode.ViewColumn.Two);
        }

        runUpdate();        
    });

    context.subscriptions.push(disposablePreview);

    // --- Events & Other Commands ---

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (!editor || !currentPanel || !currentPanel.visible) return;
        const doc = editor.document;
        // Auto-switch for new XML with link
        if (doc.languageId === 'xml' || doc.fileName.endsWith('.xml')) {
             const text = doc.getText();
             const match = text.match(/<\?xml-stylesheet\s+.*href=["']([^"']+)["'].*\?>/);
             if (match) {
                 const xsltRelPath = match[1];
                 const xmlDir = path.dirname(doc.uri.fsPath);
                 const absPath = path.resolve(xmlDir, xsltRelPath);
                 try {
                     const newXslt = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
                     activeXml = doc;
                     activeXslt = newXslt;
                     triggerAutoUpdate();
                 } catch (e) { }
             }
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (activeXml && e.document.uri.toString() === activeXml.uri.toString()) triggerAutoUpdate();
        if (activeXslt && e.document.uri.toString() === activeXslt.uri.toString()) triggerAutoUpdate();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('xslt-viewer.switchFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const doc = editor.document;
        
        if (activeXml && activeXslt) {
             if(doc.uri.toString() === activeXml.uri.toString()) {
                 vscode.window.showTextDocument(activeXslt);
             } else {
                 vscode.window.showTextDocument(activeXml);
             }
        } else {
             vscode.window.showInformationMessage('No active transformation pair.');
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('xslt-viewer.exportPdf', async () => {
         if (!activeXml || !activeXslt) {
             vscode.window.showErrorMessage('No active transformation.');
             return;
         }
         try {
             const resultHtml = await runPythonTransformation(context, activeXml.getText(), activeXslt.getText());
             const tempFile = path.join(os.tmpdir(), `xslt_preview_${Date.now()}.html`);
             fs.writeFileSync(tempFile, resultHtml, 'utf-8');
             await vscode.env.openExternal(vscode.Uri.file(tempFile));
         } catch (e: any) {
             vscode.window.showErrorMessage('Failed to export: ' + e.message);
         }
    }));
}

// --- Implementation Details ---

function runPythonTransformation(context: vscode.ExtensionContext, xml: string, xslt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = context.asAbsolutePath(path.join('src', 'python', 'transform.py'));
        const config = vscode.workspace.getConfiguration('xslt-viewer');
        const pythonPath = config.get<string>('pythonPath') || 'python';

        const process = cp.spawn(pythonPath, [scriptPath]);
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', d => stdout += d.toString());
        process.stderr.on('data', d => stderr += d.toString());

        process.on('close', code => {
            if (code !== 0) reject(new Error(stderr || stdout));
            else resolve(stdout);
        });
        process.on('error', err => reject(err));

        process.stdin.write(JSON.stringify({ xmlContent: xml, xsltContent: xslt }));
        process.stdin.end();
    });
}

function instrumentXslt(xsltContent: string): string {
    const lines = xsltContent.split('\n');
    return lines.map((line, index) => {
        const lineNum = index + 1;
        return line.replace(/<(?!(?:\/|xsl:|[\?!]))([a-zA-Z0-9_:-]+)([^>]*)>/g, (match, tagName, attributes) => {
            if (attributes.includes('data-source-line')) return match;
            return `<${tagName} data-source-line="${lineNum}"${attributes}>`;
        });
    }).join('\n');
}

function scanImages(docs: (vscode.TextDocument | undefined)[]) {
    const images: any[] = [];
    const seen = new Set();
    const regex = /data:image\/(?:png|jpg|jpeg|gif|svg\+xml|webp);base64,([^"'\)\s]+)/g;

    docs.forEach(doc => {
        if (!doc) return;
        const text = doc.getText();
        let match;
        while ((match = regex.exec(text)) !== null) {
            const fullMatch = match[0];
            if (seen.has(fullMatch)) continue;
            seen.add(fullMatch);

            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + fullMatch.length);
            const mimeMatch = fullMatch.match(/data:(image\/[a-z+]+);/);

            images.push({
                fullMatch,
                mime: mimeMatch ? mimeMatch[1] : 'image/png',
                base64: match[1].replace(/\s/g, ''),
                line: startPos.line + 1,
                size: (match[1].length / 1024).toFixed(1) + ' KB',
                range: {
                    file: doc.fileName, 
                    startLine: startPos.line,
                    startChar: startPos.character,
                    endLine: endPos.line,
                    endChar: endPos.character
                }
            });
        }
    });
    return images;
}

async function pickWorkspaceFile(prompt: string, extensions: string[], contextFolder?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
    let files: vscode.Uri[] = [];

    if (contextFolder) {
        try {
            const entries = await vscode.workspace.fs.readDirectory(contextFolder);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File) {
                    const ext = path.extname(name).slice(1).toLowerCase();
                    if (extensions.includes(ext)) {
                        files.push(vscode.Uri.joinPath(contextFolder, name));
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        files = await vscode.workspace.findFiles(`**/*.{${extensions.join(',')}}`, '**/node_modules/**');
    }

    if (files.length === 0) {
        vscode.window.showErrorMessage(`No .${extensions[0]} files found in ${contextFolder ? 'current folder' : 'workspace'}`);
        return undefined;
    }

    const items = files.map(uri => ({
        label: path.basename(uri.fsPath),
        description: vscode.workspace.asRelativePath(uri),
        uri: uri
    }));

    const result = await vscode.window.showQuickPick(items, { placeHolder: prompt });
    return result ? await vscode.workspace.openTextDocument(result.uri) : undefined;
}

function findAndJump(doc: vscode.TextDocument, info: any) {
    const text = doc.getText();
    let offset = -1;
    if (info.line) {
        const line = parseInt(info.line) - 1;
        const range = new vscode.Range(line, 0, line, 0);
        showRange(doc, range);
        return;
    }
    if (info.id) {
        offset = text.indexOf(`id="${info.id}"`);
        if (offset === -1) offset = text.indexOf(`id='${info.id}'`);
    }
    if (offset === -1 && info.className) {
        offset = text.indexOf(`class="${info.className.split(' ')[0]}`);
    }
    // Simplistic search
    if (offset > -1) {
        const pos = doc.positionAt(offset);
        showRange(doc, new vscode.Range(pos, pos));
    }
}

function showRange(doc: vscode.TextDocument, range: vscode.Range) {
    vscode.window.showTextDocument(doc, { selection: range, viewColumn: vscode.ViewColumn.One });
}

async function handleSaveImage(base64: string, mime: string) {
    const ext = mime.split('/')[1].replace('svg+xml', 'svg');
    const uri = await vscode.window.showSaveDialog({ filters: { 'Images': [ext] } });
    if(uri) {
        fs.writeFileSync(uri.fsPath, new Uint8Array(Buffer.from(base64, 'base64')));
    }
}

async function handleReplaceImage(range: any) {
    if (!range || !range.file) return;
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(range.file));
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    const uris = await vscode.window.showOpenDialog({ filters: { 'Images': ['png', 'jpg', 'svg'] } });
    
    if (uris && uris[0]) {
         const b64 = fs.readFileSync(uris[0].fsPath).toString('base64');
         const mime = 'image/png'; // simplified for brevity
         const newStr = `data:${mime};base64,${b64}`;
         editor.edit(edit => {
             edit.replace(new vscode.Range(range.startLine, range.startChar, range.endLine, range.endChar), newStr);
         });
    }
}

async function handleJumpToImage(range: any) {
    if (!range || !range.file) return;
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(range.file));
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    const r = new vscode.Range(range.startLine, range.startChar, range.endLine, range.endChar);
    editor.revealRange(r, vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(r.start, r.end);
}

// --- UI Shell HTML ---

function getWebviewShell() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; padding: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; font-family: var(--vscode-font-family); background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
        
        #toolbar {
            height: 36px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-widget-border);
            display: flex;
            align-items: center;
            padding: 0 10px;
            gap: 10px;
        }

        .btn {
            background: none;
            border: 1px solid transparent;
            color: var(--vscode-foreground);
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 13px;
            display: flex; align-items: center; gap: 5px;
        }
        .btn:hover { background-color: var(--vscode-toolbar-hoverBackground); }
        .btn:active { background-color: var(--vscode-toolbar-activeBackground); }
        
        #main-container {
            flex: 1;
            display: flex;
            overflow: hidden;
            position: relative;
        }

        #content-wrapper {
            flex: 1;
            position: relative;
            background: white; 
        }

        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }

        #sidebar {
            width: 250px;
            background-color: var(--vscode-sideBar-background);
            border-left: 1px solid var(--vscode-widget-border);
            display: flex;
            flex-direction: column;
            transition: width 0.2s, min-width 0.2s;
            overflow: hidden;
        }
        #sidebar.hidden { width: 0; min-width: 0; border: none; }

        .sidebar-header {
            padding: 8px;
            font-weight: bold;
            font-size: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
            display: flex; justify-content: space-between; align-items: center;
        }
        
        #image-list {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }

        .image-item {
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 8px;
            display: flex;
            gap: 10px;
        }
        .thumb {
            width: 40px; height: 40px;
            object-fit: contain;
            background: #eee;
            border: 1px solid #ccc;
            cursor: pointer;
        }
        .info { flex: 1; min-width: 0; font-size: 11px; }
        .info div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .actions { display: flex; flex-direction: column; gap: 4px; justify-content: center; }
        .mini-btn { font-size: 10px; padding: 2px 5px; cursor: pointer; border:none; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border-radius: 2px; }
    </style>
</head>
<body>
    <div id="toolbar">
        <button class="btn" onclick="post('switchFile')">
            <span>⟳ Switch File</span>
        </button>
        <button class="btn" onclick="post('exportPdf')">📄 Export PDF</button>
        <div style="flex:1"></div>
        <button class="btn" onclick="toggleSidebar()">🖼️ Images</button>
    </div>
    
    <div id="main-container">
        <div id="content-wrapper">
             <iframe id="preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
        </div>
        <div id="sidebar">
            <div class="sidebar-header">
                Embedded Images
                <span style="font-size:14px; font-weight:normal; cursor:pointer" onclick="toggleSidebar()">✕</span>
            </div>
            <div id="image-list">No images found.</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const frame = document.getElementById('preview-frame');
        const imgList = document.getElementById('image-list');
        const sidebar = document.getElementById('sidebar');

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'update') {
               frame.srcdoc = msg.html;
               renderImages(msg.images);
            }
        });
        
        window.addEventListener('message', event => {
            if (event.data.command === 'jumpToCode') {
                 vscode.postMessage(event.data);
            }
        });

        function post(cmd, data) {
            vscode.postMessage({ command: cmd, ...data });
        }

        function toggleSidebar() {
            sidebar.classList.toggle('hidden');
        }

        function renderImages(images) {
             if(!images || images.length === 0) {
                 imgList.innerHTML = '<div style="padding:10px; text-align:center; opacity:0.6; font-size:11px">No embedded images found in XML/XSLT.</div>';
                 return;
             }
             imgList.innerHTML = images.map((img, i) => \`
                <div class="image-item">
                    <img class="thumb" src="\${img.fullMatch}" onclick="jumpToImg(\${i})" title="Jump to Line \${img.line}">
                    <div class="info">
                        <div><strong>Line \${img.line}</strong></div>
                        <div>\${img.mime.split('/')[1]} - \${img.size}</div>
                    </div>
                    <div class="actions">
                        <button class="mini-btn" onclick="saveImg(\${i})">⬇</button>
                        <button class="mini-btn" onclick="replaceImg(\${i})">✎</button>
                    </div>
                </div>
             \`).join('');
             window.currentImages = images;
        }

        function jumpToImg(i) {
             const img = window.currentImages[i];
             post('jumpToImage', { range: img.range });
        }

        function saveImg(i) {
            const img = window.currentImages[i];
            post('saveImage', { base64: img.base64, mime: img.mime });
        }
        
        function replaceImg(i) {
             const img = window.currentImages[i];
             post('replaceImage', { range: img.range });
        }
    </script>
</body>
</html>`;
}

function wrapForIframe(content: string) {
    const script = `
    <script>
        document.addEventListener('mouseover', (e) => {
             const t = e.target.closest('[data-source-line]');
             if(t) t.style.outline = '2px solid orange';
        });
        document.addEventListener('mouseout', (e) => {
             const t = e.target.closest('[data-source-line]');
             if(t) t.style.outline = '';
        });
        document.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.target.closest('[data-source-line]');
            if (target) {
                const line = target.getAttribute('data-source-line');
                window.parent.postMessage({ command: 'jumpToCode', line: line }, '*');
            } else {
                 const t = e.target;
                 window.parent.postMessage({ 
                    command: 'jumpToCode', 
                    tag: t.tagName.toLowerCase(), 
                    className: t.className, 
                    id: t.id
                 }, '*');
            }
        });
    </script>
    `;
    if (content.includes('</body>')) {
        return content.replace('</body>', script + '</body>');
    } else {
        return content + script;
    }
}
