# Módulo de Criptografía (/crypto) — Proyecto Firma Digital (Web II)

Este archivo es el contexto permanente de este módulo. Léelo por completo antes
de escribir cualquier código, y vuelve a él al inicio de cada sesión nueva.

---

## 1. Contexto del proyecto

Este es un proyecto del curso **Web II** (segundo cuatrimestre 2026), separado
del proyecto principal de CAPA 8 pero desarrollado por el mismo grupo como
trabajo adicional. El tema elegido por el equipo es **firma digital y factura
electrónica** — un sistema tipo PKI (infraestructura de llave pública) que
permite a contribuyentes obtener un certificado digital y usarlo para firmar
documentos (facturas electrónicas en XML), de forma similar a como funciona
Hacienda en Costa Rica.

El backend es Node.js/Express, con PostgreSQL como base de datos
(`src/config/db.js` ya configurado, ver `database/schema_completo.sql` para el
esquema completo del proyecto).

## 2. Equipo y división de módulos

El proyecto se divide en 5 partes, una por integrante. Yo soy la
**Integrante 3**, responsable únicamente de `/crypto`. Este contexto de los
demás módulos es solo para que entiendas el panorama completo — **no debes
tocar ni modificar el código de los otros módulos**, solo el mío.

- **Integrante 1 — Base de Datos y Contribuyentes** (`/users`,
  `/shared/database`): registro/edición/consulta de contribuyentes,
  recuperación de PIN, roles, administradores, configuración del sistema.
  Ya construyó `src/modules/contribuyentes`, `src/modules/recuperacion_pin`,
  `src/modules/roles`.
- **Integrante 2 — Autoridad Certificadora (PKI)** (`/certificate`) —
  "probablemente el módulo más importante del proyecto" según el propio
  equipo. Responsable de todo el ciclo de vida de certificados: generar,
  emitir, renovar, revocar, expirar, consultar estado, generar seriales,
  relacionar certificados con contribuyentes, y toda la lógica de estados.
  Tablas: `Solicitudes_Certificado`, `Certificados_Digitales`,
  `Renovaciones`, `Revocaciones`, `Historial_Estados`.
- **Integrante 3 — Criptografía (`/crypto`) — YO.** Ver detalle abajo.
- **Integrante 4 — API REST e Integración** (`/api`, `/auth`, `/documents`):
  responsable de toda la comunicación con los demás grupos (del curso, no
  solo entre nuestros propios módulos) — es quien une todos los módulos.
  Expone los endpoints, JWT, API Keys, middlewares, HTTPS, validación JSON,
  recepción/envío de XML, control de errores, documentación Swagger (si la
  usan), pruebas de integración. Prepara la API para que otros grupos puedan
  consumirla. Tablas: `Clientes_API`, `Lista_Negra_JWT`, `Documentos`
  (probablemente donde persiste el XML/PDF firmado para servir `signedUrl`),
  `Auditoria_General` (log amplio: login, logout, todas las acciones del
  sistema — más general que mis `Transacciones_Firma`/`Transacciones_Cifrado`,
  que solo cubren firma y cifrado). **Va a importar y consumir las funciones
  que yo construya** — por eso mi módulo no expone rutas propias (ver sección 4).
- **Integrante 5 — Documentación**: documento técnico, documento de
  laboratorio, manual para otros grupos, diagramas.

## 3. Mi módulo: `/crypto`

### Responsabilidad
Soy responsable de todo el motor criptográfico interno del sistema. **Mi
trabajo prácticamente no toca la API** — construyo servicios internos que el
módulo `/api` (Integrante 4) va a importar y usar.

### Funcionalidades que debo construir
- Generar llaves RSA
- Generar hash SHA-256
- Firmar documentos (XMLDSig sobre XML de factura)
- Validar firmas
- Cifrado simétrico (AES) — para proteger llaves privadas en reposo
- HSM simulado (Hardware Security Module simulado — no hay hardware real,
  así que se simula el comportamiento: la llave privada nunca sale "en
  claro" del servicio, se carga temporalmente en memoria solo durante la
  operación y se destruye después)
- Carga temporal de llaves (solo durante la operación, nunca persistida en
  claro)
- Destrucción de memoria (limpiar la llave privada de memoria inmediatamente
  después de usarla)
- Validación criptográfica general
- Definir la política de cifrado del proyecto
- Implementar el `HSMService`

### Tablas que administro
- `Boveda_Llaves_Privadas` — guarda las llaves privadas de cada contribuyente,
  siempre cifradas (nunca en texto plano)
- `Transacciones_Firma` — registro de cada operación de firma realizada
- `Transacciones_Cifrado` — registro de cada operación de cifrado/descifrado

## 4. Estructura del repo ya confirmada

Dentro de `src/modules/`, los módulos existentes (Integrante 1) siguen el
patrón `controller.js` + `queries.js` + `router.js` + `service.js`.

**Mi módulo es diferente**: como no expongo endpoints propios (el Integrante 4
consume mis funciones directamente, no vía HTTP), **mi carpeta `src/modules/crypto/`
NO debe llevar `router.js` ni `controller.js`** — solo archivos de servicio
(ej. `rsaService.js`, `hashService.js`, `hsmService.js`, `firmaService.js`) y
`queries.js` para mis 3 tablas.

La carpeta `src/modules/crypto/` todavía no existe — hay que crearla.

