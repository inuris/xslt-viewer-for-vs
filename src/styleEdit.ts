import * as vscode from 'vscode';

/**
 * Locate and patch a literal output tag's inline `style` (width/height) in the XSLT
 * source, driven by the preview's `data-source-line` (see transformation.ts ->
 * instrumentXslt). Used by the Preview Pane's W/H quick-edit icons (webview.ts).
 */

/**
 * Tag-start matcher — MUST mirror instrumentXslt's regex exactly (same skip set:
 * comments, CDATA, closing tags, xsl: elements, processing instructions/doctype)
 * so the line numbers this module computes line up 1:1 with the data-source-line
 * values instrumentXslt burned into the preview HTML.
 */
const TAG_PATTERN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<((?!\/|xsl:|[?!])[a-zA-Z0-9_:-]+)([^>]*)>/g;

interface TagMatch {
    /** Offset of the tag's opening '<'. */
    start: number;
    /** Offset just past the tag's closing '>'. */
    end: number;
    tagName: string;
    /** Raw attribute text between the tag name and '>' (may end with a self-close '/'). */
    attrs: string;
}

/** Find the first literal output tag whose start line matches `line` (1-based). */
function findTagAtLine(text: string, line: number): TagMatch | null {
    const pattern = new RegExp(TAG_PATTERN.source, 'g');
    let ln = 1;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        for (let i = lastIndex; i < match.index; i++) {
            if (text.charCodeAt(i) === 10) ln++;
        }
        const startLine = ln;
        for (let i = match.index; i < pattern.lastIndex; i++) {
            if (text.charCodeAt(i) === 10) ln++;
        }
        lastIndex = pattern.lastIndex;

        const [full, tagName, attrs] = match;
        if (tagName === undefined) continue; // comment / CDATA span, not an output tag
        if (startLine === line) {
            return { start: match.index, end: match.index + full.length, tagName, attrs };
        }
        if (startLine > line) break; // scanned past the target line without a match
    }
    return null;
}

/** Split a tag's trailing self-closing '/' (if any) off its attribute text. */
function splitSelfClose(attrs: string): { body: string; selfClose: string } {
    const m = attrs.match(/\/\s*$/);
    if (m) {
        return { body: attrs.slice(0, attrs.length - m[0].length), selfClose: attrs[attrs.length - 1] === '/' ? '/' : m[0] };
    }
    return { body: attrs, selfClose: '' };
}

/** Insert or update `prop:value;` inside an attribute string's style="" (adding the attribute if it's missing). */
function withStyleProp(attrs: string, prop: 'width' | 'height', value: string): string {
    const styleMatch = attrs.match(/\sstyle\s*=\s*("[^"]*"|'[^']*')/);
    if (!styleMatch) {
        return `${attrs} style="${prop}:${value};"`;
    }
    const quoted = styleMatch[1];
    const quote = quoted[0];
    const inner = quoted.slice(1, -1);
    const declRe = new RegExp('(^|;)\\s*' + prop + '\\s*:[^;]*;?', 'i');
    let newInner: string;
    if (declRe.test(inner)) {
        newInner = inner.replace(declRe, (_m, sep: string) => `${sep}${sep ? ' ' : ''}${prop}:${value};`);
    } else {
        const trimmed = inner.trim();
        newInner = trimmed ? `${trimmed.replace(/;\s*$/, '')}; ${prop}:${value};` : `${prop}:${value};`;
    }
    const idx = styleMatch.index ?? 0;
    return attrs.slice(0, idx) + ` style=${quote}${newInner}${quote}` + attrs.slice(idx + styleMatch[0].length);
}

/**
 * Patch `prop` (width/height) into the inline style of the output tag whose
 * data-source-line is `line`. Always writes an inline `style="..."` declaration
 * (adding the attribute if absent) — this reliably overrides any width/height
 * coming from a CSS class or a legacy `width=""` HTML attribute, regardless of
 * where the original sizing came from.
 *
 * Returns true if the edit was applied.
 */
export async function applyInlineStyleEdit(
    doc: vscode.TextDocument,
    line: number,
    prop: 'width' | 'height',
    value: string
): Promise<boolean> {
    const text = doc.getText();
    const tag = findTagAtLine(text, line);
    if (!tag) {
        vscode.window.showErrorMessage(`XSLT Viewer: could not locate the element's tag at line ${line} to edit ${prop}.`);
        return false;
    }

    const { body, selfClose } = splitSelfClose(tag.attrs);
    const newBody = withStyleProp(body, prop, value);
    const newTagText = `<${tag.tagName}${newBody}${selfClose}>`;

    const startPos = doc.positionAt(tag.start);
    const endPos = doc.positionAt(tag.end);
    const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preserveFocus: true });
    const applied = await editor.edit(edit => {
        edit.replace(new vscode.Range(startPos, endPos), newTagText);
    });
    if (!applied) {
        vscode.window.showErrorMessage('XSLT Viewer: failed to apply the style edit.');
        return false;
    }
    return true;
}
