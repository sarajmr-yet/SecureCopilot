import os
import re
from pathlib import Path

RULES = [
    {
        "id": "sql-injection",
        "pattern": r'execute\s*\(\s*["\'].*\+',
        "message": "SQL Injection detectee — utilisez des requetes parametrees",
        "severity": "CRITICAL",
        "cwe": "CWE-89",
        "fix": 'cursor.execute("SELECT * FROM users WHERE id = ?", (user_input,))'
    },
    {
        "id": "hardcoded-secret",
        "pattern": r'(SECRET_KEY|PASSWORD|API_KEY)\s*=\s*["\'][^"\']+["\']',
        "message": "Secret hardcode detecte — utilisez des variables d environnement",
        "severity": "HIGH",
        "cwe": "CWE-798",
        "fix": 'SECRET_KEY = os.getenv("SECRET_KEY")'
    },
    {
        "id": "debug-mode",
        "pattern": r'app\.run\(.*debug\s*=\s*True',
        "message": "Mode debug actif en production — desactivez-le",
        "severity": "MEDIUM",
        "cwe": "CWE-94",
        "fix": 'app.run(debug=False)'
    },
    {
        "id": "pickle-deserialization",
        "pattern": r'pickle\.loads\(',
        "message": "Deserialisation non securisee — evitez pickle",
        "severity": "CRITICAL",
        "cwe": "CWE-502",
        "fix": 'import json\ndata = json.loads(user_data)'
    },
    {
        "id": "command-injection",
        "pattern": r'os\.system\(|subprocess\.call\(.*shell\s*=\s*True',
        "message": "Injection de commande detectee",
        "severity": "CRITICAL",
        "cwe": "CWE-78",
        "fix": 'subprocess.run(["command", user_input], shell=False)'
    },
]

def scan_file(filepath: str) -> list:
    results = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        for rule in RULES:
            pattern = re.compile(rule["pattern"], re.IGNORECASE)
            for i, line in enumerate(lines, 1):
                if pattern.search(line):
                    results.append({
                        "file": filepath,
                        "line": i,
                        "code": line.strip(),
                        "id": rule["id"],
                        "message": rule["message"],
                        "severity": rule["severity"],
                        "cwe": rule["cwe"],
                        "fix": rule["fix"]
                    })
    except Exception as e:
        print(f"Erreur lecture {filepath}: {e}")

    return results

def scan_project(project_path: str) -> dict:
    project_path = Path(project_path)
    all_results = []
    scanned_files = []

    print(f"\n Scan du projet : {project_path}")
    print("=" * 50)

    # Parcourir tous les fichiers .py
    for py_file in project_path.rglob("*.py"):
        # Ignorer les dossiers virtuels
        if any(skip in str(py_file) for skip in ["venv", "__pycache__", ".git", "node_modules"]):
            continue

        scanned_files.append(str(py_file))
        file_results = scan_file(str(py_file))
        all_results.extend(file_results)

        if file_results:
            print(f" {py_file.name} → {len(file_results)} vulnerabilite(s)")
        else:
            print(f" {py_file.name} → propre")

    # Statistiques
    critical = len([r for r in all_results if r["severity"] == "CRITICAL"])
    high = len([r for r in all_results if r["severity"] == "HIGH"])
    medium = len([r for r in all_results if r["severity"] == "MEDIUM"])

    summary = {
        "project": str(project_path),
        "total_files": len(scanned_files),
        "total_vulnerabilities": len(all_results),
        "critical": critical,
        "high": high,
        "medium": medium,
        "results": all_results
    }

    print("=" * 50)
    print(f"\n RESUME :")
    print(f"   Fichiers scannes  : {len(scanned_files)}")
    print(f"   Vulnerabilites    : {len(all_results)}")
    print(f"   CRITICAL          : {critical}")
    print(f"   HIGH              : {high}")
    print(f"   MEDIUM            : {medium}")

    return summary