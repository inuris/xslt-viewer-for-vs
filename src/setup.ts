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

function probeCommand(cmd: string, args: string[]): Promise<ProbeResult> {
    return new Promise(resolve => {
        try {
            // No shell:true — args are passed directly to the process so
            // multi-word arguments like ['-c', 'import lxml'] are never
            // misinterpreted by cmd.exe on Windows.
            const proc = spawn(cmd, args);
            let out = '';
            proc.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
            proc.stderr?.on('data', (d: Buffer) => { out += d.toString(); });
            proc.on('close', code => resolve({ ok: code === 0, output: out.trim() }));
            proc.on('error', e => resolve({ ok: false, output: e.message }));
        } catch (e: unknown) {
            resolve({ ok: false, output: e instanceof Error ? e.message : String(e) });
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
}

async function detectDeps(pythonPath: string): Promise<DetectResult> {
    const pyResult = await probeCommand(pythonPath, ['--version']);
    const lxmlResult = pyResult.ok
        ? await probeCommand(pythonPath, ['-c', 'import lxml; import lxml.etree; print(lxml.etree.LXML_VERSION)'])
        : { ok: false, output: '(skipped — Python not found)' };

    return {
        hasPython: pyResult.ok,
        hasLxml: lxmlResult.ok,
        pythonPath,
        pythonProbe: `${pythonPath} --version`,
        pythonOutput: pyResult.output || (pyResult.ok ? '(ok)' : '(no output)'),
        lxmlProbe: `${pythonPath} -c "import lxml"`,
        lxmlOutput: lxmlResult.output || (lxmlResult.ok ? '(ok)' : '(no output)'),
    };
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
    setupPanel.webview.html = getSetupHtml(result, platform);

    setupPanel.onDidDispose(() => { setupPanel = undefined; }, null, context.subscriptions);

    setupPanel.webview.onDidReceiveMessage(async (msg: { command: string }) => {
        if (msg.command === 'checkAgain') {
            if (setupPanel) setupPanel.webview.postMessage({ command: 'checking' });
            let didDispose = false;
            try {
                const pythonPath = vscode.workspace.getConfiguration('xslt-viewer').get<string>('pythonPath') ?? 'python';
                const fresh = await detectDeps(pythonPath);
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
            vscode.workspace.getConfiguration('xslt-viewer').update('pythonPath', msg.pythonPath.trim() || 'python', vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Python path saved. Click Check Again to verify.');
        }
    }, undefined, context.subscriptions);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Called on every activation. Opens the setup panel only if a dependency is missing. */
export async function checkDependencies(context: vscode.ExtensionContext): Promise<void> {
    const pythonPath = vscode.workspace.getConfiguration('xslt-viewer').get<string>('pythonPath') ?? 'python';
    const result = await detectDeps(pythonPath);
    if (result.hasPython && result.hasLxml) return;
    openOrRevealSetupPanel(context, result);
}

/** Forced open — triggered by the `xslt-viewer.showSetup` command. Always shows the panel. */
export async function showSetupForced(context: vscode.ExtensionContext): Promise<void> {
    const pythonPath = vscode.workspace.getConfiguration('xslt-viewer').get<string>('pythonPath') ?? 'python';
    const result = await detectDeps(pythonPath);
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
    return s.replace(/"/g, '&quot;');
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

function getLxmlInstallBody(platform: 'win' | 'mac' | 'linux', hasPython: boolean): string {
    if (!hasPython) {
        return '<p class="note">Complete Step 1 first, then come back to install lxml.</p>';
    }
    const cmd = platform === 'win' ? 'pip install lxml' : 'pip3 install lxml';
    return `
    <p>Open a terminal and run:</p>
    ${codeBlock(cmd)}
    <p class="alt">If you use a virtual environment or conda, activate it first, then run the same command.</p>`;
}

function getSetupHtml(result: DetectResult, platform: 'win' | 'mac' | 'linux'): string {
    const { hasPython, hasLxml, pythonPath } = result;
    const allGood = hasPython && hasLxml;

    const pythonStep = hasPython ? '' : step(1, 'Install Python 3', getPythonInstallBody(platform));
    const lxmlStep = hasLxml ? '' : step(hasPython ? 1 : 2, 'Install the <code>lxml</code> package', getLxmlInstallBody(platform, hasPython), !hasPython);
    const pathPlaceholder = platform === 'win' ? 'python' : 'python3';
    const pathStep = step(hasPython ? (hasLxml ? 1 : 2) : 3,
        'Custom Python path? <span class="optional">(optional)</span>',
        `<p>If Python is not on your system PATH, enter the full path to the interpreter:</p>
        <div class="path-input-row">
            <input type="text" id="python-path-input" class="path-input" value="${escAttr(pythonPath)}" placeholder="${pathPlaceholder}">
            <button class="action-btn primary" onclick="savePath()">Save</button>
        </div>
        <p class="alt">Use <code>python</code> or <code>python3</code> if it is on your PATH.</p>`
    );

    const diagSection = `
    <details class="diag-details">
        <summary>🔍 Diagnostic log</summary>
        <div class="diag-box">
            <div class="diag-path">Python path: <code>${escHtml(pythonPath)}</code></div>
            <table class="diag-table">
                <thead><tr><th>Command</th><th></th><th>Output</th></tr></thead>
                <tbody>
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

    /* ── Path input ── */
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

    /* ── All-good state ── */
    .all-good { text-align: center; padding: 48px 0 32px; }
    .all-good .big { font-size: 48px; margin-bottom: 16px; }
    .all-good p { color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
</style>
</head>
<body>

${allGood ? `
<div class="all-good">
    <div class="big">✅</div>
    <h2 style="margin-bottom:8px">All set!</h2>
    <p>Python and lxml are installed. XSLT Viewer is ready to use.</p>
</div>
` : `
<div class="header">
    <div class="header-icon">⚙️</div>
    <div>
        <div class="header-title">XSLT Viewer — Quick Setup</div>
        <div class="header-sub">This extension needs Python 3 + the <code>lxml</code> package to run transformations.</div>
    </div>
</div>

<div class="status-row">
    ${badge(hasPython, 'Python 3')}
    ${badge(hasLxml, 'lxml')}
</div>

<div class="steps-title">Follow the steps below to get started:</div>

${pythonStep}
${lxmlStep}
${pathStep}

<div class="actions">
    <button class="action-btn primary" id="btn-check" onclick="startCheck()">⟳ Check Again</button>
    <span style="font-size:12px; color:var(--vscode-descriptionForeground)">After installing, click to re-verify.</span>
</div>
`}

${diagSection}

<script>
    const vscode = acquireVsCodeApi();
    function post(cmd, data) { vscode.postMessage({ command: cmd, ...data }); }

    function savePath() {
        const input = document.getElementById('python-path-input');
        const val = input ? input.value.trim() : '';
        post('savePythonPath', { pythonPath: val || 'python' });
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
