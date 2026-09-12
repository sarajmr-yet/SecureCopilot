import * as vscode from 'vscode';
const WebSocketLib = require('ws');

const BACKEND_URL = 'http://127.0.0.1:8000/api/v1/analyze';
const PROJECT_ID = 1; // ← ID du projet "Backend SecureCopilot"
let authToken: string | undefined;
let currentUserId: number | undefined;
let currentProjectId: number | undefined;
let statusBar: vscode.StatusBarItem;
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

let diagnosticCollection: vscode.DiagnosticCollection;
let timeout: NodeJS.Timeout | undefined;
let vulnerabilityMap: Map<string, any> = new Map();
let wsConnection: any | undefined;
let reconnectTimeout: NodeJS.Timeout | undefined;
async function loginUser(context: vscode.ExtensionContext) {
	const username = await vscode.window.showInputBox({
		prompt: '🔐 SecureCopilot — Nom d\'utilisateur',
		placeHolder: 'Entrez votre nom d\'utilisateur'
	});

	if (!username) { return; }

	const password = await vscode.window.showInputBox({
		prompt: '🔐 SecureCopilot — Mot de passe',
		placeHolder: 'Entrez votre mot de passe',
		password: true
	});

	if (!password) { return; }

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

		const data = await response.json() as any;
		authToken = data.access_token;

		// Récupérer les infos du user
		const meResponse = await fetch('http://127.0.0.1:8000/api/v1/auth/me', {
			headers: { 'Authorization': `Bearer ${authToken}` }
		});
		const me = await meResponse.json() as any;
		currentUserId = me.id;

		// Récupérer les projets du user
		const projectsResponse = await fetch('http://127.0.0.1:8000/api/v1/auth/projects', {
			headers: { 'Authorization': `Bearer ${authToken}` }
		});
		const projectsData = await projectsResponse.json() as any;

		if (projectsData.length === 0) {
        	vscode.window.showWarningMessage('⚠️ Aucun projet assigné — contactez votre admin');
       	    return;
        } else if (projectsData.length === 1) {
    		currentProjectId = projectsData[0].id;
			statusBar.text = `🔐 SecureCopilot | ✅ ${me.username} | 📁 ${projectsData[0].name}`;
			statusBar.tooltip = `Connecté en tant que ${me.username}`;
			statusBar.backgroundColor = undefined;
   			vscode.window.showInformationMessage(
       		 `✅ Connecté en tant que ${me.username} — Projet : ${projectsData[0].name}`
   		    );
		} else {
    	// Plusieurs projets → afficher un menu
    		const items = projectsData.map((p: any) => ({
        	 label: `📁 ${p.name}`,
             description: p.description || '',
             id: p.id
    		}));

   			const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Choisissez votre projet de travail'
}) as any;

if (!selected) {
    vscode.window.showWarningMessage('⚠️ Aucun projet sélectionné');
    return;
}

currentProjectId = selected.id;
statusBar.text = `🔐 SecureCopilot | ✅ ${me.username} | 📁 ${selected.label}`;
statusBar.tooltip = `Connecté en tant que ${me.username}`;
vscode.window.showInformationMessage(
    `✅ Connecté en tant que ${me.username} — Projet : ${selected.label}`
);
        }

		// Sauvegarder le token
		if (authToken) {5
   		await context.secrets.store('authToken', authToken);
		}

		vscode.window.showInformationMessage(
			`✅ Connecté en tant que ${me.username} — Projet : ${projectsData[0]?.name || 'Aucun'}`
		);

	} catch (error) {
		statusBar.text = '🔐 SecureCopilot | ❌ Erreur connexion';
		vscode.window.showErrorMessage('❌ Erreur de connexion au serveur');
	}
}
export function activate(context: vscode.ExtensionContext) {
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

	const quickFixProvider = vscode.languages.registerCodeActionsProvider(
		'python',
		new SecureCodeActionProvider(),
		{ providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
	);
	context.subscriptions.push(quickFixProvider);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (event.document.languageId === 'python') {
			if (timeout) { clearTimeout(timeout); }
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
		} else {
			vscode.window.showWarningMessage('⚠️ Ouvrez un fichier Python pour analyser.');
		}
	});

	const applyFixCommand = vscode.commands.registerCommand(
		'secureCopilot.applyFix',
		async (document: vscode.TextDocument, line: number, fix: string) => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }

			const lineRange = document.lineAt(line).range;
			const indentation = document.lineAt(line).text.match(/^\s*/)?.[0] || '';

			await editor.edit(editBuilder => {
				editBuilder.replace(lineRange, indentation + fix);
			});

			vscode.window.showInformationMessage('✅ Correction appliquée !');
		}
	);

	const loginCommand = vscode.commands.registerCommand('secureCopilot.login', async () => {
		await loginUser(context);
	});

	context.subscriptions.push(command, applyFixCommand, loginCommand);
}

