# backend/seed_deliverables.py
import os, sys, argparse
from typing import Dict, Any, List
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Importa tus modelos desde app.py
from app import Base, Project, Stage, DeliverableSpec, engine as app_engine

# ---------- SEED (idéntico al aprobado) ----------
SEED = {
  "externo": {
    "stages": [
      {
        "code": "E1",
        "name": "1 Concertación del proyecto",
        "order": 1,
        "deliverables": [
          {
            "key": "solicitud_servicio_dirigida_dg",
            "title": "Solicitud de servicio dirigida al Director General",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "comunicacion_con_cliente",
            "title": "Comunicación con el cliente (email y/o minutas)",
            "required": True,
            "multi": True,
            "allowed_ext": ["pdf"],
            "order": 2,
            "optional_group": None
          }
        ]
      },
      {
        "code": "E2",
        "name": "2 Gestión de la propuesta técnico-económica",
        "order": 2,
        "deliverables": [
          {
            "key": "propuesta_tecnico_economica_editable",
            "title": "Propuesta técnico-económica editable",
            "required": True,
            "multi": False,
            "allowed_ext": ["doc", "docx"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "propuesta_tecnico_economica_firmada",
            "title": "Propuesta técnico-económica firmada",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 2,
            "optional_group": None
          },
          {
            "key": "f3_ri_001_propuesta_economica",
            "title": "F3-RI-001 Propuesta económica",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf", "doc", "docx"],
            "order": 3,
            "optional_group": None
          },
          {
            "key": "f4_ri_001_gestion_riesgos",
            "title": "F4-RI-001 Gestión de riesgos",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf", "doc", "docx"],
            "order": 4,
            "optional_group": None
          },
          {
            "key": "comunicacion_aceptacion_propuesta",
            "title": "Comunicación con el cliente - Aceptación de propuesta",
            "required": True,
            "multi": True,
            "allowed_ext": ["pdf"],
            "order": 5,
            "optional_group": None
          }
        ]
      },
      {
        "code": "E3",
        "name": "3 Gestión inicial del proyecto",
        "order": 3,
        "deliverables": [
          {
            "key": "contrato_convenio_transparencia_con_anexos",
            "title": "Contrato, convenio u oficio de transparencia de recursos con anexos",
            "required": True,
            "multi": True,
            "allowed_ext": ["pdf"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "acta_constitutiva_empresa",
            "title": "Acta constitutiva de la empresa",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 101,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "poder_notarial_representante",
            "title": "Poder notarial de la persona que firmará el contrato",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 102,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "ine_representante_legal",
            "title": "INE del representante legal",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 103,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "comprobante_domicilio_empresa",
            "title": "Comprobante de domicilio de la empresa",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 104,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "constancia_situacion_fiscal",
            "title": "Constancia de situación fiscal (empresa)",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 105,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "opinion_cumplimiento_sat",
            "title": "Opinión de Cumplimiento SAT",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 106,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "opinion_cumplimiento_infonavit",
            "title": "Opinión de Cumplimiento INFONAVIT",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 107,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "opinion_cumplimiento_imss",
            "title": "Opinión de Cumplimiento IMSS",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 108,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "permisos_o_asignacion_obra",
            "title": "Permisos o asignación de la obra por autoridades",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 109,
            "optional_group": "documentos_contrato_adicionales"
          },
          {
            "key": "f1_ri_002_programa_actividades",
            "title": "F1 RI-002 Programa de actividades (Cronograma cero)",
            "required": True,
            "multi": False,
            "allowed_ext": ["xls", "xlsx"],
            "order": 2,
            "optional_group": None
          },
          {
            "key": "comunicacion_elaboracion_contrato",
            "title": "Comunicación con el cliente – Gestión para elaboración del contrato",
            "required": True,
            "multi": True,
            "allowed_ext": ["pdf"],
            "order": 3,
            "optional_group": None
          }
        ]
      },
      {
        "code": "E4",
        "name": "4 Desarrollo del proyecto de investigación",
        "order": 4,
        "deliverables": [
          {
            "key": "informes_bimestrales_sistema_proyectos",
            "title": "Informes bimestrales del sistema de proyectos",
            "required": True,
            "multi": True,
            "allowed_ext": ["xls", "xlsx"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "informes_parciales_editables",
            "title": "Informes parciales editables",
            "required": True,
            "multi": True,
            "allowed_ext": ["doc", "docx"],
            "order": 2,
            "optional_group": None
          },
          {
            "key": "informes_parciales_firmados_y_oficio",
            "title": "Informes parciales firmados y oficio de entrega",
            "required": True,
            "multi": True,
            "allowed_ext": ["pdf"],
            "order": 3,
            "optional_group": None
          },
          {
            "key": "informe_final_editable",
            "title": "Informe final editable",
            "required": True,
            "multi": False,
            "allowed_ext": ["doc", "docx"],
            "order": 4,
            "optional_group": None
          },
          {
            "key": "informe_final_firmado_y_oficio",
            "title": "Informe final firmado y oficio de entrega",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 5,
            "optional_group": None
          },
          {
            "key": "comunicacion_seguimiento_reprogramaciones",
            "title": "Comunicación con el cliente – Seguimiento, reprogramaciones y cancelaciones",
            "required": True,
            "multi": True,
            "allowed_ext": ["pdf"],
            "order": 6,
            "optional_group": None
          }
        ]
      },
      {
        "code": "E5",
        "name": "5 Gestión final del proyecto",
        "order": 5,
        "deliverables": [
          {
            "key": "oficio_de_envio",
            "title": "Oficio de envío",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "encuesta_f1_rs_019",
            "title": "Encuesta F1 RS-019",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 2,
            "optional_group": None
          },
          {
            "key": "lista_verificacion_f1_ri_007",
            "title": "Lista de verificación F1 RI-007",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 3,
            "optional_group": None
          }
        ]
      }
    ]
  },
  "interno": {
    "stages": [
      {
        "code": "I1",
        "name": "1 Desarrollo de propuestas para realizar investigación",
        "order": 1,
        "deliverables": [
          {
            "key": "correo_difusion_convocatoria",
            "title": "Correo electrónico con la difusión de la convocatoria",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "protocolo_investigacion_aprobado",
            "title": "Protocolo de investigación aprobado",
            "required": True,
            "multi": False,
            "allowed_ext": ["doc", "docx"],
            "order": 2,
            "optional_group": None
          },
          {
            "key": "f3_ri_001_propuesta_economica",
            "title": "F3-RI-001 Propuesta económica",
            "required": True,
            "multi": False,
            "allowed_ext": ["doc", "docx"],
            "order": 3,
            "optional_group": None
          },
          {
            "key": "f4_ri_001_gestion_riesgos",
            "title": "F4-RI-001 Gestión de riesgos",
            "required": True,
            "multi": False,
            "allowed_ext": ["doc", "docx"],
            "order": 4,
            "optional_group": None
          }
        ]
      },
      {
        "code": "I2",
        "name": "2 Gestión de la autorización",
        "order": 2,
        "deliverables": [
          {
            "key": "dictamen_seleccion_pii",
            "title": "Dictamen de selección del PII",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "notificacion_dictamen_pii",
            "title": "Notificación del dictamen de selección del PII",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 2,
            "optional_group": None
          },
          {
            "key": "protocolo_investigacion_autorizado_firmado",
            "title": "Protocolo de investigación autorizado firmado",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 3,
            "optional_group": None
          }
        ]
      },
      {
        "code": "I3",
        "name": "3 Desarrollo del proyecto de investigación",
        "order": 3,
        "deliverables": [
          {
            "key": "f1_ri_002_programa_actividades",
            "title": "F1 RI-002 Programa de actividades",
            "required": True,
            "multi": False,
            "allowed_ext": ["xls", "xlsx"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "informes_bimestrales_sistema_proyectos",
            "title": "Informes bimestrales del sistema de proyectos",
            "required": True,
            "multi": True,
            "allowed_ext": ["xls", "xlsx"],
            "order": 2,
            "optional_group": None
          },
          {
            "key": "oficio_reprogramacion",
            "title": "Oficio de reprogramación",
            "required": False,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 3,
            "optional_group": None
          },
          {
            "key": "publicacion_tecnica_word",
            "title": "Publicación técnica (Word)",
            "required": True,
            "multi": False,
            "allowed_ext": ["doc", "docx"],
            "order": 4,
            "optional_group": None
          },
          {
            "key": "publicacion_tecnica_pdf",
            "title": "Publicación técnica (PDF)",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 5,
            "optional_group": None
          }
        ]
      },
      {
        "code": "I4",
        "name": "4 Gestión final del proyecto",
        "order": 4,
        "deliverables": [
          {
            "key": "resultado_evaluacion_f1_gs_006_firmada",
            "title": "Resultado de la evaluación F1 GS-006 Firmada",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 1,
            "optional_group": None
          },
          {
            "key": "constancia_envio_coordinador",
            "title": "Constancia de envío por el coordinador",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 2,
            "optional_group": None
          },
          {
            "key": "lista_verificacion_formato_publicacion",
            "title": "Lista de verificación de formato para la publicación",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 3,
            "optional_group": None
          },
          {
            "key": "lista_verificacion_f2_ri_007",
            "title": "Lista de verificación F2 RI-007",
            "required": True,
            "multi": False,
            "allowed_ext": ["pdf"],
            "order": 4,
            "optional_group": None
          }
        ]
      }
    ]
  }
}


def get_session():
    # reutilizamos el engine de app para evitar dobles configs
    SessionLocal = sessionmaker(bind=app_engine, autoflush=False, autocommit=False)
    return SessionLocal()

def ensure_stage(db, project_id: int, code: str, name: str, order: int) -> Stage:
    s = db.query(Stage).filter(Stage.project_id==project_id, Stage.code==code).first()
    if s:  # update name/order si difieren
        changed = False
        if s.name != name: s.name, changed = name, True
        if s.order_index != order: s.order_index, changed = order, True
        if changed: db.add(s); db.flush()
        return s
    s = Stage(project_id=project_id, code=code, name=name, order_index=order)
    db.add(s); db.flush()
    return s

def ensure_deliverable(db, stage_id: int, d: Dict[str, Any]) -> DeliverableSpec:
    row = db.query(DeliverableSpec).filter(
        DeliverableSpec.stage_id == stage_id,
        DeliverableSpec.key == d["key"]
    ).first()
    allowed_ext_csv = ",".join(d["allowed_ext"])
    if row:
        # idempotente: actualiza metadata si cambió
        row.title = d["title"]
        row.required = bool(d["required"])
        row.multi = bool(d["multi"])
        row.allowed_ext = allowed_ext_csv
        row.order_index = int(d.get("order", 0))
        row.optional_group = d.get("optional_group")
        db.add(row)
        return row
    row = DeliverableSpec(
        stage_id=stage_id,
        key=d["key"],
        title=d["title"],
        required=bool(d["required"]),
        multi=bool(d["multi"]),
        allowed_ext=allowed_ext_csv,
        order_index=int(d.get("order", 0)),
        optional_group=d.get("optional_group")
    )
    db.add(row)
    return row

def seed_project(db, project: Project) -> Dict[str, int]:
    code_up = (project.code or "").strip().upper()
    kind = "externo" if code_up.startswith("EE") else "interno"
    if kind not in SEED:
        raise RuntimeError(f"SEED no tiene la clave '{kind}'. Claves disponibles: {list(SEED.keys())}")
    data = SEED[kind]["stages"]

    created_stages = 0
    created_delivs = 0

    for st in data:
        stage = ensure_stage(db, project.id, st["code"], st["name"], st["order"])
        if db.is_modified(stage, include_collections=False):
            pass  # stage updated
        delivs = st.get("deliverables", [])
        before = db.query(DeliverableSpec).filter(DeliverableSpec.stage_id==stage.id).count()
        for d in delivs:
            ensure_deliverable(db, stage.id, d)
        after = db.query(DeliverableSpec).filter(DeliverableSpec.stage_id==stage.id).count()
        if after > before:
            created_delivs += (after - before)
        db.flush()

    db.commit()
    return {"created_stages": created_stages, "created_deliverables": created_delivs}

def main():
    parser = argparse.ArgumentParser(description="Seed Expediente IMT deliverables")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="Sembrar en todos los proyectos")
    group.add_argument("--project-id", type=int, help="Sembrar en un proyecto por ID")
    group.add_argument("--project-code", type=str, help="Sembrar en un proyecto por código")
    args = parser.parse_args()

    db = get_session()

    if args.all:
        projects = db.query(Project).all()
        for p in projects:
            res = seed_project(db, p)
            print(f"[OK] {p.code}: {res}")
        return

    if args.project_id:
        p = db.get(Project, args.project_id)
        if not p:
            print(f"[ERROR] Proyecto id={args.project_id} no existe", file=sys.stderr); sys.exit(1)
        res = seed_project(db, p)
        print(f"[OK] {p.code}: {res}")
        return

    if args.project_code:
        p = db.query(Project).filter(Project.code == args.project_code).first()
        if not p:
            print(f"[ERROR] Proyecto code={args.project_code} no existe", file=sys.stderr); sys.exit(1)
        res = seed_project(db, p)
        print(f"[OK] {p.code}: {res}")
        return

if __name__ == "__main__":
    main()
