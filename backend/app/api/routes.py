from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.services.analyzer import analyze_code
from app.services.llm import get_explanation
from app.core.config import get_db
from app.models.vulnerability import Vulnerability

router = APIRouter()

def save_vulnerabilities(db: Session, vulnerabilities: list, file_path: str = "unknown", project_id: int = None, user_id: int = None):
    for vuln in vulnerabilities:
        try:
            # Vérifier si déjà existante
            existing = db.query(Vulnerability).filter(
                Vulnerability.file_path == file_path,
                Vulnerability.vuln_id == vuln.get("id", ""),
                Vulnerability.line_number == vuln.get("line", 0),
                Vulnerability.is_fixed == False
            ).first()

            if existing:
                continue

            db_vuln = Vulnerability(
                file_path=file_path,
                line_number=vuln.get("line", 0),
                vuln_id=vuln.get("id", ""),
                message=vuln.get("message", ""),
                severity=vuln.get("severity", ""),
                cwe=vuln.get("cwe", ""),
                code_snippet=vuln.get("code", ""),
                fix=vuln.get("fix", ""),
                project_id=project_id,
                user_id=user_id
            )
            db.add(db_vuln)
        except Exception as e:
            print(f"Error saving vulnerability: {e}")
            db.rollback()
            continue
    
    try:
        db.commit()
    except Exception as e:
        print(f"Error committing: {e}")
        db.rollback()

@router.post("/analyze")
async def analyze(payload: dict, db: Session = Depends(get_db)):
    code = payload.get("code", "")
    language = payload.get("language", "python")
    file_path = payload.get("file_path", "unknown")
    project_id = payload.get("project_id", None)
    vulnerabilities = await analyze_code(code, language)

    # Sauvegarder dans PostgreSQL
    if vulnerabilities:
        save_vulnerabilities(db, vulnerabilities, file_path, project_id)

    return {
        "vulnerabilities": vulnerabilities,
        "count": len(vulnerabilities)
    }

@router.post("/analyze/full")
async def analyze_full(payload: dict, db: Session = Depends(get_db)):
    code = payload.get("code", "")
    language = payload.get("language", "python")
    file_path = payload.get("file_path", "unknown")
    project_id = payload.get("project_id", None)
    vulnerabilities = await analyze_code(code, language)

    for vuln in vulnerabilities:
        explanation = await get_explanation(vuln, code)
        vuln["explication"] = explanation.get("explication", "")
        vuln["risque"] = explanation.get("risque", "")
        vuln["correction_llm"] = explanation.get("correction", vuln["fix"])

    if vulnerabilities:
        save_vulnerabilities(db, vulnerabilities, file_path, project_id)

    return {
        "vulnerabilities": vulnerabilities,
        "count": len(vulnerabilities)
    }

@router.get("/history")
async def get_history(
    project_id: int = None,
    user_id: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(Vulnerability)
    
    if project_id:
        query = query.filter(Vulnerability.project_id == project_id)
    
    if user_id:
        query = query.filter(Vulnerability.user_id == user_id)
    
    vulns = query.order_by(
        Vulnerability.detected_at.desc()
    ).limit(100).all()

    return {
        "history": [
            {
                "id": v.id,
                "file_path": v.file_path,
                "line_number": v.line_number,
                "vuln_id": v.vuln_id,
                "severity": v.severity,
                "cwe": v.cwe,
                "message": v.message,
                "detected_at": str(v.detected_at),
                "is_fixed": v.is_fixed,
                "project_id": v.project_id,
                "user_id": v.user_id
            }
            for v in vulns
        ],
        "total": len(vulns)
    }
@router.get("/stats")
async def get_stats(
    project_id: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(Vulnerability)
    
    if project_id:
        query = query.filter(Vulnerability.project_id == project_id)

    total = query.count()
    critical = query.filter(Vulnerability.severity == "CRITICAL").count()
    high = query.filter(Vulnerability.severity == "HIGH").count()
    medium = query.filter(Vulnerability.severity == "MEDIUM").count()
    fixed = query.filter(Vulnerability.is_fixed == True).count()

    return {
        "total": total,
        "critical": critical,
        "high": high,
        "medium": medium,
        "fixed": fixed
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            code = data.get("code", "")
            file_path = data.get("file_path", "unknown")
            project_id = data.get("project_id", None)
            user_id = data.get("user_id", None)  # ← nouveau

            print(f"project_id reçu : {project_id}, user_id reçu : {user_id}")

            vulnerabilities = await analyze_code(code, "python")

            if vulnerabilities:
                save_vulnerabilities(db, vulnerabilities, file_path, project_id, user_id)  # ← modifié

            for vuln in vulnerabilities:
                explanation = await get_explanation(vuln, code)
                vuln["explication"] = explanation.get("explication", "")
                vuln["risque"] = explanation.get("risque", "")
                vuln["correction_llm"] = explanation.get("correction", vuln["fix"])
            try:
                await websocket.send_json({
                    "vulnerabilities": vulnerabilities,
                    "count": len(vulnerabilities)
                })
            except RuntimeError:
                print("WebSocket fermé avant l'envoi")
                break
            
            
    except WebSocketDisconnect:
        print("Client disconnected")
@router.patch("/vulnerabilities/{vuln_id}/fix")
async def mark_as_fixed(
    vuln_id: int,
    db: Session = Depends(get_db)
):
    vuln = db.query(Vulnerability).filter(
        Vulnerability.id == vuln_id
    ).first()
    
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable")
    
    vuln.is_fixed = True
    db.commit()
    return {"message": "Vulnérabilité marquée comme corrigée"}