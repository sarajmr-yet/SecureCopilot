import pytest
import asyncio
from app.services.analyzer import analyze_code

# Test 1 — SQL Injection détectée
def test_sql_injection_detected():
    code = 'db.execute("SELECT * FROM users WHERE id = " + user_id)'
    result = asyncio.run(analyze_code(code, "python"))
    vuln_ids = [v["id"] for v in result]
    assert "sql-injection" in vuln_ids
# Test 2 — Hardcoded Secret détecté
def test_hardcoded_secret_detected():
    code = 'SECRET_KEY = "hardcoded123"'
    result = asyncio.run(analyze_code(code, "python"))
    vuln_ids = [v["id"] for v in result]
    assert "hardcoded-secret" in vuln_ids

# Test 3 — Command Injection détecté
def test_command_injection_detected():
    code = "os.system(user_input)"
    result = asyncio.run(analyze_code(code, "python"))
    vuln_ids = [v["id"] for v in result]
    assert "command-injection" in vuln_ids

# Test 4 — Code propre → aucune vulnérabilité
def test_clean_code():
    code = "x = 1 + 1\nprint(x)"
    result = asyncio.run(analyze_code(code, "python"))
    assert len(result) == 0

# Test 5 — Sévérité correcte
def test_severity_critical():
    code = "os.system(user_input)"
    result = asyncio.run(analyze_code(code, "python"))
    vuln = next(v for v in result if v["id"] == "command-injection")
    assert vuln["severity"] == "CRITICAL"
# Test 6 — Pickle détecté
def test_pickle_detected():
    code = "pickle.loads(data)"
    result = asyncio.run(analyze_code(code, "python"))
    vuln_ids = [v["id"] for v in result]
    assert "pickle-deserialization" in vuln_ids

# Test 7 — Debug Mode détecté
def test_debug_mode_detected():
    code = "app.run(debug=True)"
    result = asyncio.run(analyze_code(code, "python"))
    vuln_ids = [v["id"] for v in result]
    assert "debug-mode" in vuln_ids

# Test 8 — Fix généré
def test_fix_generated():
    code = 'SECRET_KEY = "hardcoded123"'
    result = asyncio.run(analyze_code(code, "python"))
    assert result[0]["fix"] != ""