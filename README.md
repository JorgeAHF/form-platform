# Form Platform (PRAP)

Plataforma web para **respaldar y gestionar archivos de proyectos**. Permite:
- Autenticación de usuarios con roles (`admin`, `colaborador`, `auditor`).
- Gestión de proyectos y miembros.
- **Expediente IMT**: etapas con entregables (checklist) y control de versiones.
- **Expediente Técnico**: carpetas por categorías para cargar y organizar documentación técnica.

La app está dividida en:
- **Backend**: FastAPI + PostgreSQL.
- **Frontend**: React + Vite.
- **Storage**: archivos físicos en una carpeta montada en el contenedor.

## Arquitectura rápida

```
web (Vite)  -->  api (FastAPI)  -->  postgres
                    |
                    --> storage (/data)
```

Los archivos se guardan en `FILES_ROOT/projects/<codigo_de_proyecto>/...` y la fecha se toma de la base de datos (no hay subcarpeta por fecha).

---

# 🚀 Guía "for dummies" para levantar la app

> Requisitos: **Docker** y **Docker Compose** instalados.

## 1) Crea un archivo `.env`

En la raíz del repo (`/workspace/form-platform`), crea un archivo **.env** con este contenido:

```
POSTGRES_DB=form_platform
POSTGRES_USER=fp_user
POSTGRES_PASSWORD=fp_pass

API_JWT_SECRET=super-secret-key
MAX_FILE_MB=50
ALLOWED_EXT=pdf,docx,xlsx,jpg,png,zip

# Opcionales
AUTOSEED_ENABLE=false
AUTOSNAPSHOT_ON_UPLOAD=false
```

> Puedes cambiar los valores si lo necesitas, pero **no borres las variables**.

## 2) Levanta la app

Ejecuta:

```
docker compose up --build
```

La primera vez tardará un poco porque descarga imágenes y compila.

## 3) Abre el navegador

- **Frontend**: http://localhost:5173  
- **API**: http://localhost:8000

## 4) Crea el primer usuario (admin)

La primera cuenta se crea automáticamente como **admin** usando el endpoint `/auth/register`.

Puedes hacerlo con `curl`:

```
curl -X POST http://localhost:8000/auth/register \
  -F "username=admin" \
  -F "password=admin123" \
  -F "full_name=Admin Usuario" \
  -F "email=admin@example.com" \
  -F "initials=AU"
```

Si prefieres Postman/Insomnia: es un POST con `multipart/form-data` a `/auth/register`.

## 5) Inicia sesión en la UI

Ve a http://localhost:5173 e inicia sesión con el usuario que creaste.

---

# 🧭 Uso básico

## A) Crear proyectos

1. En la pestaña **Proyectos**, crea un nuevo proyecto.
2. El código se arma con prefijo:
   - `EE` para **externo**
   - `EI` para **interno**
3. Al crear el proyecto se generan las carpetas y etapas base.

## B) Expediente IMT (entregables)

1. En la pestaña **Expediente IMT** selecciona un proyecto y una etapa.
2. Sube archivos a cada entregable.
3. Si un entregable es de tipo “único” y ya existe un archivo activo, la app pedirá un **motivo** para versionar.

## C) Expediente Técnico (categorías)

1. En la pestaña **Expediente Técnico** selecciona un proyecto.
2. Navega las categorías (Información técnica → categoría → subcarpeta).
3. Sube archivos sueltos o carpetas completas.

## D) Solicitar eliminación de archivos

1. Desde cualquier listado puedes solicitar eliminación.
2. Queda en estado **pendiente** hasta que un admin lo apruebe.

---

# 🔐 Roles y permisos

- **admin**:
  - Administra usuarios.
  - Aprueba solicitudes de registro y eliminación.
  - Acceso total.
- **colaborador**:
  - Sube archivos según permisos de proyecto.
- **auditor**:
  - Solo lectura.

Además:
- `can_create_projects` permite crear proyectos.
- `can_access_exptec` permite ver el Expediente Técnico.

---

# 🗂️ Estructura de carpetas (storage)

```
/data
└── projects
    └── <CODIGO_PROYECTO>
        ├── Información técnica
        └── Expediente IMT
```

---

# 🧪 Tests

No hay tests automatizados en este repo.

---

# 🛠️ Comandos útiles

Detener:
```
docker compose down
```

Reiniciar todo desde cero (borra base de datos):
```
docker compose down -v
docker compose up --build
```

---

# 🧰 Guía "for dummies" **ultra detallada** para producción (servidor o PC)

> Objetivo: dejar la app corriendo en un servidor/PC como servicio "final" (no dev).

## 0) Requisitos previos (no te saltes ninguno)

1. **Tener Docker instalado**  
   - En Linux: instala **Docker Engine** y **Docker Compose plugin**.
   - En Windows/Mac: instala **Docker Desktop**.
2. **Tener acceso a la terminal** (SSH en servidor o PowerShell/Terminal en PC).
3. **Tener puertos abiertos**:
   - `5173` para el frontend
   - `8000` para la API
   - `5432` solo si necesitas acceder a la base desde fuera (normalmente NO).

## 1) Clona el proyecto

```
git clone <URL_DEL_REPO> form-platform
cd form-platform
```

## 2) Crea el archivo `.env` (obligatorio)

En la **raíz del repo**, crea un archivo llamado `.env` con este contenido:

```
POSTGRES_DB=form_platform
POSTGRES_USER=fp_user
POSTGRES_PASSWORD=fp_pass

API_JWT_SECRET=super-secret-key
MAX_FILE_MB=50
ALLOWED_EXT=pdf,docx,xlsx,jpg,png,zip

# Opcionales
AUTOSEED_ENABLE=false
AUTOSNAPSHOT_ON_UPLOAD=false
```

