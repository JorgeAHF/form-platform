import os
import re
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Tuple

from fastapi import (
    FastAPI, UploadFile, File, Form, Depends, HTTPException, status,
    Query, Request
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import FileResponse

from jose import jwt, JWTError
from passlib.hash import bcrypt

from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, ForeignKey, Text,
    func, UniqueConstraint, desc, Boolean, text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

# ----------------- Config -----------------
DATABASE_URL = os.getenv("DATABASE_URL")
FILES_ROOT = Path(os.getenv("FILES_ROOT", "/data"))
MAX_FILE_MB = int(os.getenv("MAX_FILE_MB", "50"))
ALLOWED_EXT = {e.strip().lower() for e in os.getenv("ALLOWED_EXT", "pdf,docx,xlsx,jpg,png,zip").split(",")}
JWT_SECRET = os.getenv("JWT_SECRET", "change_me")
JWT_ALG = "HS256"
ACCESS_TOKEN_EXPIRES_MIN = int(os.getenv("ACCESS_TOKEN_MIN", "120"))
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3001,http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# ----------------- Models -----------------
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="colaborador")  # admin | colaborador
    created_at = Column(DateTime, default=func.now())

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(16), nullable=False, default="externo")  # externo | interno
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    stages = relationship("Stage", back_populates="project", cascade="all,delete")

class Stage(Base):
    __tablename__ = "stages"
    __table_args__ = (UniqueConstraint('project_id','code', name='uq_stage_project_code'),)
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    order_index = Column(Integer, default=0)
    project = relationship("Project", back_populates="stages")

class DeliverableSpec(Base):
    __tablename__ = "deliverables"
    id = Column(Integer, primary_key=True)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(128), nullable=False)                  # único por etapa
    title = Column(String(512), nullable=False)
    required = Column(Boolean, default=True, nullable=False)
    multi = Column(Boolean, default=False, nullable=False)
    allowed_ext = Column(Text, nullable=False, default="pdf")  # csv: "pdf,docx"
    order_index = Column(Integer, default=0)
    optional_group = Column(String(128))

    stage = relationship("Stage", back_populates="deliverables")

    __table_args__ = (
        UniqueConstraint("stage_id", "key", name="uq_deliverables_stage_key"),
    )

# relación inversa en Stage:
Stage.deliverables = relationship(
    "DeliverableSpec", back_populates="stage", cascade="all,delete-orphan"
)

class FileRecord(Base):
    __tablename__ = "files"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)  # puede ser NULL (info técnica)
    filename = Column(String(512), nullable=False)
    path = Column(Text, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    content_type = Column(String(128))
    sha256 = Column(String(64))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=func.now())
    deliverable_id = Column(Integer, ForeignKey("deliverables.id"), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    version = Column(Integer, nullable=False, server_default="1")
    reason = Column(Text)  # motivo de nueva versión (si aplica)
    supersedes_id = Column(Integer, ForeignKey("files.id"), nullable=True)


class ProjectMember(Base):
    __tablename__ = "project_members"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(16), default="uploader")  # viewer | uploader | manager
    created_at = Column(DateTime, default=func.now())
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_user"),)

class RegistrationRequest(Base):
    __tablename__ = "registration_requests"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), nullable=False)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(16), nullable=False, default="pending")  # pending|approved|rejected
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    decided_at = Column(DateTime, nullable=True)
    decided_by = Column(Integer, ForeignKey("users.id"), nullable=True)

# ---- Wire del seeder (import tardío para evitar circular) ----
_seed_project = None
try:
    from seed_deliverables import seed_project as _seed_project
    print("Seeder wired: True")
except Exception as e:
    _seed_project = None
    print("WARN: seed_deliverables no disponible:", e)


# ----------------- Etapas por tipo (Expediente IMT) -----------------
STAGE_TEMPLATES = {
    "externo": [
        ("E1", "1 Concertación del proyecto"),
        ("E2", "2 Gestión de la propuesta técnico-económica"),
        ("E3", "3 Gestión inicial del proyecto"),
        ("E4", "4 Desarrollo del proyecto de investigación"),
        ("E5", "5 Gestión final del proyecto"),
    ],
    "interno": [
        ("I1", "1 Desarrollo de propuestas para realizar investigación"),
        ("I2", "2 Gestión de la autorización"),
        ("I3", "3 Desarrollo del proyecto de investigación"),
        ("I4", "4 Gestión final del proyecto"),
    ],
}

