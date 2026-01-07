
let widgets = [];
let decorations = [];
let editorInstance = null;
let monacoInstance = null;
let styleDefinitions = new Map(); // selector -> { uri, range }

export function initCssNavigation(editor, monaco) {
    editorInstance = editor;
    monacoInstance = monaco;

    // Register Providers
    registerProviders(monaco);

    // Update widgets on content change
    let timeout;
    const update = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            parseStyleDefinitions();
            updateCssWidgets();
        }, 500);
    };

    editor.onDidChangeModelContent(update);

    // Initial update
    update();
}

function parseStyleDefinitions() {
    if (!editorInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;

    styleDefinitions.clear();
    const text = model.getValue();
    const styleRegex = /<style[\s\S]*?>([\s\S]*?)<\/style>/gi;
    let styleMatch;

    while ((styleMatch = styleRegex.exec(text)) !== null) {
        const styleContent = styleMatch[1];
        const styleStartOffset = styleMatch.index + styleMatch[0].indexOf(styleContent);

        // Simple regex to find selectors (class and id)
        // This is a basic parser and might miss complex cases, but works for standard .class and #id
        const selectorRegex = /([.#][\w-]+)(?=\s*\{|\s*,)/g;
        let selectorMatch;

        while ((selectorMatch = selectorRegex.exec(styleContent)) !== null) {
            const selector = selectorMatch[1];
            const absolutePos = styleStartOffset + selectorMatch.index;
            const startPos = model.getPositionAt(absolutePos);
            const endPos = model.getPositionAt(absolutePos + selector.length);

            // Store the first occurrence or all? usually first is enough for "go to def"
            if (!styleDefinitions.has(selector)) {
                styleDefinitions.set(selector, {
                    uri: model.uri,
                    range: {
                        startLineNumber: startPos.lineNumber,
                        startColumn: startPos.column,
                        endLineNumber: endPos.lineNumber,
                        endColumn: endPos.column
                    }
                });
            }
        }
    }
}

function updateCssWidgets() {
    if (!editorInstance || !monacoInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;

    // Clear old widgets
    widgets.forEach(w => editorInstance.removeContentWidget(w));
    widgets = [];

    const newDecorations = [];
    const text = model.getValue();
    // Find class and id attributes
    const attrRegex = /\b(class|id)\s*=\s*(["'])(.*?)\2/g;
    let match;

    while ((match = attrRegex.exec(text)) !== null) {
        const type = match[1]; // class or id
        const value = match[3];
        const valueStartOffset = match.index + match[0].indexOf(match[2]) + 1;

        // Split value by spaces to handle multiple classes
        const names = value.split(/\s+/);
        let currentOffset = valueStartOffset;

        names.forEach(name => {
            if (!name) {
                currentOffset += 1;
                return;
            }

            const selector = (type === 'class' ? '.' : '#') + name;
            if (styleDefinitions.has(selector)) {
                const def = styleDefinitions.get(selector);
                const startPos = model.getPositionAt(currentOffset);
                const endPos = model.getPositionAt(currentOffset + name.length);
                
                // Add decoration to create space
                newDecorations.push({
                    range: new monacoInstance.Range(endPos.lineNumber, endPos.column, endPos.lineNumber, endPos.column),
                    options: {
                        afterContentClassName: 'css-icon-spacer',
                        stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                    }
                });

                const widget = new CssWidget(
                    widgets.length, 
                    endPos, 
                    selector, 
                    def, 
                    editorInstance, 
                    monacoInstance
                );
                editorInstance.addContentWidget(widget);
                widgets.push(widget);
            }

            currentOffset += name.length + 1; // +1 for space (approximate, but good enough for simple cases)
        });
    }
    
    decorations = editorInstance.deltaDecorations(decorations, newDecorations);
}

function registerProviders(monaco) {
    monaco.languages.registerDefinitionProvider('xml', {
        provideDefinition: function(model, position) {
            const word = model.getWordAtPosition(position);
            if (!word) return null;
            
            // Check context (class or id) - simplified check
            const lineContent = model.getLineContent(position.lineNumber);
            // ... (reuse logic or rely on word lookup in map) ...
            
            // Try to find if the word matches a known selector
            const classSelector = '.' + word.word;
            const idSelector = '#' + word.word;

            if (styleDefinitions.has(classSelector)) {
                return styleDefinitions.get(classSelector);
            }
            if (styleDefinitions.has(idSelector)) {
                return styleDefinitions.get(idSelector);
            }
            return null;
        }
    });

    monaco.languages.registerHoverProvider('xml', {
        provideHover: function(model, position) {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const classSelector = '.' + word.word;
            const idSelector = '#' + word.word;
            let def = null;
            let type = '';

            if (styleDefinitions.has(classSelector)) {
                def = styleDefinitions.get(classSelector);
                type = 'class';
            } else if (styleDefinitions.has(idSelector)) {
                def = styleDefinitions.get(idSelector);
                type = 'id';
            }

            if (def) {
                return {
                    range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                    contents: [
                        { value: `**CSS Definition found**` },
                        { value: `Click icon or Ctrl+Click to go to definition of ${type} \`${word.word}\`` }
                    ]
                };
            }
            return null;
        }
    });
}

class CssWidget {
    constructor(id, position, selector, definition, editor, monaco) {
        this.id = 'css-widget-' + id;
        this.position = position;
        this.selector = selector;
        this.definition = definition;
        this.editor = editor;
        this.monaco = monaco;

        this.domNode = document.createElement('div');
        this.domNode.className = 'css-navigation-widget';
        this.domNode.innerHTML = '➜'; // Arrow icon
        this.domNode.title = `Go to definition of ${selector}`;
        
        this.domNode.onclick = (e) => {
            e.stopPropagation();
            this.editor.revealRangeInCenter(this.definition.range);
            this.editor.setPosition({
                lineNumber: this.definition.range.startLineNumber,
                column: this.definition.range.startColumn
            });
            this.editor.focus();
        };
    }

    getId() { return this.id; }
    getDomNode() { return this.domNode; }
    getPosition() {
        return {
            position: {
                lineNumber: this.position.lineNumber,
                column: this.position.column
            },
            preference: [this.monaco.editor.ContentWidgetPositionPreference.EXACT]
        };
    }
}
