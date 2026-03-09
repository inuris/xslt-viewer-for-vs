import * as vscode from 'vscode';

export function findAndJump(doc: vscode.TextDocument, info: { line?: string; id?: string; className?: string }): void {
    const text = doc.getText();
    if (info.line) {
        const line = parseInt(info.line, 10) - 1;
        const range = new vscode.Range(line, 0, line, 0);
        showRange(doc, range);
        return;
    }

    let offset = -1;
    if (info.id) {
        offset = text.indexOf(`id="${info.id}"`);
        if (offset === -1) offset = text.indexOf(`id='${info.id}'`);
    }
    if (offset === -1 && info.className) {
        offset = text.indexOf(`class="${info.className.split(' ')[0]}`);
    }
    if (offset > -1) {
        const pos = doc.positionAt(offset);
        showRange(doc, new vscode.Range(pos, pos));
    }
}

export function showRange(doc: vscode.TextDocument, range: vscode.Range): void {
    vscode.window.showTextDocument(doc, { selection: range, viewColumn: vscode.ViewColumn.One });
}
