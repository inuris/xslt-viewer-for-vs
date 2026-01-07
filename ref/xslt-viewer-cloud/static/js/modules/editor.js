import { renderClientSide } from './preview.js';
import { initBase64Support } from './base64_tools.js';
import { initCssNavigation } from './css_navigation.js';
import { initXsltSwitcher } from './xslt_switcher.js';
import { detachBase64, attachBase64, clearBase64Cache } from './base64_manager.js';
import { vfs } from './vfs.js';

let editor = null;
let currentTheme = localStorage.getItem('monaco-theme') || 'vs-dark';
let xsltSwitcher = null;

// State
let tabs = []; // Array of { id, path, name, content, viewState, isDirty, isPreview, model, linkedXsltPath, isXsltViewMode, xsltContent, xsltViewState, xmlContent, xmlViewState }
let activeTabId = null;
let isLoading = false;

// DOM Elements
const tabsContainer = document.getElementById('tabs-container');
const editorBreadcrumb = document.getElementById('editor-breadcrumb');

export function initEditor() {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
        updateThemeButton();

        editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: '<!-- Select a file to open -->', 
            language: 'xml',
            theme: currentTheme,
            automaticLayout: true,
            stopRenderingLineAfter: -1,
            minimap: { enabled: false },
            detectIndentation: false
        });

        // Initialize Indentation
        const indentSelect = document.getElementById('indent-select');
        const savedIndent = localStorage.getItem('editor-indent') || '4';
        
        const updateIndent = (val) => {
            editor.updateOptions({ tabSize: val, indentSize: val });
            const model = editor.getModel();
            if (model) {
                model.updateOptions({ tabSize: val, indentSize: val });
            }
        };

        if (indentSelect) {
            indentSelect.value = savedIndent;
            updateIndent(parseInt(savedIndent));
            
            indentSelect.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                localStorage.setItem('editor-indent', val);
                updateIndent(val);
            });
        }

        // Initialize Base64 Tools
        initBase64Support(editor, monaco, () => {
            saveCurrentFile();
        }, revealLine);

        initCssNavigation(editor, monaco);
        xsltSwitcher = initXsltSwitcher(editor, monaco, () => {
            saveCurrentFile().then(() => {
                const tab = tabs.find(t => t.id === activeTabId);
                if (tab) checkForLinkedXslt(tab);
            });
        });

        // Track changes
        editor.onDidChangeModelContent(() => {
            if (!isLoading && activeTabId) {
                const tab = tabs.find(t => t.id === activeTabId);
                if (tab) {
                    let needsRender = false;
                    if (!tab.isDirty) {
                        tab.isDirty = true;
                        needsRender = true;
                    }
                    // If tab is modified, it should no longer be a preview tab
                    if (tab.isPreview) {
                        tab.isPreview = false;
                        needsRender = true;
                    }
                    if (needsRender) {
                        saveTabsState();
                        renderTabs();
                    }
                }
            }
        });

        // Handle Copy to restore Base64
        const container = editor.getContainerDomNode();
        container.addEventListener('copy', (e) => {
            // Get all selections
            const selections = editor.getSelections();
            if (!selections || selections.length === 0) return;

            // Sort selections by position to maintain order
            selections.sort((a, b) => {
                if (a.startLineNumber === b.startLineNumber) {
                    return a.startColumn - b.startColumn;
                }
                return a.startLineNumber - b.startLineNumber;
            });

            const model = editor.getModel();
            const texts = selections.map(selection => {
                return model.getValueInRange(selection);
            });

            // Join with newlines (standard behavior)
            let textToCopy = texts.join(model.getEOL());

            // Check if we have any base64 placeholders
            if (textToCopy.includes('__BASE64_IMAGE_')) {
                e.preventDefault();
                const restoredText = attachBase64(textToCopy);
                e.clipboardData.setData('text/plain', restoredText);
            }
        });

        // Handle Paste to detach Base64
        container.addEventListener('paste', (e) => {
            const text = e.clipboardData.getData('text/plain');
            if (text && text.includes('data:image/') && text.includes(';base64,')) {
                e.preventDefault();
                const processed = detachBase64(text);
                
                const selection = editor.getSelection();
                const range = new monaco.Range(
                    selection.startLineNumber, 
                    selection.startColumn, 
                    selection.endLineNumber, 
                    selection.endColumn
                );
                
                editor.executeEdits('paste-base64', [{
                    range: range,
                    text: processed,
                    forceMoveMarkers: true
                }]);
            }
        });

        document.getElementById('themeToggle').addEventListener('click', toggleTheme);

        // Add Save Command (Ctrl+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
            saveCurrentFile();
        });

        // Add Format Command (Shift+Alt+F)
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, function() {
            formatCurrentFile();
        });
        
        // Bind Format Button
        const fmtBtn = document.getElementById('formatBtn');
        if(fmtBtn) fmtBtn.addEventListener('click', formatCurrentFile);

        initSettings();
        restoreTabs();
    });
}

