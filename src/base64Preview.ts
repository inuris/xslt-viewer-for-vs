/**
 * Inlay hints, decorations, and hover preview for base64 image strings in XML/XSLT.
 * - Inlay hint: compact label like [📷 24KB PNG] before the base64
 * - Decoration: grayed-out / de-emphasized styling on the base64 span
 * - Hover: image preview when hovering over the base64
 */

import * as vscode from 'vscode';
import { handleSaveImage } from './images';

const BASE64_IMAGE_REGEX = /data:image\/(?:png|jpg|jpeg|gif|svg\+xml|webp);base64,([^"'\)\s]+)/g;

// Store hover data by lightweight id so we don't embed huge base64 payloads into command links.
const hoverImageStore = new Map<string, Base64Match>();
let hoverImageCounter = 0;

interface Base64Match {
    range: vscode.Range;
    mime: string;
    sizeKB: number;
    fullMatch: string;
    base64: string;
}

function findBase64Matches(doc: vscode.TextDocument): Base64Match[] {
    const matches: Base64Match[] = [];
    const text = doc.getText();
    let match;
    const regex = new RegExp(BASE64_IMAGE_REGEX.source, 'g');
    while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + fullMatch.length);
        const mimeMatch = fullMatch.match(/data:(image\/[a-z+]+);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const base64 = match[1].replace(/\s/g, '');
        matches.push({
            range: new vscode.Range(startPos, endPos),
            mime,
            sizeKB: Math.round((base64.length * 3) / 4 / 1024 * 10) / 10,
            fullMatch,
            base64,
        });
    }
    return matches;
}

function isXmlOrXsl(doc: vscode.TextDocument): boolean {
    const id = doc.languageId;
    const fn = doc.fileName.toLowerCase();
    return id === 'xml' || id === 'xsl' || fn.endsWith('.xml') || fn.endsWith('.xsl') || fn.endsWith('.xslt');
}

export function registerBase64Preview(context: vscode.ExtensionContext): void {
    const documentSelector: vscode.DocumentSelector = [
        { language: 'xml' },
        { language: 'xsl' },
        { pattern: '**/*.xml' },
        { pattern: '**/*.xsl' },
        { pattern: '**/*.xslt' },
    ];

    let decorationType: vscode.TextEditorDecorationType | undefined;
    let lastDecoratedEditor: vscode.TextEditor | undefined;

    const updateDecorations = (editor: vscode.TextEditor | undefined) => {
        if (!decorationType) {
            decorationType = vscode.window.createTextEditorDecorationType({
                opacity: '0.45',
                borderRadius: '2px',
                backgroundColor: new vscode.ThemeColor('editor.inactiveSelectionBackground'),
            });
        }
        if (lastDecoratedEditor && lastDecoratedEditor !== editor) {
            lastDecoratedEditor.setDecorations(decorationType, []);
            lastDecoratedEditor = undefined;
        }
        if (!editor || !isXmlOrXsl(editor.document)) return;
        const matches = findBase64Matches(editor.document);
        editor.setDecorations(decorationType, matches.map((m) => m.range));
        lastDecoratedEditor = editor;
    };

    const debouncedUpdate = (() => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        return () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                timeout = undefined;
                updateDecorations(vscode.window.activeTextEditor);
            }, 150);
        };
    })();

    context.subscriptions.push(
        vscode.languages.registerInlayHintsProvider(
            documentSelector,
            {
                provideInlayHints(
                    document: vscode.TextDocument,
                    range: vscode.Range
                ): vscode.InlayHint[] {
                    if (!isXmlOrXsl(document)) return [];
                    const matches = findBase64Matches(document);
                    const hints: vscode.InlayHint[] = [];
                    for (const m of matches) {
                        if (m.range.intersection(range)) {
                            hints.push({
                                position: m.range.start,
                                label: '📷',
                                paddingLeft: true,
                            });
                        }
                    }
                    return hints;
                },
            }
        )
    );

    context.subscriptions.push(
        vscode.languages.registerHoverProvider(documentSelector, {
            provideHover(
                document: vscode.TextDocument,
                position: vscode.Position
            ): vscode.Hover | undefined {
                if (!isXmlOrXsl(document)) return undefined;
                const matches = findBase64Matches(document);
                const hit = matches.find((m) => m.range.contains(position));
                if (!hit) return undefined;

                const id = String(hoverImageCounter++);
                hoverImageStore.set(id, hit);
                const md = new vscode.MarkdownString();
                md.isTrusted = true;
                // Allow raw <img> HTML so we can constrain thumbnail size
                (md as any).supportHtml = true;
                md.appendMarkdown(`**📷 Embedded image** · ${hit.mime} · ${hit.sizeKB} KB`);
                if (hit.sizeKB < 200) {
                    // Fixed-size thumbnail that fits within the hover without forcing scroll.
                    const safeSrc = hit.fullMatch.replace(/"/g, '&quot;');
                    md.appendMarkdown('\n\n');
                    md.appendMarkdown(
                        `<img src="${safeSrc}" width="260" style="max-height:200px;object-fit:contain;display:block;" />`
                    );
                }
                const arg = encodeURIComponent(JSON.stringify({ id }));
                md.appendMarkdown('\n\n');
                md.appendMarkdown(
                    `[💾 Save as image](command:xslt-viewer.saveEmbeddedImageFromHover?${arg})` +
                    '  •  ' +
                    `[📋 Copy base64](command:xslt-viewer.copyEmbeddedImageBase64?${arg})`
                );
                return new vscode.Hover(md, hit.range);
            },
        })
    );

    // Commands used by hover command links
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'xslt-viewer.saveEmbeddedImageFromHover',
            async (arg: { id?: string } | undefined) => {
                if (!arg?.id) return;
                const hit = hoverImageStore.get(arg.id);
                if (!hit) return;
                await handleSaveImage(hit.base64, hit.mime);
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'xslt-viewer.copyEmbeddedImageBase64',
            async (arg: { id?: string } | undefined) => {
                if (!arg?.id) return;
                const hit = hoverImageStore.get(arg.id);
                if (!hit) return;
                await vscode.env.clipboard.writeText(hit.base64);
                vscode.window.showInformationMessage('Base64 image copied to clipboard.');
            }
        )
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updateDecorations(editor);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            const editor = vscode.window.activeTextEditor;
            if (editor?.document.uri.toString() === e.document.uri.toString()) {
                debouncedUpdate();
            }
        })
    );

    updateDecorations(vscode.window.activeTextEditor);

    context.subscriptions.push({
        dispose: () => {
            decorationType?.dispose();
        },
    });
}