function connectWebSocket(context: vscode.ExtensionContext) {
	if (wsConnection && wsConnection.readyState === 1) {
		return;
	}

	const ws = new WebSocketLib('ws://127.0.0.1:8000/api/v1/ws');
	wsConnection = ws;

	ws.on('open', () => {
		console.log('Secure Copilot WebSocket connected !');
	});

	ws.on('message', (data: Buffer) => {
		try {
			const parsed = JSON.parse(data.toString());
			const vulnerabilities = parsed.vulnerabilities || [];
			const editor = vscode.window.activeTextEditor;

			if (!editor || editor.document.languageId !== 'python') { return; }

			vulnerabilityMap.clear();
			for (const vuln of vulnerabilities) {
				vulnerabilityMap.set(
					`${editor.document.uri.toString()}-${vuln.line - 1}`,
					vuln
				);
			}

			updateDiagnostics(editor.document, vulnerabilities);
			updateDecorations(editor.document, vulnerabilities);

			if (vulnerabilities.length > 0) {
				vscode.window.showWarningMessage(
					`🔐 ${vulnerabilities.length} vulnérabilité(s) détectée(s) !`
				);
			}

		} catch (error) {
			console.error('WebSocket message error:', error);
		}
	});

	ws.on('error', (error: any) => {
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
			if (reconnectTimeout) { clearTimeout(reconnectTimeout); }
		}
	});
}

async function analyzeDocument(document: vscode.TextDocument) {
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

		if (!response.ok) { return; }

		const data = await response.json() as any;
		const vulnerabilities = data.vulnerabilities || [];

		vulnerabilityMap.clear();
		for (const vuln of vulnerabilities) {
			vulnerabilityMap.set(`${document.uri.toString()}-${vuln.line - 1}`, vuln);
		}

		updateDiagnostics(document, vulnerabilities);
		updateDecorations(document, vulnerabilities);

		if (vulnerabilities.length > 0) {
			vscode.window.showWarningMessage(
				`🔐 ${vulnerabilities.length} vulnérabilité(s) détectée(s) !`
			);
			enrichWithLLM(document, code, vulnerabilities);
		}

	} catch (error: any) {
    if (error?.status === 401 || error?.message?.includes('401')) {
        statusBar.text = '🔐 SecureCopilot | ⚠️ Session expirée';
        vscode.window.showWarningMessage(
            '⚠️ Session expirée — Reconnectez-vous',
            'Se connecter'
        ).then(action => {
            if (action === 'Se connecter') {
                vscode.commands.executeCommand('secureCopilot.login');
            }
        });
    } else if (error?.message?.includes('fetch') || error?.message?.includes('ECONNREFUSED')) {
        statusBar.text = '🔐 SecureCopilot | 🔴 Backend indisponible';
        statusBar.tooltip = 'Le serveur SecureCopilot est arrêté';
    } else {
        console.error('Secure Copilot error:', error);
    }
}
}


