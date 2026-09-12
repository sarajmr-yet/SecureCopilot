"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const WebSocketLib = require('ws');
const BACKEND_URL = 'http://127.0.0.1:8000/api/v1/analyze';
const PROJECT_ID = 1; // ← ID du projet "Backend SecureCopilot"
let authToken;
let currentUserId;
let currentProjectId;
let statusBar;
const criticalDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    border: '1px solid red',
    borderRadius: '2px',
});
const highDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    border: '1px solid orange',
    borderRadius: '2px',
});
const mediumDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 255, 0, 0.15)',
    border: '1px solid yellow',
    borderRadius: '2px',
});
let diagnosticCollection;
let timeout;
let vulnerabilityMap = new Map();
let wsConnection;
let reconnectTimeout;
async function loginUser(context) {
    const username = await vscode.window.showInputBox({
        prompt: '🔐 SecureCopilot — Nom d\'utilisateur',
        placeHolder: 'Entrez votre nom d\'utilisateur'
    });
    if (!username) {
        return;
    }
    const password = await vscode.window.showInputBox({
        prompt: '🔐 SecureCopilot — Mot de passe',
        placeHolder: 'Entrez votre mot de passe',
        password: true
    });
    if (!password) {
        return;
    }
    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        const response = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });
        if (!response.ok) {
            vscode.window.showErrorMessage('❌ Identifiants incorrects !');
            return;
        }
        const data = await response.json();
        authToken = data.access_token;
        // Récupérer les infos du user
        const meResponse = await fetch('http://127.0.0.1:8000/api/v1/auth/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const me = await meResponse.json();
        currentUserId = me.id;
        // Récupérer les projets du user
        const projectsResponse = await fetch('http://127.0.0.1:8000/api/v1/auth/projects', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const projectsData = await projectsResponse.json();
        if (projectsData.length === 0) {
            vscode.window.showWarningMessage('⚠️ Aucun projet assigné — contactez votre admin');
            return;
        }
        else if (projectsData.length === 1) {
            currentProjectId = projectsData[0].id;
            statusBar.text = `🔐 SecureCopilot | ✅ ${me.username} | 📁 ${projectsData[0].name}`;
            statusBar.tooltip = `Connecté en tant que ${me.username}`;
            statusBar.backgroundColor = undefined;
            vscode.window.showInformationMessage(`✅ Connecté en tant que ${me.username} — Projet : ${projectsData[0].name}`);
        }
        else {
            // Plusieurs projets → afficher un menu
            const items = projectsData.map((p) => ({
                label: `📁 ${p.name}`,
                description: p.description || '',
                id: p.id
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Choisissez votre projet de travail'
            });
            if (!selected) {
                vscode.window.showWarningMessage('⚠️ Aucun projet sélectionné');
                return;
            }
            currentProjectId = selected.id;
            statusBar.text = `🔐 SecureCopilot | ✅ ${me.username} | 📁 ${selected.label}`;
            statusBar.tooltip = `Connecté en tant que ${me.username}`;
            vscode.window.showInformationMessage(`✅ Connecté en tant que ${me.username} — Projet : ${selected.label}`);
        }
        // Sauvegarder le token
        if (authToken) {
            5;
            await context.secrets.store('authToken', authToken);
        }
        vscode.window.showInformationMessage(`✅ Connecté en tant que ${me.username} — Projet : ${projectsData[0]?.name || 'Aucun'}`);
    }
    catch (error) {
        statusBar.text = '🔐 SecureCopilot | ❌ Erreur connexion';
        vscode.window.showErrorMessage('❌ Erreur de connexion au serveur');
    }
}
function activate(context) {
    console.log('Secure Copilot is now active!');
    // Créer la barre de statut
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = '🔐 SecureCopilot | ❌ Non connecté';
    statusBar.tooltip = 'Cliquez pour vous connecter';
    statusBar.command = 'secureCopilot.login';
    statusBar.show();
    context.subscriptions.push(statusBar);
    // Login au démarrage
    loginUser(context).then(() => {
        connectWebSocket(context);
    });
    diagnosticCollection = vscode.languages.createDiagnosticCollection('secureCopilot');
    context.subscriptions.push(diagnosticCollection);
    const quickFixProvider = vscode.languages.registerCodeActionsProvider('python', new SecureCodeActionProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] });
    context.subscriptions.push(quickFixProvider);
    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'python') {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                analyzeDocument(event.document);
            }, 1000);
        }
    });
    vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'python') {
            analyzeDocument(document);
        }
    });
    const command = vscode.commands.registerCommand('secureCopilot.analyze', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'python') {
            analyzeDocument(editor.document);
            vscode.window.showInformationMessage('🔍 Analyse de sécurité en cours...');
        }
        else {
            vscode.window.showWarningMessage('⚠️ Ouvrez un fichier Python pour analyser.');
        }
    });
    const applyFixCommand = vscode.commands.registerCommand('secureCopilot.applyFix', async (document, line, fix) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const lineRange = document.lineAt(line).range;
        const indentation = document.lineAt(line).text.match(/^\s*/)?.[0] || '';
        await editor.edit(editBuilder => {
            editBuilder.replace(lineRange, indentation + fix);
        });
        vscode.window.showInformationMessage('✅ Correction appliquée !');
    });
    const loginCommand = vscode.commands.registerCommand('secureCopilot.login', async () => {
        await loginUser(context);
    });
    context.subscriptions.push(command, applyFixCommand, loginCommand);
}
function connectWebSocket(context) {
    if (wsConnection && wsConnection.readyState === 1) {
        return;
    }
    const ws = new WebSocketLib('ws://127.0.0.1:8000/api/v1/ws');
    wsConnection = ws;
    ws.on('open', () => {
        console.log('Secure Copilot WebSocket connected !');
    });
    ws.on('message', (data) => {
        try {
            const parsed = JSON.parse(data.toString());
            const vulnerabilities = parsed.vulnerabilities || [];
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'python') {
                return;
            }
            vulnerabilityMap.clear();
            for (const vuln of vulnerabilities) {
                vulnerabilityMap.set(`${editor.document.uri.toString()}-${vuln.line - 1}`, vuln);
            }
            updateDiagnostics(editor.document, vulnerabilities);
            updateDecorations(editor.document, vulnerabilities);
            if (vulnerabilities.length > 0) {
                vscode.window.showWarningMessage(`🔐 ${vulnerabilities.length} vulnérabilité(s) détectée(s) !`);
            }
        }
        catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    ws.on('close', () => {
        console.log('WebSocket disconnected — reconnecting in 3s...');
        reconnectTimeout = setTimeout(() => {
            connectWebSocket(context);
        }, 3000);
    });
    context.subscriptions.push({
        dispose: () => {
            ws.close();
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        }
    });
}
async function analyzeDocument(document) {
    const code = document.getText();
    if (wsConnection && wsConnection.readyState === 1) {
        wsConnection.send(JSON.stringify({
            code,
            language: 'python',
            file_path: document.fileName,
            project_id: currentProjectId || PROJECT_ID,
            user_id: currentUserId
        }));
        return;
    }
    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                language: 'python',
                file_path: document.fileName,
                project_id: currentProjectId || PROJECT_ID,
                user_id: currentUserId
            })
        });
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        const vulnerabilities = data.vulnerabilities || [];
        vulnerabilityMap.clear();
        for (const vuln of vulnerabilities) {
            vulnerabilityMap.set(`${document.uri.toString()}-${vuln.line - 1}`, vuln);
        }
        updateDiagnostics(document, vulnerabilities);
        updateDecorations(document, vulnerabilities);
        if (vulnerabilities.length > 0) {
            vscode.window.showWarningMessage(`🔐 ${vulnerabilities.length} vulnérabilité(s) détectée(s) !`);
            enrichWithLLM(document, code, vulnerabilities);
        }
    }
    catch (error) {
        if (error?.status === 401 || error?.message?.includes('401')) {
            statusBar.text = '🔐 SecureCopilot | ⚠️ Session expirée';
            vscode.window.showWarningMessage('⚠️ Session expirée — Reconnectez-vous', 'Se connecter').then(action => {
                if (action === 'Se connecter') {
                    vscode.commands.executeCommand('secureCopilot.login');
                }
            });
        }
        else if (error?.message?.includes('fetch') || error?.message?.includes('ECONNREFUSED')) {
            statusBar.text = '🔐 SecureCopilot | 🔴 Backend indisponible';
            statusBar.tooltip = 'Le serveur SecureCopilot est arrêté';
        }
        else {
            console.error('Secure Copilot error:', error);
        }
    }
}
async function enrichWithLLM(document, code, vulnerabilities) {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/v1/analyze/full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                language: 'python',
                file_path: document.fileName,
                project_id: currentProjectId || PROJECT_ID,
                user_id: currentUserId
            })
        });
        if (response.status === 401) {
            statusBar.text = '🔐 SecureCopilot | ⚠️ Session expirée';
            vscode.window.showWarningMessage('⚠️ Session expirée — Reconnectez-vous', 'Se connecter').then(action => {
                if (action === 'Se connecter') {
                    vscode.commands.executeCommand('secureCopilot.login');
                }
            });
            return;
        }
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        const enriched = data.vulnerabilities || [];
        vulnerabilityMap.clear();
        for (const vuln of enriched) {
            vulnerabilityMap.set(`${document.uri.toString()}-${vuln.line - 1}`, vuln);
        }
        updateDecorations(document, enriched);
    }
    catch (error) {
        console.error('LLM enrichment error:', error);
    }
}
class SecureCodeActionProvider {
    provideCodeActions(document, range) {
        const actions = [];
        const line = range.start.line;
        const key = `${document.uri.toString()}-${line}`;
        const vuln = vulnerabilityMap.get(key);
        if (vuln && vuln.fix) {
            const action = new vscode.CodeAction(`🔐 Secure Copilot: Corriger "${vuln.id}"`, vscode.CodeActionKind.QuickFix);
            action.command = {
                command: 'secureCopilot.applyFix',
                title: 'Appliquer la correction',
                arguments: [document, line, vuln.fix]
            };
            action.diagnostics = diagnosticCollection.get(document.uri)?.filter(d => d.range.start.line === line) || [];
            action.isPreferred = true;
            actions.push(action);
        }
        return actions;
    }
}
function updateDiagnostics(document, vulnerabilities) {
    const diagnostics = [];
    for (const vuln of vulnerabilities) {
        const line = vuln.line - 1;
        const lineText = document.lineAt(line);
        const range = new vscode.Range(line, 0, line, lineText.text.length);
        const severity = vuln.severity === 'CRITICAL'
            ? vscode.DiagnosticSeverity.Error
            : vuln.severity === 'HIGH'
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information;
        const diagnostic = new vscode.Diagnostic(range, `🔐 [${vuln.severity}] ${vuln.message} (${vuln.cwe})`, severity);
        diagnostic.source = 'Secure Copilot';
        diagnostics.push(diagnostic);
    }
    diagnosticCollection.set(document.uri, diagnostics);
}
function updateDecorations(document, vulnerabilities) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
        return;
    }
    const critical = [];
    const high = [];
    const medium = [];
    for (const vuln of vulnerabilities) {
        const line = vuln.line - 1;
        const lineText = document.lineAt(line);
        const range = new vscode.Range(line, 0, line, lineText.text.length);
        const decoration = {
            range,
            hoverMessage: new vscode.MarkdownString(`**🔐 Secure Copilot**\n\n` +
                `**Vulnérabilité :** \`${vuln.id}\`\n\n` +
                `**Sévérité :** ${vuln.severity} | **CWE :** ${vuln.cwe}\n\n` +
                `---\n\n` +
                `**📖 Explication :**\n${vuln.explication || vuln.message}\n\n` +
                `**⚠️ Risque :**\n${vuln.risque || 'Risque de sécurité détecté'}\n\n` +
                `---\n\n` +
                `**✅ Correction suggérée :**\n\`\`\`python\n${vuln.correction_llm || vuln.fix}\n\`\`\``)
        };
        if (vuln.severity === 'CRITICAL') {
            critical.push(decoration);
        }
        else if (vuln.severity === 'HIGH') {
            high.push(decoration);
        }
        else {
            medium.push(decoration);
        }
    }
    editor.setDecorations(criticalDecoration, critical);
    editor.setDecorations(highDecoration, high);
    editor.setDecorations(mediumDecoration, medium);
}
function deactivate() {
    diagnosticCollection.dispose();
}
//# sourceMappingURL=extension.js.map