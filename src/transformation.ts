import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

/**
 * Run XSLT transformation via Python lxml script.
 * stdin: JSON { xmlContent, xsltContent }, stdout: result bytes (e.g. HTML).
 */
export function runPythonTransformation(
    context: vscode.ExtensionContext,
    xml: string,
    xslt: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = context.asAbsolutePath(path.join('resources', 'python', 'transform.py'));
        const config = vscode.workspace.getConfiguration('xslt-viewer');
        const pythonPath = config.get<string>('pythonPath') || 'python';

        const proc = cp.spawn(pythonPath, [scriptPath]);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => (stdout += d.toString()));
        proc.stderr.on('data', d => (stderr += d.toString()));

        proc.on('close', code => {
            if (code !== 0) reject(new Error(stderr || stdout));
            else resolve(stdout);
        });
        proc.on('error', err => reject(err));

        proc.stdin.write(JSON.stringify({ xmlContent: xml, xsltContent: xslt }));
        proc.stdin.end();
    });
}

/**
 * Inject data-source-line attributes into output elements for click-to-jump.
 *
 * IMPORTANT: this scans the whole document (not line-by-line) and explicitly
 * skips over XML comments (<!-- ... -->) and CDATA sections (<![CDATA[ ... ]]>).
 * A naive per-line tag regex will happily "match" text inside a comment that
 * merely looks like a tag start (e.g. a comment containing `<someVarName`),
 * corrupting the comment's `-->` terminator and silently shifting the whole
 * document's element nesting. That previously caused libxslt errors such as
 * "element template only allowed as child of stylesheet" even though the
 * original XSLT file was perfectly valid.
 */
export function instrumentXslt(xsltContent: string): string {
    const pattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<((?!\/|xsl:|[?!])[a-zA-Z0-9_:-]+)([^>]*)>/g;
    let result = '';
    let lastIndex = 0;
    let line = 1;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(xsltContent)) !== null) {
        const [full, tagName, attributes] = match;

        // Count newlines between the previous match and this one to keep the line counter accurate.
        for (let i = lastIndex; i < match.index; i++) {
            if (xsltContent.charCodeAt(i) === 10) line++;
        }
        result += xsltContent.slice(lastIndex, match.index);

        if (tagName === undefined || attributes.includes('data-source-line')) {
            // Comment / CDATA section, or a tag that's already instrumented: leave untouched.
            result += full;
        } else {
            result += `<${tagName} data-source-line="${line}"${attributes}>`;
        }

        // Account for newlines inside the matched text itself before continuing.
        for (let i = match.index; i < pattern.lastIndex; i++) {
            if (xsltContent.charCodeAt(i) === 10) line++;
        }
        lastIndex = pattern.lastIndex;
    }

    result += xsltContent.slice(lastIndex);
    return result;
}
