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
        const scriptPath = context.asAbsolutePath(path.join('src', 'python', 'transform.py'));
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
 */
export function instrumentXslt(xsltContent: string): string {
    const lines = xsltContent.split('\n');
    return lines
        .map((line, index) => {
            const lineNum = index + 1;
            return line.replace(
                /<(?!(?:\/|xsl:|[\?!]))([a-zA-Z0-9_:-]+)([^>]*)>/g,
                (match, tagName, attributes) => {
                    if (attributes.includes('data-source-line')) return match;
                    return `<${tagName} data-source-line="${lineNum}"${attributes}>`;
                }
            );
        })
        .join('\n');
}
