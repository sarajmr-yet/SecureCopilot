from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.services.auth import (
    authenticate_user, create_user, create_access_token,
    decode_token, get_user_by_id
)
from app.models.vulnerability import User, Project, UserProject
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# ============ SCHEMAS ============

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "developer"

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class AssignProject(BaseModel):
    user_id: int
    project_id: int

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

# ============ HELPERS ============

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    user = get_user_by_id(db, payload.get("user_id"))
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acces admin requis")
    return current_user

# ============ AUTH ROUTES ============

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants incorrects")

    token = create_access_token({"user_id": user.id, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role
    }

# ============ ADMIN ROUTES ============

@router.post("/users")
async def create_new_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Utilisateur existe deja")

    user = create_user(db, user_data.username, user_data.email,
                       user_data.password, user_data.role)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    }

@router.get("/users")
async def get_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role} for u in users]

@router.post("/projects")
async def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    project = Project(
        name=project_data.name,
        description=project_data.description,
        created_by=admin.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"id": project.id, "name": project.name, "description": project.description}

@router.get("/projects")
async def get_all_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "admin":
        projects = db.query(Project).all()
    else:
        user_projects = db.query(UserProject).filter(
            UserProject.user_id == current_user.id
        ).all()
        project_ids = [up.project_id for up in user_projects]
        projects = db.query(Project).filter(Project.id.in_(project_ids)).all()

    return [{"id": p.id, "name": p.name, "description": p.description} for p in projects]

@router.post("/assign")
async def assign_user_to_project(
    data: AssignProject,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    existing = db.query(UserProject).filter(
        UserProject.user_id == data.user_id,
        UserProject.project_id == data.project_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Deja assigne")

    assignment = UserProject(user_id=data.user_id, project_id=data.project_id)
    db.add(assignment)
    db.commit()
    return {"message": "Utilisateur assigne au projet avec succes"}
@router.get("/assignments")
async def get_assignments(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    assignments = db.query(UserProject).all()
    result = []
    for a in assignments:
        user = db.query(User).filter(User.id == a.user_id).first()
        project = db.query(Project).filter(Project.id == a.project_id).first()
        if user and project:
            result.append({
                "user_id": a.user_id,
                "username": user.username,
                "project_id": a.project_id,
                "project_name": project.name
            })
    return result
@router.delete("/assign")
async def remove_assignment(
    data: AssignProject,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    assignment = db.query(UserProject).filter(
        UserProject.user_id == data.user_id,
        UserProject.project_id == data.project_id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignation introuvable")

    db.delete(assignment)
    db.commit()
    return {"message": "Assignation supprimée avec succès"}