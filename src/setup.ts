/**
 * First-run dependency check: verifies Python and lxml are available.
 * If either is missing, opens a setup guide webview panel.
 * The command `xslt-viewer.showSetup` forces the panel open at any time.
 */

import * as vscode from 'vscode';
import { spawn } from 'child_process';

// ─── Detection ───────────────────────────────────────────────────────────────

interface ProbeResult {
    ok: boolean;
    output: string; // combined stdout + stderr, trimmed
}

const PROBE_TIMEOUT_MS = 15000;

function probeCommand(cmd: string, args: string[]): Promise<ProbeResult> {
    return new Promise(resolve => {
        let settled = false;
        const finish = (r: ProbeResult) => { if (!settled) { settled = true; resolve(r); } };
        try {
            // No shell:true — args are passed directly to the process so
            // multi-word arguments like ['-c', 'import lxml'] are never
            // misinterpreted by cmd.exe on Windows.
            const proc = spawn(cmd, args);
            let out = '';
            // A hung interpreter must not leave the "Checking…" button stuck forever.
            const timer = setTimeout(() => {
                proc.kill();
                finish({ ok: false, output: (out.trim() + `\n(timed out after ${PROBE_TIMEOUT_MS / 1000}s)`).trim() });
            }, PROBE_TIMEOUT_MS);
            proc.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
            proc.stderr?.on('data', (d: Buffer) => { out += d.toString(); });
            proc.on('close', code => { clearTimeout(timer); finish({ ok: code === 0, output: out.trim() }); });
            proc.on('error', e => { clearTimeout(timer); finish({ ok: false, output: e.message }); });
        } catch (e: unknown) {
            finish({ ok: false, output: e instanceof Error ? e.message : String(e) });
        }
    });
}

interface DetectResult {
    hasPython: boolean;
    hasLxml: boolean;
    pythonPath: string;
    pythonProbe: string;  // label for log: "python --version"
    pythonOutput: string;
    lxmlProbe: string;    // label for log: "python -c import lxml"
    lxmlOutput: string;
    /** Set when the configured path failed and an auto-detected interpreter is used instead. */
    fallbackFrom?: { path: string; output: string };
}

/** Interpreter chosen by the last check: the configured path, or an auto-detected one. */
let detectedPythonPath: string | undefined;

/** True when the user explicitly configured xslt-viewer.pythonPath (any scope). */
function isPythonPathExplicit(): boolean {
    const info = vscode.workspace.getConfiguration('xslt-viewer').inspect<string>('pythonPath');
    const v = info?.workspaceFolderValue ?? info?.workspaceValue ?? info?.globalValue;
    return typeof v === 'string' && v.trim() !== '';
}

function configuredPythonPath(): string {
    return (vscode.workspace.getConfiguration('xslt-viewer').get<string>('pythonPath') || '').trim() || 'python';
}

/**
 * The interpreter the extension should run. Uses the user's setting when set,
 * otherwise whatever auto-detection found (e.g. `python3` on macOS/Linux where
 * plain `python` usually doesn't exist), falling back to `python`.
 */
export function getPythonPath(): string {
    return detectedPythonPath ?? configuredPythonPath();
}

/** Candidates tried, in order, when the user has not set a path. */
function autoCandidates(): string[] {
    return process.platform === 'win32'
        ? ['python', 'py', 'python3']
        : ['python3', 'python'];
}

/** Parses "Python 3.12.1" → 3. Returns undefined when the output has no version. */
function pythonMajor(output: string): number | undefined {
    const m = /Python\s+(\d+)\./i.exec(output);
    return m ? Number(m[1]) : undefined;
}

async function probePython(pythonPath: string): Promise<ProbeResult> {
    const r = await probeCommand(pythonPath, ['--version']);
    if (!r.ok) return r;
    const major = pythonMajor(r.output);
    // transform.py needs Python 3 — Python 2's `--version` also exits 0.
    if (major !== undefined && major < 3) {
        return { ok: false, output: `${r.output} (Python 3 is required)` };
    }
    return r;
}

