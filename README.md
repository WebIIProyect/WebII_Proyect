# HSM Sign CR — Firma Digital y Factura Electrónica

Backend en Node.js/Express + PostgreSQL para un sistema tipo PKI: los
contribuyentes obtienen un certificado digital y lo usan para firmar
facturas electrónicas en XML, de forma similar a Hacienda Costa Rica.

Este documento explica **dónde está el backend, cómo levantarlo, y cómo
consumir cada API** — pensado tanto para el equipo (otros grupos que
necesiten integrar contra estas rutas) como para probarlo a mano en
Postman.

## Dónde está el backend

Un solo servidor Express sirve tanto el frontend estático como toda la
API:

```
src/app.js                 ← punto de entrada único (npm start lo corre)
src/config/db.js           ← conexión a PostgreSQL (pool de pg)
src/modules/
  contribuyentes/          ← Integrante 1: registro, consulta, edición
  roles/                   ← Integrante 1: catálogo de roles
  recuperacion_pin/        ← Integrante 1: recuperación de PIN por token
  certificate/             ← Integrante 2: ciclo de vida del certificado (PKI)
  crypto/                  ← Integrante 3: motor criptográfico (SIN rutas propias,
                               se consume por require() desde otros módulos)
  auth/                    ← sesión de acceso (login + JWT)
  documentos/              ← firma/validación de XML + operaciones de cuenta
                               protegidas por PIN (integra crypto + certificate)
pages/                     ← frontend estático (HTML/CSS/JS, sin build step)
database/schema_completo.sql ← esquema completo de PostgreSQL
```

Cada módulo sigue el patrón `router.js` + `controller.js` + `service.js`
+ `queries.js` (excepto `crypto`, que no tiene `router.js` ni
`controller.js` a propósito — ver `src/modules/crypto/README.md`).

Cada `router.js` tiene comentarios JSDoc encima de cada ruta con el
método, el body esperado, la respuesta y los errores posibles — es la
referencia más al día si esta tabla queda desactualizada.

## Cómo levantarlo

```bash
npm install
```

Crea un `.env` en la raíz (usa `.env.example` como plantilla) con:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=firma_digital
DB_USER=postgres
DB_PASSWORD=<tu contraseña>
PORT=3000
HSM_MASTER_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_SECRET=<mismo comando de arriba, otra vez, para un valor distinto>
```

Aplica el esquema una vez (si la base está vacía):

```bash
psql -h localhost -U postgres -c "CREATE DATABASE firma_digital;"
psql -h localhost -U postgres -d firma_digital -f database/schema_completo.sql
```

Y arranca:

```bash
npm start
```

Servidor en `http://localhost:3000`. El frontend se sirve en `/`, la API
bajo `/api/*`.

## Cómo probarlo en Postman

No hay ninguna colección para importar — son rutas REST normales, se
arman a mano: elige el método, pega la URL (`http://localhost:3000/api/...`),
en pestaña **Body → raw → JSON** pega el body de ejemplo de la tabla de
abajo, y en headers agrega `Content-Type: application/json` si envías body.

## Referencia de la API

### `/api/documentos` — firma y validación (lo que consumen otros grupos)

Esta es la API real de firma digital: **no depende de la página web**,
cualquier backend externo puede llamarla directo con JSON.

| Método y ruta | Body | Qué hace |
|---|---|---|
| `POST /api/documentos/firmar` | `{ "identificacion", "pin", "xmlFactura" }` | Verifica el PIN, firma el XML con XMLDSig (RSA-2048/SHA-256) usando la llave privada del contribuyente, y registra la transacción. Devuelve `{ success, xmlFirmado, hashDocumento, serialCertificado }`. |
| `POST /api/documentos/validar` | `{ "xmlFirmado" }` | Extrae la llave pública del XML firmado, la cruza contra los certificados emitidos por el sistema, y valida la firma. Devuelve `{ esValida, signerId, signerName, algorithm, certificateStatus, signatureDate }`. |
| `GET /api/documentos/certificados/:idContribuyente` | — | Certificados digitales de un contribuyente. |
| `GET /api/documentos/historial/:idContribuyente` | — | Historial de operaciones de firma (tabla `transacciones_firma`). |
| `PATCH /api/documentos/pin/:idContribuyente` | `{ "currentPin", "newPin" }` | Cambia el PIN de firma. |
| `PATCH /api/documentos/password/:idContribuyente` | `{ "currentPassword", "newPassword" }` | Cambia la contraseña de acceso. |
| `POST /api/documentos/certificados/:idCertificado/renovar` | `{ "idContribuyente", "pin", "motivo" }` | Renueva el certificado (nuevo par de llaves RSA), exige PIN. |
| `POST /api/documentos/certificados/:idCertificado/revocar` | `{ "idContribuyente", "pin", "motivo" }` | Revoca el certificado, exige PIN. |

Ejemplo mínimo de `xmlFactura` para probar `POST /api/documentos/firmar`:

