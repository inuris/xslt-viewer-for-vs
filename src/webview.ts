/**
 * Webview HTML shell and iframe content helpers for XSLT Preview panel.
 */

export function getWebviewShell(initialZoom: number = 100): string {
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
        .actions { display: flex; flex-direction: column; gap: 4px; justify-content: center; align-items: flex-start; }
        .mini-btn { font-size: 10px; padding: 2px 5px; cursor: pointer; border:none; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border-radius: 2px; text-align: left; }
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
        let latestHtml = '';

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
            if (cmd === 'jumpToCode' || cmd === 'showSetup') {
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
                    <img class="thumb" src="\${img.fullMatch}" onclick="jumpToImg(\${i})" title="Jump to Line \${img.line}" onload="var d=this.nextElementSibling.querySelector('.img-dimensions');if(d)d.textContent=this.naturalWidth+' × '+this.naturalHeight;">
                    <div class="info">
                        <div><strong>Line \${img.line}</strong></div>
                        <div>\${img.mime.split('/')[1]} - \${img.size}</div>
                        <div class="img-dimensions">—</div>
                    </div>
                    <div class="actions">
                        <button class="mini-btn" onclick="exportImg(\${i})">💾 Export</button>
                        <button class="mini-btn" onclick="replaceImg(\${i})">🔄 Replace</button>
                    </div>
                </div>
             \`).join('');
             window.currentImages = images;
        }

        function jumpToImg(i) {
             const img = window.currentImages[i];
             post('jumpToImage', { range: img.range });
        }

        function exportImg(i) {
            const img = window.currentImages[i];
            post('exportImage', { base64: img.base64, mime: img.mime, fullMatch: img.fullMatch });
        }
        
        function replaceImg(i) {
             const img = window.currentImages[i];
             post('replaceImage', { range: img.range, fullMatch: img.fullMatch });
        }
    </script>
</body>
</html>`;
}

/**
 * HTML for the Replace Image dialog (Upload / Paste Base64 + Resize, Opacity slider, Hue/Saturation/Brightness).
 * Controls edit the original image when no upload/paste is provided; otherwise they apply to the new image.
 * @param nonce Optional value to force webview reload when opening for a different image (e.g. Date.now()).
 */
export function getReplaceImagePanelHtml(nonce?: number): string {
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
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">Replace image</div>
        <div class="dims-info" id="target-line-info">Line: —</div>
        <div class="row">
            <button type="button" class="btn btn-secondary" id="btn-upload">Upload...</button>
            <span style="color: var(--vscode-descriptionForeground);">or paste Base64 below</span>
        </div>
        <div class="section">
            <label for="paste-base64">Paste Base64 image string:</label>
            <textarea id="paste-base64" placeholder="Paste data:image/...;base64,... or raw base64"></textarea>
        </div>
    </div>
    <div id="dims-section" class="section hidden">
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
        <div class="slider-row">
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
        let state = { range: null, currentDataUri: null, newDataUri: null, origW: 0, origH: 0, ratio: 1, originalImageW: 0, originalImageH: 0 };
        let livePreviewTimer = null;

        window.addEventListener('message', function(e) {
            const msg = e.data;
            if (msg.command === 'init') {
                state.range = msg.range;
                state.currentDataUri = msg.currentImageDataUri || null;
                const line = (state.range && typeof state.range.startLine === 'number') ? (state.range.startLine + 1) : null;
                document.getElementById('target-line-info').textContent = line ? ('Line: ' + line) : 'Line: —';
                if (state.currentDataUri) loadOldImageAndFillDims(state.currentDataUri);
            }
            if (msg.command === 'replaceImageFileData') {
                setNewImageOnly(msg.dataUri);
            }
        });
        vscode.postMessage({ command: 'replaceImageReady' });

        function parseImageInput(val) {
            if (!val || !val.trim()) return null;
            val = val.trim();
            if (val.indexOf('data:') === 0) return val;
            return 'data:image/png;base64,' + val.replace(/^data:[^;]+;base64,/, '');
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
            const needsProcess =
                (state.originalImageW > 0 && state.originalImageH > 0 && w > 0 && h > 0 &&
                    (w !== state.originalImageW || h !== state.originalImageH || opacityPct !== 100 ||
                     adj.hue !== 0 || adj.sat !== 0 || adj.bri !== 0));
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
                    ctx.drawImage(img, 0, 0, w, h);
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

        function scheduleLivePreview() {
            if (!state.currentDataUri || !getActiveSourceUri()) return;
            if (livePreviewTimer) {
                clearTimeout(livePreviewTimer);
            }
            livePreviewTimer = setTimeout(function() {
                buildPreviewDataUri(function(dataUri) {
                    vscode.postMessage({
                        command: 'replaceImagePreview',
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
                }
                document.getElementById('dims-section').classList.remove('hidden');
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
            document.getElementById('dims-section').classList.remove('hidden');
            const img = new Image();
            img.onload = function() {
                state.originalImageW = img.naturalWidth;
                state.originalImageH = img.naturalHeight;
                state.ratio = state.originalImageW / state.originalImageH;

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

        document.getElementById('btn-upload').onclick = function() {
            vscode.postMessage({ command: 'replaceImagePickFile' });
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
            vscode.postMessage({ command: 'replaceImagePreviewReset' });
            vscode.postMessage({ command: 'replaceImageCancel' });
        };

        document.getElementById('btn-delete').onclick = function() {
            if (!state.range) return;
            vscode.postMessage({ command: 'replaceImageDelete', range: state.range });
        };

        document.getElementById('btn-insert').onclick = function() {
            if (!state.range || !getActiveSourceUri()) return;
            buildPreviewDataUri(function(dataUri) {
                vscode.postMessage({ command: 'replaceImageApply', dataUri: dataUri, range: state.range });
            });
        };
    </script>
</body>
</html>`;
}

/**
 * HTML for the Export Image dialog (Save file + Base64 textarea to copy).
 * @param nonce Optional value to force webview reload when opening for a different image.
 */
export function getExportImagePanelHtml(nonce?: number): string {
    return `<!DOCTYPE html>
<html lang="en">
<!-- ${nonce ?? ''} -->
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 16px; font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-size: 13px; }
        .section { margin-bottom: 16px; }
        .section-title { font-weight: 600; margin-bottom: 8px; }
        .btn { padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; border: 1px solid transparent; }
        .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
        .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
        .actions { margin-top: 16px; display: flex; justify-content: flex-end; gap: 8px; }
        textarea { width: 100%; min-height: 120px; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; box-sizing: border-box; font-family: var(--vscode-editor-font-family); font-size: 12px; resize: vertical; }
        label { display: block; margin-bottom: 6px; }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">Export image</div>
        <button type="button" class="btn btn-primary" id="btn-save">Save file...</button>
    </div>
    <div class="section">
        <label for="base64-ta">Base64 (copy to clipboard):</label>
        <textarea id="base64-ta" readonly></textarea>
    </div>
    <div class="actions">
        <button type="button" class="btn btn-secondary" id="btn-close">Close</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        var exportState = { base64: '', mime: '' };
        window.addEventListener('message', function(e) {
            var msg = e.data;
            if (msg.command === 'init') {
                exportState.base64 = msg.base64 || '';
                exportState.mime = msg.mime || '';
                document.getElementById('base64-ta').value = msg.fullMatch || ('data:' + (msg.mime || 'image/png') + ';base64,' + (msg.base64 || ''));
            }
        });
        vscode.postMessage({ command: 'exportImageReady' });
        document.getElementById('btn-save').onclick = function() {
            vscode.postMessage({ command: 'exportImageSave', base64: exportState.base64, mime: exportState.mime });
        };
        document.getElementById('btn-close').onclick = function() {
            vscode.postMessage({ command: 'exportImageClose' });
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
            hlStyle.textContent = '.xslt-preview-line-highlight{outline:3px solid #AB47BC!important;box-shadow:0 0 0 2px rgba(171,71,188,0.45);z-index:2;position:relative;}';
            if (document.head) document.head.appendChild(hlStyle);
            var previewLineHighlighted = [];
            function clearPreviewLineHighlight() {
                previewLineHighlighted.forEach(function(el) {
                    el.classList.remove('xslt-preview-line-highlight');
                });
                previewLineHighlighted = [];
            }
            function highlightPreviewForSourceLine(lineNum) {
                clearPreviewLineHighlight();
                if (!lineNum || lineNum < 1) return;
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
                if (!els.length) return;
                for (var i = 0; i < els.length; i++) {
                    els[i].classList.add('xslt-preview-line-highlight');
                    previewLineHighlighted.push(els[i]);
                }
                try {
                    els[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                } catch (err) {}
            }
            window.addEventListener('message', function(e) {
                var d = e.data;
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
                    highlightPreviewForSourceLine(n);
                }
            });
            var hoveredEl = null, hoveredParent = null;
            var tip = document.createElement('div');
            tip.id = 'xslt-dimensions-tooltip';
            tip.style.cssText = 'position:fixed;z-index:99999;padding:4px 8px;background:rgba(0,0,0,0.85);color:#fff;font-size:12px;font-family:sans-serif;border-radius:4px;pointer-events:none;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:none;';
            document.body.appendChild(tip);
            function showTip(el) {
                tip.textContent = el.offsetWidth + ' × ' + el.offsetHeight;
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
        })();
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
