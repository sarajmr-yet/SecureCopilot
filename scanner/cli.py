import sys
import json
from scan import scan_project
from reporter import generate_html_report

def main():
    print("""
    ╔══════════════════════════════════════════════╗
    ║   Secure Copilot — Module Scanner            ║
    ║   AI-Powered Secure Code Generation          ║
    ╚══════════════════════════════════════════════╝
    """)

    # Récupérer le chemin du projet
    if len(sys.argv) < 2:
        print(" Usage : python cli.py <chemin_du_projet>")
        print(" Exemple : python cli.py C:\\Users\\RYZEN\\mon_projet")
        sys.exit(1)

    project_path = sys.argv[1]

    # Lancer le scan
    summary = scan_project(project_path)

    # Générer le rapport HTML
    rapport_path = generate_html_report(summary)

    # Générer aussi un rapport JSON
    json_path = rapport_path.replace(".html", ".json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\n Rapport JSON  : {json_path}")

    # Résultat final
    if summary["total_vulnerabilities"] == 0:
        print("\n Aucune vulnerabilite detectee — projet securise !")
    else:
        print(f"\n ACTION REQUISE : {summary['total_vulnerabilities']} vulnerabilite(s) a corriger !")
        print(f"   dont {summary['critical']} CRITICAL — a traiter en priorite !")

    print("\n Ouvrez le rapport HTML dans votre navigateur.")

if __name__ == "__main__":
    main()