async function detectAt(pythonPath: string, pyResult: ProbeResult): Promise<DetectResult> {
    const lxmlResult = pyResult.ok
        ? await probeCommand(pythonPath, ['-c', 'import lxml.etree; print(lxml.etree.LXML_VERSION)'])
        : { ok: false, output: '(skipped — Python not found)' };

    return {
        hasPython: pyResult.ok,
        hasLxml: lxmlResult.ok,
        pythonPath,
        pythonProbe: `${pythonPath} --version`,
        pythonOutput: pyResult.output || (pyResult.ok ? '(ok)' : '(no output)'),
        lxmlProbe: `${pythonPath} -c "import lxml.etree"`,
        lxmlOutput: lxmlResult.output || (lxmlResult.ok ? '(ok)' : '(no output)'),
    };
}

async function autoDetect(): Promise<DetectResult> {
    // Prefer the first candidate that has lxml, else the first Python 3 found.
    let firstPython: DetectResult | undefined;
    let firstFailure: DetectResult | undefined;
    for (const candidate of autoCandidates()) {
        const result = await detectAt(candidate, await probePython(candidate));
        if (result.hasPython && result.hasLxml) return result;
        if (result.hasPython && !firstPython) firstPython = result;
        if (!firstFailure) firstFailure = result;
    }
    return firstPython ?? firstFailure!;
}

async function detectDeps(): Promise<DetectResult> {
    let result: DetectResult;
    if (isPythonPathExplicit()) {
        const p = configuredPythonPath();
        const py = await probePython(p);
        result = await detectAt(p, py);
        if (!py.ok) {
            // The saved path is gone (e.g. an uninstalled pyenv version, or a path
            // synced from another PC). Fall back to whatever Python is on PATH.
            const auto = await autoDetect();
            if (auto.hasPython) {
                result = { ...auto, fallbackFrom: { path: p, output: py.output } };
            }
        }
    } else {
        result = await autoDetect();
    }
    detectedPythonPath = result.hasPython ? result.pythonPath : undefined;
    return result;
}

// ─── Panel singleton ─────────────────────────────────────────────────────────

let setupPanel: vscode.WebviewPanel | undefined;