function saveTabsState() {
    const state = {
        activeTabId: activeTabId,
        tabs: tabs.map(t => ({
            id: t.id,
            path: t.path,
            name: t.name,
            isPreview: t.isPreview,
            linkedXsltPath: t.linkedXsltPath,
            isXsltViewMode: t.isXsltViewMode
        }))
    };
    localStorage.setItem('editor-tabs-state', JSON.stringify(state));
}

function restoreTabs() {
    const saved = localStorage.getItem('editor-tabs-state');
    if (!saved) return;

    try {
        const state = JSON.parse(saved);
        if (!state.tabs || state.tabs.length === 0) return;

        // We need to load content for each tab.
        // This might be slow if many tabs.
        // Let's load them sequentially or parallel?
        // Parallel is better.
        
        const promises = state.tabs.map(t => {
            // We need to reconstruct the tab object
            // We don't have content yet.
            // We can reuse openFile logic but openFile activates the tab.
            // We want to restore all then activate one.
            
            // Let's manually reconstruct.
            return loadFileContent(t.path).then(content => {
                const newTab = {
                    id: t.id,
                    path: t.path,
                    name: t.name,
                    content: content,
                    viewState: null,
                    isDirty: false,
                    isPreview: t.isPreview,
                    linkedXsltPath: t.linkedXsltPath,
                    isXsltViewMode: t.isXsltViewMode,
                    xsltContent: null,
                    xsltViewState: null,
                    xmlContent: null,
                    xmlViewState: null
                };
                
                // If it was in XSLT mode, we might need to load XSLT content too?
                // Or just let toggleXsltView handle it when activated?
                // If we restore as isXsltViewMode=true, activateTab will try to use xsltContent.
                // So we should probably load it if needed.
                
                if (t.isXsltViewMode && t.linkedXsltPath) {
                    return loadFileContent(t.linkedXsltPath).then(xsltContent => {
                        newTab.xsltContent = xsltContent;
                        // We also need to set xmlContent to 'content' (which is XML)
                        newTab.xmlContent = content;
                        return newTab;
                    });
                }
                
                return newTab;
            }).catch(err => {
                console.warn(`Failed to restore tab ${t.path}`, err);
                return null;
            });
        });

        Promise.all(promises).then(loadedTabs => {
            // Filter out failed loads
            const validTabs = loadedTabs.filter(t => t !== null);
            if (validTabs.length > 0) {
                tabs = validTabs;
                renderTabs();
                
                if (state.activeTabId && tabs.find(t => t.id === state.activeTabId)) {
                    activateTab(state.activeTabId);
                } else {
                    activateTab(tabs[0].id);
                }
            }
        });

    } catch (e) {
        console.error('Error restoring tabs', e);
    }
}

function initSettings() {
    // Settings disabled in client-side version
    const btn = document.getElementById('settingsBtn');
    if (btn) btn.style.display = 'none';
    
    // Also hide the modal if it exists
    const modal = document.getElementById('settingsModal');
    if (modal) modal.style.display = 'none';
}

export function getEditorInstance() {
    return editor;
}

// --- Tab Management ---

