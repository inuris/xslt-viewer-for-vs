import { getEditorInstance } from './editor.js';
import { FileExplorer } from './explorer.js';

export function initLayout() {
    // Layout Toggle Logic
    const layoutBtn = document.getElementById('layoutToggle');
    if (layoutBtn) {
        const savedLayout = localStorage.getItem('layout-preference');
        if (savedLayout === '3col') {
            document.body.classList.add('layout-3col');
        }

        layoutBtn.addEventListener('click', () => {
            document.body.classList.toggle('layout-3col');
            
            // Clear inline styles that might interfere with CSS classes
            const previewContainer = document.getElementById('preview-container');
            if (previewContainer) {
                previewContainer.style.height = '';
                previewContainer.style.width = '';
            }

            const is3Col = document.body.classList.contains('layout-3col');
            localStorage.setItem('layout-preference', is3Col ? '3col' : '2col');
            
            const editor = getEditorInstance();
            if (editor) setTimeout(() => editor.layout(), 50);
        });
    }

    // Restore Layout Sizes
    const savedSidebarWidth = localStorage.getItem('sidebar-width');
    const savedPreviewHeight = localStorage.getItem('preview-height');
    const savedPreviewWidth = localStorage.getItem('preview-width');

    if (savedSidebarWidth) {
        document.documentElement.style.setProperty('--sidebar-width', savedSidebarWidth);
    }
    if (savedPreviewHeight) {
        document.documentElement.style.setProperty('--preview-height', savedPreviewHeight);
    }
    if (savedPreviewWidth) {
        document.documentElement.style.setProperty('--preview-width', savedPreviewWidth);
    }

    // Sidebar Resizer
    const resizer = document.getElementById('dragMe');
    const sidebar = document.querySelector('.sidebar');
    const viewer = document.getElementById('viewer');
    const editorContainer = document.getElementById('monaco-editor');
    
    let x = 0;
    let w = 0;

    const mouseDownHandler = function(e) {
        e.preventDefault();
        document.body.classList.add('is-resizing');
        
        x = e.clientX;
        const sbWidth = window.getComputedStyle(sidebar).width;
        w = parseInt(sbWidth, 10);

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        resizer.classList.add('resizing');
        
        if(viewer) viewer.style.pointerEvents = 'none';
        if(editorContainer) editorContainer.style.pointerEvents = 'none';
    };

    const mouseMoveHandler = function(e) {
        const dx = e.clientX - x;
        const newWidth = `${w + dx}px`;
        document.documentElement.style.setProperty('--sidebar-width', newWidth);
        localStorage.setItem('sidebar-width', newWidth);
    };

    const mouseUpHandler = function() {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        resizer.classList.remove('resizing');
        document.body.classList.remove('is-resizing');
        
        if(viewer) viewer.style.pointerEvents = 'auto';
        if(editorContainer) editorContainer.style.pointerEvents = 'auto';
    };

    if(resizer) {
        resizer.addEventListener('mousedown', mouseDownHandler);
    }

    // Vertical Resizer (Handles both Vertical and Horizontal resizing based on layout)
    const vResizer = document.getElementById('dragMeVertical');
    const previewContainer = document.getElementById('preview-container');
    
    let startY = 0;
    let startH = 0;
    let startX = 0;
    let startW = 0;
    
    const vMouseDownHandler = function(e) {
        e.preventDefault();
        document.body.classList.add('is-resizing');

        const is3Col = document.body.classList.contains('layout-3col');
        
        if (is3Col) {
            startX = e.clientX;
            const pWidth = window.getComputedStyle(previewContainer).width;
            startW = parseInt(pWidth, 10);
        } else {
            startY = e.clientY;
            const pHeight = window.getComputedStyle(previewContainer).height;
            startH = parseInt(pHeight, 10);
        }
        
        document.addEventListener('mousemove', vMouseMoveHandler);
        document.addEventListener('mouseup', vMouseUpHandler);
        vResizer.classList.add('resizing');
        
        if(viewer) viewer.style.pointerEvents = 'none';
        if(editorContainer) editorContainer.style.pointerEvents = 'none';
    }
    
    const vMouseMoveHandler = function(e) {
        const is3Col = document.body.classList.contains('layout-3col');
        const editor = getEditorInstance();

        if (is3Col) {
            const dx = e.clientX - startX;
            const newWidth = startW - dx;
            const newWidthPx = `${newWidth}px`;
            document.documentElement.style.setProperty('--preview-width', newWidthPx);
            localStorage.setItem('preview-width', newWidthPx);
        } else {
            const dy = e.clientY - startY;
            const newHeight = startH + dy;
            const newHeightPx = `${newHeight}px`;
            document.documentElement.style.setProperty('--preview-height', newHeightPx);
            localStorage.setItem('preview-height', newHeightPx);
        }
        
        if (editor) editor.layout();
    }
    
    const vMouseUpHandler = function() {
        document.removeEventListener('mousemove', vMouseMoveHandler);
        document.removeEventListener('mouseup', vMouseUpHandler);
        vResizer.classList.remove('resizing');
        document.body.classList.remove('is-resizing');
        
        if(viewer) viewer.style.pointerEvents = 'auto';
        if(editorContainer) editorContainer.style.pointerEvents = 'auto';
        
        const editor = getEditorInstance();
        if (editor) editor.layout();
    }
    
    if (vResizer) {
        vResizer.addEventListener('mousedown', vMouseDownHandler);
    }
    
    // Drag and Drop Upload Logic (Sidebar)
    if (sidebar) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            sidebar.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            sidebar.addEventListener(eventName, () => sidebar.classList.add('highlight'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            sidebar.addEventListener(eventName, () => sidebar.classList.remove('highlight'), false);
        });

        sidebar.addEventListener('drop', (e) => {
            FileExplorer.handleDrop(e);
        });
    }
}
