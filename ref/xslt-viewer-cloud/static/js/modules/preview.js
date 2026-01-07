import { revealLine, setEditorMarkers } from './editor.js';
import { vfs } from './vfs.js';

export function initPreview() {
    const iframe = document.getElementById('viewer');
    const zoomSelect = document.getElementById('preview-zoom');
    const printBtn = document.getElementById('preview-print');
    
    if (!iframe) return;

    // Print Button
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.print();
            }
        });
    }

    // Load saved zoom
    if (zoomSelect) {
        const savedZoom = localStorage.getItem('preview-zoom') || '100';
        zoomSelect.value = savedZoom;
        
        zoomSelect.addEventListener('change', () => {
            const val = zoomSelect.value;
            localStorage.setItem('preview-zoom', val);
            applyZoom(iframe.contentDocument, val);
        });
    }

    const tryAttach = () => {
        try {
            const doc = iframe.contentDocument;
            if (doc) {
                attachPreviewListeners(doc);
                // Apply zoom on load/attach
                if (zoomSelect) {
                    applyZoom(doc, zoomSelect.value);
                }
            }
        } catch (err) {
            console.warn('Cannot access iframe content:', err);
        }
    };

    // Try immediately
    tryAttach();

    // And on load
    iframe.addEventListener('load', tryAttach);
}

// Helper to resolve relative paths against a base path
function resolvePath(base, relative) {
    // Normalize base: ensure it ends with / if it's a directory, or strip filename if it's a file
    // In our app, base is usually passed as "folder/" or "folder/file.xml"
    // If it has an extension, assume it's a file and strip it.
    
    let stack = base.split('/').filter(p => p);
    
    // Heuristic: if last part has a dot, it's likely a file, so remove it to get directory
    if (stack.length > 0 && stack[stack.length - 1].includes('.')) {
        stack.pop();
    }
    
    const parts = relative.split('/');
    for (const part of parts) {
        if (part === '.' || part === '') continue;
        if (part === '..') {
            if (stack.length > 0) stack.pop();
        } else {
            stack.push(part);
        }
    }
    return stack.join('/');
}

async function preprocessXslt(xsltContent, xsltPath) {
    if (!xsltPath) return xsltContent;

    // Compatibility Patch (Client-Side): Map MSXSL to EXSLT
    // This allows msxsl:node-set() to work in browsers that support exsl:node-set() (like Chrome/Firefox)
    if (xsltContent.includes("urn:schemas-microsoft-com:xslt")) {
        console.log("Client-side patching MSXSL namespace to EXSLT");
        xsltContent = xsltContent.replace(/urn:schemas-microsoft-com:xslt/g, "http://exslt.org/common");
    }

    const parser = new DOMParser();
    let doc;
    try {
        doc = parser.parseFromString(xsltContent, "text/xml");
    } catch (e) {
        console.error("Failed to parse XSLT for preprocessing", e);
        return xsltContent;
    }

    const processNode = async (node) => {
        const href = node.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('data:')) return;

        const resolvedPath = resolvePath(xsltPath, href);
        
        try {
            let content;
            try {
                content = vfs.readFile(resolvedPath);
            } catch (e) {
                console.warn(`XSLT Import not found: ${resolvedPath}`);
                return;
            }

            if (content) {
                const processedContent = await preprocessXslt(content, resolvedPath);
                const blob = new Blob([processedContent], { type: 'text/xml' });
                const blobUrl = URL.createObjectURL(blob);
                node.setAttribute('href', blobUrl);
            }
        } catch (e) {
            console.warn(`Failed to resolve XSLT import: ${resolvedPath}`, e);
        }
    };

    const imports = [...doc.getElementsByTagNameNS('http://www.w3.org/1999/XSL/Transform', 'import')];
    const includes = [...doc.getElementsByTagNameNS('http://www.w3.org/1999/XSL/Transform', 'include')];
    
    for (const node of [...imports, ...includes]) {
        await processNode(node);
    }

    return new XMLSerializer().serializeToString(doc);
}

