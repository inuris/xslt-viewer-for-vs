
// Virtual File System for Client-Side Only Mode
// Replaces server.py file operations

class VirtualFileSystem {
    constructor() {
        this.root = {}; // { "folder": { "file.xml": "content" } }
        this.currentPath = '';
        this.load();
    }

    save() {
        try {
            const json = JSON.stringify(this.root);
            
            // Compression Logic to "expand" storage limit
            let dataToStore = json;
            let isCompressed = false;
            
            if (window.LZString) {
                try {
                    const compressed = LZString.compressToUTF16(json);
                    // Check if compression actually helped (usually yes for JSON)
                    if (compressed.length < json.length) {
                        dataToStore = 'COMPRESSED:' + compressed;
                        isCompressed = true;
                    }
                } catch (e) {
                    console.warn("Compression failed, saving raw JSON", e);
                }
            }

            localStorage.setItem('vfs_root', dataToStore);
            this.notifyChange(json.length); // Notify logical size
            return true;
        } catch (e) {
            console.warn('Failed to save VFS to localStorage (quota exceeded?)', e);
            alert('Storage Quota Exceeded! Cannot save changes. (Approx 5MB-10MB limit reached)');
            this.load(); // Revert changes
            return false;
        }
    }

    notifyChange(size) {
        window.dispatchEvent(new CustomEvent('vfs-change', { detail: { size: size } }));
    }

    getSize() {
        return JSON.stringify(this.root).length;
    }

