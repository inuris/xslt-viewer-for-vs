# XSLT Viewer (Client-Side)

This is a fully client-side XSLT Viewer and Editor. It runs entirely in the browser using a Virtual File System (VFS). No backend server is required.

## Features

- **Virtual File System**: Upload Zip files or drag-and-drop folders to work with them in-memory.
- **XSLT Transformation**: Real-time client-side XSLT transformation using the browser's native XSLTProcessor.
- **Monaco Editor**: Full-featured code editor for XML and XSLT files.
- **Preview**: Live preview of the transformed result.
- **Export**: Download your modified files as a Zip archive.

## Hosting

Since this is a static web application, you can host it on any static file server:

- **GitHub Pages**
- **Netlify**
- **Vercel**
- **Apache/Nginx** (static mode)
- **Local Filesystem** (Note: Some browsers restrict XSLT/Imports on `file://` protocol due to CORS. It is recommended to use a local server like `http-server` or VS Code Live Server).

## Usage

1. Open `index.html` in a web browser.
2. Click **Upload Zip** to load a project, or drag and drop files/folders into the explorer.
3. Click on an XML file to open it.
4. If the XML references an XSLT file (via `<?xml-stylesheet ... ?>`), it will be automatically detected.
5. Click **XSLT** in the tab bar to switch between XML and XSLT views.
6. Edit files and see the **Preview** update automatically (on save/change).
7. Right-click files in the explorer to Rename, Delete, or Download.
8. Select files and click **Download** (or right-click) to export them.

## Development

- `static/js/modules/vfs.js`: Handles the in-memory file system.
- `static/js/modules/explorer.js`: Manages the file tree and file operations.
- `static/js/modules/editor.js`: Manages the Monaco Editor instance.
- `static/js/modules/preview.js`: Handles XSLT transformation and rendering.

## Dependencies

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) (CDN)
- [JSZip](https://stuk.github.io/jszip/) (CDN)