export function openFile(path, isPreview = true) {
    if (!editor) return Promise.resolve();

    // Check if already open as a main tab
    const existingTab = tabs.find(t => t.path === path);
    if (existingTab) {
        if (!isPreview && existingTab.isPreview) {
            existingTab.isPreview = false;
            renderTabs();
        }
        return activateTab(existingTab.id);
    }

    // Check if already open as a linked XSLT in an XML tab
    // If user clicks XSLT file, and it's already open as linked XSLT, jump to it
    if (path.toLowerCase().endsWith('.xslt')) {
        const linkedTab = tabs.find(t => t.linkedXsltPath === path);
        if (linkedTab) {
            // Activate the XML tab and switch to XSLT view
            return activateTab(linkedTab.id).then(() => {
                if (!linkedTab.isXsltViewMode) {
                    toggleXsltView(linkedTab.id, true);
                }
            });
        }
    }

    // If opening as preview, check if we have an existing preview tab to reuse
    if (isPreview) {
        const previewTab = tabs.find(t => t.isPreview);
        if (previewTab) {
            // Reuse preview tab
            return loadFileContent(path).then(content => {
                previewTab.path = path;
                previewTab.name = path.split('/').pop();
                previewTab.content = content; // This is the "current" content (XML or XSLT depending on file type)
                previewTab.isDirty = false;
                previewTab.viewState = null;
                
                // Reset linked XSLT state
                previewTab.linkedXsltPath = null;
                previewTab.isXsltViewMode = false;
                previewTab.xsltContent = null;
                previewTab.xsltViewState = null;
                previewTab.xmlContent = null;
                previewTab.xmlViewState = null;
                
                // If this was the active tab, update editor content
                if (activeTabId === previewTab.id) {
                    isLoading = true;
                    const processed = detachBase64(content);
                    editor.setValue(processed);
                    editor.setScrollTop(0);
                    monaco.editor.setModelLanguage(editor.getModel(), path.endsWith('.xslt') ? 'xml' : 'xml');
                    isLoading = false;
                    updateBreadcrumb();
                    updatePreview();
                    checkForLinkedXslt(previewTab);
                } else {
                    activateTab(previewTab.id);
                }
                renderTabs();
            });
        }
    }

    // Create new tab
    return loadFileContent(path).then(content => {
        const newTab = {
            id: Date.now().toString(),
            path: path,
            name: path.split('/').pop(),
            content: content,
            viewState: null,
            isDirty: false,
            isPreview: isPreview,
            linkedXsltPath: null,
            isXsltViewMode: false,
            xsltContent: null,
            xsltViewState: null,
            xmlContent: null,
            xmlViewState: null
        };
        tabs.push(newTab);
        saveTabsState();
        renderTabs();
        activateTab(newTab.id);
        checkForLinkedXslt(newTab);
    });
}

function checkForLinkedXslt(tab) {
    if (tab.path.toLowerCase().endsWith('.xml')) {
        try {
            // Client-side logic to find linked XSLT
            // 1. Read XML content
            const content = tab.content; // This might be detached base64, but headers should be fine
            // 2. Regex for <?xml-stylesheet ... href="..." ?>
            const match = content.match(/<\?xml-stylesheet\s+[^>]*?href=['"]([^'"]+)['"][^>]*?\?>/i);
            if (match && match[1]) {
                const href = match[1];
                // Resolve path relative to XML file
                const parts = tab.path.split('/');
                parts.pop(); // Remove filename
                
                // Handle relative paths like "../style.xsl" or "style.xsl"
                // Simple resolution:
                const hrefParts = href.split('/');
                const dirParts = [...parts];
                
                for (const part of hrefParts) {
                    if (part === '.') continue;
                    if (part === '..') {
                        if (dirParts.length > 0) dirParts.pop();
                    } else {
                        dirParts.push(part);
                    }
                }
                
                const xsltPath = dirParts.join('/');
                
                // Check if file exists in VFS
                try {
                    vfs.readFile(xsltPath); // Will throw if not found
                    tab.linkedXsltPath = xsltPath;
                    saveTabsState();
                    renderTabs();
                    
                    // If this is the active tab, update the preview now that we found the XSLT
                    if (activeTabId === tab.id) {
                        updatePreview();
                    }
                } catch (e) {
                    // XSLT file not found
                    console.warn(`Linked XSLT not found at: ${xsltPath}`);
                }
            }
        } catch (e) {
            console.error("Error checking linked XSLT", e);
        }
    }
}

