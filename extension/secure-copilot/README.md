# SecureCopilot — AI-Powered DevSecOps Toolchain

## Description
SecureCopilot est une extension VS Code qui détecte en temps réel les vulnérabilités de sécurité dans le code Python et propose des corrections automatiques via IA (CodeLlama).

## Fonctionnalités
- 🔐 Détection temps réel des vulnérabilités OWASP Top 10
- 🤖 Explications intelligentes via LLM (CodeLlama)
- ✅ Corrections automatiques (Quick Fix)
- 📊 Dashboard de suivi des vulnérabilités
- 👥 Gestion multi-utilisateurs et multi-projets

## Prérequis
- Backend SecureCopilot lancé sur http://127.0.0.1:8000
- Ollama + CodeLlama installés

## Utilisation
1. Installer l'extension
2. Se connecter avec vos identifiants
3. Ouvrir un fichier Python
4. Les vulnérabilités sont détectées automatiquement

## Vulnérabilités détectées
- SQL Injection (CWE-89)
- Command Injection (CWE-78)
- Hardcoded Secrets (CWE-798)
- XSS (CWE-79)
- Path Traversal (CWE-22)
- SSRF (CWE-918)
- XXE (CWE-611)
- Insecure Deserialization (CWE-502)
- Insecure Random (CWE-338)
- Debug Mode (CWE-94)

## Auteur
Sara Jamiri — ENSA GCDSTE — PFA 2024/2025