### ⚠️ Importante
- Cambia `POSTGRES_PASSWORD` y `API_JWT_SECRET` por valores seguros.
- **No borres variables**: si faltan, el backend no arranca.

## 3) Ajusta dominio/IP (opcional pero recomendado)

Si vas a exponer en un dominio público, edita `docker-compose.yml` y actualiza:

```
ALLOWED_ORIGINS: "http://localhost:3001,http://localhost:5173"
```

Por ejemplo:

```
ALLOWED_ORIGINS: "https://mi-dominio.com"
```

## 4) Levanta la app en modo producción

```
docker compose up --build -d
```

Explicación:
- `--build` compila imágenes si es necesario.
- `-d` deja todo corriendo en segundo plano.

## 5) Verifica que todo esté corriendo

```
docker compose ps
```

Deberías ver 3 servicios **UP**:
- `postgres`
- `api`
- `web`

## 6) Crea el primer usuario (admin)

Solo la **primera vez**, crea el usuario admin:

```
curl -X POST http://localhost:8000/auth/register \
  -F "username=admin" \
  -F "password=admin123" \
  -F "full_name=Admin Usuario" \
  -F "email=admin@example.com" \
  -F "initials=AU"
```

Si la app está en un servidor remoto, reemplaza `localhost` por la IP o dominio.

## 7) Entra a la app desde el navegador

```
http://<IP_O_DOMINIO>:5173
```

Ejemplos:
- `http://localhost:5173`
- `http://192.168.1.50:5173`
- `https://mi-dominio.com`

## 8) Crea tu primer proyecto

1. Entra con el usuario admin.
2. Ve a **Proyectos**.
3. Crea un proyecto (externo o interno).

## 9) Carga archivos

### Expediente IMT
- Selecciona un proyecto y etapa.
- Sube los entregables requeridos.

### Expediente Técnico
- Entra a la pestaña si tienes permiso.
- Elige categoría y sube archivos o carpetas.

---

# ✅ Actualizar la app (cuando hay cambios en el repo)

```
git pull
docker compose up --build -d
```

# 🧹 Detener o borrar todo

Detener:
```
docker compose down
```

Borrar todo (incluye base de datos):
```
docker compose down -v
```

---

# 📦 Instalación en TrueNAS SCALE como App (Custom App)

Esta guía está pensada para TrueNAS SCALE usando **Apps → Discover Apps → Custom App**.

## 1) Preparar datasets en TrueNAS

En **Datasets**, crea por ejemplo:

- `tank/apps/form-platform/pgdata` (base de datos)
- `tank/apps/form-platform/files` (archivos del sistema)
- `tank/apps/form-platform/app` (código del proyecto, opcional pero recomendado)

> Recomendación: deja `pgdata` y `files` con snapshots automáticos.

## 2) Copiar el proyecto al dataset

Desde shell de TrueNAS o por SMB/SSH, deja el repo en:

`/mnt/tank/apps/form-platform/app/form-platform`

## 3) Crear archivo `.env.truenas`

Dentro del repo, crea este archivo:

```env
POSTGRES_DB=form_platform
POSTGRES_USER=fp_user
POSTGRES_PASSWORD=cambia_esto

API_JWT_SECRET=cambia_esto_muy_largo
MAX_FILE_MB=50
ALLOWED_EXT=pdf,docx,xlsx,jpg,png,zip
ALLOWED_ORIGINS=http://IP_TRUENAS:5173

AUTOSEED_ENABLE=false
AUTOSNAPSHOT_ON_UPLOAD=false

PGDATA_PATH=/mnt/tank/apps/form-platform/pgdata
FILES_PATH=/mnt/tank/apps/form-platform/files
```

## 4) Deploy con compose optimizado para TrueNAS

El repositorio incluye `docker-compose.truenas.yml` para despliegue continuo (sin bind mounts de código y sin `--reload` del backend).

Desde shell:

```bash
cd /mnt/tank/apps/form-platform/app/form-platform
docker compose --env-file .env.truenas -f docker-compose.truenas.yml up -d --build
```

Verifica estado:

```bash
docker compose --env-file .env.truenas -f docker-compose.truenas.yml ps
```

## 5) Publicar como App en interfaz de TrueNAS (opcional UI)

Si prefieres hacerlo totalmente por UI:

1. Apps → **Discover Apps** → **Custom App**.
2. Tipo: **Docker Compose**.
3. Pega el contenido de `docker-compose.truenas.yml`.
4. En variables, carga las mismas de `.env.truenas`.
5. Mapea puertos:
   - `5173` (web)
   - `8000` (api)
6. Despliega.

## 6) Inicializar admin

Después del primer arranque:

```bash
curl -X POST http://IP_TRUENAS:8000/auth/register \
  -F "username=admin" \
  -F "password=admin123" \
  -F "full_name=Admin Usuario" \
  -F "email=admin@example.com" \
  -F "initials=AU"
```

## 7) Acceso

- Frontend: `http://IP_TRUENAS:5173`
- API: `http://IP_TRUENAS:8000`

## Notas importantes para TrueNAS

- Cambia secretos antes de exponer en red.
- Si usarás dominio/HTTPS, coloca un reverse proxy (Traefik/NPM/Caddy) y ajusta `ALLOWED_ORIGINS`.
- Evita usar `docker-compose.yml` de desarrollo en producción porque monta código local y usa `--reload`.