# ----------------- Categorías (Información técnica) -----------------
FOLDER_SCHEMAS: Dict[str, Dict] = {
    "externo": {
        "sections": [
            {
                "key": "info",
                "folder": "Información técnica",
                "categories": [
                    {"key": "ensayos", "folder": "Ensayos de laboratorio"},
                    {"key": "datos_crudos", "folder": "Datos crudos"},
                    {"key": "codigos", "folder": "Códigos de programación"},
                    {"key": "info_cliente", "folder": "Información técnica del cliente"},
                    {"key": "referencias", "folder": "Referencias Bibliográficas"},
                    {"key": "resultados", "folder": "Resultados procesados"},
                    {"key": "figuras", "folder": "Visualizaciones-Figuras"},
                    {"key": "doc_tecnica", "folder": "Documentación técnica interna"},
                    {"key": "presentacion", "folder": "Material de presentación"},
                    {"key": "entregables_cliente", "folder": "Entregables al cliente"},
                ],
            }
        ]
    },
    "interno": {
        "sections": [
            {
                "key": "info",
                "folder": "Información técnica",
                "categories": [
                    {"key": "ensayos", "folder": "Ensayos de laboratorio"},
                    {"key": "datos_crudos", "folder": "Datos crudos"},
                    {"key": "algoritmos", "folder": "Algoritmos/Código de programación"},
                    {"key": "info_tecnica", "folder": "Información técnica"},
                    {"key": "referencias", "folder": "Referencias Bibliográficas"},
                    {"key": "resultados", "folder": "Resultados procesados"},
                    {"key": "figuras", "folder": "Visualizaciones-Figuras"},
                    {"key": "doc_tecnica", "folder": "Documentación técnica interna"},
                    {"key": "presentacion", "folder": "Material de presentación"},
                    {"key": "entregables", "folder": "Entregables"},
                ],
            }
        ]
    },
}

# ----------------- Security helpers -----------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_opt = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def create_db():
    Base.metadata.create_all(engine)
    FILES_ROOT.mkdir(parents=True, exist_ok=True)

def safe_migrate():
    # crea tablas nuevas (deliverables) si no existen
    Base.metadata.create_all(engine)
    # añade columnas a files si faltan (PostgreSQL)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE files ADD COLUMN IF NOT EXISTS deliverable_id integer"))
        conn.execute(text("ALTER TABLE files ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true"))
        conn.execute(text("ALTER TABLE files ADD COLUMN IF NOT EXISTS version integer DEFAULT 1"))
        conn.execute(text("ALTER TABLE files ADD COLUMN IF NOT EXISTS reason text"))
        conn.execute(text("ALTER TABLE files ADD COLUMN IF NOT EXISTS supersedes_id integer"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXPIRES_MIN):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)