function loadFileContent(path) {
    return new Promise((resolve, reject) => {
        try {
            const content = vfs.readFile(path);
            resolve(content);
        } catch (e) {
            reject(e);
        }
    });
}

export function closeTab(id, event) {
    if (event) event.stopPropagation();
    
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tab = tabs[index];
    if (tab.isDirty) {
        showUnsavedChangesModal(tab, () => {
            // On Save
            saveCurrentFile().then(() => {
                closeTabInternal(id);
            });
        }, () => {
            // On Don't Save
            closeTabInternal(id);
        });
        return;
    }

    closeTabInternal(id);
}

function closeTabInternal(id) {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    tabs.splice(index, 1);
    saveTabsState();
    
    if (activeTabId === id) {
        // Switch to neighbor
        if (tabs.length > 0) {
            // Try right, then left
            const newIndex = Math.min(index, tabs.length - 1);
            activateTab(tabs[newIndex].id);
        } else {
            activeTabId = null;
            editor.setValue('<!-- Select a file to open -->');
            updateBreadcrumb();
        }
    }
    renderTabs();
}

function showUnsavedChangesModal(tab, onSave, onDontSave) {
    const modal = document.getElementById('unsavedChangesModal');
    const msg = document.getElementById('unsavedChangesMessage');
    const saveBtn = document.getElementById('unsavedSaveBtn');
    const dontSaveBtn = document.getElementById('unsavedDontSaveBtn');
    const cancelBtn = document.getElementById('unsavedCancelBtn');

    if (!modal) {
        // Fallback if modal not found
        if (confirm(`Save changes to ${tab.name}?`)) {
            onSave();
        } else {
            if (confirm(`Discard changes to ${tab.name}?`)) {
                onDontSave();
            }
        }
        return;
    }

    msg.textContent = `Do you want to save the changes you made to ${tab.name}?`;
    modal.style.display = 'block';

    const cleanup = () => {
        modal.style.display = 'none';
        saveBtn.onclick = null;
        dontSaveBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    saveBtn.onclick = () => {
        cleanup();
        onSave();
    };

    dontSaveBtn.onclick = () => {
        cleanup();
        onDontSave();
    };

    cancelBtn.onclick = () => {
        cleanup();
    };
}

export function activateTab(id) {
    if (activeTabId === id) return Promise.resolve();

    // Save state of current tab
    if (activeTabId) {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) {
            // Save to specific content slot based on mode
            const currentVal = editor.getValue();
            const currentViewState = editor.saveViewState();
            
            if (currentTab.isXsltViewMode) {
                currentTab.xsltContent = currentVal;
                currentTab.xsltViewState = currentViewState;
            } else {
                currentTab.xmlContent = currentVal; // Or just .content if we treat .content as "primary"
                currentTab.content = currentVal; // Keep .content as "current active content" for simplicity?
                // Actually, let's use .content as "current active content" to avoid breaking other things
                // But we also need to back it up to xmlContent/xsltContent when switching
                currentTab.xmlViewState = currentViewState;
            }
            currentTab.viewState = currentViewState;
            currentTab.content = currentVal;
        }
    }

    activeTabId = id;
    saveTabsState();
    const tab = tabs.find(t => t.id === id);
    if (!tab) return Promise.resolve();

    isLoading = true;
    
    // Determine what content to load
    let contentToLoad = tab.content;
    let viewStateToLoad = tab.viewState;

    if (tab.isXsltViewMode) {
        // If we are in XSLT mode, ensure we have XSLT content
        if (tab.xsltContent === null) {
            // Should have been loaded when toggled. 
            // If not, maybe we need to load it now?
            // But activateTab is sync-ish (except for this fetch).
            // Let's assume toggle handles loading.
            // If we are activating a tab that was already in XSLT mode, xsltContent should be there.
            contentToLoad = tab.xsltContent || '';
            viewStateToLoad = tab.xsltViewState;
        } else {
            contentToLoad = tab.xsltContent;
            viewStateToLoad = tab.xsltViewState;
        }
    } else {
        // XML Mode
        // If we have xmlContent backed up, use it. Else use tab.content (initial load)
        if (tab.xmlContent !== null) {
            contentToLoad = tab.xmlContent;
            viewStateToLoad = tab.xmlViewState;
        } else {
            contentToLoad = tab.content;
            viewStateToLoad = tab.viewState;
        }
    }

    // Detach Base64 (if not already detached in storage - we store detached in memory usually)
    // Wait, loadFileContent returns RAW. openFile stores RAW in tab.content.
    // So initial load needs detach.
    // But subsequent saves to tab.content (from editor.getValue) are DETACHED.
    // We need to know if content is raw or detached.
    // Let's assume: tab.content (and xmlContent/xsltContent) is DETACHED if it came from editor.
    // If it came from loadFileContent, it is RAW (Attached).
    
    // We can check for base64 markers? Or just always detach. Detach is idempotent if already detached?
    // No, detach replaces base64 strings. If already replaced, it does nothing.
    // But if we have markers, detach might mess up?
    // `detachBase64` looks for `data:image...`. If we have markers `<!-- BASE64... -->`, it ignores them.
    // So it's safe to call detach.
    
    const processed = detachBase64(contentToLoad);
    editor.setValue(processed);
    
    if (viewStateToLoad) {
        editor.restoreViewState(viewStateToLoad);
    } else {
        editor.setScrollTop(0);
    }
    
    // Enforce indentation
    const indentSelect = document.getElementById('indent-select');
    if (indentSelect) {
        const val = parseInt(indentSelect.value);
        editor.getModel().updateOptions({ tabSize: val, indentSize: val });
    }

    isLoading = false;
    renderTabs();
    updateBreadcrumb();
    updatePreview();
    
    if (xsltSwitcher && tab.path.endsWith('.xml') && !tab.isXsltViewMode) {
        xsltSwitcher.setCurrentPath(tab.path);
    } else if (xsltSwitcher) {
        xsltSwitcher.setCurrentPath(null);
    }

    // Sync Explorer
    const visiblePath = tab.isXsltViewMode ? tab.linkedXsltPath : tab.path;
    if (window.FileExplorer && window.FileExplorer.revealFile && visiblePath) {
        window.FileExplorer.revealFile(visiblePath);
    }

    return Promise.resolve();
}