    load() {
        try {
            const saved = localStorage.getItem('vfs_root');
            if (saved) {
                if (saved.startsWith('COMPRESSED:') && window.LZString) {
                    const compressed = saved.substring(11); // Remove header
                    const decompressed = LZString.decompressFromUTF16(compressed);
                    if (decompressed) {
                         this.root = JSON.parse(decompressed);
                    } else {
                        console.error("Decompression failed");
                        this.root = {};
                    }
                } else {
                    // Fallback for legacy uncompressed data
                    try {
                        this.root = JSON.parse(saved);
                    } catch(e) {
                        // Might be compressed but missing header? Or corrupt.
                        // Try decompressing just in case legacy data isn't the issue
                        if (window.LZString) {
                            const retry = LZString.decompressFromUTF16(saved);
                            if (retry) {
                                this.root = JSON.parse(retry);
                            } else {
                                throw e;
                            }
                        } else {
                             throw e;
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load VFS', e);
        }
    }

    clear() {
        this.root = {};
        localStorage.removeItem('vfs_root');
        localStorage.removeItem('editor-tabs-state');
        localStorage.removeItem('monaco-theme');
        localStorage.removeItem('editor-indent');
        localStorage.removeItem('preview-zoom');
        localStorage.removeItem('layout-preference');
        localStorage.removeItem('sidebar-width');
        localStorage.removeItem('preview-height');
        localStorage.removeItem('preview-width');
    }

    get files() {
        const files = {};
        const traverse = (dir, path) => {
            Object.keys(dir).forEach(name => {
                const item = dir[name];
                const fullPath = path ? `${path}/${name}` : name;
                if (item && item.type === 'file') {
                    files[fullPath] = item.content;
                } else if (item && typeof item === 'object') {
                    traverse(item, fullPath);
                }
            });
        };
        traverse(this.root, '');
        return files;
    }

    // Helper to navigate to a specific folder object
    _resolvePath(path) {
        if (!path) return this.root; // Root path
        const parts = path.split('/').filter(p => p);
        let current = this.root;
        for (const part of parts) {
            if (!current[part]) {
                return null;
            }
            current = current[part];
        }
        return current;
    }

    // Helper to get parent folder and filename
    _getParentAndName(path) {
        const parts = path.split('/').filter(p => p);
        const name = parts.pop();
        const parentPath = parts.join('/');
        return { parentPath, name };
    }

    listFiles(path) {
        const dir = this._resolvePath(path);
        if (!dir || typeof dir !== 'object') return [];

        return Object.keys(dir).map(name => {
            const item = dir[name];
            const isDir = typeof item === 'object' && item !== null && item.type !== 'file';
            
            const fileObj = {
                name: name,
                type: isDir ? 'dir' : 'file',
                path: path ? `${path}/${name}` : name
            };

            // Check for linked XSLT in XML files
            if (!isDir && name.toLowerCase().endsWith('.xml')) {
                try {
                    // We need to read the content to find the link.
                    // Since it's in memory, this is cheap.
                    // But we should be careful if files are huge.
                    // The server read the first 2KB.
                    let content = item.content;
                    if (item.isBase64) {
                        // Decode first chunk only? 
                        // atob might fail on partial chunk.
                        // Let's just decode all for now, assuming files aren't massive.
                        // Or better, use the regex on the base64? No.
                        try {
                            content = atob(item.content);
                        } catch (e) {}
                    }
                    
                    const match = /<\?xml-stylesheet\s+[^>]*?href=['"]([^'"]+)['"][^>]*?\?>/i.exec(content.substring(0, 2048));
                    if (match) {
                        fileObj.linkedXslt = match[1];
                        // Check if it exists
                        // The href is relative to the XML file
                        // We need to resolve it.
                        // path is the folder path.
                        // If href is "style.xsl", full path is "path/style.xsl"
                        // If href is "../style.xsl", we need to resolve.
                        
                        // Simple resolution for now
                        // We can use a helper or just check simple cases
                        // Let's try to resolve it properly
                        const targetPath = this._resolveRelativePath(path, match[1]);
                        if (targetPath) {
                             // Check existence
                             try {
                                 this.readFile(targetPath);
                                 fileObj.linkedXsltExists = true;
                             } catch (e) {
                                 fileObj.linkedXsltExists = false;
                             }
                        }
                    }
                } catch (e) {
                    console.warn('Error checking linked XSLT', e);
                }
            }
            
            return fileObj;
        });
    }

    _resolveRelativePath(basePath, relativePath) {
        const stack = basePath.split('/').filter(p => p);
        const parts = relativePath.split('/');
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

    readFile(path) {
        const { parentPath, name } = this._getParentAndName(path);
        const dir = this._resolvePath(parentPath);
        if (dir && dir[name] && dir[name].type === 'file') {
            return dir[name].content;
        }
        throw new Error(`File not found: ${path}`);
    }

    writeFile(path, content, isBase64 = false) {
        const { parentPath, name } = this._getParentAndName(path);
        const dir = this._resolvePath(parentPath);
        if (dir) {
            dir[name] = { type: 'file', content: content, lastModified: Date.now(), isBase64: isBase64 };
            if (!this.save()) throw new Error("Save failed: Quota exceeded");
            return true;
        }
        throw new Error(`Directory not found: ${parentPath}`);
    }

    createFolder(path) {
        const { parentPath, name } = this._getParentAndName(path);
        const dir = this._resolvePath(parentPath);
        if (dir) {
            if (!dir[name]) {
                dir[name] = {}; // New folder is just an empty object
                if (!this.save()) throw new Error("Save failed: Quota exceeded");
            }
            return true;
        }
        throw new Error(`Parent directory not found: ${parentPath}`);
    }

    delete(path) {
        const { parentPath, name } = this._getParentAndName(path);
        const dir = this._resolvePath(parentPath);
        if (dir && dir[name]) {
            delete dir[name];
            if (!this.save()) throw new Error("Save failed: Quota exceeded");
            return true;
        }
        return false;
    }

    rename(oldPath, newName) {
        const { parentPath, name: oldName } = this._getParentAndName(oldPath);
        const dir = this._resolvePath(parentPath);
        if (dir && dir[oldName]) {
            dir[newName] = dir[oldName];
            delete dir[oldName];
            if (!this.save()) throw new Error("Save failed: Quota exceeded");
            return true;
        }
        return false;
    }
    
    // Import JSZip object into VFS
    async importZip(zip, targetPath, folderName) {
        // 1. Create the target folder
        const fullFolderPath = targetPath ? `${targetPath}/${folderName}` : folderName;
        this.createFolder(fullFolderPath);
        
        const targetDirObj = this._resolvePath(fullFolderPath);
        if (!targetDirObj) throw new Error("Failed to create target folder");

        // 2. Iterate files
        const files = [];
        zip.forEach((relativePath, zipEntry) => {
            files.push(zipEntry);
        });

        for (const entry of files) {
            if (entry.dir) {
                // Create subfolders
                // We need to handle nested paths like "sub/folder/"
                const parts = entry.name.split('/').filter(p => p);
                let current = targetDirObj;
                for (const part of parts) {
                    if (!current[part]) current[part] = {};
                    current = current[part];
                }
            } else {
                // It's a file
                // Use base64 for everything to handle images safely
                const content = await entry.async("base64");
                const parts = entry.name.split('/').filter(p => p);
                const fileName = parts.pop();
                
                // Navigate to the right folder
                let current = targetDirObj;
                for (const part of parts) {
                    if (!current[part]) current[part] = {};
                    current = current[part];
                }
                
                // Save file
                current[fileName] = {
                    type: 'file',
                    content: content, // Stored as base64
                    isBase64: true,
                    lastModified: entry.date
                };
            }
        }
        if (!this.save()) throw new Error("Save failed: Quota exceeded");
    }
    
    readFile(path) {
        const { parentPath, name } = this._getParentAndName(path);
        const dir = this._resolvePath(parentPath);
        if (dir && dir[name] && dir[name].type === 'file') {
            const file = dir[name];
            if (file.isBase64) {
                try {
                    const binaryString = atob(file.content);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    return new TextDecoder('utf-8').decode(bytes);
                } catch (e) {
                    console.warn("Failed to decode base64 content as UTF-8", e);
                    return atob(file.content);
                }
            }
            return file.content;
        }
        throw new Error(`File not found: ${path}`);
    }
    
    readFileAsBlob(path, mimeType) {
        const { parentPath, name } = this._getParentAndName(path);
        const dir = this._resolvePath(parentPath);
        if (dir && dir[name] && dir[name].type === 'file') {
            const file = dir[name];
            if (file.isBase64) {
                const byteCharacters = atob(file.content);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                return new Blob([byteArray], {type: mimeType});
            }
            return new Blob([file.content], {type: mimeType});
        }
        throw new Error(`File not found: ${path}`);
    }

    move(oldPath, newPath) {
        const { parentPath: oldParent, name: oldName } = this._getParentAndName(oldPath);
        const { parentPath: newParent, name: newName } = this._getParentAndName(newPath);
        
        const oldDir = this._resolvePath(oldParent);
        const newDir = this._resolvePath(newParent);
        
        if (oldDir && oldDir[oldName] && newDir) {
            newDir[newName] = oldDir[oldName];
            delete oldDir[oldName];
            if (!this.save()) throw new Error("Save failed: Quota exceeded");
            return true;
        }
        return false;
    }

    copy(oldPath, newPath) {
        const { parentPath: oldParent, name: oldName } = this._getParentAndName(oldPath);
        const { parentPath: newParent, name: newName } = this._getParentAndName(newPath);
        
        const oldDir = this._resolvePath(oldParent);
        const newDir = this._resolvePath(newParent);
        
        if (oldDir && oldDir[oldName] && newDir) {
            // Deep copy needed
            newDir[newName] = JSON.parse(JSON.stringify(oldDir[oldName]));
            if (!this.save()) throw new Error("Save failed: Quota exceeded");
            return true;
        }
        return false;
    }

    isDir(path) {
        const { parentPath, name } = this._getParentAndName(path);
        const dir = this._resolvePath(parentPath);
        if (dir && dir[name]) {
            return !dir[name].type; // If no type, it's a folder
        }
        return false;
    }
}

export const vfs = new VirtualFileSystem();
