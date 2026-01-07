
// Storage key helper
const _xsltFilterBaseKey = 'xslt_viewer_filter';

export function getServerCurrentPath() {
    return ''; // Client-side root
}

export function getFilterStorageKey() {
    const label = (getServerCurrentPath() || '/');
    return _xsltFilterBaseKey + ':' + encodeURIComponent(label);
}

export function navigateToPath(path) {
    // If FileExplorer is active (it should be), use it
    if (window.FileExplorer) {
        window.FileExplorer.loadDirectory(path);
        return;
    }
}
