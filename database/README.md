# Base de Datos — Firma Digital y Contribuyentes

## Cómo levantar la base de datos en tu máquina

1. Crea una base de datos vacía en tu Postgres local (DBeaver → SQL Editor):
```sql
   CREATE DATABASE firma_digital_db;
```
2. Abre una nueva conexión en DBeaver apuntando a `firma_digital_db`.
3. Abre `schema_completo.sql` en el editor SQL de DBeaver (contra esa conexión).
4. Ejecútalo completo con `Alt+X` (o selecciona todo y `Ctrl+Enter`).
   Esto crea las 5 tablas (roles, contribuyentes, administradores, recuperacion_pin,
   configuracion_sistema) y carga los datos base (roles y configuración inicial).

## Conectar el API

En la carpeta raíz del proyecto (`firma-digital-api`), crea un archivo `.env` con:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=firma_digital_db
DB_USER=postgres
DB_PASSWORD=tu_password_local
PORT=3000

Cada quien usa su propio `.env` local (no se sube a Git — ya está en `.gitignore`).

## Tablas

- **roles** — catálogo de roles (ADMINISTRADOR, CONTRIBUYENTE).
- **contribuyentes** — personas físicas/jurídicas inscritas, con su `pin_hash` de acceso.
- **administradores** — cuentas de administración del sistema.
- **recuperacion_pin** — solicitudes de recuperación de PIN (token + expiración).
- **configuracion_sistema** — parámetros globales clave/valor.

## Integración con otros módulos

El módulo de Firma Digital usa `id_contribuyente` (de la tabla `contribuyentes`) como
referencia para asociar las llaves públicas/privadas y el certificado de cada contribuyente.