export async function renderClientSide(xmlContent, xsltContent, baseUrl, xsltPath) {
    const iframe = document.getElementById('viewer');
    if (!iframe) return;

    // 1. Instrument XSLT for Hover Support (Client-side preparation for SSR)
    let xsltToSend = xsltContent;
    try {
        // We attempt to instrument the XSLT so that the server output contains data-source-line attributes.
        // We do NOT run preprocessXslt here because Blob URLs (from VFS imports) would break the server's lxml parser.
        const instrumented = instrumentXslt(xsltContent);
        
        // Validate that instrumentation didn't break XML syntax
        const parser = new DOMParser();
        const doc = parser.parseFromString(instrumented, "text/xml");
        if (doc.getElementsByTagName("parsererror").length === 0) {
            xsltToSend = instrumented;
        } else {
            console.warn("Instrumentation produced invalid XML, falling back to raw XSLT for server rendering.");
        }
    } catch (e) {
        console.warn("Instrumentation failed:", e);
    }

    let serverError = null;

    // Try Server-Side Rendering first (if available)
    // This is preferred for complex XSLT with disable-output-escaping
    try {
        const response = await fetch('/api/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xmlContent, xsltContent: xsltToSend })
        });

        if (response.ok) {
            let html = await response.text();
            
            // Inject base tag and resources
            html = injectResources(html, baseUrl);
            
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();
            
            setEditorMarkers([]); // Clear markers on success
            return; // Success!
        } else {
            console.warn("Server-side rendering unavailable or failed, falling back to client-side.", response.status);
            
            // Try to parse error details
            try {
                const errData = await response.json();
                if (errData.details && Array.isArray(errData.details)) {
                    const markers = errData.details.map(d => ({
                        startLineNumber: d.line,
                        startColumn: d.column || 1,
                        endLineNumber: d.line,
                        endColumn: 1000,
                        message: d.message,
                        severity: 8 // monaco.MarkerSeverity.Error
                    }));
                    setEditorMarkers(markers);
                }
                serverError = errData.error || "Unknown server error";
            } catch (e) {
                // Not JSON or parse error
                serverError = "Server returned " + response.status;
            }
        }
    } catch (e) {
        console.warn("Server-side rendering fetch failed, falling back to client-side.", e);
        serverError = "Network error: " + e.message;
    }

    // Fallback to Client-Side Rendering
    try {
        // Preprocess XSLT to handle imports/includes from VFS
        const processedXslt = await preprocessXslt(xsltContent, xsltPath);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
        
        // Try to instrument XSLT, fallback to original if it fails
        let xsltDoc;
        try {
            const instrumentedXslt = instrumentXslt(processedXslt);
            xsltDoc = parser.parseFromString(instrumentedXslt, "text/xml");
            if (xsltDoc.getElementsByTagName("parsererror").length > 0) {
                throw new Error("Instrumentation produced invalid XML");
            }
        } catch (e) {
            console.warn("XSLT Instrumentation failed, falling back to original XSLT", e);
            xsltDoc = parser.parseFromString(processedXslt, "text/xml");
        }

        // Check for parse errors
        const xmlError = xmlDoc.getElementsByTagName("parsererror");
        if (xmlError.length > 0) {
            throw new Error("XML Parse Error: " + xmlError[0].textContent);
        }
        const xsltError = xsltDoc.getElementsByTagName("parsererror");
        if (xsltError.length > 0) {
            throw new Error("XSLT Parse Error: " + xsltError[0].textContent);
        }

        const processor = new XSLTProcessor();
        processor.importStylesheet(xsltDoc);

        const resultDoc = processor.transformToDocument(xmlDoc);

        // --- Layout Fix: Strip Whitespace ---
        // XSLT formatting often introduces whitespace between tags (e.g., indenting divs),
        // which browsers render as visible space, potentially breaking precise invoice layouts.
        // We traverse the result DOM and remove pure-whitespace text nodes,
        // unless they are inside pre-formatted blocks.
        cleanWhitespace(resultDoc);
        
        // Serialize to string to inject base tag
        const serializer = new XMLSerializer();
        let html = serializer.serializeToString(resultDoc);

        // --- Disable Output Escaping Simulation ---
        // Browser XSLTProcessor ignores disable-output-escaping="yes".
        // We manually unescape common tags that are often output this way (script, style, comments).
        html = html.replace(/&lt;script/g, '<script')
                   .replace(/&lt;\/script&gt;/g, '</script>')
                   .replace(/&lt;style/g, '<style')
                   .replace(/&lt;\/style&gt;/g, '</style>')
                   .replace(/&lt;!--/g, '<!--')
                   .replace(/--&gt;/g, '-->');

        // --- Client-Side Resource Injection ---
        html = injectResources(html, baseUrl);

        // Inject Warning if Server Failed
        if (serverError) {
            const warningHtml = `
                <div style="background: #fff3cd; color: #856404; padding: 10px; border-bottom: 1px solid #ffeeba; font-family: sans-serif; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span><strong>Warning:</strong> Server-side rendering failed. Showing client-side fallback. (Error: ${serverError})</span>
                    <button onclick="this.parentElement.style.display='none'" style="background:none; border:none; cursor:pointer; font-size:16px;">&times;</button>
                </div>
            `;
            // Inject after body tag if possible, or prepend
            if (html.includes('<body')) {
                html = html.replace(/<body[^>]*>/, match => match + warningHtml);
            } else {
                html = warningHtml + html;
            }
        }

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();

    } catch (e) {
        console.error("Client-side rendering failed:", e);
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        
        let errorHtml = `<html><body style="font-family: sans-serif; color: #d32f2f;"><h3>Rendering Error (Client-Side)</h3><pre>${e.message}</pre>`;
        
        if (serverError) {
            errorHtml += `<hr><h3>Server-Side Error</h3><pre>${serverError}</pre>`;
        }
        
        errorHtml += `</body></html>`;
        
        doc.write(errorHtml);
        doc.close();
    }
}

