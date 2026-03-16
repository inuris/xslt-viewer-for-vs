/**
 * Simple XML/XSLT formatter: indent child tags vertically, preserve all text content exactly
 * (no newlines or character changes inside text, including spaces).
 */

const enum TokenType {
    Text = 'text',
    OpenTag = 'open',
    CloseTag = 'close',
    SelfCloseTag = 'selfclose',
    PI = 'pi',
    Comment = 'comment',
    CDATA = 'cdata',
    Doctype = 'doctype',
}

interface Token {
    type: TokenType;
    value: string;
    tagName?: string; // for OpenTag and CloseTag
}

function getTagName(tagValue: string, isClose: boolean): string {
    const start = isClose ? 2 : 1;
    let end = start;
    while (end < tagValue.length && /[\w:-]/.test(tagValue[end])) end++;
    return tagValue.substring(start, end).toLowerCase();
}

function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const n = input.length;

    while (i < n) {
        if (input[i] === '<') {
            if (input.substr(i, 5) === '<?xml' || input.substr(i, 2) === '<?') {
                const end = input.indexOf('?>', i);
                if (end === -1) {
                    tokens.push({ type: TokenType.Text, value: input[i++] });
                    continue;
                }
                tokens.push({ type: TokenType.PI, value: input.substring(i, end + 2) });
                i = end + 2;
                continue;
            }
            if (input.substr(i, 4) === '<!--') {
                const end = input.indexOf('-->', i);
                if (end === -1) {
                    tokens.push({ type: TokenType.Text, value: input[i++] });
                    continue;
                }
                tokens.push({ type: TokenType.Comment, value: input.substring(i, end + 3) });
                i = end + 3;
                continue;
            }
            if (input.substr(i, 9) === '<![CDATA[') {
                const end = input.indexOf(']]>', i);
                if (end === -1) {
                    tokens.push({ type: TokenType.Text, value: input[i++] });
                    continue;
                }
                tokens.push({ type: TokenType.CDATA, value: input.substring(i, end + 3) });
                i = end + 3;
                continue;
            }
            if (input.substr(i, 2) === '<!' && (input.substr(i, 9) === '<!DOCTYPE' || input.substr(i, 9) === '<!doctype')) {
                let j = i + 9;
                let inQuote = '';
                while (j < n) {
                    const c = input[j];
                    if (inQuote) {
                        if (c === inQuote) inQuote = '';
                        j++;
                        continue;
                    }
                    if (c === '"' || c === "'") { inQuote = c; j++; continue; }
                    if (c === '>') break;
                    j++;
                }
                if (j < n) {
                    tokens.push({ type: TokenType.Doctype, value: input.substring(i, j + 1) });
                    i = j + 1;
                    continue;
                }
            }
            if (input.substr(i, 2) === '</') {
                const end = input.indexOf('>', i);
                if (end === -1) {
                    tokens.push({ type: TokenType.Text, value: input[i++] });
                    continue;
                }
                const closeRaw = input.substring(i, end + 1);
                tokens.push({ type: TokenType.CloseTag, value: closeRaw, tagName: getTagName(closeRaw, true) });
                i = end + 1;
                continue;
            }
            const tagStart = i;
            i++;
            let inQuote = '';
            while (i < n) {
                const c = input[i];
                if (inQuote) {
                    if (c === inQuote) inQuote = '';
                    i++;
                    continue;
                }
                if (c === '"' || c === "'") {
                    inQuote = c;
                    i++;
                    continue;
                }
                if (c === '>') {
                    i++;
                    const raw = input.substring(tagStart, i);
                    const trimmed = raw.trimEnd();
                    if (trimmed.endsWith('/>')) {
                        tokens.push({ type: TokenType.SelfCloseTag, value: raw });
                    } else {
                        tokens.push({ type: TokenType.OpenTag, value: raw, tagName: getTagName(raw, false) });
                    }
                    break;
                }
                i++;
            }
            continue;
        }
        let start = i;
        while (i < n && input[i] !== '<') i++;
        if (start < i) {
            tokens.push({ type: TokenType.Text, value: input.substring(start, i) });
        }
    }
    return tokens;
}

