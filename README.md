# Form Platform

## Configuración

Copia el archivo de variables de entorno de ejemplo y ajusta los valores según sea necesario:

```bash
cp .env.example .env
```

## Ejecutar con Docker/Compose

### Variables de entorno requeridas

| Variable              | Descripción                                      |
|-----------------------|--------------------------------------------------|
| `POSTGRES_DB`         | Nombre de la base de datos de Postgres           |
| `POSTGRES_USER`       | Usuario de Postgres                              |
| `POSTGRES_PASSWORD`   | Contraseña de Postgres                           |
| `DATABASE_URL`        | Cadena de conexión a la base de datos            |
| `JWT_SECRET`          | Clave para firmar los tokens JWT                 |
| `MAX_FILE_MB`         | Tamaño máximo permitido para los archivos (MB)   |
| `ALLOWED_EXT`         | Extensiones de archivo permitidas                |
| `AUTOSEED_ENABLE`     | Precarga datos en la base de datos al iniciar    |
| `AUTOSNAPSHOT_ON_UPLOAD` | Genera un snapshot al subir un archivo        |

### Puertos expuestos

- `5432` – Base de datos Postgres
- `8000` – API (FastAPI)
- `5173` – Interfaz web (Vite)

### Volúmenes opcionales

- `pgdata` – Persistencia de datos de Postgres
- `./storage:/data` – Archivos subidos
- `./backend:/app` y `./web:/app` – Código fuente montado para desarrollo
- `web_node_modules` – Dependencias de Node.js

### Ejemplos de uso

```bash
# Ejecutar solo la API
docker run --env-file .env -p 8000:8000 -v $(pwd)/storage:/data form-platform-api

# Levantar todos los servicios con Compose
docker compose up --build
```