function injectResources(html, baseUrl) {
    // Since we don't have a server to serve "images/logo.png", we must
    // find all such links and replace them with Blob URLs from VFS.
    
    // 1. Parse the generated HTML
    const htmlDoc = new DOMParser().parseFromString(html, "text/html");

    // Ensure charset meta tag exists to force UTF-8
    if (!htmlDoc.querySelector('meta[charset]')) {
        const meta = htmlDoc.createElement('meta');
        meta.setAttribute('charset', 'UTF-8');
        const head = htmlDoc.head || htmlDoc.getElementsByTagName('head')[0];
        if (head) {
            head.insertBefore(meta, head.firstChild);
        } else {
            // If no head, create one
            const newHead = htmlDoc.createElement('head');
            newHead.appendChild(meta);
            htmlDoc.documentElement.insertBefore(newHead, htmlDoc.documentElement.firstChild);
        }
    }
    
    // 2. Find all elements with src or href
    const elements = htmlDoc.querySelectorAll('[src], [href]');
    
    elements.forEach(el => {
        const src = el.getAttribute('src');
        const href = el.getAttribute('href');
        const target = src || href;
        
        if (target && !target.startsWith('http') && !target.startsWith('data:') && !target.startsWith('#')) {
            // It's a relative path
            // Resolve it against baseUrl (which is the folder of the XML file)
            // baseUrl is like "folder/" or "folder/file.xml" (we need to handle this)
            
            // In editor.js, we passed baseUrl. Let's assume it's the folder path ending in /
            const fullPath = resolvePath(baseUrl, target);
            
            try {
                // Determine mime type
                let mime = 'application/octet-stream';
                if (target.endsWith('.png')) mime = 'image/png';
                else if (target.endsWith('.jpg') || target.endsWith('.jpeg')) mime = 'image/jpeg';
                else if (target.endsWith('.css')) mime = 'text/css; charset=utf-8';
                else if (target.endsWith('.js')) mime = 'application/javascript; charset=utf-8';
                
                const blob = vfs.readFileAsBlob(fullPath, mime);
                const url = URL.createObjectURL(blob);
                
                if (src) el.setAttribute('src', url);
                if (href) el.setAttribute('href', url);
                
            } catch (e) {
                console.warn(`Resource not found in VFS: ${fullPath}`);
            }
        }
    });
    
    return new XMLSerializer().serializeToString(htmlDoc);
}