/** Returns [endIndex, isInline]. endIndex is the index of the matching CloseTag. */
function findMatchingClose(tokens: Token[], openIdx: number): { endIdx: number; isInline: boolean } {
    const openTag = tokens[openIdx];
    const name = openTag.tagName;
    if (!name) return { endIdx: openIdx + 1, isInline: false };
    let depth = 1;
    let hasChildTags = false;
    for (let i = openIdx + 1; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type === TokenType.OpenTag) {
            depth++;
            hasChildTags = true;
        } else if (tok.type === TokenType.SelfCloseTag) {
            hasChildTags = true;
        } else if (tok.type === TokenType.CloseTag && tok.tagName === name) {
            depth--;
            if (depth === 0) return { endIdx: i, isInline: !hasChildTags };
        } else if (tok.type === TokenType.CloseTag) {
            depth--;
        }
    }
    return { endIdx: openIdx + 1, isInline: false };
}

// ASCII whitespace only (excludes &#160; / U+00A0 so we preserve non-breaking space)
const ASCII_WS = /[\t\n\r\f\v ]/;

/** Collapse newlines and excess whitespace inside a tag to a single space; do not change quoted attribute values. Preserves &#160;. */
function normalizeTagWhitespace(tagValue: string): string {
    let out = '';
    let i = 0;
    let inQuote = '';
    let whitespaceRun = '';
    while (i < tagValue.length) {
        const c = tagValue[i];
        if (inQuote) {
            out += c;
            if (c === inQuote) inQuote = '';
            i++;
            continue;
        }
        if (c === '"' || c === "'") {
            inQuote = c;
            if (whitespaceRun.includes('\n')) out += ' ';
            else out += whitespaceRun;
            whitespaceRun = '';
            out += c;
            i++;
            continue;
        }
        if (ASCII_WS.test(c)) {
            whitespaceRun += c;
            i++;
            continue;
        }
        if (whitespaceRun) {
            out += whitespaceRun.includes('\n') ? ' ' : whitespaceRun;
            whitespaceRun = '';
        }
        out += c;
        i++;
    }
    if (whitespaceRun) out += whitespaceRun.includes('\n') ? ' ' : whitespaceRun;
    return out.replace(/^[\t\n\r\f\v ]+|[\t\n\r\f\v ]+$/g, '');
}

/**
 * Simple CSS formatter: one declaration per line, indent by brace depth, preserve comments and strings.
 */