def _decode_user(db: Session, token: Optional[str]) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        username: str = payload.get("sub")
        if not username:
            return None
    except JWTError:
        return None
    return db.query(User).filter(User.username == username).first()

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    user = _decode_user(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    return user

def get_current_user_optional(db: Session = Depends(get_db), token: Optional[str] = Depends(oauth2_scheme_opt)) -> Optional[User]:
    return _decode_user(db, token)

def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol admin")
    return user

ROLE_ORDER = {"viewer": 0, "uploader": 1, "manager": 2, "admin": 3}

def is_admin(u: User) -> bool:
    return u.role == "admin"

def ensure_member(db: Session, user: User, project_id: int, need: str = "viewer"):
    if is_admin(user):
        return
    m = db.query(ProjectMember).filter_by(project_id=project_id, user_id=user.id).first()
    if not m:
        raise HTTPException(403, "No eres miembro de este proyecto")
    if ROLE_ORDER.get(m.role, 0) < ROLE_ORDER.get(need, 0):
        raise HTTPException(403, "Permisos insuficientes")

def get_initials(username: str) -> str:
    parts = re.findall(r"[A-Za-z]+", username or "")
    return "".join(p[0] for p in parts).upper()

# ----------------- Helpers: code & folders -----------------
def validate_project_code(code: str, ptype: str):
    if ptype == "externo":
        if not re.match(r"^EE\d{4}\s+[A-Z0-9]{3,}$", code):
            raise HTTPException(400, "Código inválido (esperado: EE#### SIGLAS)")
    elif ptype == "interno":
        if not re.match(r"^EI\d{4}\s+[A-Z0-9]{3,}$", code):
            raise HTTPException(400, "Código inválido (esperado: EI#### SIGLAS)")
    else:
        raise HTTPException(400, "Tipo de proyecto inválido (externo|interno)")

def get_project_schema(ptype: str) -> Dict:
    sch = FOLDER_SCHEMAS.get(ptype)
    if not sch:
        raise HTTPException(500, "Esquema de carpetas no configurado para el tipo")
    return sch

def resolve_folder_path(proj: Project, section_key: str, category_key: str, subcategory_key: Optional[str] = None) -> Path:
    sch = get_project_schema(proj.type)
    section = next((s for s in sch["sections"] if s["key"] == section_key), None)
    if not section:
        raise HTTPException(400, f"Sección inválida para {proj.type}")
    cat = next((c for c in section["categories"] if c["key"] == category_key), None)
    if not cat:
        raise HTTPException(400, "Categoría inválida")
    parts = [proj.code, section["folder"], cat["folder"]]
    if subcategory_key:
        childs = cat.get("children") or []
        sub = next((x for x in childs if x["key"] == subcategory_key), None)
        if not sub:
            raise HTTPException(400, "Subcategoría inválida")
        parts.append(sub["folder"])
    parts.append(datetime.utcnow().strftime("%Y-%m-%d"))
    return FILES_ROOT / "projects" / Path("/".join(parts))

def safe_folder(name: str) -> str:
    return re.sub(r"[^0-9A-Za-zÁÉÍÓÚáéíóúÑñüÜ \-_.()]", "", (name or "").strip())

def seed_stages_for_project(db: Session, project: "Project"):
    tpl = STAGE_TEMPLATES.get(project.type, [])
    # NUEVO: mapear existentes para no duplicar
    existing = { (s.code or "").upper(): s
                 for s in db.query(Stage).filter(Stage.project_id==project.id) }
    for idx, (code, name) in enumerate(tpl, start=1):
        s = existing.get(code.upper())
        if s:
            s.name = name
            s.order_index = idx
            db.add(s)
        else:
            db.add(Stage(project_id=project.id, code=code, name=name, order_index=idx))
    db.commit()


# ----------------- Expediente IMT (helpers) -----------------

def _parse_allowed_ext_csv(csv: str) -> set[str]:
    return {e.strip().lower() for e in (csv or "").split(",") if e.strip()}

def _build_expediente_path(proj_code: str, stage_code: str, deliverable_key: str, version: int) -> Path:
    date_folder = datetime.utcnow().strftime("%Y-%m-%d")
    return (FILES_ROOT / "projects" / proj_code / "Expediente IMT"
            / stage_code / deliverable_key / date_folder / f"v{version}")

def _next_version_for_deliverable(db: Session, deliverable_id: int) -> int:
    # Siguiente versión secuencial (sirve tanto para single como multi)
    q = db.query(func.max(FileRecord.version)).filter(FileRecord.deliverable_id == deliverable_id)
    maxv = q.scalar() or 0
    return maxv + 1

def _expediente_snapshot(project_id: int, db: Session) -> dict:
    proj = db.query(Project).get(project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")

    stages = db.query(Stage).filter(Stage.project_id == project_id).order_by(Stage.order_index).all()
    out_stages = []
    total_req = 0
    done_req = 0

    for st in stages:
        specs = db.query(DeliverableSpec).filter(DeliverableSpec.stage_id == st.id).order_by(DeliverableSpec.order_index).all()
        items = []
        stage_req = 0
        stage_done = 0

        for spec in specs:
            files = db.query(FileRecord).filter(FileRecord.deliverable_id == spec.id).order_by(FileRecord.uploaded_at.desc()).all()

            # estado de cumplimiento
            if spec.multi:
                complete = len(files) > 0
            else:
                # single: debe existir 1 activo
                active = next((f for f in files if f.is_active), None)
                complete = active is not None

            if spec.required:
                stage_req += 1
                if complete:
                    stage_done += 1

            items.append({
                "deliverable_id": spec.id,
                "key": spec.key,
                "title": spec.title,
                "required": spec.required,
                "multi": spec.multi,
                "allowed_ext": list(_parse_allowed_ext_csv(spec.allowed_ext)),
                "optional_group": spec.optional_group,
                "status": "completo" if complete else "faltante",
                "files": [{
                    "id": f.id,
                    "filename": f.filename,
                    "size_bytes": f.size_bytes,
                    "content_type": f.content_type,
                    "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
                    "uploaded_by": f.uploaded_by,
                    "version": f.version,
                    "is_active": f.is_active,
                    "reason": f.reason
                } for f in files]
            })

        pct = round(100 * stage_done / stage_req, 1) if stage_req > 0 else 0.0
        out_stages.append({
            "stage": {"id": st.id, "code": st.code, "name": st.name, "order": st.order_index},
            "required_total": stage_req,
            "required_done": stage_done,
            "progress_percent": pct,
            "deliverables": items
        })

        total_req += stage_req
        done_req += stage_done

    global_pct = round(100 * done_req / total_req, 1) if total_req > 0 else 0.0
    return {"project": {"id": proj.id, "code": proj.code, "name": proj.name},
            "required_total": total_req, "required_done": done_req,
            "progress_percent": global_pct, "stages": out_stages}

# ----------------- App -----------------
app = FastAPI(title="Files Platform API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization", "Content-Type", "Accept", "Origin", "User-Agent",
        "DNT", "Cache-Control", "X-Requested-With"
    ],
    expose_headers=["Content-Disposition"],
)

@app.on_event("startup")
def on_startup():
    create_db()
    safe_migrate()

# -------- Auth --------
@app.post("/auth/register")
def register(
    username: str = Form(...),
    password: str = Form(...),
    role: str = Form("colaborador"),
    db: Session = Depends(get_db),
    current_opt: Optional[User] = Depends(get_current_user_optional),
):
    # Solo libre si es el PRIMER usuario; de lo contrario requiere admin
    if db.query(User).count() == 0:
        hashed = bcrypt.hash(password)
        user = User(username=username, password_hash=hashed, role="admin")
        db.add(user); db.commit()
        return {"ok": True, "user": {"username": username, "role": user.role}, "bootstrap": True}

    if not current_opt or current_opt.role != "admin":
        raise HTTPException(403, "Solo un admin puede crear usuarios directamente")

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(400, "Usuario ya existe")
    hashed = bcrypt.hash(password)
    user = User(username=username, password_hash=hashed, role=role)
    db.add(user); db.commit()
    return {"ok": True, "user": {"username": username, "role": user.role}, "bootstrap": False}

@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not bcrypt.verify(form.password, user.password_hash):
        raise HTTPException(401, "Credenciales inválidas")
    token = create_access_token({"sub": user.username, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "initials": get_initials(user.username),
    }

@app.get("/me")
def me(current: User = Depends(get_current_user)):
    return {
        "username": current.username,
        "role": current.role,
        "initials": get_initials(current.username),
    }

# --- Registro con aprobación ---
@app.post("/auth/request-register")
def request_register(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(400, "Usuario ya existe")
    existing = db.query(RegistrationRequest).filter(
        RegistrationRequest.username == username,
        RegistrationRequest.status == "pending"
    ).first()
    if existing:
        raise HTTPException(400, "Ya existe una solicitud pendiente para este usuario")
    rr = RegistrationRequest(
        username=username.strip(),
        password_hash=bcrypt.hash(password),
        status="pending"
    )
    db.add(rr); db.commit()
    return {"ok": True, "message": "Solicitud enviada. Un administrador la revisará."}

@app.get("/admin/registrations")
def list_registrations(
    status_filter: Optional[str] = Query(None, pattern="^(pending|approved|rejected)$"),
    db: Session = Depends(get_db),
    current: User = Depends(require_admin)
):
    q = db.query(RegistrationRequest)
    if status_filter:
        q = q.filter(RegistrationRequest.status == status_filter)
    rows = q.order_by(desc(RegistrationRequest.created_at)).limit(200).all()
    return [
        {
            "id": r.id, "username": r.username, "status": r.status, "note": r.note,
            "created_at": r.created_at, "decided_at": r.decided_at, "decided_by": r.decided_by
        }
        for r in rows
    ]

@app.post("/admin/registrations/{req_id}/approve")
def approve_registration(
    req_id: int,
    role: str = Form("colaborador"),
    db: Session = Depends(get_db),
    current: User = Depends(require_admin)
):
    rr = db.get(RegistrationRequest, req_id)
    if not rr or rr.status != "pending":
        raise HTTPException(404, "Solicitud no encontrada o no está pendiente")
    if db.query(User).filter(User.username == rr.username).first():
        # Si alguien ya creó al user manualmente, marca como rechazada por duplicado
        rr.status = "rejected"
        rr.note = "Duplicada: usuario ya existe"
        rr.decided_at = func.now()
        rr.decided_by = current.id
        db.commit()
        raise HTTPException(409, "Usuario ya existe; solicitud marcada como rechazada")

    user = User(username=rr.username, password_hash=rr.password_hash, role=role)
    db.add(user)
    rr.status = "approved"
    rr.decided_at = func.now()
    rr.decided_by = current.id
    db.commit()
    return {"ok": True, "user": {"id": user.id, "username": user.username, "role": user.role}}

@app.post("/admin/registrations/{req_id}/reject")
def reject_registration(
    req_id: int,
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current: User = Depends(require_admin)
):
    rr = db.get(RegistrationRequest, req_id)
    if not rr or rr.status != "pending":
        raise HTTPException(404, "Solicitud no encontrada o no está pendiente")
    rr.status = "rejected"
    rr.note = (note or "").strip() or None
    rr.decided_at = func.now()
    rr.decided_by = current.id
    db.commit()
    return {"ok": True}

# -------- Proyectos / Etapas / Miembros --------
@app.post("/projects")
def create_project(
    code: str = Form(...),
    name: str = Form(...),
    type: str = Form("externo"),
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    type = type.lower().strip()
    if type not in ("externo", "interno"):
        raise HTTPException(400, "type debe ser 'externo' o 'interno'")
    validate_project_code(code, type)
    if db.query(Project).filter(Project.code == code).first():
        raise HTTPException(400, "Código de proyecto ya existe")
    p = Project(code=code, name=name, type=type, created_by=current.id)
    db.add(p); db.commit()

    (FILES_ROOT / "projects" / p.code / "Información técnica").mkdir(parents=True, exist_ok=True)
    (FILES_ROOT / "projects" / p.code / "Expediente IMT").mkdir(parents=True, exist_ok=True)

# --- AUTO-SIEMBRA: etapas + (si hay script) entregables ---
# --- AUTO-SIEMBRA: etapas + entregables (si hay script) ---
    try:
        # ¿ya hay deliverables? (idempotencia)
        has_delivs = db.query(DeliverableSpec)\
            .join(Stage, DeliverableSpec.stage_id == Stage.id)\
            .filter(Stage.project_id == p.id).count() > 0

        if not has_delivs:
            if _seed_project is not None:
                _seed_project(db, p)   # siembra etapas + checklist
            else:
                # fallback: intenta importar directo (evita importlib.util)
                try:
                    import seed_deliverables as _sd
                    _sd.seed_project(db, p)
                except Exception as e:
                    print("WARN auto-seed (fallback):", e)

        # Si por lo que sea sigue sin checklist, al menos siembra etapas
        post_delivs = db.query(DeliverableSpec)\
            .join(Stage, DeliverableSpec.stage_id == Stage.id)\
            .filter(Stage.project_id == p.id).count() > 0
        if not post_delivs:
            seed_stages_for_project(db, p)

    except Exception as e:
        print("WARN auto-seed:", e)


@app.get("/projects")
def list_projects(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if is_admin(current):
        rows = db.query(Project).order_by(Project.created_at.desc()).all()
    else:
        rows = (db.query(Project)
                  .join(ProjectMember, ProjectMember.project_id == Project.id)
                  .filter(ProjectMember.user_id == current.id)
                  .order_by(Project.created_at.desc())
                  .all())
    return [{"id": p.id, "code": p.code, "name": p.name, "type": p.type} for p in rows]

@app.post("/projects/{project_id}/stages")
def add_stage(
    project_id: int,
    code: str = Form(...),
    name: str = Form(...),
    order_index: int = Form(0),
    db: Session = Depends(get_db),
    current: User = Depends(require_admin)
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")
    st = Stage(project_id=project_id, code=code, name=name, order_index=order_index)
    db.add(st); db.commit()
    return {"id": st.id, "code": st.code, "name": st.name, "order": st.order_index}

@app.get("/projects/{project_id}/stages")
def list_stages(project_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")
    ensure_member(db, current, project_id, "viewer")
    rows = db.query(Stage).filter(Stage.project_id == project_id).order_by(Stage.order_index).all()
    return [{"id": s.id, "code": s.code, "name": s.name, "order": s.order_index} for s in rows]

@app.get("/projects/{project_id}/progress")
def project_progress(project_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")
    ensure_member(db, current, project_id, "viewer")
    stages = db.query(Stage).filter(Stage.project_id == project_id).order_by(Stage.order_index).all()
    rows = []
    for s in stages:
        count = db.query(FileRecord).filter(FileRecord.project_id == project_id, FileRecord.stage_id == s.id).count()
        rows.append({"stage_id": s.id, "stage_code": s.code, "stage_name": s.name, "files": count, "done": count > 0})
    total = len(stages)
    done = sum(1 for r in rows if r["done"])
    pct = round(100 * done / total, 1) if total > 0 else 0.0
    return {"project": proj.code, "stages": rows, "completed_percent": pct}

@app.get("/projects/{project_id}/progress-expediente")
def progress_expediente(project_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    snap = _expediente_snapshot(project_id, db)
    return {
        "project": snap["project"],
        "required_total": snap["required_total"],
        "required_done": snap["required_done"],
        "progress_percent": snap["progress_percent"],
        "stages": [{
            "stage": s["stage"],
            "required_total": s["required_total"],
            "required_done": s["required_done"],
            "progress_percent": s["progress_percent"],
        } for s in snap["stages"]]
    }

@app.post("/projects/{project_id}/members")
def add_member(
    project_id: int,
    user_id: int = Form(...),
    role: str = Form("uploader"),
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")
    exists = db.query(ProjectMember).filter_by(project_id=project_id, user_id=user_id).first()
    if exists:
        exists.role = role
    else:
        db.add(ProjectMember(project_id=project_id, user_id=user_id, role=role))
    db.commit()
    return {"ok": True}

@app.get("/projects/{project_id}/members")
def list_members_admin(project_id: int, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    rows = (
        db.query(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )
    return [
        {"user_id": pm.user_id, "username": u.username, "role": pm.role, "since": pm.created_at}
        for pm, u in rows
    ]

@app.delete("/projects/{project_id}/members")
def remove_member(project_id: int, user_id: int = Query(...), db: Session = Depends(get_db), current: User = Depends(require_admin)):
    pm = db.query(ProjectMember).filter_by(project_id=project_id, user_id=user_id).first()
    if not pm:
        raise HTTPException(404, "Miembro no encontrado en el proyecto")
    db.delete(pm)
    db.commit()
    return {"ok": True}

@app.get("/users")
def list_users(q: Optional[str] = Query(None), db: Session = Depends(get_db), current: User = Depends(require_admin)):
    qry = db.query(User)
    if q:
        like = f"%{q.strip()}%"
        qry = qry.filter(User.username.ilike(like))
    rows = qry.order_by(User.created_at.desc()).limit(50).all()
    return [{"id": u.id, "username": u.username, "role": u.role, "created_at": u.created_at} for u in rows]

@app.get("/projects/{project_id}/categories")
def categories_tree(project_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")
    ensure_member(db, current, project_id, "viewer")
    return {"project": proj.code, "type": proj.type, "tree": get_project_schema(proj.type)}

@app.get("/projects/{project_id}/deliverables")
def list_project_deliverables(project_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    stages = db.query(Stage).filter(Stage.project_id == project_id).order_by(Stage.order_index).all()
    out = []
    for s in stages:
        dels = db.query(DeliverableSpec).filter(DeliverableSpec.stage_id == s.id).order_by(DeliverableSpec.order_index).all()
        out.append({
            "stage": {"id": s.id, "code": s.code, "name": s.name},
            "deliverables": [{
                "id": d.id, "key": d.key, "title": d.title,
                "required": d.required, "multi": d.multi,
                "allowed_ext": d.allowed_ext, "order": d.order_index,
                "optional_group": d.optional_group
            } for d in dels]
        })
    return out

@app.get("/projects/{project_id}/expediente")
def get_expediente(project_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    return _expediente_snapshot(project_id, db)

# -------- Descarga & listado de archivos --------
@app.get("/download/{file_id}")
def download_file(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    # 1) token por Authorization: Bearer ...
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    token = None
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()

    # 2) o por query ?access_token= / ?token=
    token = token or request.query_params.get("access_token") or request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    current = _user_from_token(db, token)
    if not current:
        raise HTTPException(status_code=401, detail="Not authenticated")

    rec = db.get(FileRecord, file_id)
    if not rec or not Path(rec.path).exists():
        raise HTTPException(404, "Archivo no encontrado")

    # permisos mínimos: viewer del proyecto (o admin)
    ensure_member(db, current, rec.project_id, "viewer")

    return FileResponse(
        path=rec.path,
        filename=rec.filename,
        media_type=rec.content_type or "application/octet-stream"
    )

@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    rec = db.get(FileRecord, file_id)
    if not rec:
        raise HTTPException(404, "Archivo no encontrado")
    # requiere rol de manager en el proyecto (o admin global)
    ensure_member(db, current, rec.project_id, "manager")
    # eliminar del disco (si existe) y del registro
    try:
        p = Path(rec.path)
        if p.exists():
            p.unlink()
    except Exception:
        # si falla borrar el archivo, seguimos con el registro para no bloquear
        pass
    db.delete(rec)
    db.commit()
    return {"ok": True}


@app.get("/projects/{project_id}/files")
def list_files(
    project_id: int,
    stage_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None, description="Búsqueda por nombre (ILIKE)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")
    ensure_member(db, current, project_id, "viewer")

    from sqlalchemy import or_
    from sqlalchemy.orm import aliased
    U = aliased(User)

    qset = (
        db.query(FileRecord, Stage, U)
        .join(Stage, Stage.id == FileRecord.stage_id, isouter=True)
        .join(U, U.id == FileRecord.uploaded_by, isouter=True)
        .filter(FileRecord.project_id == project_id)
    )
    if stage_id:
        qset = qset.filter(FileRecord.stage_id == stage_id)
    if q:
        like = f"%{q.strip()}%"
        qset = qset.filter(FileRecord.filename.ilike(like))

    qset = qset.order_by(desc(FileRecord.uploaded_at)).limit(limit).offset(offset)

    items = []
    for fr, st, u in qset.all():
        items.append({
            "id": fr.id,
            "filename": fr.filename,
            "size_bytes": fr.size_bytes,
            "content_type": fr.content_type,
            "stage": ({"id": st.id, "code": st.code, "name": st.name} if st else None),
            "uploaded_at": fr.uploaded_at,
            "uploaded_by": (u.username if u else None),
            "download_url": f"http://localhost:8000/download/{fr.id}",
        })
    return {"items": items, "limit": limit, "offset": offset}


# -------- Upload de archivos --------
@app.post("/upload")
def upload_file(
    project_id: int = Form(...),
    # EXPEDIENTE IMT (usa etapas)
    stage_id: Optional[int] = Form(None),
    exp_subfolder: Optional[str] = Form(None),
    # INFORMACIÓN TÉCNICA (usa categorías)
    section_key: Optional[str] = Form(None),
    category_key: Optional[str] = Form(None),
    subcategory_key: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")

    ensure_member(db, current, project_id, "uploader")

    # Información técnica (categorías)
    if section_key and category_key:
        dest_dir = resolve_folder_path(
            proj,
            section_key.strip(),
            category_key.strip(),
            subcategory_key.strip() if subcategory_key else None
        )
        stage_fk = None
    else:
        # Expediente IMT (etapas)
        if not stage_id:
            raise HTTPException(400, "Debes indicar stage_id o (section_key + category_key)")
        stage = db.get(Stage, stage_id)
        if not stage or stage.project_id != project_id:
            raise HTTPException(400, "Etapa inválida para el proyecto")
        date_folder = datetime.utcnow().strftime("%Y-%m-%d")
        base = FILES_ROOT / "projects" / proj.code / "Expediente IMT" / (stage.code or safe_folder(stage.name))
        if exp_subfolder:
            base = base / safe_folder(exp_subfolder)
        dest_dir = base / date_folder
        stage_fk = stage_id

    dest_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, f"Extensión no permitida: .{ext}")

    dest_path = dest_dir / file.filename
    hasher = hashlib.sha256()
    total = 0
    with dest_path.open("wb") as f:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_FILE_MB * 1024 * 1024:
                try: dest_path.unlink()
                except Exception: pass
                raise HTTPException(413, f"Archivo supera {MAX_FILE_MB} MB")
            hasher.update(chunk)
            f.write(chunk)

    rec = FileRecord(
        project_id=project_id,
        stage_id=stage_fk,
        filename=file.filename,
        path=str(dest_path),
        size_bytes=total,
        content_type=file.content_type,
        sha256=hasher.hexdigest(),
        uploaded_by=current.id
    )
    db.add(rec); db.commit()

    return {
        "ok": True,
        "file": {
            "filename": rec.filename,
            "size_bytes": rec.size_bytes,
            "sha256": rec.sha256,
            "saved_to": rec.path
        }
    }

@app.post("/upload/expediente")
def upload_expediente(
    project_id: int = Form(...),
    stage_id: int = Form(...),
    deliverable_key: str = Form(...),
    file: UploadFile = File(...),
    reason: Optional[str] = Form(None),  # obligatorio cuando single y ya existe activo
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user)
):
    proj = db.query(Project).get(project_id)
    if not proj:
        raise HTTPException(404, "Proyecto no existe")

    ensure_member(db, current, project_id, "uploader")

    stage = db.query(Stage).get(stage_id)
    if not stage or stage.project_id != project_id:
        raise HTTPException(400, "Etapa inválida para el proyecto")

    spec = db.query(DeliverableSpec).filter(
        DeliverableSpec.stage_id == stage.id,
        DeliverableSpec.key == deliverable_key
    ).first()
    if not spec:
        raise HTTPException(404, "Entregable no encontrado en la etapa")

    # Validación extensiones
    ext = Path(file.filename).suffix.lower().lstrip(".")
    allowed_spec = _parse_allowed_ext_csv(spec.allowed_ext)
    if ext not in allowed_spec:
        raise HTTPException(415, f"Extensión no permitida por el entregable: .{ext}. Permitidas: {sorted(allowed_spec)}")

    # Además, respeta el filtro global ALLOWED_EXT si lo estás usando:
    if ALLOWED_EXT and ext not in ALLOWED_EXT:
        raise HTTPException(415, f"Extensión no permitida por la política global: .{ext}. Globalmente permitidas: {sorted(ALLOWED_EXT)}")

    # Versionado / política single vs multi
    existing_active: Optional[FileRecord] = None
    if not spec.multi:
        existing_active = db.query(FileRecord).filter(
            FileRecord.deliverable_id == spec.id,
            FileRecord.is_active == True
        ).order_by(FileRecord.version.desc()).first()
        if existing_active and not reason:
            raise HTTPException(400, "Debes indicar 'reason' para crear una nueva versión de un entregable de archivo único.")

    version = _next_version_for_deliverable(db, spec.id)
    dest_dir = _build_expediente_path(proj.code, stage.code, spec.key, version)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / file.filename

    # Guardado con límites
    hasher = hashlib.sha256()
    total = 0
    with dest_path.open("wb") as f:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_FILE_MB * 1024 * 1024:
                try:
                    dest_path.unlink()
                except Exception:
                    pass
                raise HTTPException(413, f"Archivo supera {MAX_FILE_MB} MB")
            hasher.update(chunk)
            f.write(chunk)

    # Si single y había activo, lo desactivamos (queda como versión previa)
    supersedes_id = None
    if existing_active:
        existing_active.is_active = False
        supersedes_id = existing_active.id
        db.add(existing_active)

    rec = FileRecord(
        project_id=project_id,
        stage_id=stage_id,
        deliverable_id=spec.id,
        filename=file.filename,
        path=str(dest_path),
        size_bytes=total,
        content_type=file.content_type,
        sha256=hasher.hexdigest(),
        uploaded_by=current.id,
        is_active=True,
        version=version,
        reason=reason,
        supersedes_id=supersedes_id
    )
    db.add(rec); db.commit()

    # Respuesta compacta + snapshot opcional
    return {
        "ok": True,
        "file": {
            "id": rec.id,
            "filename": rec.filename,
            "size_bytes": rec.size_bytes,
            "version": rec.version,
            "is_active": rec.is_active,
            "reason": rec.reason
        }
    }

# -------- Endpoint estilo Form.io (compat) --------
def _user_from_token(db: Session, token: str) -> Optional[User]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        username = payload.get("sub")
        if not username:
            return None
    except JWTError:
        return None
    return db.query(User).filter(User.username == username).first()

@app.post("/upload/formio")
def upload_formio(
    file: UploadFile = File(...),
    project_id_form: Optional[int] = Form(None),
    stage_id_form: Optional[int] = Form(None),
    project_id_q: Optional[int] = Query(None),
    stage_id_q: Optional[int] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db),
):
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    token = None
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    token = token or request.query_params.get("access_token") or request.query_params.get("token")
    current = _user_from_token(db, token or "")
    if not current:
        raise HTTPException(status_code=401, detail="Not authenticated")

    project_id = project_id_form if project_id_form is not None else project_id_q
    stage_id = stage_id_form if stage_id_form is not None else stage_id_q
    if not project_id or not stage_id:
        raise HTTPException(400, "Debes indicar project_id y stage_id")

    ensure_member(db, current, project_id, "uploader")

    proj = db.get(Project, project_id)
    stage = db.get(Stage, stage_id)
    if not proj or not stage or stage.project_id != proj.id:
        raise HTTPException(400, "Proyecto/Etapa inválidos")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, f"Extensión no permitida: .{ext}")

    date_folder = datetime.utcnow().strftime("%Y-%m-%d")
    dest_dir = FILES_ROOT / "projects" / proj.code / "Expediente IMT" / safe_folder(stage.name) / date_folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / file.filename

    hasher = hashlib.sha256()
    total = 0
    with dest_path.open("wb") as f:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_FILE_MB * 1024 * 1024:
                try: dest_path.unlink()
                except Exception: pass
                raise HTTPException(413, f"Archivo supera {MAX_FILE_MB} MB")
            hasher.update(chunk)
            f.write(chunk)

    rec = FileRecord(
        project_id=project_id,
        stage_id=stage_id,
        filename=file.filename,
        path=str(dest_path),
        size_bytes=total,
        content_type=file.content_type,
        sha256=hasher.hexdigest(),
        uploaded_by=current.id
    )
    db.add(rec); db.commit()

    return {
        "name": rec.filename,
        "size": rec.size_bytes,
        "type": rec.content_type or "application/octet-stream",
        "url": f"http://localhost:8000/download/{rec.id}",
        "storage": "url"
    }