function applyZoom(doc, zoomLevel) {
    if (!doc || !doc.body) return;
    const scale = parseInt(zoomLevel) / 100;
    
    // Apply transform to body
    doc.body.style.transform = `scale(${scale})`;
    doc.body.style.transformOrigin = '0 0';
    
    // Adjust width to fill space if scaled down
    // If scale is 0.5, content takes half width. We want it to take full width of iframe?
    // No, usually zoom means "make it smaller/larger".
    // If we scale down (0.5), the content becomes half size.
    // If the content was 100% width, it now looks like 50% width.
    // If we want it to still fill the iframe width but be smaller (show more content),
    // we need to increase the width of the body to (100/scale)%.
    
    doc.body.style.width = `${100/scale}%`;
    
    // Also need to handle height if we want scrollbars to work correctly on the iframe?
    // If we scale down, the body height shrinks. The iframe scrollbar will adjust.
    // If we scale up, the body height grows.
    
    // Note: If the content has fixed width (like A4 paper), scaling it is exactly what we want.
    // If it's responsive, increasing width will reflow text.
    // Invoice templates are usually fixed width or responsive.
    // Let's stick with width adjustment.
}

function instrumentXslt(xsltContent) {
    // Simple regex-based instrumentation to add data-source-line attributes
    // This allows clicking on the preview to jump to the XSLT line.
    // Note: This is a heuristic and might not be perfect for complex XSLT.
    
    const lines = xsltContent.split('\n');
    const instrumentedLines = lines.map((line, index) => {
        const lineNum = index + 1;
        // Regex to find start tags of literal result elements
        // Matches <TAG ... >
        // Excludes </TAG>, <xsl:TAG, <?xml, <!--, <![CDATA[
        // We use a negative lookahead to exclude special tags.
        
        // Pattern explanation:
        // <                : Start of tag
        // (?!              : Negative lookahead (don't match if followed by...)
        //   /              : Closing tag
        //   |xsl:          : XSLT namespace
        //   |\?            : Processing instruction
        //   |!             : Comment or CDATA
        // )
        // ([a-zA-Z0-9_:-]+): Capture Tag Name (Group 1)
        // ([^>]*)          : Capture Attributes (Group 2)
        // >                : End of tag
        
        // Note: This regex assumes the tag is on a single line or at least the opening part is.
        // It also assumes > is not inside an attribute value (which is a limitation of regex parsing).
        
        return line.replace(/<(?!(?:\/|xsl:|[\?!]))([a-zA-Z0-9_:-]+)([^>]*)>/g, (match, tagName, attributes) => {
            // Avoid double injection
            if (attributes.includes('data-source-line')) return match;
            return `<${tagName} data-source-line="${lineNum}"${attributes}>`;
        });
    });
    
    return instrumentedLines.join('\n');
}