function formatCss(css: string, indentSize: number): string {
    const indentStr = ' '.repeat(indentSize);
    const lines: string[] = [];
    let depth = 0;
    let i = 0;
    const n = css.length;
    let line = '';
    let inString = '';
    let inComment = false; // /* */

    const flushLine = () => {
        const t = line.trim();
        if (t) lines.push(indentStr.repeat(depth) + t);
        line = '';
    };

    while (i < n) {
        const c = css[i];
        const c2 = css.substr(i, 2);

        if (inString) {
            line += c;
            if (c === '\\' && i + 1 < n) { line += css[++i]; i++; }
            else if (c === inString) inString = '';
            i++;
            continue;
        }
        if (inComment) {
            line += c;
            if (c2 === '*/') { line += css[i + 1]; i += 2; inComment = false; }
            else i++;
            continue;
        }

        if (c2 === '/*') {
            line += '/*';
            i += 2;
            inComment = true;
            continue;
        }
        if ((c === '"' || c === "'") && !inString) {
            inString = c;
            line += c;
            i++;
            continue;
        }

        if (c === '{') {
            line = line.trimEnd();
            if (line) {
                lines.push(indentStr.repeat(depth) + line.trim() + ' {');
            } else {
                lines.push(indentStr.repeat(depth) + '{');
            }
            line = '';
            depth++;
            i++;
            continue;
        }
        if (c === '}') {
            const t = line.trimEnd();
            if (t) {
                lines.push(indentStr.repeat(depth) + t);
                line = '';
            }
            depth--;
            if (depth < 0) depth = 0;
            lines.push(indentStr.repeat(depth) + '}');
            line = '';
            i++;
            continue;
        }
        if (c === ';') {
            line += c;
            flushLine();
            i++;
            continue;
        }
        if (c === '\n' || c === '\r') {
            const t = line.trim();
            if (t) lines.push(indentStr.repeat(depth) + t);
            line = '';
            i++;
            continue;
        }
        line += c;
        i++;
    }
    const t = line.trim();
    if (t) lines.push(indentStr.repeat(depth) + t);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Normalize content: XML whitespace (tab, LF, CR, space) to single space; preserve one leading/trailing when present. Preserves &#160; (U+00A0). Aligns with XPath normalize-space(). */
function collapseTextToLine(text: string): string {
    const hadLeading = text.length > 0 && ASCII_WS.test(text[0]);
    const hadTrailing = text.length > 0 && ASCII_WS.test(text[text.length - 1]);
    let s = text.replace(/[\t\n\r\f\v ]+/g, ' ').replace(/^[\t\n\r\f\v ]+|[\t\n\r\f\v ]+$/g, '');
    if (s.length === 0) return hadLeading || hadTrailing ? ' ' : '';
    if (hadLeading) s = ' ' + s;
    if (hadTrailing) s = s + ' ';
    return s;
}

function formatWithIndent(tokens: Token[], indentSize: number): string {
    const indentStr = ' '.repeat(indentSize);
    let depth = 0;
    const out: string[] = [];
    let afterNewline = true;
    let scriptDepth = 0;

    for (let idx = 0; idx < tokens.length; idx++) {
        const t = tokens[idx];
        switch (t.type) {
            case TokenType.Text: {
                if (scriptDepth > 0) {
                    out.push(t.value);
                    afterNewline = false;
                    break;
                }
                const isWhitespaceOnly = /^[\t\n\r\f\v ]*$/.test(t.value);
                if (isWhitespaceOnly) {
                    if (!afterNewline) {
                        // Use space + newline so space is preserved between inline elements (e.g. </b> <i>)
                        out.push(' \n');
                        afterNewline = true;
                    }
                } else {
                    out.push(t.value.replace(/[\t\n\r\f\v ]+/g, ' '));
                    afterNewline = false;
                }
                break;
            }
            case TokenType.PI:
            case TokenType.Comment:
            case TokenType.CDATA:
            case TokenType.Doctype:
                if (!afterNewline) out.push('\n');
                out.push(indentStr.repeat(depth), t.value);
                afterNewline = false;
                break;
            case TokenType.SelfCloseTag:
                if (!afterNewline) out.push('\n');
                out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                afterNewline = false;
                break;
            case TokenType.OpenTag: {
                const { endIdx, isInline } = findMatchingClose(tokens, idx);
                const tagName = t.tagName;
                const isStyleBlock = tagName === 'style';
                const isScriptBlock = tagName === 'script';
                if (isScriptBlock) {
                    if (!afterNewline) out.push('\n');
                    out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                    depth++;
                    scriptDepth++;
                    afterNewline = false;
                    break;
                }
                if (isInline && isStyleBlock) {
                    // <style> with only text: format inner content as CSS
                    let innerText = '';
                    for (let j = idx + 1; j < endIdx; j++) {
                        const inner = tokens[j];
                        if (inner.type === TokenType.Text) innerText += inner.value;
                    }
                    const formattedCss = formatCss(innerText.trim(), indentSize);
                    const baseIndent = indentStr.repeat(depth);
                    const cssWithIndent = formattedCss
                        ? formattedCss.split('\n').map((line) => baseIndent + line).join('\n')
                        : '';
                    if (!afterNewline) out.push('\n');
                    out.push(baseIndent, normalizeTagWhitespace(t.value), '\n');
                    if (cssWithIndent) out.push(cssWithIndent, '\n');
                    out.push(baseIndent, normalizeTagWhitespace(tokens[endIdx].value));
                    idx = endIdx;
                    afterNewline = false;
                } else if (isInline) {
                    if (!afterNewline) out.push('\n');
                    out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                    for (let j = idx + 1; j < endIdx; j++) {
                        const inner = tokens[j];
                        if (inner.type === TokenType.Text) {
                            out.push(collapseTextToLine(inner.value));
                        } else if (inner.type === TokenType.Comment || inner.type === TokenType.CDATA || inner.type === TokenType.PI) {
                            out.push(inner.value);
                        }
                    }
                    out.push(normalizeTagWhitespace(tokens[endIdx].value));
                    idx = endIdx;
                    afterNewline = false;
                } else {
                    if (!afterNewline) out.push('\n');
                    out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                    depth++;
                    afterNewline = false;
                }
                break;
            }
            case TokenType.CloseTag:
                if (t.tagName === 'script' && scriptDepth > 0) {
                    scriptDepth--;
                }
                depth--;
                if (depth < 0) depth = 0;
                if (!afterNewline) out.push('\n');
                out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                afterNewline = false;
                break;
        }
    }
    return out.join('');
}

/**
 * Format XML/XSLT content: child tags on new lines with indent; all text content unchanged.
 */
export function formatXml(contents: string, indentSize: number = 4): string {
    const tokens = tokenize(contents);
    return formatWithIndent(tokens, indentSize);
}