### Dependencias
Ya instaladas en el proyecto (no reinstalar): `bcrypt`, `dotenv`, `express`,
`jsonwebtoken`, `pg`.

Lo que voy a necesitar más adelante (NO instalar hasta que lleguemos a ese
punto del checklist): `xml-crypto` (para XMLDSig, punto 3 del checklist).

La generación de llaves RSA y el hash SHA-256 (punto 1) **no requieren ninguna
librería externa** — se hacen con el módulo nativo `crypto` de Node.js.

## 5. Decisiones técnicas ya tomadas

Estas decisiones ya se evaluaron comparando alternativas — no las cuestiones
ni propongas cambiarlas sin que yo lo pida explícitamente.

| Decisión | Elegido | Por qué |
|---|---|---|
| Llave asimétrica | **RSA 2048 bits** (no ECDSA) | Es lo que usa Hacienda CR en factura electrónica real (X.509 + XMLDSig se documenta casi siempre con RSA), mejor soporte en Node, más fácil de defender en la exposición |
| Hash | **SHA-256** | Estándar en XML Signature, combina bien con RSA |
| Cifrado simétrico (proteger llave privada en reposo) | **AES-256-GCM** | AES por ser el estándar académico más fácil de justificar; modo GCM específicamente porque es autenticado (detecta manipulación, no solo cifra) |
| Hash del PIN | **BCrypt** | Ya está instalado en el proyecto; más simple de implementar/explicar que Argon2 para este alcance |
| Firma de documentos | **XMLDSig** | Estándar de firma XML, compatible con factura electrónica |
| Vigencia de la firma/certificado | 2 años | Después de expirar: no puede firmar, pero sí se pueden seguir validando firmas anteriores (así funciona una PKI real) |

## 6. Flujos que mi módulo debe soportar

### Flujo A — Alta de certificado (una sola vez por contribuyente)
El contribuyente se registra (Integrante 1) y se genera su certificado
(Integrante 2). Mi parte específica en este flujo:
1. Generar el par de llaves RSA (2048 bits)
2. Cifrar la llave privada con AES-256-GCM antes de guardarla en
   `Boveda_Llaves_Privadas`
3. El PIN de firma (distinto de la contraseña de acceso) se guarda con hash
   BCrypt

### Flujo B — Solicitud de firma (cada vez que se firma una factura)
El usuario ya tiene certificado. Formato de entrada esperado (definido por
Integrante 4, viene desde `/api`):

```json
{
    "numeroTributario": "3101123456",
    "pin": "MiPIN123",
    "xmlFactura": "<FacturaElectronica>...</FacturaElectronica>"
}
```

Mi parte específica en este flujo:
1. Verificar el PIN contra el hash BCrypt guardado
2. Cargar temporalmente la llave privada (descifrarla con AES-256-GCM) SOLO
   en memoria, nunca a disco
3. Firmar el XML con XMLDSig usando esa llave
4. **Destruir la llave de memoria inmediatamente** después de firmar
5. Registrar la operación en `Transacciones_Firma` (fecha, hora, zona
   horaria/UTC, hash del documento, serial del certificado usado)
6. Devolver el XML firmado

### Política de PIN (aplica a la verificación, no a mi lógica de generación)
Entre 8 y 16 caracteres, con al menos 1 mayúscula, 1 minúscula, 1 número y 1
símbolo. Después de 3 intentos fallidos: bloqueo de 15 minutos. (La lógica de
bloqueo probablemente vive en `/users` o `/auth`, pero mi módulo debe exponer
la función de verificación de PIN de forma que ese bloqueo se pueda aplicar
desde afuera.)

## 7. Cómo quiero que trabajes

Este proyecto se construye **por partes, una funcionalidad a la vez, en
sesiones separadas** — no de una sola vez, aunque técnicamente pudieras
hacerlo todo junto. Esto es intencional (para revisar cada pieza con calma y
cuidar el uso de tokens), así que:

- En cada sesión, implementa **solo** el punto del checklist que yo te
  indique explícitamente — nunca avances al siguiente punto por tu cuenta,
  aunque parezca el paso lógico siguiente.
- Al terminar un punto, márcalo como hecho en el checklist de abajo y
  **detente ahí**, esperando indicaciones para el siguiente.
- Si algo de lo que describí en este documento no coincide con lo que
  encuentres en el código real (por ejemplo, si otro integrante ya cambió
  algo), avísame antes de asumir y seguir adelante.
- Explícame brevemente qué hiciste y por qué, en términos que pueda usar
  para explicarlo yo misma en la defensa del proyecto.

## 8. Checklist del módulo `/crypto`

- [x] 1. Generación de llaves RSA (2048 bits) + función de hash SHA-256
      (módulo nativo `crypto` de Node, sin librerías nuevas)
- [x] 2. HSM simulado: bóveda de llaves (cifrado AES-256-GCM antes de
      guardar en `Boveda_Llaves_Privadas`, carga temporal en memoria,
      destrucción de memoria tras cada uso)
- [x] 3. Servicio de firma (XMLDSig sobre el XML de factura) — requiere
      instalar `xml-crypto`
- [x] 4. Servicio de validación de firmas
- [x] 5. Registro de transacciones (`Transacciones_Firma`,
      `Transacciones_Cifrado`)
- [x] 6. Verificación de PIN (hash BCrypt) lista para ser consumida desde
      `/auth` o `/users`
- [x] 7. Preparar y documentar las funciones exportadas para que
      Integrante 4 las consuma desde `/api`
