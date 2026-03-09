import * as vscode from 'vscode';
import * as path from 'path';

export async function pickWorkspaceFile(
    prompt: string,
    extensions: string[],
    contextFolder?: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
    let files: vscode.Uri[] = [];

    if (contextFolder) {
        try {
            const entries = await vscode.workspace.fs.readDirectory(contextFolder);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File) {
                    const ext = path.extname(name).slice(1).toLowerCase();
                    if (extensions.includes(ext)) {
                        files.push(vscode.Uri.joinPath(contextFolder, name));
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        files = await vscode.workspace.findFiles(
            `**/*.{${extensions.join(',')}}`,
            '**/node_modules/**'
        );
    }

    if (files.length === 0) {
        vscode.window.showErrorMessage(
            `No .${extensions[0]} files found in ${contextFolder ? 'current folder' : 'workspace'}`
        );
        return undefined;
    }

    const items = files.map(uri => ({
        label: path.basename(uri.fsPath),
        description: vscode.workspace.asRelativePath(uri),
        uri,
    }));

    const result = await vscode.window.showQuickPick(items, { placeHolder: prompt });
    return result ? await vscode.workspace.openTextDocument(result.uri) : undefined;
}

export async function updateXmlStylesheetLink(
    xmlDoc: vscode.TextDocument,
    xsltDoc: vscode.TextDocument
): Promise<void> {
    const xmlPath = xmlDoc.uri.fsPath;
    const xsltPath = xsltDoc.uri.fsPath;

    let relPath = path.relative(path.dirname(xmlPath), xsltPath);
    relPath = relPath.split(path.sep).join('/');

    const text = xmlDoc.getText();
    const match = text.match(
        /(<\?xml-stylesheet\s+(?:[^?]*\s+)?href=["'])([^"']*)(["'](?:[^?]*)?\?>)/);

    const edit = new vscode.WorkspaceEdit();

    if (match) {
        const startOffset = match.index! + match[1].length;
        const endOffset = startOffset + match[2].length;
        const range = new vscode.Range(
            xmlDoc.positionAt(startOffset),
            xmlDoc.positionAt(endOffset)
        );
        edit.replace(xmlDoc.uri, range, relPath);
    } else {
        const xmlDeclMatch = text.match(/^<\?xml\s+[^?]*\?>\s*/);
        let insertPos = new vscode.Position(0, 0);
        if (xmlDeclMatch) {
            insertPos = xmlDoc.positionAt(xmlDeclMatch[0].length);
        }
        const newPI = `\n<?xml-stylesheet type='text/xsl' href='${relPath}' ?>\n`;
        edit.insert(xmlDoc.uri, insertPos, newPI);
    }

    try {
        await vscode.workspace.applyEdit(edit);
        await xmlDoc.save();
        vscode.window.setStatusBarMessage(`Linked XSLT updated to: ${relPath}`, 3000);
    } catch (e) {
        console.error('Failed to update XML stylesheet link:', e);
    }
}
