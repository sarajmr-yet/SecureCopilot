import re
import subprocess
import json
import os

RULES_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'semgrep_rules', 'owasp.yaml')

FALLBACK_RULES = [
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
    {
        "id": "xss",
        "pattern": r'render_template_string\(',
        "message": "XSS detecte — echappez les entrees utilisateur",
        "severity": "CRITICAL",
        "cwe": "CWE-79",
        "fix": 'return escape(user_input)'
    },
    {
        "id": "path-traversal",
        "pattern": r'open\s*\(\s*.*\+',
        "message": "Path Traversal detecte — validez les chemins",
        "severity": "HIGH",
        "cwe": "CWE-22",
        "fix": 'open(os.path.basename(filename))'
    },
    {
        "id": "ssrf",
        "pattern": r'requests\.(get|post)\s*\(\s*[a-zA-Z_]+\s*\)',
        "message": "SSRF potentiel — validez les URLs externes",
        "severity": "HIGH",
        "cwe": "CWE-918",
        "fix": 'requests.get(validate_url(user_url))'
    },
    {
        "id": "insecure-random",
        "pattern": r'random\.(random|randint)\(',
        "message": "Generateur aleatoire non securise — utilisez secrets",
        "severity": "MEDIUM",
        "cwe": "CWE-338",
        "fix": 'import secrets\ntoken = secrets.token_hex(32)'
    },
    {
        "id": "xxe",
        "pattern": r'ET\.(fromstring|parse)\(',
        "message": "XXE potentiel — desactivez les entites externes",
        "severity": "CRITICAL",
        "cwe": "CWE-611",
        "fix": 'ET.fromstring(data, parser=ET.XMLParser(resolve_entities=False))'
    },
]

SEVERITY_MAP = {
    "ERROR": "CRITICAL",
    "WARNING": "HIGH",
    "INFO": "MEDIUM"
}

FIX_MAP = {rule["id"]: rule["fix"] for rule in FALLBACK_RULES}
CWE_MAP = {rule["id"]: rule["cwe"] for rule in FALLBACK_RULES}

async def analyze_with_semgrep(code: str) -> list:
    import tempfile
    results = []

    try:
        # Créer fichier temporaire SANS suppression automatique
        tmp_file = tempfile.NamedTemporaryFile(
            mode='w', suffix='.py',
            delete=False, encoding='utf-8'
        )
        tmp_file.write(code)
        tmp_file.close()  # Fermer AVANT d'appeler Semgrep
        tmp_path = tmp_file.name

        result = subprocess.run(
            ['semgrep', '--config', RULES_PATH, '--json', tmp_path],
            capture_output=True, text=True, timeout=30
        )

        # Supprimer APRÈS que Semgrep ait fini
        os.unlink(tmp_path)

        print(f"Semgrep stdout: {result.stdout[:200]}")
        print(f"Semgrep stderr: {result.stderr[:200]}")

        if result.stdout:
            data = json.loads(result.stdout)
            for finding in data.get('results', []):
                rule_id = finding['check_id'].split('.')[-1]
                severity = SEVERITY_MAP.get(
                    finding['extra']['severity'], 'MEDIUM'
                )
                results.append({
                    "id": rule_id,
                    "line": finding['start']['line'],
                    "code": finding['extra']['lines'].strip(),
                    "message": finding['extra']['message'],
                    "severity": severity,
                    "cwe": CWE_MAP.get(rule_id, "CWE-000"),
                    "fix": FIX_MAP.get(rule_id, "Consultez OWASP")
                })

    except Exception as e:
        print(f"Semgrep error: {e}")
        if 'tmp_path' in locals():
            try:
                os.unlink(tmp_path)
            except:
                pass

    return results

async def analyze_with_regex(code: str) -> list:
    vulnerabilities = []
    lines = code.split("\n")

    for rule in FALLBACK_RULES:
        pattern = re.compile(rule["pattern"], re.IGNORECASE)
        for i, line in enumerate(lines, 1):
            if pattern.search(line):
                vulnerabilities.append({
                    "id": rule["id"],
                    "line": i,
                    "code": line.strip(),
                    "message": rule["message"],
                    "severity": rule["severity"],
                    "cwe": rule["cwe"],
                    "fix": rule["fix"]
                })

    return vulnerabilities

async def analyze_code(code: str, language: str = "python") -> list:
    # Essayer Semgrep d'abord
    results = await analyze_with_semgrep(code)

    # Fallback regex si Semgrep échoue
    if not results:
        print("Semgrep returned no results → using regex fallback")
        results = await analyze_with_regex(code)

    return results