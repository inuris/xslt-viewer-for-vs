/**
 * Webview HTML shell and iframe content helpers for XSLT Preview panel.
 */

export function getWebviewShell(initialZoom: number = 100, initialLocked: boolean = false): string {
    const zoomOptions = [25, 50, 75, 100] as const;
    const safeZoom = zoomOptions.includes(initialZoom as any) ? initialZoom : 100;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; padding: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; font-family: var(--vscode-font-family); background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
        
        #path-bar {
            height: 22px;
            min-height: 22px;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-widget-border);
            display: flex;
            align-items: center;
            padding: 0 10px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            overflow: hidden;
        }
        #path-bar span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #path-bar {
            gap: 8px;
        }
        #path-text { flex: 0 1 auto; min-width: 0; max-width: 75%; }
        .path-bar-btn {
            flex-shrink: 0;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 3px;
            padding: 2px 8px;
            font-size: 12px;
            cursor: pointer;
        }
        .path-bar-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        #toolbar {
            height: 36px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-widget-border);
            display: flex;
            align-items: center;
            padding: 0 10px;
            gap: 10px;
            position: relative;
        }

        #format-btn-group {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            gap: 4px;
        }
        .format-btn {
            font-weight: 700;
            width: 26px;
            justify-content: center;
        }
        #color-input {
            position: absolute;
            width: 0;
            height: 0;
            opacity: 0;
            pointer-events: none;
            border: none;
            padding: 0;
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
        .btn.locked {
            background-color: var(--vscode-inputOption-activeBackground);
            color: var(--vscode-inputOption-activeForeground, var(--vscode-foreground));
            border-color: var(--vscode-inputOption-activeBorder, transparent);
        }
        .btn.locked:hover { background-color: var(--vscode-inputOption-activeBackground); }
        .format-btn { border-color: var(--vscode-widget-border); }

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
            width: 190px;
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
            padding: 8px;
        }

        .image-item {
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            padding: 6px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .thumb {
            width: 36px; height: 36px;
            flex-shrink: 0;
            object-fit: contain;
            background: #eee;
            border: 1px solid #ccc;
            cursor: pointer;
        }
        .info { flex: 1; min-width: 0; max-width: 84px; font-size: 11px; }
        .info div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .actions { flex-shrink: 0; display: flex; align-items: center; }
        .icon-btn { font-size: 15px; line-height: 1; width: 26px; height: 26px; padding: 0; cursor: pointer; border: none; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .icon-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    </style>
</head>
<body>
    <div id="path-bar" title="Preview source (relative path)">
        <span id="path-text">—</span>
        <button type="button" id="switch-file-btn" class="path-bar-btn" title="Switch to XSLT or XML" onclick="post('switchFile')">XSLT</button>
    </div>
    <div id="toolbar">
        <button class="btn" onclick="post('exportPdf')">📄 Export PDF</button>
        <div style="flex:1"></div>
        <div id="format-btn-group">
            <button type="button" id="bold-btn" class="btn format-btn" title="Toggle bold on the active preview element" aria-pressed="false" onmousedown="event.preventDefault()" onclick="toggleBold()">B</button>
            <button type="button" id="color-btn" class="btn format-btn" title="Change text color of the active preview element" onmousedown="event.preventDefault()" onclick="openColorPicker()">A</button>
            <input type="color" id="color-input" tabindex="-1" />
        </div>
        <button type="button" id="lock-btn" class="btn${initialLocked ? ' locked' : ''}"
                title="Lock preview: keep showing the current XML+XSLT pair even when you open another XML file"
                aria-pressed="${initialLocked ? 'true' : 'false'}"
                onclick="toggleLock()">${initialLocked ? '🔒 Locked' : '🔓 Lock'}</button>
        <label for="zoom-select" style="display:flex;align-items:center;gap:6px;font-size:13px;">
            <select id="zoom-select" class="toolbar-zoom" aria-label="Zoom">
                <option value="25"${safeZoom === 25 ? ' selected' : ''}>25%</option>
                <option value="50"${safeZoom === 50 ? ' selected' : ''}>50%</option>
                <option value="75"${safeZoom === 75 ? ' selected' : ''}>75%</option>
                <option value="100"${safeZoom === 100 ? ' selected' : ''}>100%</option>
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
        const lockBtn = document.getElementById('lock-btn');
        const boldBtn = document.getElementById('bold-btn');
        const colorBtn = document.getElementById('color-btn');
        const colorInput = document.getElementById('color-input');
        let lastActiveColorHex = '#000000';
        let latestHtml = '';
        let previewLocked = ${initialLocked ? 'true' : 'false'};

        function updateLockBtn() {
            if (!lockBtn) return;
            lockBtn.textContent = previewLocked ? '🔒 Locked' : '🔓 Lock';
            lockBtn.classList.toggle('locked', previewLocked);
            lockBtn.setAttribute('aria-pressed', previewLocked ? 'true' : 'false');
        }

        function toggleLock() {
            previewLocked = !previewLocked;
            updateLockBtn();
            post('toggleLock', { locked: previewLocked });
        }

        function toggleBold() {
            if (frame && frame.contentWindow) {
                frame.contentWindow.postMessage({ command: 'toggleBold' }, '*');
            }
        }

        function hexLuminance(hex) {
            var r = parseInt(hex.slice(1, 3), 16) / 255;
            var g = parseInt(hex.slice(3, 5), 16) / 255;
            var b = parseInt(hex.slice(5, 7), 16) / 255;
            return 0.299 * r + 0.587 * g + 0.114 * b;
        }

        function openColorPicker() {
            if (!colorInput) return;
            colorInput.value = lastActiveColorHex;
            colorInput.click();
        }
        if (colorInput) {
            // 'input' fires continuously while dragging inside the native picker's swatch/hue
            // area - just live-mutate the preview DOM (no source-file write, no reload) so
            // dragging feels responsive without hammering the extension. 'change' fires once,
            // when the color is finalized - that's the single point we persist to source.
            colorInput.addEventListener('input', function() {
                if (frame && frame.contentWindow) {
                    frame.contentWindow.postMessage({ command: 'previewColor', color: colorInput.value }, '*');
                }
            });
            colorInput.addEventListener('change', function() {
                if (frame && frame.contentWindow) {
                    frame.contentWindow.postMessage({ command: 'setColor', color: colorInput.value }, '*');
                }
            });
        }

        function applyZoom() {
            if (!frame || !zoomSelect) return;
            const pct = parseInt(zoomSelect.value, 10);
            const scale = pct / 100;
            try {
                const doc = frame.contentDocument;
                if (doc && doc.documentElement) {
                    doc.documentElement.style.zoom = scale.toString();
                }
            } catch (e) {}
        }
        if (zoomSelect) {
            zoomSelect.value = '${safeZoom}';
            zoomSelect.addEventListener('change', () => {
                applyZoom();
                const pct = parseInt(zoomSelect.value, 10);
                post('setPreviewZoom', { zoom: pct });
            });
        }
        if (frame) {
            frame.addEventListener('load', applyZoom);
        }

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'update') {
               latestHtml = msg.html || '';
               frame.srcdoc = latestHtml;
               if (boldBtn) {
                   boldBtn.classList.remove('locked');
                   boldBtn.setAttribute('aria-pressed', 'false');
               }
               if (colorBtn) {
                   colorBtn.style.color = '';
                   colorBtn.style.backgroundColor = '';
               }
               renderImages(msg.images);
               applyZoom();
               const pathEl = document.getElementById('path-text');
               if (pathEl) pathEl.textContent = msg.relativePath || msg.filename || '—';
               const switchBtn = document.getElementById('switch-file-btn');
               if (switchBtn && msg.switchButtonLabel) switchBtn.textContent = msg.switchButtonLabel;
               var hl = msg.highlightLine;
               if (hl != null && hl > 0 && frame) {
                   frame.addEventListener('load', function highlightAfterPreviewLoad() {
                       if (frame.contentWindow) {
                           frame.contentWindow.postMessage(
                               { command: 'highlightSourceLine', line: hl },
                               '*'
                           );
                       }
                   }, { once: true });
               }
            }
            if (msg.command === 'setSwitchLabel' && msg.label) {
               const switchBtn = document.getElementById('switch-file-btn');
               if (switchBtn) switchBtn.textContent = msg.label;
            }
            if (msg.command === 'setPath' && msg.relativePath !== undefined) {
               const pathEl = document.getElementById('path-text');
               if (pathEl) pathEl.textContent = msg.relativePath;
            }
            if (msg.command === 'setLockState' && typeof msg.locked === 'boolean') {
               previewLocked = msg.locked;
               updateLockBtn();
            }
            if (msg.command === 'highlightPreviewLine' && frame && frame.contentWindow) {
               frame.contentWindow.postMessage(
                   { command: 'highlightSourceLine', line: msg.line },
                   '*'
               );
            }
                if (msg.command === 'previewReplaceImage' && latestHtml && msg.oldDataUri && msg.previewDataUri) {
                    frame.srcdoc = latestHtml.split(msg.oldDataUri).join(msg.previewDataUri);
                    applyZoom();
                }
                if (msg.command === 'previewResetImage' && latestHtml) {
                    frame.srcdoc = latestHtml;
                    applyZoom();
                }
        });
        
        window.addEventListener('message', event => {
            const cmd = event.data && event.data.command;
            if (cmd === 'jumpToCode' || cmd === 'showSetup' || cmd === 'editElementStyle') {
                vscode.postMessage(event.data);
            }
            if (cmd === 'activeStyleState') {
                if (boldBtn) {
                    boldBtn.classList.toggle('locked', !!event.data.bold);
                    boldBtn.setAttribute('aria-pressed', event.data.bold ? 'true' : 'false');
                }
                if (colorBtn && event.data.colorHex) {
                    lastActiveColorHex = event.data.colorHex;
                    colorBtn.style.color = event.data.colorHex;
                    colorBtn.style.backgroundColor = hexLuminance(event.data.colorHex) > 0.5 ? '#1e1e1e' : '#f3f3f3';
                }
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
                    <img class="thumb" src="\${img.fullMatch}" onclick="jumpToImg(\${i})" title="Jump to Line \${img.line}" onload="var d=this.nextElementSibling.querySelector('.img-dimensions');if(d)d.textContent=this.naturalWidth+' × '+this.naturalHeight;">
                    <div class="info">
                        <div><strong>Line \${img.line}</strong></div>
                        <div>\${img.mime.split('/')[1]} - \${img.size}</div>
                        <div class="img-dimensions">—</div>
                    </div>
                    <div class="actions">
                        <button class="icon-btn" onclick="editImg(\${i})" title="Edit">✏️</button>
                    </div>
                </div>
             \`).join('');
             window.currentImages = images;
        }

        function jumpToImg(i) {
             const img = window.currentImages[i];
             post('jumpToImage', { range: img.range });
        }

        function editImg(i) {
             const img = window.currentImages[i];
             post('editImage', { range: img.range, base64: img.base64, mime: img.mime, fullMatch: img.fullMatch });
        }
    </script>
</body>
</html>`;
}

/**
 * HTML for the Edit Image dialog (Upload / Save as / Base64 textarea + Resize, Opacity slider, Hue/Saturation/Brightness).
 * The Base64 textarea shows the current image's data URI on open; overwriting it (or uploading a file)
 * sets the new image to apply. Controls edit the original image when no upload/paste is provided;
 * otherwise they apply to the new image.
 * @param nonce Optional value to force webview reload when opening for a different image (e.g. Date.now()).
 */
export function getEditImagePanelHtml(nonce?: number): string {
    return `<!DOCTYPE html>
<html lang="en">
<!-- ${nonce ?? ''} -->
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 16px; font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-size: 13px; }
        .section { margin-bottom: 16px; }
        .section-title { font-weight: 600; margin-bottom: 8px; }
        .row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        label { min-width: 90px; }
        input[type="number"] { width: 80px; padding: 4px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; }
        input[type="checkbox"] { margin-right: 6px; }
        input[type="range"] { flex: 1; min-width: 120px; accent-color: var(--vscode-button-background); }
        .slider-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .slider-row label { min-width: 90px; }
        .slider-val { width: 42px; text-align: right; font-variant-numeric: tabular-nums; color: var(--vscode-descriptionForeground); }
        textarea { width: 100%; min-height: 80px; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; box-sizing: border-box; font-family: inherit; resize: vertical; }
        .btn { padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; border: 1px solid transparent; }
        .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
        .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
        .btn-delete { background: transparent; color: var(--vscode-errorForeground); border: 1px solid var(--vscode-input-border); }
        .btn-delete:hover { background: var(--vscode-input-background); }
        .actions { margin-top: 16px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; }
        .actions-spacer { flex: 1; min-width: 8px; }
        .dims-info { margin: 8px 0; font-size: 12px; color: var(--vscode-descriptionForeground); }
        .hidden { display: none !important; }
        .tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
        .tab-btn { display: flex; align-items: center; gap: 6px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 6px 12px; cursor: pointer; color: var(--vscode-descriptionForeground); font-size: 13px; }
        .tab-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
        .tab-btn.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-background); font-weight: 600; }
        .adjust-preview-wrap {
            width: 260px; height: 180px; border: 1px solid var(--vscode-input-border); border-radius: 4px;
            background-image: linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%);
            background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0px; background-color: #444;
            display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .adjust-preview-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .crop-wrap { position: relative; width: 260px; height: 180px; overflow: hidden; background: #1e1e1e; border: 1px solid var(--vscode-input-border); border-radius: 4px; user-select: none; }
        .crop-wrap canvas { position: absolute; top: 0; left: 0; }
        .crop-rect { position: absolute; box-sizing: border-box; border: 1px dashed #fff; box-shadow: 0 0 0 9999px rgba(0,0,0,0.55); cursor: move; }
        .crop-handle { position: absolute; width: 10px; height: 10px; background: #fff; border: 1px solid #333; box-sizing: border-box; }
        .crop-handle[data-h="nw"] { top: -5px; left: -5px; cursor: nwse-resize; }
        .crop-handle[data-h="n"] { top: -5px; left: 50%; margin-left: -5px; cursor: ns-resize; }
        .crop-handle[data-h="ne"] { top: -5px; right: -5px; cursor: nesw-resize; }
        .crop-handle[data-h="e"] { top: 50%; right: -5px; margin-top: -5px; cursor: ew-resize; }
        .crop-handle[data-h="se"] { bottom: -5px; right: -5px; cursor: nwse-resize; }
        .crop-handle[data-h="s"] { bottom: -5px; left: 50%; margin-left: -5px; cursor: ns-resize; }
        .crop-handle[data-h="sw"] { bottom: -5px; left: -5px; cursor: nesw-resize; }
        .crop-handle[data-h="w"] { top: 50%; left: -5px; margin-top: -5px; cursor: ew-resize; }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">Edit image</div>
        <div class="dims-info" id="target-line-info">Line: —</div>
        <div class="row">
            <button type="button" class="btn btn-secondary" id="btn-upload">Replace...</button>
            <button type="button" class="btn btn-primary" id="btn-save">Save as...</button>
        </div>
    </div>

    <div class="tabs">
        <button type="button" class="tab-btn active" id="tab-btn-crop" data-tab="crop">✂️ Crop &amp; Resize</button>
        <button type="button" class="tab-btn" id="tab-btn-advanced" data-tab="advanced">🎨 Opacity &amp; Color</button>
        <button type="button" class="tab-btn" id="tab-btn-base64" data-tab="base64">📋 Base64</button>
    </div>

    <div id="panel-crop" class="tab-panel">
        <div id="crop-section" class="section hidden">
            <div class="section-title">Crop</div>
            <div class="crop-wrap" id="crop-wrap">
                <canvas id="crop-canvas" width="260" height="180"></canvas>
                <div class="crop-rect" id="crop-rect">
                    <div class="crop-handle" data-h="nw"></div>
                    <div class="crop-handle" data-h="n"></div>
                    <div class="crop-handle" data-h="ne"></div>
                    <div class="crop-handle" data-h="e"></div>
                    <div class="crop-handle" data-h="se"></div>
                    <div class="crop-handle" data-h="s"></div>
                    <div class="crop-handle" data-h="sw"></div>
                    <div class="crop-handle" data-h="w"></div>
                </div>
            </div>
            <div class="row" style="margin-top:8px">
                <button type="button" class="btn btn-secondary" id="btn-crop-reset">Reset crop</button>
                <span class="dims-info" id="crop-info" style="margin:0">Crop: full image</span>
            </div>
        </div>
        <div id="resize-section" class="section hidden">
            <div class="section-title">Resize</div>
            <div class="row">
                <label for="width-px">Width (px):</label>
                <input type="number" id="width-px" min="1" />
                <span>×</span>
                <label for="height-px">Height (px):</label>
                <input type="number" id="height-px" min="1" />
            </div>
            <div class="row">
                <input type="checkbox" id="maintain-ratio" checked />
                <label for="maintain-ratio">Maintain aspect ratio</label>
            </div>
        </div>
    </div>

    <div id="panel-advanced" class="tab-panel hidden">
        <div id="adjust-section" class="section hidden">
            <div class="section-title">Preview</div>
            <div class="adjust-preview-wrap">
                <img id="adjust-preview" alt="" />
            </div>
            <div class="slider-row" style="margin-top:12px">
                <label for="opacity-slider">Opacity</label>
                <input type="range" id="opacity-slider" min="0" max="100" value="100" />
                <span class="slider-val" id="opacity-val">100</span>
            </div>
            <div class="section-title" style="margin-top:12px">Hue / Saturation / Brightness</div>
            <div class="slider-row">
                <label for="hue-slider">Hue</label>
                <input type="range" id="hue-slider" min="-180" max="180" value="0" />
                <span class="slider-val" id="hue-val">0</span>
            </div>
            <div class="slider-row">
                <label for="sat-slider">Saturation</label>
                <input type="range" id="sat-slider" min="-100" max="100" value="0" />
                <span class="slider-val" id="sat-val">0</span>
            </div>
            <div class="slider-row">
                <label for="bri-slider">Brightness</label>
                <input type="range" id="bri-slider" min="-100" max="100" value="0" />
                <span class="slider-val" id="bri-val">0</span>
            </div>
        </div>
    </div>

    <div id="panel-base64" class="tab-panel hidden">
        <div class="section">
            <label for="paste-base64">Base64 image string (paste to replace):</label>
            <textarea id="paste-base64" placeholder="Paste data:image/...;base64,... or raw base64"></textarea>
        </div>
    </div>

    <div id="summary-section" class="hidden">
        <div class="dims-info" id="dims-info">Original: — | New: —</div>
    </div>
    <div class="actions">
        <button type="button" class="btn btn-delete" id="btn-delete">Delete image</button>
        <span class="actions-spacer" aria-hidden="true"></span>
        <button type="button" class="btn btn-secondary" id="btn-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="btn-insert">Replace</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let state = { range: null, currentDataUri: null, newDataUri: null, origW: 0, origH: 0, ratio: 1, originalImageW: 0, originalImageH: 0,
            cropSourceImg: null, crop: null, cropScale: 1, cropDrawW: 0, cropDrawH: 0, cropOffsetX: 0, cropOffsetY: 0 };
        let livePreviewTimer = null;
        let cropDrag = null;

        window.addEventListener('message', function(e) {
            const msg = e.data;
            if (msg.command === 'init') {
                state.range = msg.range;
                state.currentDataUri = msg.currentImageDataUri || null;
                const line = (state.range && typeof state.range.startLine === 'number') ? (state.range.startLine + 1) : null;
                document.getElementById('target-line-info').textContent = line ? ('Line: ' + line) : 'Line: —';
                document.getElementById('paste-base64').value = state.currentDataUri || '';
                if (state.currentDataUri) loadOldImageAndFillDims(state.currentDataUri);
            }
            if (msg.command === 'editImageFileData') {
                document.getElementById('paste-base64').value = msg.dataUri;
                setNewImageOnly(msg.dataUri);
            }
        });
        vscode.postMessage({ command: 'editImageReady' });

        function unhideEditControls() {
            document.getElementById('resize-section').classList.remove('hidden');
            document.getElementById('adjust-section').classList.remove('hidden');
            document.getElementById('summary-section').classList.remove('hidden');
            updateAdjustPreview(getActiveSourceUri());
        }

        function parseImageInput(val) {
            if (!val || !val.trim()) return null;
            val = val.trim();
            if (val.indexOf('data:') === 0) return val;
            return 'data:image/png;base64,' + val.replace(/^data:[^;]+;base64,/, '');
        }

        function dataUriToParts(dataUri) {
            const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUri || '');
            return m ? { mime: m[1], base64: m[2] } : { mime: 'image/png', base64: '' };
        }

        function clamp(n, min, max) {
            return Math.max(min, Math.min(max, n));
        }

        function getSliderValue(id, min, max, fallback) {
            const n = parseInt(document.getElementById(id).value, 10);
            return Number.isFinite(n) ? clamp(n, min, max) : fallback;
        }

        function getAdjustments() {
            return {
                hue: getSliderValue('hue-slider', -180, 180, 0),
                sat: getSliderValue('sat-slider', -100, 100, 0),
                bri: getSliderValue('bri-slider', -100, 100, 0),
            };
        }

        /** Active image to edit: uploaded/pasted if present, otherwise the original. */
        function getActiveSourceUri() {
            return state.newDataUri || state.currentDataUri;
        }

        function rgbToHsl(r, g, b) {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h = 0;
            let s = 0;
            const l = (max + min) / 2;
            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                else if (max === g) h = ((b - r) / d + 2) / 6;
                else h = ((r - g) / d + 4) / 6;
            }
            return [h, s, l];
        }

        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        function hslToRgb(h, s, l) {
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }
            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        }

        function applyHsbToImageData(imageData, hue, sat, bri) {
            if (hue === 0 && sat === 0 && bri === 0) return;
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue;
                let hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
                let h = hsl[0] + (hue / 360);
                h = h - Math.floor(h);
                let s = clamp(hsl[1] + (sat / 100), 0, 1);
                let l = clamp(hsl[2] + (bri / 100), 0, 1);
                const rgb = hslToRgb(h, s, l);
                data[i] = rgb[0];
                data[i + 1] = rgb[1];
                data[i + 2] = rgb[2];
            }
        }

        function buildPreviewDataUri(onDone) {
            const sourceUri = getActiveSourceUri();
            if (!sourceUri) return;
            const w = parseInt(document.getElementById('width-px').value, 10) || 0;
            const h = parseInt(document.getElementById('height-px').value, 10) || 0;
            const opacityPct = getSliderValue('opacity-slider', 0, 100, 100);
            const opacity = opacityPct / 100;
            const adj = getAdjustments();
            const isCropped = !!(state.crop && state.originalImageW > 0 && state.originalImageH > 0 &&
                (Math.round(state.crop.x) !== 0 || Math.round(state.crop.y) !== 0 ||
                 Math.round(state.crop.w) !== state.originalImageW || Math.round(state.crop.h) !== state.originalImageH));
            const needsProcess =
                (state.originalImageW > 0 && state.originalImageH > 0 && w > 0 && h > 0 &&
                    (w !== state.originalImageW || h !== state.originalImageH || opacityPct !== 100 ||
                     adj.hue !== 0 || adj.sat !== 0 || adj.bri !== 0 || isCropped));
            if (needsProcess) {
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.onload = function() {
                    if (!ctx) return;
                    ctx.clearRect(0, 0, w, h);
                    ctx.globalAlpha = 1;
                    const sx = isCropped ? state.crop.x : 0;
                    const sy = isCropped ? state.crop.y : 0;
                    const sw = isCropped ? state.crop.w : state.originalImageW;
                    const sh = isCropped ? state.crop.h : state.originalImageH;
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
                    if (adj.hue !== 0 || adj.sat !== 0 || adj.bri !== 0) {
                        const imageData = ctx.getImageData(0, 0, w, h);
                        applyHsbToImageData(imageData, adj.hue, adj.sat, adj.bri);
                        ctx.putImageData(imageData, 0, 0);
                    }
                    if (opacityPct !== 100) {
                        const tmp = document.createElement('canvas');
                        tmp.width = w;
                        tmp.height = h;
                        const tctx = tmp.getContext('2d');
                        if (tctx) {
                            tctx.clearRect(0, 0, w, h);
                            tctx.globalAlpha = opacity;
                            tctx.drawImage(canvas, 0, 0);
                            onDone(tmp.toDataURL('image/png'));
                            return;
                        }
                    }
                    onDone(canvas.toDataURL('image/png'));
                };
                img.src = sourceUri;
                return;
            }
            onDone(sourceUri);
        }

        function updateAdjustPreview(dataUri) {
            const el = document.getElementById('adjust-preview');
            if (el && dataUri) el.src = dataUri;
        }

        function scheduleLivePreview() {
            if (!state.currentDataUri || !getActiveSourceUri()) return;
            if (livePreviewTimer) {
                clearTimeout(livePreviewTimer);
            }
            livePreviewTimer = setTimeout(function() {
                buildPreviewDataUri(function(dataUri) {
                    updateAdjustPreview(dataUri);
                    vscode.postMessage({
                        command: 'editImagePreview',
                        oldDataUri: state.currentDataUri,
                        dataUri: dataUri,
                    });
                });
            }, 120);
        }

        // Load the original image that currently exists in the document.
        // Enables Resize / Opacity / HSB as an edit of the original (no upload required).
        function loadOldImageAndFillDims(dataUri) {
            const img = new Image();
            img.onload = function() {
                state.origW = img.naturalWidth;
                state.origH = img.naturalHeight;
                // Until a new image is uploaded/pasted, edits apply to the original source.
                if (!state.newDataUri) {
                    state.originalImageW = state.origW;
                    state.originalImageH = state.origH;
                    state.ratio = state.origH ? (state.origW / state.origH) : 1;
                    state.cropSourceImg = img;
                    initCropForActiveSource();
                }
                unhideEditControls();
                document.getElementById('width-px').value = state.origW;
                document.getElementById('height-px').value = state.origH;
                updateDimsInfo();
            };
            img.onerror = function() { state.origW = 0; state.origH = 0; updateDimsInfo(); };
            img.src = dataUri;
        }

        // Load the NEW image (upload / pasted) and initialize the width/height boxes.
        function setNewImageOnly(dataUri) {
            state.newDataUri = dataUri;
            unhideEditControls();
            const img = new Image();
            img.onload = function() {
                state.originalImageW = img.naturalWidth;
                state.originalImageH = img.naturalHeight;
                state.ratio = state.originalImageW / state.originalImageH;
                state.cropSourceImg = img;
                initCropForActiveSource();

                let targetW = state.originalImageW;
                let targetH = state.originalImageH;

                // If we know the original image size and maintain-ratio is on,
                // fit the NEW image into the ORIGINAL bounding box without oversizing.
                // Exception: 1×1 is a placeholder — ignore its size and use the new image's natural size.
                const isPlaceholder = state.origW === 1 && state.origH === 1;
                if (!isPlaceholder && state.origW > 0 && state.origH > 0 && document.getElementById('maintain-ratio').checked) {
                    const scaleW = state.origW / state.originalImageW;
                    const scaleH = state.origH / state.originalImageH;
                    const scale = Math.min(scaleW, scaleH, 1); // never upscale beyond 100%
                    targetW = Math.round(state.originalImageW * scale);
                    targetH = Math.round(state.originalImageH * scale);
                }

                document.getElementById('width-px').value = targetW;
                document.getElementById('height-px').value = targetH;
                updateDimsInfo();
                scheduleLivePreview();
            };
            img.onerror = function() { state.originalImageW = 0; state.originalImageH = 0; updateDimsInfo(); };
            img.src = dataUri;
        }

        function updateDimsInfo() {
            const w = parseInt(document.getElementById('width-px').value, 10) || 0;
            const h = parseInt(document.getElementById('height-px').value, 10) || 0;
            const opacity = getSliderValue('opacity-slider', 0, 100, 100);
            const adj = getAdjustments();
            document.getElementById('opacity-val').textContent = String(opacity);
            document.getElementById('hue-val').textContent = String(adj.hue);
            document.getElementById('sat-val').textContent = String(adj.sat);
            document.getElementById('bri-val').textContent = String(adj.bri);
            const origStr = (state.origW && state.origH) ? (state.origW + '×' + state.origH) : '—';
            const srcLabel = state.newDataUri ? 'New' : 'Edit';
            document.getElementById('dims-info').textContent =
                'Original: ' + origStr + ' | ' + srcLabel + ': ' + w + '×' + h +
                ' | Opacity: ' + opacity + '%' +
                ' | H:' + adj.hue + ' S:' + adj.sat + ' B:' + adj.bri;
        }

        function updateHeightFromWidth() {
            const w = parseInt(document.getElementById('width-px').value, 10) || 0;
            if (!state.ratio || w <= 0) return;
            const h = Math.max(1, Math.round(w / state.ratio));
            document.getElementById('height-px').value = h;
        }

        function updateWidthFromHeight() {
            const h = parseInt(document.getElementById('height-px').value, 10) || 0;
            if (!state.ratio || h <= 0) return;
            const w = Math.max(1, Math.round(h * state.ratio));
            document.getElementById('width-px').value = w;
        }

        // ---- Crop (Photoshop-style edge/corner drag on a mini preview canvas) ----

        function initCropForActiveSource() {
            const img = state.cropSourceImg;
            if (!img || !state.originalImageW || !state.originalImageH) return;
            const canvas = document.getElementById('crop-canvas');
            const cw = canvas.width;
            const ch = canvas.height;
            const scale = Math.min(cw / state.originalImageW, ch / state.originalImageH);
            state.cropScale = scale;
            state.cropDrawW = state.originalImageW * scale;
            state.cropDrawH = state.originalImageH * scale;
            state.cropOffsetX = (cw - state.cropDrawW) / 2;
            state.cropOffsetY = (ch - state.cropDrawH) / 2;
            state.crop = { x: 0, y: 0, w: state.originalImageW, h: state.originalImageH };
            document.getElementById('crop-section').classList.remove('hidden');
            renderCropCanvas();
            positionCropRectEl();
            updateCropInfo();
        }

        function renderCropCanvas() {
            const canvas = document.getElementById('crop-canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (state.cropSourceImg) {
                ctx.drawImage(state.cropSourceImg, state.cropOffsetX, state.cropOffsetY, state.cropDrawW, state.cropDrawH);
            }
        }

        function positionCropRectEl() {
            const el = document.getElementById('crop-rect');
            const c = state.crop;
            if (!c) return;
            el.style.left = (state.cropOffsetX + c.x * state.cropScale) + 'px';
            el.style.top = (state.cropOffsetY + c.y * state.cropScale) + 'px';
            el.style.width = (c.w * state.cropScale) + 'px';
            el.style.height = (c.h * state.cropScale) + 'px';
        }

        function updateCropInfo() {
            const c = state.crop;
            const full = c && Math.round(c.x) === 0 && Math.round(c.y) === 0 &&
                Math.round(c.w) === state.originalImageW && Math.round(c.h) === state.originalImageH;
            document.getElementById('crop-info').textContent = (!c || full)
                ? 'Crop: full image'
                : ('Crop: ' + Math.round(c.w) + '×' + Math.round(c.h) + ' @ ' + Math.round(c.x) + ',' + Math.round(c.y));
        }

        function wrapPointFromEvent(e) {
            const wrap = document.getElementById('crop-wrap');
            const rect = wrap.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function clampCrop(c) {
            const x = clamp(c.x, 0, Math.max(0, state.originalImageW - 10));
            const y = clamp(c.y, 0, Math.max(0, state.originalImageH - 10));
            const w = clamp(c.w, 10, state.originalImageW - x);
            const h = clamp(c.h, 10, state.originalImageH - y);
            return { x: x, y: y, w: w, h: h };
        }

        function onCropDragMove(e) {
            if (!cropDrag) return;
            const p = wrapPointFromEvent(e);
            const dxNat = (p.x - cropDrag.startPx.x) / state.cropScale;
            const dyNat = (p.y - cropDrag.startPx.y) / state.cropScale;
            const s = cropDrag.startCrop;
            const c = { x: s.x, y: s.y, w: s.w, h: s.h };

            if (cropDrag.mode === 'move') {
                c.x = clamp(s.x + dxNat, 0, state.originalImageW - s.w);
                c.y = clamp(s.y + dyNat, 0, state.originalImageH - s.h);
            } else {
                const h = cropDrag.handle;
                if (h === 'w' || h === 'nw' || h === 'sw') { c.x = s.x + dxNat; c.w = s.w - dxNat; }
                if (h === 'e' || h === 'ne' || h === 'se') { c.w = s.w + dxNat; }
                if (h === 'n' || h === 'nw' || h === 'ne') { c.y = s.y + dyNat; c.h = s.h - dyNat; }
                if (h === 's' || h === 'sw' || h === 'se') { c.h = s.h + dyNat; }
            }
            state.crop = clampCrop(c);
            positionCropRectEl();
            updateCropInfo();
        }

        function onCropDragEnd() {
            cropDrag = null;
            document.removeEventListener('mousemove', onCropDragMove);
            document.removeEventListener('mouseup', onCropDragEnd);
            if (!state.crop) return;
            document.getElementById('width-px').value = Math.round(state.crop.w);
            document.getElementById('height-px').value = Math.round(state.crop.h);
            state.ratio = state.crop.h ? (state.crop.w / state.crop.h) : 1;
            updateDimsInfo();
            scheduleLivePreview();
        }

        document.getElementById('crop-rect').addEventListener('mousedown', function(e) {
            if (e.button !== 0 || !state.crop) return;
            const handle = e.target.getAttribute('data-h');
            e.preventDefault();
            e.stopPropagation();
            cropDrag = {
                mode: handle ? 'resize' : 'move',
                handle: handle,
                startPx: wrapPointFromEvent(e),
                startCrop: { x: state.crop.x, y: state.crop.y, w: state.crop.w, h: state.crop.h },
            };
            document.addEventListener('mousemove', onCropDragMove);
            document.addEventListener('mouseup', onCropDragEnd);
        });

        document.getElementById('btn-crop-reset').onclick = function() {
            if (!state.originalImageW || !state.originalImageH) return;
            state.crop = { x: 0, y: 0, w: state.originalImageW, h: state.originalImageH };
            positionCropRectEl();
            updateCropInfo();
            document.getElementById('width-px').value = state.originalImageW;
            document.getElementById('height-px').value = state.originalImageH;
            state.ratio = state.originalImageW / state.originalImageH;
            updateDimsInfo();
            scheduleLivePreview();
        };

        function switchTab(name) {
            ['crop', 'advanced', 'base64'].forEach(function(t) {
                document.getElementById('tab-btn-' + t).classList.toggle('active', t === name);
                document.getElementById('panel-' + t).classList.toggle('hidden', t !== name);
            });
        }
        document.getElementById('tab-btn-crop').onclick = function() { switchTab('crop'); };
        document.getElementById('tab-btn-advanced').onclick = function() { switchTab('advanced'); };
        document.getElementById('tab-btn-base64').onclick = function() { switchTab('base64'); };

        document.getElementById('btn-upload').onclick = function() {
            vscode.postMessage({ command: 'editImagePickFile' });
        };

        document.getElementById('btn-save').onclick = function() {
            const parts = dataUriToParts(document.getElementById('paste-base64').value || getActiveSourceUri());
            vscode.postMessage({ command: 'editImageSave', base64: parts.base64, mime: parts.mime });
        };

        document.getElementById('paste-base64').oninput = function() {
            const dataUri = parseImageInput(this.value);
            if (dataUri) setNewImageOnly(dataUri);
        };

        document.getElementById('width-px').oninput = function() {
            if (document.getElementById('maintain-ratio').checked) {
                updateHeightFromWidth();
            }
            updateDimsInfo();
            scheduleLivePreview();
        };
        document.getElementById('height-px').oninput = function() {
            if (document.getElementById('maintain-ratio').checked) {
                updateWidthFromHeight();
            }
            updateDimsInfo();
            scheduleLivePreview();
        };
        function onAdjustSliderInput() {
            updateDimsInfo();
            scheduleLivePreview();
        }
        document.getElementById('opacity-slider').oninput = onAdjustSliderInput;
        document.getElementById('hue-slider').oninput = onAdjustSliderInput;
        document.getElementById('sat-slider').oninput = onAdjustSliderInput;
        document.getElementById('bri-slider').oninput = onAdjustSliderInput;
        document.getElementById('maintain-ratio').onchange = function() {
            if (this.checked) {
                // When turning ratio back on, snap the other dimension to match the current one.
                const w = parseInt(document.getElementById('width-px').value, 10) || 0;
                const h = parseInt(document.getElementById('height-px').value, 10) || 0;
                if (w > 0) {
                    updateHeightFromWidth();
                } else if (h > 0) {
                    updateWidthFromHeight();
                }
            }
            updateDimsInfo();
            scheduleLivePreview();
        };

        document.getElementById('btn-cancel').onclick = function() {
            vscode.postMessage({ command: 'editImagePreviewReset' });
            vscode.postMessage({ command: 'editImageCancel' });
        };

        document.getElementById('btn-delete').onclick = function() {
            if (!state.range) return;
            vscode.postMessage({ command: 'editImageDelete', range: state.range });
        };

        document.getElementById('btn-insert').onclick = function() {
            if (!state.range || !getActiveSourceUri()) return;
            buildPreviewDataUri(function(dataUri) {
                vscode.postMessage({ command: 'editImageApply', dataUri: dataUri, range: state.range });
            });
        };
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
        (function() {
            var hlStyle = document.createElement('style');
            hlStyle.textContent = '.xslt-preview-line-highlight{outline:3px solid #AB47BC!important;box-shadow:0 0 0 2px rgba(171,71,188,0.45);z-index:2;position:relative;}' +
                '.xslt-edge-handle{position:fixed;z-index:99998;display:none;background:transparent;}' +
                '.xslt-edge-handle.horiz{cursor:ew-resize;}' +
                '.xslt-edge-handle.vert{cursor:ns-resize;}' +
                '.xslt-edge-handle:hover,.xslt-edge-handle.dragging{background:rgba(171,71,188,0.45);}' +
                '#xslt-drag-label{position:fixed;z-index:100001;display:none;padding:2px 6px;background:rgba(0,0,0,0.85);color:#fff;font:600 11px sans-serif;border-radius:3px;pointer-events:none;white-space:nowrap;}';
            if (document.head) document.head.appendChild(hlStyle);
            var previewLineHighlighted = [];

            var activeEditEl = null;   // the exact element the edge handles are anchored to
            var activeEditLine = null; // its data-source-line (maps 1:1 to the XSLT source tag)
            // A click already activates the exact clicked element synchronously (see the
            // document click handler below). The extension still echoes back a
            // 'highlightSourceLine' message once the editor cursor move round-trips — ignore
            // that echo so it can't re-derive (and possibly clobber onto a parent sharing the
            // same source line) what the click already pinned precisely.
            var lastClickLine = null;
            var lastClickAt = 0;
            // A completed edge-drag ends in a native mouseup that (since the pointer has
            // usually moved off the handle) synthesizes a 'click' on whatever's underneath —
            // often the outer body/table, which has no data-source-line. Left unswallowed,
            // that stray click fell into the document click handler's "else" branch and
            // deactivated the just-edited element. Suppress exactly one click after a drag.
            var justDragged = false;

            function parsePx(v) {
                if (!v) return null;
                var m = String(v).trim().match(/^(-?\\d+(?:\\.\\d+)?)px$/);
                return m ? parseFloat(m[1]) : null;
            }

            /** Whether the given element is currently bold (inline style wins; falls back to computed style). */
            function computeBold(el) {
                if (!el) return false;
                var inline = el.style.fontWeight;
                if (inline) return inline === '700' || inline === 'bold';
                var fw = window.getComputedStyle(el).fontWeight;
                return fw === 'bold' || parseInt(fw, 10) >= 600;
            }

            /** Text color of the given element (inline style wins; falls back to computed style), as an rgb()/rgba() string. */
            function computeColor(el) {
                if (!el) return null;
                return el.style.color || window.getComputedStyle(el).color;
            }

            function rgbStringToHex(rgbStr) {
                var m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(rgbStr || '');
                if (!m) return '#000000';
                function h(n) { var s = parseInt(n, 10).toString(16); return s.length === 1 ? '0' + s : s; }
                return '#' + h(m[1]) + h(m[2]) + h(m[3]);
            }

            function postFormatState() {
                window.parent.postMessage({
                    command: 'activeStyleState',
                    bold: computeBold(activeEditEl),
                    colorHex: activeEditEl ? rgbStringToHex(computeColor(activeEditEl)) : null,
                }, '*');
            }

            /** Commit path for the edge-drag handles. 0 (or less) removes the declaration instead of writing "0px". */
            function commitStyleValue(prop, line, px) {
                if (line == null) return;
                if (px <= 0) {
                    if (activeEditEl) activeEditEl.style.removeProperty(prop);
                    window.parent.postMessage({ command: 'editElementStyle', line: line, prop: prop, value: '' }, '*');
                } else {
                    var value = px + 'px';
                    if (activeEditEl) activeEditEl.style[prop] = value;
                    window.parent.postMessage({ command: 'editElementStyle', line: line, prop: prop, value: value }, '*');
                }
            }

            // ── Edge-drag handles (Photoshop-style): drag the active element's left/right
            // border to resize width, top/bottom border to resize height. ─────────────────
            var HANDLE_SIZE = 6;
            var dragLabel = document.createElement('div');
            dragLabel.id = 'xslt-drag-label';
            document.body.appendChild(dragLabel);

            function makeHandle(edge, orientation) {
                var h = document.createElement('div');
                h.className = 'xslt-edge-handle ' + orientation;
                h.addEventListener('mousedown', function(e) { startEdgeDrag(edge, e); });
                h.addEventListener('click', function(e) { e.stopPropagation(); });
                document.body.appendChild(h);
                return h;
            }
            var handleLeft = makeHandle('left', 'horiz');
            var handleRight = makeHandle('right', 'horiz');
            var handleTop = makeHandle('top', 'vert');
            var handleBottom = makeHandle('bottom', 'vert');
            var edgeHandles = [handleLeft, handleRight, handleTop, handleBottom];

            function positionEdgeHandles() {
                if (!activeEditEl) { hideEdgeHandles(); return; }
                var r = activeEditEl.getBoundingClientRect();
                var half = HANDLE_SIZE / 2;
                handleLeft.style.left = (r.left - half) + 'px';
                handleLeft.style.top = r.top + 'px';
                handleLeft.style.width = HANDLE_SIZE + 'px';
                handleLeft.style.height = r.height + 'px';

                handleRight.style.left = (r.right - half) + 'px';
                handleRight.style.top = r.top + 'px';
                handleRight.style.width = HANDLE_SIZE + 'px';
                handleRight.style.height = r.height + 'px';

                handleTop.style.left = r.left + 'px';
                handleTop.style.top = (r.top - half) + 'px';
                handleTop.style.width = r.width + 'px';
                handleTop.style.height = HANDLE_SIZE + 'px';

                handleBottom.style.left = r.left + 'px';
                handleBottom.style.top = (r.bottom - half) + 'px';
                handleBottom.style.width = r.width + 'px';
                handleBottom.style.height = HANDLE_SIZE + 'px';

                edgeHandles.forEach(function(h) { h.style.display = 'block'; });
            }
            function hideEdgeHandles() {
                edgeHandles.forEach(function(h) { h.style.display = 'none'; h.classList.remove('dragging'); });
            }

            var dragState = null; // { handle, prop, sign, startCoord, startPx, line }

            function startEdgeDrag(edge, e) {
                if (!activeEditEl || activeEditLine == null) return;
                if (e.button !== undefined && e.button !== 0) return; // left mouse button only
                e.preventDefault();
                e.stopPropagation();
                var prop = (edge === 'left' || edge === 'right') ? 'width' : 'height';
                var sign = (edge === 'right' || edge === 'bottom') ? 1 : -1;
                var current = activeEditEl.style[prop];
                var startPx = parsePx(current);
                if (startPx == null) {
                    var r = activeEditEl.getBoundingClientRect();
                    startPx = prop === 'width' ? r.width : r.height;
                }
                var handle = edge === 'left' ? handleLeft : edge === 'right' ? handleRight : edge === 'top' ? handleTop : handleBottom;
                handle.classList.add('dragging');
                dragState = {
                    handle: handle,
                    prop: prop,
                    sign: sign,
                    startCoord: prop === 'width' ? e.clientX : e.clientY,
                    startPx: startPx,
                    line: activeEditLine,
                };
                document.body.style.cursor = prop === 'width' ? 'ew-resize' : 'ns-resize';
                document.addEventListener('mousemove', onEdgeDragMove);
                document.addEventListener('mouseup', onEdgeDragEnd);
            }

            function computeDragPx(e) {
                var coord = dragState.prop === 'width' ? e.clientX : e.clientY;
                var delta = (coord - dragState.startCoord) * dragState.sign;
                return Math.max(0, Math.round(dragState.startPx + delta));
            }

            function onEdgeDragMove(e) {
                if (!dragState || !activeEditEl) return;
                var newPx = computeDragPx(e);
                activeEditEl.style[dragState.prop] = newPx + 'px';
                positionEdgeHandles();
                dragLabel.textContent = (dragState.prop === 'width' ? 'W: ' : 'H: ') + newPx + 'px';
                dragLabel.style.left = (e.clientX + 14) + 'px';
                dragLabel.style.top = (e.clientY + 14) + 'px';
                dragLabel.style.display = 'block';
            }

            function onEdgeDragEnd(e) {
                if (!dragState) return;
                var newPx = computeDragPx(e);
                var prop = dragState.prop;
                var line = dragState.line;
                var handle = dragState.handle;
                endDrag();
                commitStyleValue(prop, line, newPx);
                if (handle) handle.classList.remove('dragging');
                justDragged = true; // swallow the click this mouseup is about to synthesize
                positionEdgeHandles();
            }

            function endDrag() {
                dragState = null;
                document.body.style.cursor = '';
                dragLabel.style.display = 'none';
                document.removeEventListener('mousemove', onEdgeDragMove);
                document.removeEventListener('mouseup', onEdgeDragEnd);
            }

            // Scroll/resize must only REPOSITION the handles, never hide them.
            document.addEventListener('scroll', function() { positionEdgeHandles(); }, true);
            window.addEventListener('resize', function() { positionEdgeHandles(); });
            // ─────────────────────────────────────────────────────────────────────

            function clearPreviewLineHighlight() {
                previewLineHighlighted.forEach(function(el) {
                    el.classList.remove('xslt-preview-line-highlight');
                });
                previewLineHighlighted = [];
                hideEdgeHandles();
                activeEditEl = null;
                activeEditLine = null;
                postFormatState();
            }

            /** Shared activation: apply the purple highlight + anchor the edge-drag handles to els[0]. */
            function activateElements(els, anchorLine) {
                clearPreviewLineHighlight();
                if (!els || !els.length) return;
                for (var i = 0; i < els.length; i++) {
                    els[i].classList.add('xslt-preview-line-highlight');
                    previewLineHighlighted.push(els[i]);
                }
                activeEditEl = els[0];
                activeEditLine = anchorLine;
                positionEdgeHandles();
                postFormatState();
            }

            function highlightPreviewForSourceLine(lineNum) {
                if (!lineNum || lineNum < 1) { clearPreviewLineHighlight(); return; }
                var els = [];
                var fallbackLine = lineNum;
                // If current cursor line has no mapped output node (e.g. xsl:value-of text line),
                // walk upward to the nearest previous mapped source line (closest parent output tag).
                while (fallbackLine >= 1) {
                    var sel = '[data-source-line="' + String(fallbackLine) + '"]';
                    els = document.querySelectorAll(sel);
                    if (els.length) break;
                    fallbackLine--;
                }
                if (!els.length) { clearPreviewLineHighlight(); return; }
                // Edge-drag handles anchor to the first matched element, keyed by the actual
                // matched source line (fallbackLine), which is what maps 1:1 back to the tag
                // in the XSLT source that styleEdit.ts will locate and patch.
                activateElements(els, fallbackLine);
                try {
                    els[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                } catch (err) {}
            }
            window.addEventListener('message', function(e) {
                var d = e.data;
                if (d && d.command === 'toggleBold') {
                    if (!activeEditEl || activeEditLine == null) return;
                    var isBold = computeBold(activeEditEl);
                    var newVal = isBold ? '' : '700';
                    if (newVal) activeEditEl.style.fontWeight = newVal;
                    else activeEditEl.style.removeProperty('font-weight');
                    window.parent.postMessage({ command: 'editElementStyle', line: activeEditLine, prop: 'font-weight', value: newVal }, '*');
                    postFormatState();
                    return;
                }
                if (d && d.command === 'previewColor') {
                    // Live-only: mutate the DOM + button swatch for instant feedback while
                    // dragging in the native picker, but don't touch the source file or
                    // trigger a reload - see setColor for the actual commit.
                    if (!activeEditEl || !d.color) return;
                    activeEditEl.style.color = d.color;
                    postFormatState();
                    return;
                }
                if (d && d.command === 'setColor') {
                    if (!activeEditEl || activeEditLine == null || !d.color) return;
                    activeEditEl.style.color = d.color;
                    window.parent.postMessage({ command: 'editElementStyle', line: activeEditLine, prop: 'color', value: d.color }, '*');
                    postFormatState();
                    return;
                }
                if (d && d.command === 'highlightSourceLine') {
                    if (d.line == null || d.line === '') {
                        clearPreviewLineHighlight();
                        return;
                    }
                    var n = parseInt(d.line, 10);
                    if (isNaN(n)) {
                        clearPreviewLineHighlight();
                        return;
                    }
                    if (lastClickLine !== null && String(n) === String(lastClickLine) && (Date.now() - lastClickAt) < 1000) {
                        return; // echo of our own click-driven activation; already precise, don't re-derive
                    }
                    highlightPreviewForSourceLine(n);
                }
            });
            var hoveredEl = null, hoveredParent = null;
            var tip = document.createElement('div');
            tip.id = 'xslt-dimensions-tooltip';
            tip.style.cssText = 'position:fixed;z-index:99999;padding:4px 8px;background:rgba(0,0,0,0.85);color:#fff;font-size:12px;font-family:sans-serif;border-radius:4px;pointer-events:none;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:none;';
            var tipSelector = document.createElement('div');
            tipSelector.style.cssText = 'font-weight:600;margin-bottom:2px;';
            var tipDims = document.createElement('div');
            tip.appendChild(tipSelector);
            tip.appendChild(tipDims);
            document.body.appendChild(tip);
            function buildSelector(el) {
                var tag = el.tagName ? el.tagName.toLowerCase() : '';
                if (el.id) return tag + '#' + el.id;
                if (el.className && typeof el.className === 'string' && el.className.trim()) {
                    var first = el.className.trim().split(/\s+/)[0];
                    if (first) return tag + '.' + first;
                }
                return tag;
            }
            function showTip(el) {
                tipSelector.textContent = buildSelector(el);
                tipDims.textContent = el.offsetWidth + ' × ' + el.offsetHeight;
                tip.style.display = 'block';
                var r = el.getBoundingClientRect();
                var topVal = r.top - tip.offsetHeight - 4;
                if (topVal < 8) topVal = r.bottom + 4;
                tip.style.left = Math.max(4, r.left + (r.width / 2) - (tip.offsetWidth / 2)) + 'px';
                tip.style.top = topVal + 'px';
            }
            function hideTip() { tip.style.display = 'none'; }
            function clearHover() {
                if (hoveredEl) { hoveredEl.style.outline = ''; hoveredEl = null; }
                if (hoveredParent) { hoveredParent.style.outline = ''; hoveredParent = null; }
                hideTip();
            }
            document.addEventListener('mouseover', (e) => {
                var t = e.target.closest('[data-source-line]');
                if (!t) return;
                var parentWithLine = t.parentElement ? t.parentElement.closest('[data-source-line]') : null;
                clearHover();
                hoveredEl = t;
                hoveredParent = parentWithLine;
                t.style.outline = '2px solid orange';
                if (parentWithLine) parentWithLine.style.outline = '2px dashed rgba(255,165,0,0.45)';
                showTip(t);
            });
            document.addEventListener('mouseout', (e) => {
                var t = e.target.closest('[data-source-line]');
                if (!t) return;
                var parentWithLine = t.parentElement ? t.parentElement.closest('[data-source-line]') : null;
                if (e.relatedTarget && (t.contains(e.relatedTarget) || (parentWithLine && parentWithLine.contains(e.relatedTarget)))) return;
                clearHover();
            });
            document.addEventListener('click', (e) => {
                e.stopPropagation();
                if (justDragged) {
                    // This click is the tail end of an edge-drag mouseup, not a real
                    // element pick — consume it without touching the current activation.
                    justDragged = false;
                    return;
                }
                const target = e.target.closest('[data-source-line]');
                if (target) {
                    const line = target.getAttribute('data-source-line');
                    // Activate the EXACT clicked element right away — don't wait on the
                    // editor round-trip, and don't re-derive it by line number later (that
                    // querySelectorAll-by-line can land on a parent sharing the same line).
                    lastClickLine = line;
                    lastClickAt = Date.now();
                    activateElements([target], parseInt(line, 10));
                    window.parent.postMessage({ command: 'jumpToCode', line: line }, '*');
                } else {
                     clearPreviewLineHighlight();
                     const t = e.target;
                     window.parent.postMessage({
                        command: 'jumpToCode',
                        tag: t.tagName.toLowerCase(),
                        className: t.className,
                        id: t.id
                     }, '*');
                }
            });
        })();
    </script>
    `;
    if (content.includes('</body>')) {
        return content.replace('</body>', script + '</body>');
    }
    return content + script;
}