export function toggleXsltView(tabId, forceState) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !tab.linkedXsltPath) return;

    const newState = forceState !== undefined ? forceState : !tab.isXsltViewMode;
    if (tab.isXsltViewMode === newState) return;

    // Save current state before switching
    const currentVal = editor.getValue();
    const currentViewState = editor.saveViewState();

    if (tab.isXsltViewMode) {
        // Switching FROM XSLT TO XML
        tab.xsltContent = currentVal;
        tab.xsltViewState = currentViewState;
    } else {
        // Switching FROM XML TO XSLT
        tab.xmlContent = currentVal;
        tab.xmlViewState = currentViewState;
        tab.content = currentVal; // Update main content pointer too?
    }

    tab.isXsltViewMode = newState;
    saveTabsState();

    if (newState) {
        // Switching TO XSLT
        // Check if we have XSLT content
        if (tab.xsltContent === null) {
            // Load it
            isLoading = true;
            loadFileContent(tab.linkedXsltPath).then(content => {
                tab.xsltContent = content; // Raw
                const processed = detachBase64(content);
                editor.setValue(processed);
                editor.setScrollTop(0);
                isLoading = false;
                renderTabs();
                updateBreadcrumb();
                updatePreview();
            });
        } else {
            const processed = detachBase64(tab.xsltContent);
            editor.setValue(processed);
            if (tab.xsltViewState) editor.restoreViewState(tab.xsltViewState);
            else editor.setScrollTop(0);
            renderTabs();
            updateBreadcrumb();
            updatePreview();
        }
    } else {
        // Switching TO XML
        const content = tab.xmlContent !== null ? tab.xmlContent : tab.content;
        const processed = detachBase64(content);
        editor.setValue(processed);
        if (tab.xmlViewState) editor.restoreViewState(tab.xmlViewState);
        else editor.setScrollTop(0);
        renderTabs();
        updateBreadcrumb();
        updatePreview();
    }
}