function openOrRevealSetupPanel(context: vscode.ExtensionContext, result: DetectResult): void {
    const platform: 'win' | 'mac' | 'linux' =
        process.platform === 'win32' ? 'win' :
        process.platform === 'darwin' ? 'mac' : 'linux';

    if (setupPanel) {
        setupPanel.webview.html = getSetupHtml(result, platform);
        setupPanel.reveal(vscode.ViewColumn.One);
        return;
    }

    setupPanel = vscode.window.createWebviewPanel(
        'xsltViewerSetup',
        'XSLT Viewer — Setup',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    setupPanel.iconPath = {
        light: vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', 'setup-light.svg'),
        dark: vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', 'setup-dark.svg'),
    };
    setupPanel.webview.html = getSetupHtml(result, platform);

    setupPanel.onDidDispose(() => { setupPanel = undefined; }, null, context.subscriptions);

interface SetupMessage {
    command: string;
    pythonPath?: string;
}

setupPanel.webview.onDidReceiveMessage(async (msg: SetupMessage) => {
        if (msg.command === 'checkAgain') {
            if (setupPanel) setupPanel.webview.postMessage({ command: 'checking' });
            let didDispose = false;
            try {
                const fresh = await detectDeps();
                if (fresh.hasPython && fresh.hasLxml) {
                    setupPanel?.dispose();
                    didDispose = true;
                    vscode.window.showInformationMessage('✅ Python and lxml are ready. XSLT Viewer is good to go!');
                } else {
                    if (setupPanel) setupPanel.webview.html = getSetupHtml(fresh, platform);
                }
            } finally {
                if (!didDispose && setupPanel) {
                    setupPanel.webview.postMessage({ command: 'checkDone' });
                }
            }
        }
        if (msg.command === 'savePythonPath' && typeof msg.pythonPath === 'string') {
            // Await the write so the re-check below reads the new value, not the old one.
            // An empty path clears the setting and returns to auto-detection.
            await vscode.workspace.getConfiguration('xslt-viewer').update('pythonPath', msg.pythonPath.trim() || undefined, vscode.ConfigurationTarget.Global);
            if (!setupPanel) return;
            setupPanel.webview.postMessage({ command: 'checking' });
            const fresh = await detectDeps();
            if (fresh.hasPython && fresh.hasLxml) {
                setupPanel?.dispose();
                vscode.window.showInformationMessage('✅ Python path saved. Python and lxml are ready. XSLT Viewer is good to go!');
            } else if (setupPanel) {
                setupPanel.webview.html = getSetupHtml(fresh, platform);
                vscode.window.showWarningMessage('Python path saved, but the check still fails. See the diagnostic log in the setup panel.');
            }
        }
    }, undefined, context.subscriptions);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Called on every activation. Opens the setup panel only if a dependency is missing. */
export async function checkDependencies(context: vscode.ExtensionContext): Promise<void> {
    const result = await detectDeps();
    if (result.hasPython && result.hasLxml) {
        if (result.fallbackFrom) {
            vscode.window.showWarningMessage(
                `XSLT Viewer: the saved Python path "${result.fallbackFrom.path}" no longer works, so "${result.pythonPath}" is being used instead. Update or clear the xslt-viewer.pythonPath setting.`);
        }
        return;
    }
    openOrRevealSetupPanel(context, result);
}

/** Forced open — triggered by the `xslt-viewer.showSetup` command. Always shows the panel. */
export async function showSetupForced(context: vscode.ExtensionContext): Promise<void> {
    const result = await detectDeps();
    openOrRevealSetupPanel(context, result);
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function badge(ok: boolean, label: string): string {
    return ok
        ? `<span class="badge ok">✓ ${label}</span>`
        : `<span class="badge fail">✗ ${label} not found</span>`;
}

function step(n: number, title: string, body: string, disabled = false): string {
    return `
    <div class="step${disabled ? ' disabled' : ''}">
        <div class="step-header"><span class="step-num">${n}</span><span class="step-title">${title}</span></div>
        <div class="step-body">${body}</div>
    </div>`;
}

function codeBlock(cmd: string): string {
    return `
    <div class="code-row">
        <code class="cmd">${escHtml(cmd)}</code>
        <button class="copy-btn" onclick="copy(this)" data-cmd="${escAttr(cmd)}">Copy</button>
    </div>`;
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
    return escHtml(s).replace(/"/g, '&quot;');
}

function diagRow(probe: string, ok: boolean, output: string): string {
    const icon = ok ? '<span class="diag-ok">✓</span>' : '<span class="diag-fail">✗</span>';
    return `
    <tr>
        <td class="diag-probe">${escHtml(probe)}</td>
        <td class="diag-status">${icon}</td>
        <td class="diag-out">${escHtml(output || '(no output)')}</td>
    </tr>`;
}

function getPythonInstallBody(platform: 'win' | 'mac' | 'linux'): string {
    const tabs: Record<string, string> = {
        Windows: `
            <p>The fastest option — open <strong>PowerShell</strong> and run:</p>
            ${codeBlock('winget install -e --id Python.Python.3')}
            <p class="alt">Or download the installer from <a href="https://www.python.org/downloads/">python.org/downloads</a>.<br>
            <em>Important: check "Add Python to PATH" during install.</em></p>`,
        macOS: `
            <p>If you have <a href="https://brew.sh">Homebrew</a>:</p>
            ${codeBlock('brew install python3')}
            <p class="alt">Or download the installer from <a href="https://www.python.org/downloads/">python.org/downloads</a>.</p>`,
        Linux: `
            <p><strong>Ubuntu / Debian:</strong></p>
            ${codeBlock('sudo apt update && sudo apt install python3 python3-pip')}
            <p class="alt"><strong>Fedora / RHEL:</strong></p>
            ${codeBlock('sudo dnf install python3 python3-pip')}`,
    };

    const order = platform === 'win' ? ['Windows', 'macOS', 'Linux']
                : platform === 'mac' ? ['macOS', 'Windows', 'Linux']
                : ['Linux', 'Windows', 'macOS'];

    return `
    <div class="tabs" id="python-tabs">
        ${order.map((name, i) => `<button class="tab${i === 0 ? ' active' : ''}" onclick="switchTab('python-tabs', this, 'py-${name}')">${name}</button>`).join('')}
    </div>
    ${order.map((name, i) => `<div class="tab-panel${i === 0 ? ' active' : ''}" id="py-${name}">${tabs[name]}</div>`).join('')}`;
}

function getLxmlInstallBody(pythonPath: string, hasPython: boolean): string {
    if (!hasPython) {
        return '<p class="note">Complete Step 1 first, then come back to install lxml.</p>';
    }
    // Install into the exact interpreter the extension uses, not whichever pip is on PATH.
    const exe = /\s/.test(pythonPath) ? `"${pythonPath}"` : pythonPath;
    const cmd = `${exe} -m pip install lxml`;
    return `
    <p>Open a terminal and run:</p>
    ${codeBlock(cmd)}
    <p class="alt">If you use a virtual environment or conda, activate it first, then run the same command.</p>`;
}

function getSetupHtml(result: DetectResult, platform: 'win' | 'mac' | 'linux'): string {
    const { hasPython, hasLxml, pythonPath } = result;
    const allGood = hasPython && hasLxml;

    const pathPlaceholder = platform === 'win' ? 'python' : 'python3';

    // Step 1: Python – when missing, show both install + custom path; hide completely once resolved.
    const pythonStep = hasPython
        ? ''
        : step(
            1,
            'Python 3',
            `
        <div class="sub-section">
            <div class="sub-title">1. Install Python 3</div>
            ${getPythonInstallBody(platform)}
        </div>
        <div class="sub-separator"></div>
        <div class="sub-section">
            <div class="sub-title">2. Or set a custom Python path</div>
            <p>If you already installed Python but it is not on your PATH, point XSLT Viewer to the full interpreter path:</p>
            <div class="path-input-row">
                <input type="text" id="python-path-input" class="path-input" value="${escAttr(pythonPath)}" placeholder="${pathPlaceholder}">
                <button class="action-btn primary" onclick="savePath()">Save</button>
            </div>
            <p class="alt">Example: <code>C:\\Python312\\python.exe</code> on Windows or <code>/usr/local/bin/python3</code> on macOS/Linux.</p>
        </div>`
        );

    // Step 2 (or 1 when Python is already OK): lxml
    const lxmlStep = hasLxml
        ? ''
        : step(
            hasPython ? 1 : 2,
            'Install the <code>lxml</code> package',
            getLxmlInstallBody(pythonPath, hasPython),
            !hasPython
        );

    const diagSection = `
    <details class="diag-details">
        <summary>🔍 Diagnostic log</summary>
        <div class="diag-box">
            <div class="diag-path">Python path: <code>${escHtml(pythonPath)}</code></div>
            <table class="diag-table">
                <thead><tr><th>Command</th><th></th><th>Output</th></tr></thead>
                <tbody>
                    ${result.fallbackFrom ? diagRow(`${result.fallbackFrom.path} --version`, false, result.fallbackFrom.output) : ''}
                    ${diagRow(result.pythonProbe, result.hasPython, result.pythonOutput)}
                    ${diagRow(result.lxmlProbe, result.hasLxml, result.lxmlOutput)}
                </tbody>
            </table>
        </div>
    </details>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
        font-family: var(--vscode-font-family);
        font-size: 13px;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        padding: 40px 48px 60px;
        max-width: 720px;
    }

    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Header ── */
    .header { display: flex; align-items: flex-start; gap: 18px; margin-bottom: 32px; }
    .header-icon { font-size: 36px; line-height: 1; flex-shrink: 0; }
    .header-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header-sub { font-size: 13px; color: var(--vscode-descriptionForeground); }

    .fallback-note {
        font-size: 12px; line-height: 1.6; margin-bottom: 16px; padding: 10px 14px; border-radius: 6px;
        background: rgba(230,160,40,0.12); border: 1px solid rgba(230,160,40,0.3);
    }
    .fallback-note code { font-family: var(--vscode-editor-font-family, monospace); }

    /* ── Status badges ── */
    .status-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 32px; }
    .badge {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
    }
    .badge.ok   { background: rgba(50,205,50,0.15); color: #4caf50; border: 1px solid rgba(50,205,50,0.3); }
    .badge.fail { background: rgba(220,60,60,0.12); color: #e05252; border: 1px solid rgba(220,60,60,0.25); }

    /* ── Steps ── */
    .steps-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
    .step {
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        margin-bottom: 14px;
        overflow: hidden;
        background: var(--vscode-sideBar-background);
    }
    .step.disabled { opacity: 0.45; pointer-events: none; }
    .step-header {
        display: flex; align-items: center; gap: 12px;
        padding: 12px 16px;
        background: var(--vscode-list-hoverBackground);
        border-bottom: 1px solid var(--vscode-widget-border);
    }
    .step-num {
        width: 24px; height: 24px; border-radius: 50%;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .step-title { font-weight: 600; font-size: 13px; }
    .optional { font-weight: 400; font-size: 11px; color: var(--vscode-descriptionForeground); }
    .step-body { padding: 14px 16px; }
    .step-body p { margin-bottom: 10px; line-height: 1.6; }
    .step-body p:last-child { margin-bottom: 0; }
    .alt  { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .note { font-size: 12px; color: var(--vscode-descriptionForeground); font-style: italic; }

    /* ── Code rows ── */
    .code-row {
        display: flex; align-items: center; gap: 8px;
        background: var(--vscode-terminal-background, var(--vscode-editor-background));
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        padding: 8px 10px;
        margin-bottom: 10px;
    }
    .cmd {
        flex: 1;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: 12px;
        color: var(--vscode-terminal-foreground, var(--vscode-editor-foreground));
        overflow: auto; white-space: pre; user-select: all;
    }
    .copy-btn {
        flex-shrink: 0;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 3px; padding: 3px 9px; font-size: 11px; cursor: pointer;
    }
    .copy-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .copy-btn.copied { color: #4caf50; }

    /* ── Tabs ── */
    .tabs { display: flex; gap: 2px; margin-bottom: 12px; }
    .tab {
        background: none; border: none;
        border-bottom: 2px solid transparent;
        padding: 4px 12px; font-size: 12px; cursor: pointer;
        color: var(--vscode-descriptionForeground);
    }
    .tab.active { color: var(--vscode-foreground); border-bottom-color: var(--vscode-button-background); font-weight: 600; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* ── Action buttons ── */
    .actions { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; align-items: center; }
    .action-btn { padding: 8px 18px; border-radius: 4px; font-size: 13px; cursor: pointer; border: none; font-weight: 500; }
    .action-btn.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .action-btn.primary:hover { background: var(--vscode-button-hoverBackground); }
    .action-btn.primary:disabled { opacity: 0.6; cursor: default; }
    .action-btn.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border, transparent); }
    .action-btn.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

    /* ── Path / sub-sections ── */
    .path-input-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
    .path-input {
        flex: 1;
        min-width: 0;
        padding: 8px 12px;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: 12px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
    }
    .sub-section { margin-bottom: 10px; }
    .sub-title {
        font-weight: 600;
        font-size: 12px;
        margin-bottom: 6px;
        color: var(--vscode-foreground);
    }
    .sub-separator {
        height: 1px;
        background: var(--vscode-widget-border);
        opacity: 0.4;
        margin: 10px 0;
    }

    /* ── Diagnostic log ── */
    .diag-details {
        margin-top: 32px;
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        overflow: hidden;
    }
    .diag-details summary {
        padding: 10px 14px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        background: var(--vscode-list-hoverBackground);
        user-select: none;
        list-style: none;
    }
    .diag-details summary::-webkit-details-marker { display: none; }
    .diag-details[open] summary { border-bottom: 1px solid var(--vscode-widget-border); }
    .diag-box { padding: 12px 14px; }
    .diag-path { font-size: 12px; margin-bottom: 12px; color: var(--vscode-descriptionForeground); }
    .diag-path code { font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-foreground); }
    .diag-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .diag-table th { text-align: left; padding: 4px 8px; color: var(--vscode-descriptionForeground); font-weight: 600; border-bottom: 1px solid var(--vscode-widget-border); }
    .diag-table td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15)); }
    .diag-table tr:last-child td { border-bottom: none; }
    .diag-probe { font-family: var(--vscode-editor-font-family, monospace); white-space: nowrap; color: var(--vscode-foreground); }
    .diag-status { text-align: center; white-space: nowrap; }
    .diag-out { font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-descriptionForeground); word-break: break-all; }
    .diag-ok   { color: #4caf50; font-weight: 700; }
    .diag-fail { color: #e05252; font-weight: 700; }

</style>
</head>
<body>

<div class="header">
    <div class="header-icon">⚙️</div>
    <div>
        <div class="header-title">XSLT Viewer — Quick Setup</div>
        <div class="header-sub">${
            allGood
                ? 'All checks passed. Python 3 and the lxml package are ready to use.'
                : 'This extension needs Python 3 + the <code>lxml</code> package to run transformations.'
        }</div>
    </div>
</div>

${result.fallbackFrom ? `<div class="fallback-note">Your saved Python path <code>${escHtml(result.fallbackFrom.path)}</code> no longer works, so XSLT Viewer is using <code>${escHtml(pythonPath)}</code> instead. Clear or update the path in Settings (<code>xslt-viewer.pythonPath</code>) to stop seeing this.</div>` : ''}

<div class="status-row">
    ${badge(hasPython, 'Python 3')}
    ${badge(hasLxml, 'lxml')}
</div>

<div class="steps-title">Follow the steps below to get started:</div>

${pythonStep}
${lxmlStep}

<div class="actions">
    <button class="action-btn primary" id="btn-check" onclick="startCheck()">⟳ ${allGood ? 'Run Check Again' : 'Check Again'}</button>
    <span style="font-size:12px; color:var(--vscode-descriptionForeground)">${
        allGood
            ? 'You can re-run the check any time if you change environments.'
            : 'After installing, click to re-verify.'
    }</span>
</div>

${diagSection}

<script>
    const vscode = acquireVsCodeApi();
    function post(cmd, data) { vscode.postMessage({ command: cmd, ...data }); }

    function savePath() {
        const input = document.getElementById('python-path-input');
        const val = input ? input.value.trim() : '';
        post('savePythonPath', { pythonPath: val });
    }

    function startCheck() {
        const btn = document.getElementById('btn-check');
        if (btn) { btn.textContent = '⟳ Checking…'; btn.disabled = true; }
        post('checkAgain');
    }

    window.addEventListener('message', e => {
        if (e.data.command === 'checking') {
            const btn = document.getElementById('btn-check');
            if (btn) { btn.textContent = '⟳ Checking…'; btn.disabled = true; }
        }
        if (e.data.command === 'checkDone') {
            const btn = document.getElementById('btn-check');
            if (btn) { btn.textContent = '⟳ Check Again'; btn.disabled = false; }
        }
    });

    function switchTab(groupId, btn, panelId) {
        const group = document.getElementById(groupId);
        group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const container = btn.closest('.step-body');
        container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(panelId).classList.add('active');
    }

    function copy(btn) {
        const cmd = btn.getAttribute('data-cmd');
        navigator.clipboard.writeText(cmd).then(() => {
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1800);
        });
    }
</script>
</body>
</html>`;
}
