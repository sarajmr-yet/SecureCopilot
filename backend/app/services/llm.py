import httpx
import json
import re

OLLAMA_URL = "http://localhost:11434/api/generate"

async def get_explanation(vulnerability: dict, code: str) -> dict:
    prompt = """Tu es un expert en cybersecurite. Analyse cette vulnerabilite Python.

Vulnerabilite : """ + vulnerability['message'] + """
CWE : """ + vulnerability['cwe'] + """
Severite : """ + vulnerability['severity'] + """
Code concerne : """ + vulnerability['code'] + """

Reponds UNIQUEMENT avec ce JSON sans texte avant ou apres :
{
    "explication": "explication simple en 2 phrases max",
    "risque": "ce qu un attaquant peut faire concretement",
    "correction": "version corrigee du code en une ligne"
}"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": "codellama",
                    "prompt": prompt,
                    "stream": False
                }
            )

            if response.status_code == 200:
                data = response.json()
                raw = data.get("response", "")
                print(f"LLM raw response: {raw}")
                json_match = re.search(r'\{[^{}]*\}', raw, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())

    except Exception as e:
        print(f"LLM error: {e}")

    return {
        "explication": vulnerability["message"],
        "risque": "Risque de securite detecte",
        "correction": vulnerability.get("fix", "Consultez OWASP")
    }