function renderTabs() {
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';
    
    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = `editor-tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isPreview ? 'preview' : ''} ${tab.linkedXsltPath ? 'has-xslt' : ''} ${tab.isXsltViewMode ? 'xslt-mode' : ''}`;
        el.title = tab.isXsltViewMode ? tab.linkedXsltPath : tab.path;
        el.onclick = (e) => {
            // If clicking toggle, don't activate?
            // Actually we want to activate AND toggle if needed.
            // But toggle button has its own handler.
            activateTab(tab.id);
        };
        el.ondblclick = (e) => {
            e.stopPropagation();
            if (tab.isPreview) {
                tab.isPreview = false;
                saveTabsState();
                renderTabs();
            }
        };
        
        const label = document.createElement('span');
        label.className = 'tab-label';
        label.textContent = tab.name + (tab.isDirty ? ' ●' : '');
        
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'tab-xslt-toggle';
        toggleBtn.textContent = 'XSLT';
        toggleBtn.title = 'Toggle XSLT View';
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            activateTab(tab.id).then(() => {
                toggleXsltView(tab.id);
            });
        };

        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = (e) => closeTab(tab.id, e);
        
        el.appendChild(label);
        if (tab.linkedXsltPath) el.appendChild(toggleBtn);
        el.appendChild(closeBtn);
        tabsContainer.appendChild(el);
    });
}

function updateBreadcrumb() {
    if (!editorBreadcrumb) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) {
        editorBreadcrumb.textContent = '';
        return;
    }
    editorBreadcrumb.textContent = tab.isXsltViewMode ? tab.linkedXsltPath : tab.path;
}

function updatePreview() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    // Update Preview Header
    const previewHeader = document.querySelector('.path-info strong');
    if (previewHeader) {
        previewHeader.textContent = tab.path;
    }

    const currentEditorValue = attachBase64(editor.getValue());
    
    // Determine XML and XSLT content
    let xmlContentPromise = Promise.resolve(null);
    let xsltContentPromise = Promise.resolve(null);
    let baseUrl = tab.path;

    if (tab.isXsltViewMode) {
        // Editing XSLT
        // XSLT is in editor
        xsltContentPromise = Promise.resolve(currentEditorValue);
        
        // XML is in tab.xmlContent (if loaded) or needs fetch
        if (tab.xmlContent) {
            xmlContentPromise = Promise.resolve(attachBase64(tab.xmlContent));
        } else {
            // Fetch XML content
             xmlContentPromise = loadFileContent(tab.path).then(content => attachBase64(content));
        }
    } else {
        // Editing XML
        // XML is in editor
        xmlContentPromise = Promise.resolve(currentEditorValue);
        
        // XSLT is in tab.xsltContent (if loaded) or tab.linkedXsltPath
        if (tab.xsltContent) {
            xsltContentPromise = Promise.resolve(attachBase64(tab.xsltContent));
        } else if (tab.linkedXsltPath) {
            xsltContentPromise = loadFileContent(tab.linkedXsltPath).then(content => attachBase64(content));
        }
    }

    Promise.all([xmlContentPromise, xsltContentPromise]).then(([xml, xslt]) => {
        if (xml && xslt) {
            // Calculate Base URL
            let base = baseUrl.replace(/\\/g, '/');
            const lastSlash = base.lastIndexOf('/');
            if (lastSlash !== -1) base = '/' + base.substring(0, lastSlash + 1);
            else base = '/';
            if (base.startsWith('//')) base = base.substring(1);

            // Pass xsltPath if available (for resolving imports)
            const xsltPath = tab.linkedXsltPath || '';
            renderClientSide(xml, xslt, base, xsltPath);
        } else {
            console.log("Missing XML or XSLT content for preview.");
            // Clear the preview or show a message
            const iframe = document.getElementById('viewer');
            if (iframe) {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                doc.open();
                doc.write(`
                    <html>
                    <body style="font-family: sans-serif; color: #666; text-align: center; padding-top: 20px;">
                        <h3>No Preview Available</h3>
                        <p>${!xml ? 'No XML content.' : 'No XSLT linked or selected.'}</p>
                    </body>
                    </html>
                `);
                doc.close();
            }
        }
    }).catch(err => {
        console.error("Error preparing preview:", err);
    });
}

