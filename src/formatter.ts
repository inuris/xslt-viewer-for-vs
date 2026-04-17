/**
 * Simple XML/XSLT formatter: indent child tags vertically and normalize text-node whitespace
 * (line breaks/tabs collapse to single spaces) for cleaner literal text output.
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
                    const tagName = getTagName(raw, false);
                    // Treat entire <script>...</script> and <style>...</style> as a single text chunk so
                    // embedded JS/CSS (including data URIs and HTML comments like <!-- -->) is never tokenized/modified.
                    if (tagName === 'script' || tagName === 'style') {
                        const lower = input.toLowerCase();
                        const closeStart = lower.indexOf(tagName === 'style' ? '</style' : '</script', i);
                        if (closeStart !== -1) {
                            const closeEnd = input.indexOf('>', closeStart);
                            if (closeEnd !== -1) {
                                const fullBlock = input.substring(tagStart, closeEnd + 1);
                                tokens.push({ type: TokenType.Text, value: fullBlock });
                                i = closeEnd + 1;
                                break;
                            }
                        }
                    }
                    if (trimmed.endsWith('/>')) {
                        tokens.push({ type: TokenType.SelfCloseTag, value: raw });
                    } else {
                        tokens.push({ type: TokenType.OpenTag, value: raw, tagName });
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
const ASCII_WS_GLOBAL = /[\t\n\r\f\v ]+/g;
const ASCII_WS_EDGE = /^[\t\n\r\f\v ]+|[\t\n\r\f\v ]+$/g;
const ASCII_WS_EDGE_END = /[\t\n\r\f\v ]+$/g;

function trimAscii(value: string): string {
    return value.replace(ASCII_WS_EDGE, '');
}

function trimAsciiEnd(value: string): string {
    return value.replace(ASCII_WS_EDGE_END, '');
}

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
    return trimAscii(out);
}

/** Collapse whitespace/newlines inside <!-- --> comment body to a single space. */
function normalizeCommentWhitespace(commentValue: string): string {
    if (!commentValue.startsWith('<!--') || !commentValue.endsWith('-->')) return commentValue;
    const inner = trimAscii(commentValue.slice(4, -3).replace(ASCII_WS_GLOBAL, ' '));
    return `<!-- ${inner} -->`;
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
        const t = trimAscii(line);
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
            line = trimAsciiEnd(line);
            if (line) {
                lines.push(indentStr.repeat(depth) + trimAscii(line) + ' {');
            } else {
                lines.push(indentStr.repeat(depth) + '{');
            }
            line = '';
            depth++;
            i++;
            continue;
        }
        if (c === '}') {
            const t = trimAsciiEnd(line);
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
            const t = trimAscii(line);
            if (t) lines.push(indentStr.repeat(depth) + t);
            line = '';
            i++;
            continue;
        }
        line += c;
        i++;
    }
    const t = trimAscii(line);
    if (t) lines.push(indentStr.repeat(depth) + t);
    return trimAscii(lines.join('\n').replace(/\n{3,}/g, '\n\n'));
}

/** Format CSS while preserving any inline data:image;base64,... segments (quoted or unquoted). */
function formatCssPreservingDataUris(css: string, indentSize: number): string {
    const originals: string[] = [];
    let transformed = '';
    let i = 0;
    while (i < css.length) {
        const start = css.indexOf('data:image', i);
        if (start === -1) {
            transformed += css.slice(i);
            break;
        }
        transformed += css.slice(i, start);

        // Capture until a likely delimiter that ends the URL context.
        // We stop before: quote, right-paren, or whitespace/newline.
        let end = start;
        while (end < css.length) {
            const c = css[end];
            if (c === '"' || c === "'" || c === ')' || c === ' ' || c === '\n' || c === '\r' || c === '\t') break;
            end++;
        }
        const seg = css.slice(start, end);
        const id = originals.push(seg) - 1;
        transformed += `__XSLT_VIEWER_DATA_URI_${id}__`;
        i = end;
    }

    const formatted = formatCss(transformed, indentSize);
    if (!formatted) return formatted;
    return formatted.replace(/__XSLT_VIEWER_DATA_URI_(\d+)__/g, (_m, d) => originals[Number(d)] ?? _m);
}

