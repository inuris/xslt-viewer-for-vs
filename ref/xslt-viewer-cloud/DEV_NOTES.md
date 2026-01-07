# XSLT Viewer - Developer Notes

> **Note for AI Agents:** Please refer to `AI_CONTEXT.md` for detailed architectural context, code patterns, and "vibing-code" instructions.

This document outlines the UI modules, their functionalities, and the visual structure of the application to assist in debugging and development.

## UI Module Breakdown

### 1. Page Header
*   **Location**: `index.html`, `static/css/components.css`
*   **Main Functions**:
    *   **Breadcrumb Navigation**: Displays current directory path. Allows navigation to parent folders.
    *   **Layout Toggle**: Switches between 2-column (Editor + Preview) and 3-column (Sidebar + Editor + Preview) layouts.

### 2. Sidebar (File Explorer)
*   **Location**: `index.html` (inlined), `static/js/modules/explorer.js`
*   **Main Functions**:
    *   **File Tree Rendering**: Lists files and folders from the Virtual File System (VFS).
    *   **Navigation**: Click folders to expand/navigate, click files to open.
    *   **Upload**: "Upload Zip" button to load projects.
    *   **Context Menu** (Right-click on items):
        *   `Delete`: Remove file/folder from VFS.
        *   `Rename`: Rename file/folder in VFS.
        *   `Cut/Copy/Paste`: VFS operations.
        *   `Download`: Download single file or zip of folder.
    *   **Zip Extraction**: Drag and drop a `.zip` file onto the window triggers the **Zip Extract Modal**.

### 3. Editor Pane
*   **Location**: `index.html` (inlined), `static/js/modules/editor.js`
*   **Main Functions**:
    *   **Monaco Editor**: Core text editing interface.
    *   **Tabs**: Switch between `XSLT` (stylesheet) and `XML` (data) views.
    *   **Toolbar**:
        *   `Format`: Formats the current document (Client-side).
        *   `Theme`: Toggles Dark/Light mode.
        *   `Settings`: (Disabled in Client-side Version).
    *   **Status Bar**: Shows ready state or save status.
    *   **Shortcuts**: `Ctrl+S` to save to VFS.

#### Sub-Module: Base64 Image Tools
*   **Location**: `static/js/modules/base64_tools.js`
*   **Functions**:
    *   **Inline Widget**: Detects base64 image strings in code. Displays a `🖼️` icon.
    *   **Replace Image**: Clicking the icon opens the **Image Resize Modal**.

#### Sub-Module: CSS Navigation
*   **Location**: `static/js/modules/css_navigation.js`
*   **Functions**:
    *   **Inline Widget**: Detects CSS class/ID usage in XML/XSLT. Displays a `➜` icon.
    *   **Go to Definition**: Clicking the icon jumps to the corresponding `<style>` definition.

### 4. Preview Pane
*   **Location**: `index.html` (inlined), `static/js/modules/preview.js`
*   **Main Functions**:
    *   **Rendering**: Client-side rendering using `XSLTProcessor` (Browser API).
    *   **Toolbar**:
        *   `Print`: Print the preview content.
        *   `Zoom`: Adjust zoom level (50% - 150%).
        *   `Toggle Image List`: Expands/Collapses the Image List Sidebar.

#### Sub-Module: Image List Sidebar
*   **Location**: `static/js/modules/base64_tools.js`
*   **Functions**:
    *   **List View**: Displays thumbnails of all base64 images found in the editor.
    *   **Go to Line** (Eye Icon): Scrolls the editor to the image location.
    *   **Replace Image** (Edit Icon): Opens the **Image Resize Modal**.

### 5. Modals (Popups)
*   **Location**: `index.html` (inlined)

#### A. Settings Modal
*   **Trigger**: (Disabled in Client-side Version).
*   **Functions**:
    *   Configure Root Path for the file explorer.

#### B. Zip Extract Modal
*   **Trigger**: Drag & Drop a `.zip` file.
*   **Functions**:
    *   Input target folder name.
    *   Extract contents to VFS.

#### C. Image Resize Modal
*   **Trigger**: "Replace Image" action (from Editor Widget or Image List).
*   **Location**: `static/js/modules/base64_tools.js`
*   **Functions**:
    *   **Preview**: Shows the selected new image.
    *   **Resize Controls**: Width/Height inputs.
    *   **Auto-Fill**: Width defaults to original image width. Height calculated by aspect ratio.
    *   **Aspect Ratio Lock**: Checkbox to maintain ratio when editing dimensions.
    *   **Insert**: Replaces the base64 string in the editor with the resized image data.

---

## GUI Visual Map (ASCII)

```text
+-----------------------------------------------------------------------+
| [Header] Breadcrumb: root > folder > file.xml       [Layout Toggle]   |
+------------------+---------------------------+------------------------+
| [Sidebar]        | [Editor Pane]             | [Preview Pane]         |
|                  | [Tabs: XSLT | XML] [Tools]| [Toolbar: Refresh...]  |
| [Upload Btn]     |                           |                        |
|                  | 1 <style>                 | +--------------------+ |
| - Root/          | 2  .class { ... }         | |                    | |
|   - folder/      | 3 </style>                | |                    | |
|     - file.xml   | 4                         | |    Rendered        | |
|     - style.xslt | 5 <div class="class">     | |    Result          | |
|                  |   [➜ CSS Widget]          | |    (Iframe)        | |
|                  | 6                         | |                    | |
|                  | 7 <img src="data:..." />  | |                    | |
|                  |   [🖼️ Base64 Widget]      | |                    | |
|                  | 8                         | +--------------------+ |
|                  |                           |                        |
|                  |                           | [Image List Sidebar]   |
|                  |                           | +--------------------+ |
|                  |                           | | [Thumb] [Eye] [Ed] | |
|                  |                           | | Line 7             | |
|                  |                           | +--------------------+ |
+------------------+---------------------------+------------------------+

[Modals Layer]

+---------------------------+      +---------------------------+
| [Zip Extract Modal]       |      | [Image Resize Modal]      |
|                           |      |                           |
| Enter Folder Name: [___]  |      | [ Image Preview Area    ] |
|                           |      |                           |
| [Cancel] [Extract]        |      | Width: [100] Height: [50] |
|                           |      | [x] Maintain Ratio        |
+---------------------------+      |                           |
                                   | [Cancel] [Insert]         |
                                   +---------------------------+
```