function toggleTheme() {
    currentTheme = currentTheme === 'vs-dark' ? 'vs-light' : 'vs-dark';
    if (editor) monaco.editor.setTheme(currentTheme);
    localStorage.setItem('monaco-theme', currentTheme);
    updateThemeButton();
}

function updateThemeButton() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    
    // Update body class for CSS variables
    document.body.classList.remove('vs-light', 'vs-dark');
    document.body.classList.add(currentTheme);

    if (currentTheme === 'vs-dark') {
        btn.textContent = '☀️ Light Theme';
        btn.style.background = '#f0f0f0';
        btn.style.color = '#333';
    } else {
        btn.textContent = '🌙 Dark Theme';
        btn.style.background = '#333';
        btn.style.color = '#fff';
    }
}

export function formatCurrentFile() {
    if (!editor || !activeTabId) return;
    const content = editor.getValue();
    if (!content.trim()) return;

    const btn = document.getElementById('formatBtn');
    const originalText = btn ? btn.innerText : 'Format';
    if (btn) {
        btn.innerText = 'Formatting...';
        btn.disabled = true;
    }

    const indentSelect = document.getElementById('indent-select');
    const indentSize = indentSelect ? parseInt(indentSelect.value) : 4;

    // Client-side formatting using a simple XML formatter or library
    // Since we don't have a library loaded, let's use a basic indentation function
    // or assume the user will add one. For now, let's try a simple regex-based one
    // or just alert that it's not fully supported without a library.
    // Ideally, we should import 'xml-formatter' from CDN.
    
    // Use xml-formatter for strict XML/XSLT formatting that ensures proper nesting
    import('https://cdn.skypack.dev/xml-formatter').then(module => {
        const format = module.default;
        try {
            const formatted = format(content, {
                indentation: ' '.repeat(indentSize),
                collapseContent: true, 
                lineSeparator: '\n',
                whiteSpaceAtEndOfSelfclosingTag: true,
                // Only ignore strictly content-sensitive tags where NO formatting should touch strict text.
                // We ALLOW formatting of div, span, table etc. to ensure Vertical Alignment.
                // The logical layout whitespace will be handled by the Preview renderer (stripping whitespace).
                ignoredPaths: [
                     'xsl:text', // Keep xsl:text strict
                     'script', 'style', 'pre', 'textarea'
                ]
            });
            
            const scrollPosition = editor.getScrollTop();
            const position = editor.getPosition();
            
            const processedFormatted = detachBase64(formatted);
            
            editor.setValue(processedFormatted);
            editor.setScrollTop(scrollPosition);
            editor.setPosition(position);
        } catch (err) {
            alert('Formatting error: ' + err.message);
        }
    }).catch(err => {
        console.warn("xml-formatter not found", err);
        // Fallback or alert
        alert("Formatting library could not be loaded.");
    }).finally(() => {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

export function saveCurrentFile() {
    if (!activeTabId) return Promise.resolve();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return Promise.resolve();
    
    const content = editor.getValue();
    // Re-attach Base64 strings before saving
    const finalContent = attachBase64(content);
    
    const savePath = tab.isXsltViewMode ? tab.linkedXsltPath : tab.path;

    return new Promise((resolve, reject) => {
        try {
            vfs.writeFile(savePath, finalContent);
            tab.isDirty = false;
            
            // Update stored content
            if (tab.isXsltViewMode) {
                tab.xsltContent = content;
            } else {
                tab.xmlContent = content;
                tab.content = content;
            }
            
            renderTabs();
            updatePreview();
            resolve();
        } catch (e) {
            alert('Error saving file: ' + e);
            reject(e);
        }
    });
}

export function revealLine(lineNumber) {
    if (!editor) return;
    
    editor.revealLineInCenter(lineNumber);
    editor.setPosition({ lineNumber: lineNumber, column: 1 });
    editor.focus();
    
    const decorations = editor.deltaDecorations([], [
        {
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: {
                isWholeLine: true,
                className: 'lineHighlight'
            }
        }
    ]);
    
    setTimeout(() => {
        editor.deltaDecorations(decorations, []);
    }, 1500);
}

export function setEditorMarkers(markers) {
    if (!editor) return;
    const model = editor.getModel();
    if (model) {
        monaco.editor.setModelMarkers(model, 'xslt-server', markers);
    }
}

