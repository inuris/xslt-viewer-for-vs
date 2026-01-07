import { vfs } from './vfs.js';

export function initXsltSwitcher(editor, monaco, onReplaceCallback) {
    let widget = null;
    let currentHrefRange = null;
    let currentXmlPath = null;

    // Create the widget DOM
    const domNode = document.createElement('div');
    domNode.className = 'xslt-switcher-widget';
    domNode.innerHTML = '▼';
    domNode.title = 'Switch XSLT';
    domNode.style.cursor = 'pointer';
    domNode.style.color = '#4caf50';
    domNode.style.fontWeight = 'bold';
    domNode.style.marginLeft = '5px';
    domNode.style.fontSize = '12px';
    domNode.style.display = 'none'; // Hidden by default

    // Dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'xslt-switcher-dropdown';
    dropdown.style.display = 'none';
    dropdown.style.position = 'fixed';
    dropdown.style.background = '#252526';
    dropdown.style.border = '1px solid #454545';
    dropdown.style.zIndex = '1000';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    document.body.appendChild(dropdown);

    // Widget definition
    const contentWidget = {
        getId: function() { return 'xslt.switcher.widget'; },
        getDomNode: function() { return domNode; },
        getPosition: function() {
            if (!currentHrefRange) return null;
            return {
                position: {
                    lineNumber: currentHrefRange.endLineNumber,
                    column: currentHrefRange.endColumn
                },
                preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
            };
        }
    };

    editor.addContentWidget(contentWidget);

    // Event Listeners
    domNode.addEventListener('click', (e) => {
        e.stopPropagation();
        showDropdown();
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && e.target !== domNode) {
            dropdown.style.display = 'none';
        }
    });

    function updateWidgetPosition() {
        if (!currentXmlPath) {
            domNode.style.display = 'none';
            return;
        }

        const model = editor.getModel();
        if (!model) return;

        // Only for XML files
        // We can check the language or the file extension if we had access to it.
        // But checking content is safer.
        
        const text = model.getValue();
        // Regex to find <?xml-stylesheet ... href="value" ... ?>
        // We need to capture the range of the value.
        const regex = /<\?xml-stylesheet\s+[^>]*?href=['"]([^'"]+)['"][^>]*?\?>/g;
        const match = regex.exec(text);

        if (match) {
            const hrefValue = match[1];
            const matchIndex = match.index;
            const fullMatch = match[0];
            
            // Find the start of the href value inside the match
            // We know match[0] is the full tag.
            // We need to find where href='...' starts.
            const hrefIndexInMatch = fullMatch.indexOf(hrefValue);
            const absoluteStartIndex = matchIndex + hrefIndexInMatch;
            const absoluteEndIndex = absoluteStartIndex + hrefValue.length;

            const startPos = model.getPositionAt(absoluteStartIndex);
            const endPos = model.getPositionAt(absoluteEndIndex);

            currentHrefRange = new monaco.Range(
                startPos.lineNumber, 
                startPos.column, 
                endPos.lineNumber, 
                endPos.column
            );

            domNode.style.display = 'block';
            editor.layoutContentWidget(contentWidget);
        } else {
            currentHrefRange = null;
            domNode.style.display = 'none';
            editor.layoutContentWidget(contentWidget);
        }
    }

    function showDropdown() {
        if (!currentXmlPath) return;

        // Position dropdown near the widget
        const rect = domNode.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 2) + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.innerHTML = '<div style="padding:5px;color:#ccc;">Loading...</div>';
        dropdown.style.display = 'block';

        // Client-side XSLT listing
        const xsltFiles = Object.keys(vfs.files).filter(f => f.endsWith('.xsl') || f.endsWith('.xslt'));
        
        dropdown.innerHTML = '';
        if (xsltFiles.length > 0) {
            xsltFiles.forEach(file => {
                const item = document.createElement('div');
                item.textContent = file;
                item.style.padding = '5px 10px';
                item.style.cursor = 'pointer';
                item.style.color = '#ccc';
                item.style.fontSize = '13px';
                
                item.onmouseover = () => { item.style.backgroundColor = '#37373d'; };
                item.onmouseout = () => { item.style.backgroundColor = 'transparent'; };
                
                item.onclick = () => {
                    replaceXslt(file);
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(item);
            });
        } else {
            dropdown.innerHTML = '<div style="padding:5px;color:#ccc;">No XSLT files found</div>';
        }
    }

    function replaceXslt(newFilename) {
        if (!currentHrefRange) return;
        
        let textToInsert = newFilename;
        if (currentXmlPath) {
            textToInsert = getRelativePath(currentXmlPath, newFilename);
        }
        
        editor.executeEdits('xslt-switcher', [{
            range: currentHrefRange,
            text: textToInsert,
            forceMoveMarkers: true
        }]);
        
        if (onReplaceCallback) {
            onReplaceCallback();
        }
    }

    // Helper to calculate relative path
    function getRelativePath(fromPath, toPath) {
        // Normalize paths to use forward slashes
        const fromParts = fromPath.replace(/\\/g, '/').split('/');
        const toParts = toPath.replace(/\\/g, '/').split('/');
        
        // Remove filename from fromPath to get the directory
        fromParts.pop();
        
        // Find common prefix
        let i = 0;
        while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
            i++;
        }
        
        // Build relative path
        let relativeParts = [];
        // Go up for remaining parts in fromPath
        for (let j = i; j < fromParts.length; j++) {
            relativeParts.push('..');
        }
        // Go down for remaining parts in toPath
        for (let j = i; j < toParts.length; j++) {
            relativeParts.push(toParts[j]);
        }
        
        // If no relative parts (same directory), just return the filename
        if (relativeParts.length === 0) {
            // This happens if toPath is just a file in the same dir
            // But we already consumed the common prefix.
            // If fromParts had length 0 after pop (root), and toParts has length 1 (file in root).
            // i would be 0.
            // j loops would be empty.
            // Wait.
            // Example: from=a/b.xml (parts=[a]), to=a/c.xsl (parts=[a, c])
            // i=1 (matches 'a')
            // from loop: j=1 to 1 (empty)
            // to loop: j=1 to 2 (pushes 'c')
            // result: c.xsl. Correct.
            
            // Example: from=a/b.xml (parts=[a]), to=a/b/c.xsl (parts=[a, b, c])
            // i=1 (matches 'a')
            // from loop: j=1 to 1 (empty)
            // to loop: j=1 to 3 (pushes 'b', 'c')
            // result: b/c.xsl. Correct.
            
            // Example: from=a/b/c.xml (parts=[a, b]), to=a/d.xsl (parts=[a, d])
            // i=1 (matches 'a')
            // from loop: j=1 to 2 (pushes '..')
            // to loop: j=1 to 2 (pushes 'd')
            // result: ../d.xsl. Correct.
        }
        
        return relativeParts.join('/');
    }

    // Hook into editor events
    editor.onDidChangeModelContent(() => {
        updateWidgetPosition();
    });

    // We need to know the current file path to list XSLT files
    // We can expose a function to set the current path
    return {
        setCurrentPath: (path) => {
            currentXmlPath = path;
            updateWidgetPosition();
        }
    };
}
