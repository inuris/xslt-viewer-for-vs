/**
 * Webview HTML shell and iframe content helpers for XSLT Preview panel.
 */

export function getWebviewShell(): string {
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

        .toolbar-zoom {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 13px;
            cursor: pointer;
            min-width: 72px;
        }
        .toolbar-zoom:focus { outline: 1px solid var(--vscode-focusBorder); }
        
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
        <label for="zoom-select" style="display:flex;align-items:center;gap:6px;font-size:13px;">
            <select id="zoom-select" class="toolbar-zoom" aria-label="Zoom">
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100" selected>100%</option>
            </select>
        </label>
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
        const zoomSelect = document.getElementById('zoom-select');

        function applyZoom() {
            const pct = parseInt(zoomSelect.value, 10);
            const scale = pct / 100;
            try {
                const doc = frame.contentDocument;
                if (doc && doc.documentElement) {
                    doc.documentElement.style.zoom = scale.toString();
                }
            } catch (e) {}
        }
        zoomSelect.addEventListener('change', applyZoom);
        frame.addEventListener('load', applyZoom);

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'update') {
               frame.srcdoc = msg.html;
               renderImages(msg.images);
               applyZoom();
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
                        <button class="mini-btn" onclick="saveImg(\${i})">🔽Download</button>
                        <button class="mini-btn" onclick="replaceImg(\${i})">🔄️Replace</button>
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

/**
 * Wrap preview HTML with click-to-jump script (data-source-line → postMessage).
 */
export function wrapForIframe(content: string): string {
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
    }
    return content + script;
}
