import { getFilterStorageKey, getServerCurrentPath } from './utils.js';
import { openFile } from './editor.js';
import { vfs } from './vfs.js';

export const FileExplorer = {
    currentPath: '', // Client-side root is empty string
    files: [],
    selectedFiles: new Set(),
    activePreviewPath: null,
    clipboard: { action: null, items: [] },
    lastSelected: null,
    fileListEl: null,
    contextMenu: null,

    init() {
        this.fileListEl = document.getElementById('fileList');
        this.contextMenu = document.getElementById('contextMenu');
        
        if (!this.fileListEl) return;

        // Check for hash path to prevent overwriting it with root
        if (location.hash && location.hash.length > 1) {
             const hashPath = decodeURIComponent(location.hash.substring(2));
             if (hashPath) {
                 this.currentPath = hashPath;
             }
        }

        // Initial Load
        this.loadDirectory(this.currentPath);

        // Open initial file if requested (Not applicable in pure client mode usually, unless URL param)
        // if (window.SERVER_DATA && window.SERVER_DATA.initialFile) { ... }
        
        // Event Listeners
        this.fileListEl.addEventListener('click', this.handleItemClick.bind(this));
        
        // Breadcrumb navigation
        const breadcrumbNav = document.querySelector('.breadcrumb');
        if (breadcrumbNav) {
            breadcrumbNav.addEventListener('click', (e) => {
                const link = e.target.closest('.breadcrumb-link');
                if (link) {
                    e.preventDefault();
                    const path = link.dataset.path;
                    this.loadDirectory(path);
                }
                // Handle "Up" button
                const upBtn = e.target.closest('#breadcrumb-up');
                if (upBtn) {
                    e.preventDefault();
                    if (!this.currentPath) return;
                    const parts = this.currentPath.split('/');
                    parts.pop();
                    const parentPath = parts.join('/');
                    this.loadDirectory(parentPath);
                }
            });
        }

        // Handle browser back/forward
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.path !== undefined) {
                this.loadDirectory(event.state.path);
            } else {
                // Fallback to parsing URL
                let path = window.location.pathname;
                if (path.startsWith('/view')) {
                    path = path.substring(5);
                }
                if (path.startsWith('/')) {
                    path = path.substring(1);
                }
                this.loadDirectory(path);
            }
        });

        this.fileListEl.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        document.addEventListener('click', this.hideContextMenu.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Context Menu Actions
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn.bind(this);
        };
        
        bind('ctx-open', this.openSelected);
        bind('ctx-refresh', this.refresh);
        bind('ctx-new-folder', this.createNewFolder);
        bind('ctx-copy', this.copySelected);
        bind('ctx-cut', this.cutSelected);
        bind('ctx-paste', this.pasteToCurrent);
        bind('ctx-duplicate', this.duplicateSelected);
        bind('ctx-rename', this.renameSelected);
        bind('ctx-delete', this.deleteSelected);
        bind('ctx-download', this.downloadSelected);

        this.initZipUpload();
        this.initGlobalDragDrop();
        
        // Storage Status
        this.updateStorageStatus(vfs.getSize());
        window.addEventListener('vfs-change', (e) => {
            this.updateStorageStatus(e.detail.size);
        });
        
        // Filter Logic
        const input = document.getElementById('filterInput');
        const clearBtn = document.getElementById('filterClear');
        const sortBtn = document.getElementById('sortBtn');

        if (sortBtn) {
            sortBtn.addEventListener('click', function() {
                const currentSort = window.SERVER_DATA.sortOrder;
                const newSort = currentSort === 'asc' ? 'desc' : 'asc';
                const url = new URL(window.location.href);
                url.searchParams.set('sort', newSort);
                window.location.href = url.toString();
            });
        }

        const savedFilter = localStorage.getItem(getFilterStorageKey());
        if (savedFilter && input) {
            input.value = savedFilter;
        }
        
        if (input) {
            input.addEventListener('input', () => { 
                this.filterFiles(); 
                this.updateClearVisibility(); 
            });
            this.filterFiles(); // Apply initial
            this.updateClearVisibility();
        }
        
        if (clearBtn && input) {
            clearBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                input.value = '';
                this.filterFiles();
                localStorage.removeItem(getFilterStorageKey());
                input.focus();
                this.updateClearVisibility();
            });
        }
        
        // Handle file links in list (prevent default nav for files)
        this.fileListEl.addEventListener('click', (e) => {
            const a = e.target.closest('a');
            if (!a) return;
            // Prevent default navigation, let handleItemClick handle it
            e.preventDefault();
        });
        
        // Double click to open
        this.fileListEl.addEventListener('dblclick', (e) => {
            const li = e.target.closest('li');
            if (li) this.openSelected();
        });
    },

    loadDirectory(path) {
        const sort = (window.SERVER_DATA && window.SERVER_DATA.sortOrder) ? window.SERVER_DATA.sortOrder : 'asc';
        
        // Update URL without reloading
        const url = new URL(window.location.href);
        const newUrl = path ? `/#/${path}` : '/#/';
        // Only push if changed
        if (window.location.hash !== `#/${path}`) {
             window.history.pushState({ path: path }, '', newUrl);
        }

        try {
            const files = vfs.listFiles(path);
            this.currentPath = path;
            this.files = files;
            
            // Restore filter for the new path
            const input = document.getElementById('filterInput');
            if (input) {
                const savedFilter = localStorage.getItem(getFilterStorageKey());
                input.value = savedFilter || '';
                this.updateClearVisibility();
            }

            this.render();
            this.updateBreadcrumb();
        } catch (err) {
            console.error('Load dir error:', err);
        }
    },

    refresh() {
        this.loadDirectory(this.currentPath);
    },

    render() {
        this.fileListEl.innerHTML = '';
        this.selectedFiles.clear();
        
        const emptyState = document.getElementById('emptyState');
        const hasFiles = this.files && this.files.length > 0;

        if (emptyState) {
            emptyState.style.display = hasFiles ? 'none' : 'block';
        }
        this.fileListEl.style.display = hasFiles ? 'block' : 'none';

        if (!hasFiles) return;

        this.files.forEach(file => {
            if (file.type !== 'dir' && !file.name.toLowerCase().endsWith('.xml') && !file.name.toLowerCase().endsWith('.xslt')) {
                return;
            }

            const li = document.createElement('li');
            li.dataset.name = file.name;
            li.dataset.path = file.path;
            li.dataset.type = file.type;
            
            const icon = document.createElement('span');
            if (file.type === 'dir') icon.className = 'dir-icon';
            else if (file.name.endsWith('.xslt')) icon.className = 'file-icon-xslt';
            else icon.className = 'file-icon';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = file.name;
            
            li.appendChild(icon);
            li.appendChild(nameSpan);

            if (file.linkedXslt) {
                const linkSpan = document.createElement('span');
                linkSpan.className = 'linked-xslt';
                if (file.linkedXsltExists) {
                    linkSpan.classList.add('valid');
                    linkSpan.title = `Linked XSLT: ${file.linkedXslt}`;
                } else {
                    linkSpan.classList.add('missing');
                    linkSpan.title = `Linked XSLT not found: ${file.linkedXslt}`;
                }
                linkSpan.textContent = ` → ${file.linkedXslt}`;
                li.appendChild(linkSpan);
            }
            
            this.fileListEl.appendChild(li);
        });
        
        this.filterFiles();
        this.updateHighlights();
    },
    
    filterFiles() {
        const input = document.getElementById('filterInput');
        if (!input) return;
        const filter = (input.value || '').toLowerCase();
        const li = this.fileListEl.getElementsByTagName('li');

        for (let i = 0; i < li.length; i++) {
            const name = li[i].getAttribute('data-name') || '';
            let visible = true;
            if (name.toLowerCase().indexOf(filter) === -1) visible = false;
            li[i].style.display = visible ? '' : 'none';
        }
        localStorage.setItem(getFilterStorageKey(), input.value);
    },
    
    updateClearVisibility() {
        const input = document.getElementById('filterInput');
        const clearBtn = document.getElementById('filterClear');
        if (input && clearBtn) {
            clearBtn.style.display = (input.value && input.value.length > 0) ? 'block' : 'none';
        }
    },
    
    updateBreadcrumb() {
        const breadcrumbNav = document.querySelector('.breadcrumb');
        if (!breadcrumbNav) return;
        
        const backIcon = `<svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12.6128 19.6588C12.2328 19.6588 11.8516 19.5206 11.551 19.2419L5.21096 13.3619C5.05194 13.2144 4.92536 13.0355 4.83928 12.8364C4.7532 12.6373 4.7095 12.4225 4.71097 12.2056C4.71244 11.9888 4.75905 11.7746 4.84782 11.5767C4.93659 11.3788 5.06558 11.2016 5.22659 11.0563L11.7403 5.17627C12.381 4.59815 13.3691 4.64877 13.9472 5.2894C14.5253 5.93002 14.4747 6.91815 13.8341 7.49627L8.58784 12.2319L13.6753 16.9506C14.3078 17.5375 14.3453 18.5263 13.7585 19.1588C13.451 19.4906 13.0322 19.6588 12.6128 19.6588Z" fill="currentColor"/>
<path d="M19.0327 27.2256H6.25391C5.39078 27.2256 4.69141 26.5263 4.69141 25.6631C4.69141 24.8 5.39078 24.1006 6.25391 24.1006H19.0327C21.8714 24.1006 24.1808 21.7913 24.1808 18.9525C24.1808 16.1138 21.8714 13.8044 19.0327 13.8044H6.25391C5.39078 13.8044 4.69141 13.105 4.69141 12.2419C4.69141 11.3788 5.39078 10.6794 6.25391 10.6794H19.0327C23.5945 10.6794 27.3058 14.3906 27.3058 18.9525C27.3058 23.5144 23.5945 27.2256 19.0327 27.2256Z" fill="currentColor"/>
</svg>`;

        const homeIcon = `<svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M29.8661 16.8838C30.3543 17.3719 31.1456 17.3719 31.6337 16.8838C32.1218 16.3956 32.1218 15.6043 31.6337 15.1162L16.8837 0.366184C16.3956 -0.121957 15.6043 -0.121928 15.1161 0.366184L0.366117 15.1162C-0.122039 15.6043 -0.122039 16.3956 0.366117 16.8838C0.854272 17.3719 1.64554 17.3719 2.13369 16.8838L15.9999 3.01755L29.8661 16.8838Z" fill="currentColor"/>
<path d="M27.04 13.5419V29.4999H4.95703V13.5419C4.95703 12.8516 4.39739 12.2919 3.70703 12.2919C3.01668 12.2919 2.45703 12.8516 2.45703 13.5419V30.7499C2.45703 31.4403 3.01668 31.9999 3.70703 31.9999H28.29C28.9804 31.9999 29.54 31.4403 29.54 30.7499V13.5419C29.54 12.8516 28.9804 12.2919 28.29 12.2919C27.5998 12.2921 27.04 12.8517 27.04 13.5419Z" fill="currentColor"/>
<path d="M9.83203 30.7499C9.83203 31.4403 10.3917 31.9999 11.082 31.9999C11.7724 31.9999 12.332 31.4403 12.332 30.7499V22.1669H19.665V30.7499C19.665 31.4402 20.2248 31.9998 20.915 31.9999C21.6054 31.9999 22.165 31.4403 22.165 30.7499V20.9169C22.165 20.2266 21.6054 19.6669 20.915 19.6669H11.082C10.3917 19.6669 9.83203 20.2266 9.83203 20.9169V30.7499Z" fill="currentColor"/>
</svg>`;

        // Update the main breadcrumb container
        // We need to update the parent nav element to include the back button and home icon if they are missing
        // But the HTML structure has changed.
        // Let's just update the innerHTML of the nav.breadcrumb
        
        let html = `<a href="javascript:void(0)" id="breadcrumb-up" title="Go back">${backIcon}</a> `;
        html += `<a href="javascript:void(0)" class="breadcrumb-link" data-path="">${homeIcon}</a> <span class="sep">/</span> `;
        
        if (this.currentPath) {
            const parts = this.currentPath.split('/');
            parts.forEach((part, i) => {
                if (!part) return;
                const partial = parts.slice(0, i + 1).join('/');
                if (i === parts.length - 1) {
                    html += `<span class="current">${part}</span>`;
                } else {
                    html += `<a href="javascript:void(0)" class="breadcrumb-link" data-path="${partial}">${part}</a> <span class="sep">/</span> `;
                }
            });
        }
        breadcrumbNav.innerHTML = html;
    },

    handleItemClick(e) {
        const li = e.target.closest('li');
        if (!li) {
            if (!e.ctrlKey && !e.shiftKey) this.clearSelection();
            return;
        }

        const name = li.dataset.name;
        const type = li.dataset.type;
        const path = li.dataset.path;
        const isLinkClick = e.target.tagName === 'SPAN' || e.target.tagName === 'A';

        if (e.ctrlKey) {
            if (this.selectedFiles.has(name)) {
                this.selectedFiles.delete(name);
                li.classList.remove('selected');
            } else {
                this.selectedFiles.add(name);
                li.classList.add('selected');
                this.lastSelected = li;
            }
        } else if (e.shiftKey && this.lastSelected) {
            const all = Array.from(this.fileListEl.children);
            const start = all.indexOf(this.lastSelected);
            const end = all.indexOf(li);
            const [min, max] = [Math.min(start, end), Math.max(start, end)];
            
            this.clearSelection();
            for (let i = min; i <= max; i++) {
                const item = all[i];
                if (item.style.display !== 'none') {
                    this.selectedFiles.add(item.dataset.name);
                    item.classList.add('selected');
                }
            }
        } else {
            this.clearSelection();
            this.selectedFiles.add(name);
            li.classList.add('selected');
            this.lastSelected = li;
            
            if (isLinkClick) {
                if (type === 'dir') {
                    this.loadDirectory(path);
                } else {
                    // Single click opens in preview mode
                    openFile(path, true);
                    this.activePreviewPath = path;
                }
            }
        }
        this.updateHighlights();
    },
    
    previewFile(path) {
        // Deprecated, use openFile directly
        openFile(path, true);
    },

    revealFile(path) {
        if (!path) return;
        const parts = path.split('/');
        // Extract folder path
        parts.pop(); // Remove filename
        const parentPath = parts.join('/');

        // Set active preview path so updating highlights selects the correct file
        this.activePreviewPath = path;

        // If we represent root as empty string
        const targetDir = parentPath || '';

        // Only reload if we are not already in that folder
        if (this.currentPath !== targetDir) {
            this.loadDirectory(targetDir);
        } else {
             this.updateHighlights();
        }
        
        // Scroll to element and sync selection
        setTimeout(() => {
             const name = path.split('/').pop();
             this.clearSelection();
             this.selectedFiles.add(name);

             const li = Array.from(this.fileListEl.children).find(el => el.dataset.path === path);
             if (li) {
                 li.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                 li.classList.add('selected');
                 this.lastSelected = li;
             }
        }, 50);
    },

    clearSelection() {
        this.selectedFiles.clear();
        Array.from(this.fileListEl.children).forEach(li => {
            li.classList.remove('selected');
            li.classList.remove('linked-selected');
        });
    },

    updateHighlights() {
        Array.from(this.fileListEl.children).forEach(li => {
            li.classList.remove('linked-selected');
            li.classList.remove('preview-active');
        });

        if (!this.activePreviewPath) return;

        // Highlight Active Preview File
        // Note: activePreviewPath is full relative path (e.g. "folder/file.xml")
        // But li.dataset.path is also full relative path.
        const activeLi = Array.from(this.fileListEl.children).find(el => el.dataset.path === this.activePreviewPath);
        if (activeLi) {
            activeLi.classList.add('preview-active');
        }

        // Highlight Linked XSLT
        // We need to find the file object for the active preview path to get its linkedXslt
        // The file list might be filtered or inside a subdir, but 'this.files' contains current dir files.
        // If activePreviewPath is in current dir, we can find it.
        
        // Check if activePreviewPath is in current directory view
        // this.files contains items in this.currentPath
        // activePreviewPath might be "folder/file.xml" and currentPath might be "folder"
        // So we check if activePreviewPath matches any file.path
        
        const activeFile = this.files.find(f => f.path === this.activePreviewPath);
        
        if (activeFile && activeFile.linkedXslt) {
            let targetName = activeFile.linkedXslt;
            if (targetName.startsWith('./')) targetName = targetName.substring(2);
            
            if (!targetName.includes('/') && !targetName.includes('\\')) {
                    const targetLi = Array.from(this.fileListEl.children).find(el => el.dataset.name === targetName);
                    if (targetLi) {
                        targetLi.classList.add('linked-selected');
                    }
            }
        }
    },

    handleContextMenu(e) {
        e.preventDefault();
        const li = e.target.closest('li');
        
        if (li) {
            const name = li.dataset.name;
            if (!this.selectedFiles.has(name)) {
                this.clearSelection();
                this.selectedFiles.add(name);
                li.classList.add('selected');
                this.lastSelected = li;
                this.updateLinkedHighlights();
            }
        }
        
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.left = `${e.pageX}px`;
        this.contextMenu.style.top = `${e.pageY}px`;
        
        const pasteBtn = document.getElementById('ctx-paste');
        if (this.clipboard.items.length > 0) pasteBtn.classList.remove('disabled');
        else pasteBtn.classList.add('disabled');
        
        const hasSelection = this.selectedFiles.size > 0;
        ['ctx-open', 'ctx-copy', 'ctx-cut', 'ctx-rename', 'ctx-delete', 'ctx-download'].forEach(id => {
            const el = document.getElementById(id);
            if (hasSelection) el.classList.remove('disabled');
            else el.classList.add('disabled');
        });
        
        // New Folder is always enabled
        document.getElementById('ctx-new-folder').classList.remove('disabled');
        
        if (this.selectedFiles.size !== 1) {
            document.getElementById('ctx-rename').classList.add('disabled');
        }
    },

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
    },
    
    handleKeydown(e) {
        // Ignore if focus is in input or textarea (like Editor or Filter)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

        if (e.key === 'Delete') this.deleteSelected();
        if (e.ctrlKey && e.key === 'c') this.copySelected();
        if (e.ctrlKey && e.key === 'x') this.cutSelected();
        if (e.ctrlKey && e.key === 'v') this.pasteToCurrent();
    },

    openSelected() {
        if (this.selectedFiles.size !== 1) return;
        const name = Array.from(this.selectedFiles)[0];
        const li = Array.from(this.fileListEl.children).find(el => el.dataset.name === name);
        if (!li) return;
        
        const type = li.dataset.type;
        const path = li.dataset.path;
        
        if (type === 'dir') {
            this.loadDirectory(path);
        } else {
            // Double click opens permanently
            openFile(path, false);
        }
    },

    copySelected() {
        if (this.selectedFiles.size === 0) return;
        this.clipboard = {
            action: 'copy',
            items: Array.from(this.selectedFiles).map(name => `${this.currentPath}/${name}`)
        };
    },

    cutSelected() {
        if (this.selectedFiles.size === 0) return;
        this.clipboard = {
            action: 'cut',
            items: Array.from(this.selectedFiles).map(name => `${this.currentPath}/${name}`)
        };
        Array.from(this.fileListEl.children).forEach(li => {
            if (this.selectedFiles.has(li.dataset.name)) li.classList.add('cut-mode');
        });
    },

    pasteToCurrent() {
        if (this.clipboard.items.length === 0) return;
        
        try {
            const destPath = this.currentPath;
            const sources = this.clipboard.items;
            const action = this.clipboard.action;

            sources.forEach(sourcePath => {
                const fileName = sourcePath.split('/').pop();
                const destFilePath = destPath ? `${destPath}/${fileName}` : fileName;
                
                if (action === 'copy') {
                    vfs.copy(sourcePath, destFilePath);
                } else if (action === 'cut') {
                    vfs.move(sourcePath, destFilePath);
                }
            });

            this.loadDirectory(this.currentPath);
            if (action === 'cut') {
                this.clipboard = { action: null, items: [] };
            }
        } catch (err) {
            alert(err.message);
        }
    },

    duplicateSelected() {
        if (this.selectedFiles.size === 0) return;

        const currentFiles = new Set(this.files.map(f => f.name));

        this.selectedFiles.forEach(name => {
            const sourcePath = this.currentPath ? `${this.currentPath}/${name}` : name;
            
            // Determine base name and extension
            let baseName = name;
            let extension = '';
            const lastDotIndex = name.lastIndexOf('.');
            
            // Check if it's a directory
            const fileObj = this.files.find(f => f.name === name);
            const isDir = fileObj && fileObj.type === 'dir';

            if (!isDir && lastDotIndex > 0) {
                baseName = name.substring(0, lastDotIndex);
                extension = name.substring(lastDotIndex);
            }

            // Find next available suffix
            let counter = 1;
            let newName = `${baseName}_${counter}${extension}`;
            while (currentFiles.has(newName)) {
                counter++;
                newName = `${baseName}_${counter}${extension}`;
            }

            // Prompt user
            const inputName = prompt(`Duplicate "${name}" as:`, newName);
            if (!inputName) return; // Cancelled

            const destPath = this.currentPath ? `${this.currentPath}/${inputName}` : inputName;

            try {
                // Check if destination already exists (if user changed name to existing one)
                if (currentFiles.has(inputName)) {
                    if (!confirm(`"${inputName}" already exists. Overwrite?`)) return;
                }
                
                vfs.copy(sourcePath, destPath);
            } catch (err) {
                alert(`Failed to duplicate ${name}: ${err.message}`);
            }
        });

        this.loadDirectory(this.currentPath);
    },

    renameSelected() {
        if (this.selectedFiles.size !== 1) return;
        const name = Array.from(this.selectedFiles)[0];
        
        // Find the element to check type
        const li = Array.from(this.fileListEl.children).find(el => el.dataset.name === name);
        const isDir = li && li.dataset.type === 'dir';
        
        let baseName = name;
        let extension = '';
        
        if (!isDir) {
            const lastDotIndex = name.lastIndexOf('.');
            if (lastDotIndex > 0) {
                baseName = name.substring(0, lastDotIndex);
                extension = name.substring(lastDotIndex);
            }
        }

        const newBaseName = prompt("Enter new name:", baseName);
        
        if (newBaseName && newBaseName !== baseName) {
            const newName = isDir ? newBaseName : (newBaseName + extension);
            const oldPath = this.currentPath ? `${this.currentPath}/${name}` : name;
            
            try {
                vfs.rename(oldPath, newName);
                this.loadDirectory(this.currentPath);
            } catch (err) {
                alert(err.message);
            }
        }
    },

    deleteSelected() {
        if (this.selectedFiles.size === 0) return;
        if (!confirm(`Delete ${this.selectedFiles.size} items?`)) return;
        
        const paths = Array.from(this.selectedFiles).map(name => this.currentPath ? `${this.currentPath}/${name}` : name);
        
        try {
            paths.forEach(path => vfs.delete(path));
            this.loadDirectory(this.currentPath);
        } catch (err) {
            alert(err.message);
        }
    },
    
    downloadSelected() {
        if (this.selectedFiles.size === 0) return;
        const paths = Array.from(this.selectedFiles).map(name => this.currentPath ? `${this.currentPath}/${name}` : name);
        
        if (paths.length === 1 && !vfs.isDir(paths[0])) {
            // Single file download
            try {
                const path = paths[0];
                const mimeType = path.endsWith('.xml') || path.endsWith('.xslt') ? 'text/xml' : 'application/octet-stream';
                const blob = vfs.readFileAsBlob(path, mimeType);
                
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = path.split('/').pop();
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } catch (err) {
                alert(err.message);
            }
        } else {
            // Zip download
            if (!window.JSZip) {
                alert("JSZip not loaded");
                return;
            }
            const zip = new JSZip();
            
            const addFilesToZip = (zipFolder, pathList) => {
                pathList.forEach(path => {
                    const name = path.split('/').pop();
                    if (vfs.isDir(path)) {
                        const folder = zipFolder.folder(name);
                        const children = vfs.listFiles(path);
                        const childPaths = children.map(c => c.path);
                        addFilesToZip(folder, childPaths);
                    } else {
                        try {
                            // For text files, we might want to decode base64 if stored as such
                            // But readFileAsBlob handles it.
                            // However, JSZip expects content.
                            // If we use blob, JSZip handles it.
                            const blob = vfs.readFileAsBlob(path, 'application/octet-stream');
                            zipFolder.file(name, blob);
                        } catch (e) {
                            console.error("Failed to add file to zip", path, e);
                        }
                    }
                });
            };
            
            addFilesToZip(zip, paths);
            
            zip.generateAsync({type:"blob"}).then(function(content) {
                const url = window.URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = "download.zip";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            });
        }
    },

    initZipUpload() {
        const uploadBtn = document.getElementById('uploadBtn');
        const zipInput = document.getElementById('zipUploadInput');
        const modal = document.getElementById('zipModal');
        const cancelBtn = document.getElementById('zipCancelBtn');
        const okBtn = document.getElementById('zipOkBtn');
        const folderInput = document.getElementById('folderNameInput');
        const suggestionsList = document.getElementById('folderSuggestions');

        if (uploadBtn && zipInput) {
            uploadBtn.addEventListener('click', () => zipInput.click());
            zipInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleZipFile(e.target.files[0]);
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.pendingZipFile = null;
                if (zipInput) zipInput.value = '';
            });
        }

        if (okBtn) {
            okBtn.addEventListener('click', () => {
                const folderName = folderInput.value.trim();
                if (!folderName) {
                    alert('Please enter a folder name');
                    return;
                }
                this.uploadZip(this.pendingZipFile, folderName);
                modal.style.display = 'none';
                this.pendingZipFile = null;
                if (zipInput) zipInput.value = '';
            });
        }
        
        // Autocomplete
        if (folderInput && suggestionsList) {
            folderInput.addEventListener('input', () => {
                const val = folderInput.value.toLowerCase();
                suggestionsList.innerHTML = '';
                suggestionsList.style.display = 'none';
                if (!val) return;
                
                // Client-side folder search
                const folders = new Set();
                Object.keys(vfs.files).forEach(path => {
                    const parts = path.split('/');
                    // Add all parent directories
                    for (let i = 0; i < parts.length - 1; i++) {
                        folders.add(parts.slice(0, i + 1).join('/'));
                    }
                });
                
                const matches = Array.from(folders).filter(f => f.toLowerCase().includes(val));
                
                suggestionsList.innerHTML = '';
                if (matches.length > 0) {
                    matches.forEach(folder => {
                        const li = document.createElement('li');
                        li.textContent = folder;
                        li.onclick = () => {
                            folderInput.value = folder;
                            suggestionsList.innerHTML = '';
                            suggestionsList.style.display = 'none';
                        };
                        suggestionsList.appendChild(li);
                    });
                    suggestionsList.style.display = 'block';
                }
            });
            
            document.addEventListener('click', (e) => {
                if (e.target !== folderInput) {
                    suggestionsList.innerHTML = '';
                    suggestionsList.style.display = 'none';
                }
            });
        }
    },

    initGlobalDragDrop() {
        const overlay = document.getElementById('dropOverlay');
        let dragCounter = 0;

        if (!overlay) return;

        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            overlay.style.display = 'flex';
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                overlay.style.display = 'none';
            }
        });

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            overlay.style.display = 'none';
            
            // Ignore drops on the editor to prevent accidental uploads when trying to open/edit
            if (e.target.closest('#editor-container')) {
                return;
            }

            this.handleDrop(e);
        });
    },

    handleDrop(e) {
        const dt = e.dataTransfer;
        const items = dt.items;
        
        if (!items) return;

        // Check for single zip file drop
        if (items.length === 1) {
            const item = items[0].webkitGetAsEntry();
            if (item.isFile && item.name.toLowerCase().endsWith('.zip')) {
                item.file(file => {
                    this.handleZipFile(file);
                });
                return; 
            }
        }

        // Normal file/folder upload
        const queue = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if (item) {
                queue.push(this.traverseFileTree(item));
            }
        }

        Promise.all(queue).then(results => {
            const allFiles = results.flat();
            if (allFiles.length === 0) return;
            this.uploadFiles(allFiles);
        });
    },

    uploadFiles(files, options = {}) {
        const currentPath = this.currentPath || '';
        
        // Check conflicts if not forced
        if (!options.overwrite && !options.skip_existing) {
            const conflicts = [];
            files.forEach(f => {
                const fullPath = currentPath ? `${currentPath}/${f.path}` : f.path;
                try {
                    vfs.readFile(fullPath); // Will throw if not found
                    conflicts.push(f.path);
                } catch (e) {}
            });
            
            if (conflicts.length > 0) {
                this.handleUploadConflict(conflicts, (newOptions) => {
                    this.uploadFiles(files, newOptions);
                });
                return;
            }
        }

        const promises = files.map(f => {
            return new Promise((resolve, reject) => {
                const fullPath = currentPath ? `${currentPath}/${f.path}` : f.path;
                
                if (options.skip_existing) {
                    try {
                        vfs.readFile(fullPath);
                        resolve();
                        return;
                    } catch (e) {}
                }

                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    
                    // Ensure parent folders exist
                    const parts = fullPath.split('/');
                    parts.pop();
                    let cp = '';
                    parts.forEach(part => {
                        cp = cp ? `${cp}/${part}` : part;
                        try { vfs.createFolder(cp); } catch (e) {}
                    });
                    
                    try {
                        if (options.auto_rename) {
                            // Check if file exists and rename
                            let targetPath = fullPath;
                            let counter = 1;
                            const { parentPath, name } = vfs._getParentAndName(fullPath);
                            const extIndex = name.lastIndexOf('.');
                            const base = extIndex !== -1 ? name.substring(0, extIndex) : name;
                            const ext = extIndex !== -1 ? name.substring(extIndex) : '';
                            
                            while (true) {
                                try {
                                    vfs.readFile(targetPath);
                                    // Exists, try next
                                    targetPath = parentPath ? `${parentPath}/${base}_${counter}${ext}` : `${base}_${counter}${ext}`;
                                    counter++;
                                } catch (e) {
                                    // Not found, safe to use
                                    break;
                                }
                            }
                            vfs.writeFile(targetPath, base64, true);
                        } else {
                            vfs.writeFile(fullPath, base64, true);
                        }
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                };
                reader.readAsDataURL(f.file);
            });
        });
        
        Promise.all(promises).then(() => {
            this.loadDirectory(this.currentPath);
        }).catch(err => alert('Upload error: ' + err));
    },

    handleUploadConflict(conflicts, retryCallback) {
        const modal = document.getElementById('conflictModal');
        const list = document.getElementById('conflictList');
        const skipBtn = document.getElementById('conflictSkipBtn');
        const renameBtn = document.getElementById('conflictRenameBtn');
        const overwriteBtn = document.getElementById('conflictOverwriteBtn');
        
        if (!modal) {
            if (confirm('Files exist: ' + conflicts.join(', ') + '\nOverwrite?')) {
                retryCallback({ overwrite: true });
            }
            return;
        }

        list.innerHTML = '';
        conflicts.forEach(c => {
            const li = document.createElement('li');
            li.textContent = c;
            list.appendChild(li);
        });
        
        modal.style.display = 'block';
        
        const cleanup = () => {
            modal.style.display = 'none';
            skipBtn.onclick = null;
            renameBtn.onclick = null;
            overwriteBtn.onclick = null;
        };
        
        skipBtn.onclick = () => {
            cleanup();
            retryCallback({ skip_existing: true });
        };
        
        renameBtn.onclick = () => {
            cleanup();
            retryCallback({ auto_rename: true });
        };
        
        overwriteBtn.onclick = () => {
            cleanup();
            retryCallback({ overwrite: true });
        };
    },

    handleZipFile(file) {
        this.pendingZipFile = file;
        const modal = document.getElementById('zipModal');
        const folderInput = document.getElementById('folderNameInput');
        
        let proposedName = file.name.replace(/\.zip$/i, '');
        
        const setInputValue = (val) => {
            if (folderInput) {
                folderInput.value = val;
                folderInput.dispatchEvent(new Event('input'));
            }
        };

        if (window.JSZip) {
            window.JSZip.loadAsync(file).then(zip => {
                let foundXmlFile = null;
                for (let filename in zip.files) {
                    if (filename.toLowerCase().endsWith('.xml') && !filename.includes('/') && !filename.includes('\\')) {
                        foundXmlFile = zip.files[filename];
                        break;
                    }
                }
                if (!foundXmlFile) {
                    for (let filename in zip.files) {
                        if (filename.toLowerCase().endsWith('.xml')) {
                            foundXmlFile = zip.files[filename];
                            break;
                        }
                    }
                }
                
                if (foundXmlFile) {
                    foundXmlFile.async("string").then(content => {
                        let proposedName = "";
                        try {
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(content, "text/xml");
                            const nban = xmlDoc.getElementsByTagName("NBan");
                            if (nban.length > 0) {
                                const mst = nban[0].getElementsByTagName("MST");
                                if (mst.length > 0) {
                                    proposedName = mst[0].textContent.trim();
                                }
                            }
                        } catch (e) {
                            console.error("Error parsing XML:", e);
                        }

                        if (!proposedName) {
                            proposedName = this.getYYMMDD();
                        }
                        setInputValue(proposedName);
                        if (modal) modal.style.display = 'block';
                    });
                } else {
                    proposedName = this.getYYMMDD();
                    setInputValue(proposedName);
                    if (modal) modal.style.display = 'block';
                }
            }).catch(err => {
                console.error("Error reading zip:", err);
                setInputValue(this.getYYMMDD());
                if (modal) modal.style.display = 'block';
            });
        } else {
            setInputValue(proposedName);
            if (modal) modal.style.display = 'block';
        }
    },

    uploadZip(file, folderName, options = {}) {
        if (window.JSZip) {
            window.JSZip.loadAsync(file).then(zip => {
                vfs.importZip(zip, this.currentPath, folderName)
                    .then(() => {
                        this.loadDirectory(this.currentPath);
                    })
                    .catch(err => alert("Error extracting zip: " + err));
            });
        } else {
            alert("JSZip library not loaded");
        }
    },

    traverseFileTree(item, path = '') {
        return new Promise((resolve, reject) => {
            if (item.isFile) {
                item.file(file => {
                    const relativePath = item.fullPath.startsWith('/') ? item.fullPath.substring(1) : item.fullPath;
                    resolve([{ file: file, path: relativePath }]);
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                const entries = [];
                const readEntries = () => {
                    dirReader.readEntries(results => {
                        if (results.length) {
                            entries.push(...results);
                            readEntries();
                        } else {
                            const promises = entries.map(entry => this.traverseFileTree(entry));
                            Promise.all(promises).then(results => resolve(results.flat()));
                        }
                    });
                };
                readEntries();
            }
        });
    },

    getYYMMDD() {
        const d = new Date();
        const yy = d.getFullYear().toString().substr(-2);
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        return yy + mm + dd;
    },

    createNewFolder() {
        const name = prompt("Enter folder name:", "New Folder");
        if (!name) return;
        
        try {
            const fullPath = this.currentPath ? `${this.currentPath}/${name}` : name;
            vfs.createFolder(fullPath);
            this.loadDirectory(this.currentPath);
        } catch (err) {
            alert(err);
        }
    },

    updateStorageStatus(size) {
        const el = document.getElementById('vfs-size');
        const bar = document.getElementById('vfs-bar');
        if (!el || !bar) return;

        const limit = 5 * 1024 * 1024; // 5MB assumption
        const percent = Math.min(100, (size / limit) * 100);
        
        let sizeStr = '';
        if (size < 1024) sizeStr = size + ' B';
        else if (size < 1024 * 1024) sizeStr = (size / 1024).toFixed(1) + ' KB';
        else sizeStr = (size / (1024 * 1024)).toFixed(2) + ' MB';

        el.textContent = sizeStr;
        bar.style.width = `${percent}%`;
        
        if (percent > 90) bar.style.backgroundColor = '#f44336'; // Red
        else if (percent > 70) bar.style.backgroundColor = '#ff9800'; // Orange
        else bar.style.backgroundColor = '#2196f3'; // Blue
    },

};
