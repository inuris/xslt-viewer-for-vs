import * as vscode from 'vscode';
import * as fs from 'fs';

const BASE64_IMAGE_REGEX = /data:image\/(?:png|jpg|jpeg|gif|svg\+xml|webp);base64,([^"'\)\s]+)/g;

export interface ImageInfo {
    fullMatch: string;
    mime: string;
    base64: string;
    line: number;
    size: string;
    range: {
        file: string;
        startLine: number;
        startChar: number;
        endLine: number;
        endChar: number;
    };
}

export function scanImages(docs: (vscode.TextDocument | undefined)[]): ImageInfo[] {
    const images: ImageInfo[] = [];
    const seen = new Set<string>();

    docs.forEach(doc => {
        if (!doc) return;
        const text = doc.getText();
        let match;
        const regex = new RegExp(BASE64_IMAGE_REGEX.source, 'g');
        while ((match = regex.exec(text)) !== null) {
            const fullMatch = match[0];
            if (seen.has(fullMatch)) continue;
            seen.add(fullMatch);

            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + fullMatch.length);
            const mimeMatch = fullMatch.match(/data:(image\/[a-z+]+);/);

            images.push({
                fullMatch,
                mime: mimeMatch ? mimeMatch[1] : 'image/png',
                base64: match[1].replace(/\s/g, ''),
                line: startPos.line + 1,
                size: (match[1].length / 1024).toFixed(1) + ' KB',
                range: {
                    file: doc.fileName,
                    startLine: startPos.line,
                    startChar: startPos.character,
                    endLine: endPos.line,
                    endChar: endPos.character,
                },
            });
        }
    });
    return images;
}

export async function handleSaveImage(base64: string, mime: string): Promise<void> {
    const ext = mime.split('/')[1].replace('svg+xml', 'svg');
    const uri = await vscode.window.showSaveDialog({ filters: { Images: [ext] } });
    if (uri) {
        fs.writeFileSync(uri.fsPath, new Uint8Array(Buffer.from(base64, 'base64')));
    }
}

/**
 * Apply a replace in the document at the given range with the new data URI string.
 */
export async function applyReplaceImage(
    range: ImageInfo['range'],
    dataUri: string
): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(range.file));
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    await editor.edit(edit => {
        edit.replace(
            new vscode.Range(range.startLine, range.startChar, range.endLine, range.endChar),
            dataUri
        );
    });
}

export async function handleJumpToImage(range: ImageInfo['range'] | undefined): Promise<void> {
    if (!range || !range.file) return;
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(range.file));
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    const r = new vscode.Range(range.startLine, range.startChar, range.endLine, range.endChar);
    editor.revealRange(r, vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(r.start, r.end);
}
