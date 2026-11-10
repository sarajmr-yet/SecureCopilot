# Secure Copilot

AI-powered DevSecOps assistant for Python. It analyzes your code for OWASP
vulnerabilities (SQL injection, `eval`, hardcoded secrets, insecure
deserialization...) and reports them to a team dashboard.

## Features
- Analyze the current Python file with one command
- Findings mapped to CWE with severity levels
- Project-based team workflow (Admin / Developer roles)
- Optional local AI explanations (Ollama)

## Requirements
SecureCopilot needs its backend running. From the project repository:

    docker compose up --build

Then open the dashboard at http://localhost:3000.

## Usage
1. Run **Secure Copilot: Se connecter** and choose your project.
2. Run **Secure Copilot: Analyser ce fichier** on a Python file.

## Settings
- `secureCopilot.backendUrl`: backend URL (default `http://127.0.0.1:8000`).

Source: https://github.com/sarajmr-yet/SecureCopilot