```json
{
  "identificacion": "101110111",
  "pin": "MiPin123!",
  "xmlFactura": "<FacturaElectronica><Clave>1234</Clave><Total>1000</Total></FacturaElectronica>"
}
```

El contribuyente debe existir, estar `ACTIVO` y tener un certificado
`VIGENTE` (ver más abajo cómo crearlos).

### `/api/auth` — sesión de acceso

| Método y ruta | Body | Qué hace |
|---|---|---|
| `POST /api/auth/login` | `{ "correo", "password" }` | Devuelve `{ token, contribuyente }`. Requiere que el contribuyente esté `ACTIVO`. |

### `/api/contribuyentes` — Integrante 1

| Método y ruta | Body | Qué hace |
|---|---|---|
| `GET /api/contribuyentes` | — | Lista todos. |
| `GET /api/contribuyentes/:id` | — | Uno por id. |
| `POST /api/contribuyentes` | `{ "tipo_contribuyente", "identificacion", "nombre_razon_social", "correo", "pin", "password", "id_rol", "telefono"?, "direccion"?, "actividad_economica"? }` | Registra un contribuyente nuevo, queda `PENDIENTE`. |
| `PUT /api/contribuyentes/:id` | `{ "nombre_razon_social", "correo", "telefono", "direccion", "actividad_economica" }` | Edita perfil. |
| `PATCH /api/contribuyentes/:id/estado` | `{ "estado" }` (`PENDIENTE`\|`ACTIVO`\|`SUSPENDIDO`\|`RECHAZADO`) | Cambia el estado — así se "aprueba" una cuenta nueva (no hay panel de administrador todavía). |

### `/api/roles` — Integrante 1

| Método y ruta | Body | Qué hace |
|---|---|---|
| `GET /api/roles` | — | Lista roles (`CONTRIBUYENTE`, `ADMINISTRADOR`). |
| `GET /api/roles/:id` | — | Uno por id. |
| `POST /api/roles` | `{ "nombre_rol", "descripcion"? }` | Crea un rol. |

### `/api/recuperacion-pin` — Integrante 1

| Método y ruta | Body | Qué hace |
|---|---|---|
| `POST /api/recuperacion-pin` | `{ "identificacion" }` | Genera un token de recuperación (15 min de validez), devuelve `token_recuperacion`. |
| `POST /api/recuperacion-pin/confirmar` | `{ "token", "nuevo_pin" }` | Define el PIN nuevo con ese token. |

### `/api/certificados` — Integrante 2 (PKI)

| Método y ruta | Body | Qué hace |
|---|---|---|
| `POST /api/certificados/solicitudes` | `{ "id_contribuyente", "observaciones"? }` | Crea una solicitud de certificado. |
| `GET /api/certificados/solicitudes` | — | Lista solicitudes (`?id_contribuyente=` opcional). |
| `GET /api/certificados/solicitudes/:id` | — | Una solicitud. |
| `PATCH /api/certificados/solicitudes/:id/rechazar` | `{ "motivo" }` | Rechaza una solicitud pendiente. |
| `POST /api/certificados/solicitudes/:id/emitir` | — | Aprueba y emite el certificado (genera el par RSA-2048, lo guarda cifrado en la bóveda). |
| `GET /api/certificados` | — | Lista certificados (`?id_contribuyente=` opcional). |
| `GET /api/certificados/:id` | — | Un certificado. |
| `GET /api/certificados/serial/:serial` | — | Un certificado por número de serie. |
| `GET /api/certificados/:id/estado` | — | Estado actual (auto-expira si ya venció). |
| `GET /api/certificados/:id/historial` | — | Historial de cambios de estado. |
| `POST /api/certificados/:id/renovar` | `{ "motivo"? }` | Renueva sin pedir PIN (usar la versión de `/api/documentos` si se necesita esa validación). |
| `PATCH /api/certificados/:id/revocar` | `{ "motivo" }` | Revoca sin pedir PIN (ídem). |
| `PATCH /api/certificados/:id/expirar` | — | Marca como expirado manualmente. |
| `POST /api/certificados/expirar-vencidos` | — | Expira en lote todos los vencidos. |

## Flujo típico de punta a punta (para probar en Postman)

1. `GET /api/roles` → toma el `id_rol` de `CONTRIBUYENTE`.
2. `POST /api/contribuyentes` → registra (queda `PENDIENTE`).
3. `PATCH /api/contribuyentes/:id/estado` con `{"estado":"ACTIVO"}` → aprueba.
4. `POST /api/auth/login` → confirma que puede iniciar sesión.
5. `POST /api/certificados/solicitudes` → solicita certificado.
6. `POST /api/certificados/solicitudes/:id/emitir` → lo emite (queda `VIGENTE`).
7. `POST /api/documentos/firmar` → firma un XML de prueba.
8. `POST /api/documentos/validar` → valida el XML que devolvió el paso anterior.

## Módulo criptográfico (`/crypto`)

No tiene rutas HTTP propias por diseño — ver
`src/modules/crypto/README.md` para el detalle de cada función y cómo se
consume desde `/api/certificados` y `/api/documentos`.
