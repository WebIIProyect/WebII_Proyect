# Base de Datos — Firma Digital y Contribuyentes

## Cómo levantar la base de datos en tu máquina (terminal)

Requiere tener `psql` instalado (viene con PostgreSQL). Desde la raíz del
proyecto:

1. Crea la base de datos vacía:
   ```bash
   psql -h localhost -U postgres -c "CREATE DATABASE firma_digital;"
   ```
2. Aplica el esquema completo (crea todas las tablas y carga los datos base):
   ```bash
   psql -h localhost -U postgres -d firma_digital -f database/schema_completo.sql
   ```
   Si te pide contraseña, es la de tu usuario `postgres` local. Debe imprimir
   una serie de `CREATE TABLE`, `CREATE INDEX` e `INSERT 0 2` / `INSERT 0 6`
   — si ves eso hasta el final, quedó bien.

Para verificar rápido qué tablas quedaron:
```bash
psql -h localhost -U postgres -d firma_digital -c "\dt"
```

Si necesitas repetir el proceso desde cero (por ejemplo, cambió el
esquema), borra y vuelve a crear:
```bash
psql -h localhost -U postgres -c "DROP DATABASE firma_digital;"
psql -h localhost -U postgres -c "CREATE DATABASE firma_digital;"
psql -h localhost -U postgres -d firma_digital -f database/schema_completo.sql
```

## Conectar el API

En la carpeta raíz del proyecto, crea un archivo `.env` con:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=firma_digital
DB_USER=postgres
DB_PASSWORD=tu_password_local
PORT=3000
HSM_MASTER_KEY=<generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_SECRET=<mismo comando, otra vez, para un valor distinto>
```

Cada quien usa su propio `.env` local (no se sube a Git — ya está en `.gitignore`).

## Tablas

`schema_completo.sql` ya no es solo del módulo de contribuyentes — reúne
las tablas de los 4 módulos que tocan base de datos:

- **roles** — catálogo de roles (ADMINISTRADOR, CONTRIBUYENTE).
- **contribuyentes** — personas físicas/jurídicas inscritas, con su `pin_hash` y `password_hash`.
- **administradores** — cuentas de administración del sistema.
- **recuperacion_pin** — solicitudes de recuperación de PIN (token + expiración).
- **configuracion_sistema** — parámetros globales clave/valor.
- **boveda_llaves_privadas** — llave privada cifrada (AES-256-GCM) de cada contribuyente (`/crypto`).
- **transacciones_firma** / **transacciones_cifrado** — bitácora de operaciones criptográficas (`/crypto`).
- **solicitudes_certificado** / **certificados_digitales** — ciclo de solicitud y emisión (`/certificate`).
- **renovaciones** / **revocaciones** / **historial_estados** — trazabilidad del certificado (`/certificate`).

## Integración con otros módulos

El módulo de Firma Digital usa `id_contribuyente` (de la tabla `contribuyentes`) como
referencia para asociar las llaves públicas/privadas y el certificado de cada contribuyente.