function attachPreviewListeners(doc) {
    // Drag and Drop support (Attach to doc to ensure it works even if body is weird)
    doc.addEventListener('dragenter', function(e) {
        e.preventDefault();
        const overlay = document.getElementById('dropOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    });

    doc.addEventListener('dragover', function(e) {
        e.preventDefault();
    });

    doc.addEventListener('drop', function(e) {
        e.preventDefault();
        const overlay = document.getElementById('dropOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        if (window.FileExplorer && window.FileExplorer.handleDrop) {
            window.FileExplorer.handleDrop(e);
        }
    });

    // Intercept Ctrl+S in the iframe to prevent browser save and trigger app save
    doc.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Iframe Ctrl+S intercepted (Capture)');
            if (window.parent && window.parent.saveCurrentFile) {
                window.parent.saveCurrentFile();
            }
        }
    }, true);

    if (!doc.body) return;

    // Add click listener to all elements
    doc.body.addEventListener('click', function(e) {
        // Find closest element with xslt-line attribute
        // Note: The XSLT transformation must add this attribute for this to work
        // e.g. <div xslt-line="123">...</div>
        
        // If the user's XSLT doesn't have this, we might need a different strategy
        // or the user needs to instrument their XSLT.
        // Assuming the user wants to click on elements to find them in code.
        
        // For now, let's look for a specific attribute or just log it.
        // Based on previous context, the user asked for "click the xml file... not show the code".
        // And "auto switch to XSLT tab... to highlight the correct line".
        
        // Let's assume the rendered HTML has some mapping. 
        // If not, we can't implement revealLine without source maps.
        // But the user asked for the feature, so let's provide the hook.
        
        let target = e.target;
        while (target && target !== doc.body) {
            if (target.hasAttribute('data-source-line')) {
                const line = parseInt(target.getAttribute('data-source-line'), 10);
                if (!isNaN(line)) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Call the editor function
                    revealLine(line);
                    return;
                }
            }
            target = target.parentElement;
        }
    });
    
    // Inject styles for hover effect if needed
    const style = doc.createElement('style');
    style.textContent = `
        .highlight-hover {
            outline: 2px solid orange;
            cursor: pointer;
            background-color: rgba(255, 165, 0, 0.1);
        }
        .highlight-parent {
            outline: 2px dashed rgba(255, 165, 0, 0.5);
            background-color: rgba(255, 165, 0, 0.05);
        }
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
    `;
    doc.head.appendChild(style);

    // Create tooltip element
    let tooltip = doc.getElementById('preview-tooltip');
    if (!tooltip) {
        tooltip = doc.createElement('div');
        tooltip.id = 'preview-tooltip';
        doc.body.appendChild(tooltip);
    }

    let lastHighlighted = null;
    let lastParentHighlighted = null;

    doc.body.addEventListener('mouseover', function(e) {
        // Remove previous highlight
        if (lastHighlighted) {
            lastHighlighted.classList.remove('highlight-hover');
            lastHighlighted = null;
        }
        if (lastParentHighlighted) {
            lastParentHighlighted.classList.remove('highlight-parent');
            lastParentHighlighted = null;
        }
        if (tooltip) tooltip.style.display = 'none';

        // Find closest element with data-source-line
        const target = e.target.closest('[data-source-line]');
        if (target) {
            // Exclude the root elements (HTML, BODY)
            if (target.tagName === 'HTML' || target.tagName === 'BODY') return;
            
            target.classList.add('highlight-hover');
            lastHighlighted = target;

            // Find closest parent with data-source-line
            let parent = target.parentElement;
            while (parent && parent !== doc.body) {
                if (parent.hasAttribute('data-source-line')) {
                    if (parent.tagName === 'HTML' || parent.tagName === 'BODY') break;
                    
                    parent.classList.add('highlight-parent');
                    lastParentHighlighted = parent;
                    break;
                }
                parent = parent.parentElement;
            }

            // Update Tooltip
            const rect = target.getBoundingClientRect();
            const width = Math.round(rect.width);
            const height = Math.round(rect.height);
            
            let label = target.tagName.toLowerCase();
            if (target.id) label += '#' + target.id;
            if (target.className && typeof target.className === 'string') {
                 const classes = target.className.replace('highlight-hover', '').replace('highlight-parent', '').trim();
                 if(classes) label += '.' + classes.split(/\s+/).join('.');
            }

            tooltip.textContent = `${label} (${width} x ${height})`;
            tooltip.style.display = 'block';
            
            // Position tooltip
            let top = rect.top - 30;
            let left = rect.left;
            
            // Keep inside viewport
            if (top < 0) top = rect.bottom + 5;
            if (left + tooltip.offsetWidth > doc.documentElement.clientWidth) {
                left = doc.documentElement.clientWidth - tooltip.offsetWidth - 5;
            }
            
            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
        }
    });

    doc.body.addEventListener('mouseout', function(e) {
        if (lastHighlighted) {
            lastHighlighted.classList.remove('highlight-hover');
            lastHighlighted = null;
        }
        if (lastParentHighlighted) {
            lastParentHighlighted.classList.remove('highlight-parent');
            lastParentHighlighted = null;
        }
        if (tooltip) tooltip.style.display = 'none';
    });
}


 
// Helper to strip whitespace-only text nodes from the DOM
function cleanWhitespace(doc) {
    const preserveTags = new Set(['PRE', 'TEXTAREA', 'SCRIPT', 'STYLE']);
    
    const textNodes = [];
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT, null, false);
    
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    for (const textNode of textNodes) {
        if (!textNode.nodeValue.trim()) {
            let parent = textNode.parentNode;
            let shouldPreserve = false;
            while (parent && parent !== doc) {
                if (preserveTags.has(parent.nodeName.toUpperCase())) {
                    shouldPreserve = true;
                    break;
                }
                parent = parent.parentNode;
            }
            
            if (!shouldPreserve) {
                textNode.parentNode.removeChild(textNode);
            }
        }
    }
}