async function enrichWithLLM(
	document: vscode.TextDocument,
	code: string,
	vulnerabilities: any[]
) {
	try {
		const response = await fetch(
			'http://127.0.0.1:8000/api/v1/analyze/full',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
                code, 
                language: 'python',
    			file_path: document.fileName,
   				project_id: currentProjectId || PROJECT_ID,
    			user_id: currentUserId
            })
			}
		);

		if (response.status === 401) {
    statusBar.text = '🔐 SecureCopilot | ⚠️ Session expirée';
    vscode.window.showWarningMessage(
        '⚠️ Session expirée — Reconnectez-vous',
        'Se connecter'
    ).then(action => {
        if (action === 'Se connecter') {
            vscode.commands.executeCommand('secureCopilot.login');
        }
    });
    return;
}
if (!response.ok) { return; } 

		const data = await response.json() as any;
		const enriched = data.vulnerabilities || [];

		vulnerabilityMap.clear();
		for (const vuln of enriched) {
			vulnerabilityMap.set(`${document.uri.toString()}-${vuln.line - 1}`, vuln);
		}

		updateDecorations(document, enriched);

	} catch (error) {
		console.error('LLM enrichment error:', error);
	}
}

class SecureCodeActionProvider implements vscode.CodeActionProvider {
	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range
	): vscode.CodeAction[] {
		const actions: vscode.CodeAction[] = [];
		const line = range.start.line;
		const key = `${document.uri.toString()}-${line}`;
		const vuln = vulnerabilityMap.get(key);

		if (vuln && vuln.fix) {
			const action = new vscode.CodeAction(
				`🔐 Secure Copilot: Corriger "${vuln.id}"`,
				vscode.CodeActionKind.QuickFix
			);

			action.command = {
				command: 'secureCopilot.applyFix',
				title: 'Appliquer la correction',
				arguments: [document, line, vuln.fix]
			};

			action.diagnostics = diagnosticCollection.get(document.uri)?.filter(d =>
				d.range.start.line === line
			) || [];

			action.isPreferred = true;
			actions.push(action);
		}

		return actions;
	}
}

function updateDiagnostics(document: vscode.TextDocument, vulnerabilities: any[]) {
	const diagnostics: vscode.Diagnostic[] = [];

	for (const vuln of vulnerabilities) {
		const line = vuln.line - 1;
		const lineText = document.lineAt(line);
		const range = new vscode.Range(line, 0, line, lineText.text.length);

		const severity = vuln.severity === 'CRITICAL'
			? vscode.DiagnosticSeverity.Error
			: vuln.severity === 'HIGH'
				? vscode.DiagnosticSeverity.Warning
				: vscode.DiagnosticSeverity.Information;

		const diagnostic = new vscode.Diagnostic(
			range,
			`🔐 [${vuln.severity}] ${vuln.message} (${vuln.cwe})`,
			severity
		);

		diagnostic.source = 'Secure Copilot';
		diagnostics.push(diagnostic);
	}

	diagnosticCollection.set(document.uri, diagnostics);
}

function updateDecorations(document: vscode.TextDocument, vulnerabilities: any[]) {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document !== document) { return; }

	const critical: vscode.DecorationOptions[] = [];
	const high: vscode.DecorationOptions[] = [];
	const medium: vscode.DecorationOptions[] = [];

	for (const vuln of vulnerabilities) {
		const line = vuln.line - 1;
		const lineText = document.lineAt(line);
		const range = new vscode.Range(line, 0, line, lineText.text.length);

		const decoration: vscode.DecorationOptions = {
			range,
			hoverMessage: new vscode.MarkdownString(
				`**🔐 Secure Copilot**\n\n` +
				`**Vulnérabilité :** \`${vuln.id}\`\n\n` +
				`**Sévérité :** ${vuln.severity} | **CWE :** ${vuln.cwe}\n\n` +
				`---\n\n` +
				`**📖 Explication :**\n${vuln.explication || vuln.message}\n\n` +
				`**⚠️ Risque :**\n${vuln.risque || 'Risque de sécurité détecté'}\n\n` +
				`---\n\n` +
				`**✅ Correction suggérée :**\n\`\`\`python\n${vuln.correction_llm || vuln.fix}\n\`\`\``
			)
		};

		if (vuln.severity === 'CRITICAL') { critical.push(decoration); }
		else if (vuln.severity === 'HIGH') { high.push(decoration); }
		else { medium.push(decoration); }
	}

	editor.setDecorations(criticalDecoration, critical);
	editor.setDecorations(highDecoration, high);
	editor.setDecorations(mediumDecoration, medium);
}

export function deactivate() {
	diagnosticCollection.dispose();
}