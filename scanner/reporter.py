import os
from datetime import datetime

def generate_html_report(summary: dict, output_path: str = "rapport_securite.html"):
    results = summary["results"]
    
    files_dict = {}
    for r in results:
        f = r["file"]
        if f not in files_dict:
            files_dict[f] = []
        files_dict[f].append(r)

    # Score de sécurité
    total = summary["total_vulnerabilities"]
    if total == 0:
        score = 100
        score_color = "#28a745"
        score_label = "Excellent"
        score_emoji = "A+"
    elif summary["critical"] > 0:
        score = max(0, 40 - (summary["critical"] * 10))
        score_color = "#dc3545"
        score_label = "Critique"
        score_emoji = "F"
    elif summary["high"] > 0:
        score = max(40, 65 - (summary["high"] * 5))
        score_color = "#fd7e14"
        score_label = "Risque Eleve"
        score_emoji = "D"
    else:
        score = max(65, 85 - (summary["medium"] * 5))
        score_color = "#ffc107"
        score_label = "Acceptable"
        score_emoji = "C"

    # Barres de progression
    max_vuln = max(total, 1)
    critical_pct = int((summary["critical"] / max_vuln) * 100)
    high_pct = int((summary["high"] / max_vuln) * 100)
    medium_pct = int((summary["medium"] / max_vuln) * 100)

    # Lignes du tableau
    rows_html = ""
    for r in results:
        filename = os.path.basename(r['file'])
        code_preview = r['code'][:55] + "..." if len(r['code']) > 55 else r['code']
        fix_preview = r['fix'][:55] + "..." if len(r['fix']) > 55 else r['fix']

        if r['severity'] == 'CRITICAL':
            badge = 'background:#dc3545;color:white'
            row_bg = 'background:#fff8f8'
            icon = '🔴'
        elif r['severity'] == 'HIGH':
            badge = 'background:#fd7e14;color:white'
            row_bg = 'background:#fff9f5'
            icon = '🟠'
        else:
            badge = 'background:#ffc107;color:#333'
            row_bg = 'background:#fffdf0'
            icon = '🟡'

        rows_html += f"""
        <tr style="{row_bg}">
            <td>
                <span style="background:#e9ecef;padding:3px 8px;border-radius:6px;
                font-family:monospace;font-size:12px;font-weight:600">{filename}</span>
            </td>
            <td>
                <span style="background:#1F4E79;color:white;padding:3px 8px;
                border-radius:6px;font-size:12px">L.{r['line']}</span>
            </td>
            <td>
                <code style="font-size:11px;color:#c0392b;background:#fdf2f2;
                padding:3px 6px;border-radius:4px">{code_preview}</code>
            </td>
            <td style="font-size:12px;font-weight:600;color:#444">{r['id']}</td>
            <td>
                <span style="padding:4px 12px;border-radius:20px;font-size:11px;
                font-weight:700;{badge}">{icon} {r['severity']}</span>
            </td>
            <td>
                <span style="background:#e3f2fd;color:#1565c0;padding:3px 8px;
                border-radius:6px;font-size:11px;font-weight:600">{r['cwe']}</span>
            </td>
            <td>
                <code style="font-size:11px;color:#1a7a3a;background:#f0faf4;
                padding:3px 6px;border-radius:4px">{fix_preview}</code>
            </td>
        </tr>"""

    # Recommandations
    reco_html = ""
    if summary["critical"] > 0:
        reco_html += """
        <div style="background:#fff5f5;border-left:4px solid #dc3545;
             padding:12px 16px;margin-bottom:10px;border-radius:0 8px 8px 0">
            <strong style="color:#dc3545">🔴 CRITIQUE — Action immédiate requise</strong>
            <p style="font-size:13px;color:#666;margin-top:5px">
            Des vulnérabilités critiques ont été détectées. 
            Corrigez-les avant tout déploiement en production.</p>
        </div>"""
    if summary["high"] > 0:
        reco_html += """
        <div style="background:#fff9f5;border-left:4px solid #fd7e14;
             padding:12px 16px;margin-bottom:10px;border-radius:0 8px 8px 0">
            <strong style="color:#fd7e14">🟠 ÉLEVÉ — Correction prioritaire</strong>
            <p style="font-size:13px;color:#666;margin-top:5px">
            Des vulnérabilités à risque élevé ont été détectées.
            Planifiez leur correction rapidement.</p>
        </div>"""
    if summary["medium"] > 0:
        reco_html += """
        <div style="background:#fffdf0;border-left:4px solid #ffc107;
             padding:12px 16px;margin-bottom:10px;border-radius:0 8px 8px 0">
            <strong style="color:#d4a017">🟡 MOYEN — À planifier</strong>
            <p style="font-size:13px;color:#666;margin-top:5px">
            Des vulnérabilités modérées ont été détectées.
            Intégrez leur correction dans le prochain sprint.</p>
        </div>"""
    if total == 0:
        reco_html += """
        <div style="background:#f0faf4;border-left:4px solid #28a745;
             padding:12px 16px;border-radius:0 8px 8px 0">
            <strong style="color:#28a745">✅ Aucune vulnérabilité détectée</strong>
            <p style="font-size:13px;color:#666;margin-top:5px">
            Votre code respecte les bonnes pratiques de sécurité OWASP.</p>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Securite — Secure Copilot</title>
    <style>
        * {{ margin:0; padding:0; box-sizing:border-box; }}
        body {{ font-family:'Segoe UI',system-ui,sans-serif; background:#f0f2f5; color:#333; }}
        
        .header {{
            background: linear-gradient(135deg, #0d2137 0%, #1F4E79 50%, #2E75B6 100%);
            color:white; padding:30px 40px;
            display:flex; justify-content:space-between; align-items:center;
        }}
        .header-left h1 {{ font-size:22px; font-weight:700; margin-bottom:6px; }}
        .header-left p {{ font-size:12px; opacity:0.7; }}
        .header-right {{
            background:rgba(255,255,255,0.1); border-radius:12px;
            padding:15px 25px; text-align:center;
        }}
        .score-number {{
            font-size:48px; font-weight:900; color:{score_color};
            text-shadow:0 0 20px rgba(255,255,255,0.3);
        }}
        .score-label {{ font-size:12px; opacity:0.8; margin-top:2px; }}

        .container {{ max-width:1200px; margin:25px auto; padding:0 20px; }}

        .stats {{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:20px; }}
        .stat-card {{
            background:white; border-radius:12px; padding:20px;
            text-align:center; box-shadow:0 2px 12px rgba(0,0,0,0.06);
            border-top:4px solid transparent; transition:transform 0.2s;
        }}
        .stat-card:hover {{ transform:translateY(-2px); }}
        .stat-card.files {{ border-top-color:#1F4E79; }}
        .stat-card.critical {{ border-top-color:#dc3545; }}
        .stat-card.high {{ border-top-color:#fd7e14; }}
        .stat-card.medium {{ border-top-color:#ffc107; }}
        .stat-number {{ font-size:40px; font-weight:800; line-height:1; margin-bottom:6px; }}
        .stat-label {{ font-size:12px; color:#888; font-weight:500; text-transform:uppercase; letter-spacing:1px; }}
        .files .stat-number {{ color:#1F4E79; }}
        .critical .stat-number {{ color:#dc3545; }}
        .high .stat-number {{ color:#fd7e14; }}
        .medium .stat-number {{ color:#d4a017; }}

        .grid-2 {{ display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }}

        .section {{
            background:white; border-radius:12px; padding:22px;
            box-shadow:0 2px 12px rgba(0,0,0,0.06); margin-bottom:20px;
        }}
        .section-title {{
            font-size:15px; font-weight:700; color:#1F4E79;
            margin-bottom:16px; padding-bottom:10px;
            border-bottom:2px solid #f0f2f5;
            display:flex; align-items:center; gap:8px;
        }}

        .progress-item {{ margin-bottom:14px; }}
        .progress-header {{
            display:flex; justify-content:space-between;
            font-size:12px; font-weight:600; margin-bottom:5px;
        }}
        .progress-bar {{
            height:8px; background:#f0f2f5; border-radius:4px; overflow:hidden;
        }}
        .progress-fill {{ height:100%; border-radius:4px; transition:width 1s; }}

        table {{ width:100%; border-collapse:collapse; font-size:13px; }}
        th {{
            background:#1F4E79; color:white; padding:11px 14px;
            text-align:left; font-weight:500; font-size:12px;
            text-transform:uppercase; letter-spacing:0.5px;
        }}
        th:first-child {{ border-radius:8px 0 0 0; }}
        th:last-child {{ border-radius:0 8px 0 0; }}
        td {{ padding:11px 14px; border-bottom:1px solid #f5f5f5; vertical-align:middle; }}
        tr:hover td {{ background:rgba(31,78,121,0.03) !important; }}

        .footer {{
            text-align:center; padding:20px; color:#aaa; font-size:11px;
        }}
        .footer strong {{ color:#1F4E79; }}
    </style>
</head>
<body>

<div class="header">
    <div class="header-left">
        <h1>Rapport de Securite — Secure Copilot</h1>
        <p>Projet : {summary['project']}</p>
        <p style="margin-top:4px">
            Date : {datetime.now().strftime('%d/%m/%Y a %H:%M')} &nbsp;|&nbsp;
            Genere par : AI-Powered Developer Copilot for Secure Code Generation
        </p>
    </div>
    <div class="header-right">
        <div class="score-number">{score_emoji}</div>
        <div style="font-size:16px;font-weight:700;margin-top:4px">{score}/100</div>
        <div class="score-label">Score Securite — {score_label}</div>
    </div>
</div>

<div class="container">

    <!-- Statistiques -->
    <div class="stats">
        <div class="stat-card files">
            <div class="stat-number">{summary['total_files']}</div>
            <div class="stat-label">Fichiers scannes</div>
        </div>
        <div class="stat-card critical">
            <div class="stat-number">{summary['critical']}</div>
            <div class="stat-label">Critical</div>
        </div>
        <div class="stat-card high">
            <div class="stat-number">{summary['high']}</div>
            <div class="stat-label">High</div>
        </div>
        <div class="stat-card medium">
            <div class="stat-number">{summary['medium']}</div>
            <div class="stat-label">Medium</div>
        </div>
    </div>

    <div class="grid-2">
        <!-- Distribution -->
        <div class="section">
            <div class="section-title">Distribution des vulnerabilites</div>
            <div class="progress-item">
                <div class="progress-header">
                    <span style="color:#dc3545">CRITICAL</span>
                    <span>{summary['critical']} / {total}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" 
                         style="width:{critical_pct}%;background:#dc3545"></div>
                </div>
            </div>
            <div class="progress-item">
                <div class="progress-header">
                    <span style="color:#fd7e14">HIGH</span>
                    <span>{summary['high']} / {total}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill"
                         style="width:{high_pct}%;background:#fd7e14"></div>
                </div>
            </div>
            <div class="progress-item">
                <div class="progress-header">
                    <span style="color:#d4a017">MEDIUM</span>
                    <span>{summary['medium']} / {total}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill"
                         style="width:{medium_pct}%;background:#ffc107"></div>
                </div>
            </div>
        </div>

        <!-- Recommandations -->
        <div class="section">
            <div class="section-title">Recommandations</div>
            {reco_html}
        </div>
    </div>

    <!-- Tableau vulnerabilites -->
    <div class="section">
        <div class="section-title">
            Vulnerabilites detectees
            <span style="background:#1F4E79;color:white;padding:2px 10px;
            border-radius:20px;font-size:12px">{total}</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Fichier</th>
                    <th>Ligne</th>
                    <th>Code vulnerable</th>
                    <th>Type</th>
                    <th>Severite</th>
                    <th>CWE</th>
                    <th>Correction suggéree</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
    </div>

</div>

<div class="footer">
    Genere par <strong>Secure Copilot</strong> — 
    AI-Powered Developer Copilot for Secure Code Generation &nbsp;|&nbsp;
    {datetime.now().strftime('%d/%m/%Y')}
</div>

</body>
</html>"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"\n Rapport genere : {output_path}")
    return output_path