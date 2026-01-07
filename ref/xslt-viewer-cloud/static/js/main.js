import { FileExplorer } from './modules/explorer.js';
import { initEditor, saveCurrentFile } from './modules/editor.js';
import { initPreview } from './modules/preview.js';
import { initLayout } from './modules/layout.js';
import { navigateToPath } from './modules/utils.js';
import { vfs } from './modules/vfs.js';

window.addEventListener('DOMContentLoaded', () => {
    // Initialize Modules
    FileExplorer.init();
    initEditor();
    initPreview();
    initLayout();
    
    // Clear Cache Button
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all files and reset the application? This cannot be undone.')) {
                vfs.clear();
                location.reload();
            }
        });
    }

    // Expose Globals for HTML interactions
    window.FileExplorer = FileExplorer;
    window.navigateToPath = function(path) {
        FileExplorer.loadDirectory(path);
    };
    window.saveCurrentFile = saveCurrentFile;

    // Global Shortcuts
    window.addEventListener('keydown', (e) => {
        // Ctrl+S: Save
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Global Ctrl+S intercepted (Capture)');
            saveCurrentFile();
        }
    }, true);
    
    // Handle Start Button in Empty State
    const startBtn = document.getElementById('firstRunStartBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            // Trigger upload zip
            const uploadBtn = document.getElementById('uploadBtn');
            if (uploadBtn) uploadBtn.click();
        });
    }
});