function tryFormatWholeStyleBlockText(text: string, indentSize: number, depth: number): string | null {
    const lower = text.toLowerCase();
    if (!lower.startsWith('<style')) return null;
    const closeStart = lower.lastIndexOf('</style');
    if (closeStart === -1) return null;
    const closeEnd = text.indexOf('>', closeStart);
    if (closeEnd === -1) return null;

    // Find end of opening tag (respect quotes).
    let openEnd = -1;
    let inQuote = '';
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuote) {
            if (c === inQuote) inQuote = '';
            continue;
        }
        if (c === '"' || c === "'") { inQuote = c; continue; }
        if (c === '>') { openEnd = i; break; }
    }
    if (openEnd === -1 || openEnd >= closeStart) return null;

    const openTag = text.slice(0, openEnd + 1);
    const inner = text.slice(openEnd + 1, closeStart);
    const closeTag = text.slice(closeStart, closeEnd + 1);

    const indentStr = ' '.repeat(indentSize);
    const baseIndent = indentStr.repeat(depth);
    const innerFormatted = formatCssPreservingDataUris(trimAscii(inner), indentSize);
    const innerWithIndent = innerFormatted
        ? innerFormatted.split('\n').map((line) => baseIndent + indentStr + line).join('\n')
        : '';

    return [
        baseIndent + openTag,
        innerWithIndent,
        baseIndent + closeTag,
    ].filter(Boolean).join('\n');
}

function collapseTextToLine(text: string): string {
    // Guardrail: keep probable encoded payloads untouched.
    const compact = text.replace(ASCII_WS_GLOBAL, '');
    const looksEncoded = compact.length > 160 && /^[A-Za-z0-9+/=]+$/.test(compact);
    if (looksEncoded) return text;

    // XML/XPath-style normalization for text nodes: collapse ASCII whitespace to one space.
    return trimAscii(text.replace(ASCII_WS_GLOBAL, ' '));
}

function formatWithIndent(tokens: Token[], indentSize: number): string {
    const indentStr = ' '.repeat(indentSize);
    let depth = 0;
    const out: string[] = [];
    let afterNewline = true;

    for (let idx = 0; idx < tokens.length; idx++) {
        const t = tokens[idx];
        switch (t.type) {
            case TokenType.Text: {
                const isWhitespaceOnly = /^[\t\n\r\f\v ]*$/.test(t.value);
                if (isWhitespaceOnly) {
                    if (!afterNewline) {
                        // Use space + newline so space is preserved between inline elements (e.g. </b> <i>)
                        out.push(' \n');
                        afterNewline = true;
                    }
                } else {
                    const formattedStyleBlock = tryFormatWholeStyleBlockText(t.value, indentSize, depth);
                    if (formattedStyleBlock) {
                        if (!afterNewline) out.push('\n');
                        out.push(formattedStyleBlock);
                        afterNewline = false;
                        break;
                    }
                    const collapsed = collapseTextToLine(t.value);
                    if (collapsed) out.push(collapsed);
                    afterNewline = false;
                }
                break;
            }
            case TokenType.PI:
            case TokenType.CDATA:
            case TokenType.Doctype:
                if (!afterNewline) out.push('\n');
                out.push(indentStr.repeat(depth), t.value);
                afterNewline = false;
                break;
            case TokenType.Comment:
                if (!afterNewline) out.push('\n');
                out.push(indentStr.repeat(depth), normalizeCommentWhitespace(t.value));
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
                if (isInline) {
                    if (!afterNewline) out.push('\n');
                    out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                    for (let j = idx + 1; j < endIdx; j++) {
                        const inner = tokens[j];
                        if (inner.type === TokenType.Text) {
                            out.push(collapseTextToLine(inner.value));
                        } else if (inner.type === TokenType.Comment) {
                            out.push(normalizeCommentWhitespace(inner.value));
                        } else if (inner.type === TokenType.CDATA || inner.type === TokenType.PI) {
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
                depth--;
                if (depth < 0) depth = 0;
                if (!afterNewline) {
                    out.push('\n');
                }
                out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                afterNewline = false;
                break;
        }
    }
    return out.join('');
}

/**
 * Format XML/XSLT content: child tags on new lines with indent; normalize text-node whitespace.
 */
export function formatXml(contents: string, indentSize: number = 4): string {
    const tokens = tokenize(contents);
    return formatWithIndent(tokens, indentSize);
}
