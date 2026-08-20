# Módulo `/crypto` — Motor criptográfico

Construido por Integrante 3. Ver `CLAUDE.md` en la raíz del repo para el
contexto completo del proyecto y las decisiones técnicas ya tomadas.

**Este módulo no expone rutas HTTP.** Es una librería interna: `/api`
(Integrante 4) importa estas funciones directamente y las usa dentro de sus
propios endpoints. No hay `router.js` ni `controller.js` aquí, a propósito.

## Instalación / requisitos

- Dependencias ya en `package.json`: `bcrypt`, `xml-crypto`, `@xmldom/xmldom`.
  No hace falta instalar nada más para usar este módulo.
- Variable de entorno obligatoria: `HSM_MASTER_KEY` (ver `.env.example`) —
  una llave AES-256 en hex (64 caracteres) usada por el HSM simulado para
  cifrar/descifrar las llaves privadas de la bóveda. Sin ella, cualquier
  función de `hsm` lanza un error explícito.
- Tablas propias (ya en `database/schema_completo.sql`, ya probadas contra
  Postgres real): `boveda_llaves_privadas`, `transacciones_firma`,
  `transacciones_cifrado`.

## Cómo importarlo

```js
const crypto = require('../modules/crypto'); // ajustar la ruta según desde dónde se importe
```

`crypto` queda organizado por archivo:

| Namespace | Archivo | Para qué |
|---|---|---|
| `crypto.rsa` | `rsaService.js` | Generar pares de llaves RSA 2048 bits |
| `crypto.hash` | `hashService.js` | Hash SHA-256 de cualquier contenido |
| `crypto.hsm` | `hsmService.js` | HSM simulado: cifrar/descifrar/guardar/cargar/destruir la llave privada |
| `crypto.firma` | `firmaService.js` | Firmar un XML con XMLDSig |
| `crypto.validarFirma` | `validarFirmaService.js` | Validar una firma XMLDSig ya aplicada |
| `crypto.pin` | `pinService.js` | Política, hash y verificación del PIN de firma |
| `crypto.queries` | `queries.js` | Acceso directo a las 3 tablas del módulo (normalmente no hace falta llamarlo aparte — `hsm` y `pin` ya lo usan internamente) |

## Referencia de funciones

### `crypto.rsa`
- **`generarParLlavesRSA()`** → `{ publicKey, privateKey }` (PEM). Sin efectos secundarios, no toca la BD.

### `crypto.hash`
- **`calcularHashSHA256(contenido, encoding = 'hex')`** → `string`. `contenido` puede ser string o Buffer.

### `crypto.hsm`
- **`guardarLlaveEnBoveda(idContribuyente, llavePublica, llavePrivadaPem)`** → `Promise<object>`. Cifra la llave privada (AES-256-GCM) y la guarda en `boveda_llaves_privadas`. Registra automáticamente una transacción `CIFRADO` (exitosa o fallida) en `transacciones_cifrado`.
- **`cargarLlaveTemporalmente(idContribuyente)`** → `Promise<{ llavePublica, llavePrivadaBuffer }>`. Trae la llave cifrada de la bóveda y la descifra en memoria. Registra automáticamente una transacción `DESCIFRADO`. **`llavePrivadaBuffer` es un `Buffer`, no un string** — es lo que hay que pasarle a `crypto.firma.firmarXML`.
- **`destruirLlaveDeMemoria(buffer)`** → `void`. Sobrescribe el buffer con ceros. **Obligatorio llamarla después de usar `llavePrivadaBuffer`**, en un `finally` (ver ejemplo del Flujo B más abajo).
- **`cifrarLlavePrivada(pem)` / `descifrarLlavePrivada(datos)`** — las piezas de cifrado puras, sin tocar la BD. Normalmente no hace falta llamarlas directo; están para pruebas o casos especiales.

### `crypto.firma`
- **`firmarXML(xmlFactura, llavePrivada)`** → `string` (el XML con `<Signature>` insertado). `llavePrivada` acepta string o `Buffer`. Lanza error si el XML no está bien formado (ver nota de seguridad abajo) o si falta algún parámetro. **No** verifica el PIN, no carga la llave, no registra nada — solo firma. La llave pública correspondiente se deriva automáticamente y se embebe en `<KeyInfo>` (formato `RSAKeyValue`) — el documento queda "autodescriptivo", no hace falta mandar la llave pública aparte para poder validarlo.
- **`construirKeyInfoRSA(llave)`** → `string`. Genera el XML de `<KeyValue>` a partir de una llave pública o privada. Normalmente no hace falta llamarla directo, la usa `firmarXML` internamente.

### `crypto.validarFirma`
- **`validarFirmaXML(xmlFirmado, llavePublicaEsperada?)`** → `{ esValida: boolean, motivo?: string, origenLlave: 'proporcionada'|'keyInfo' }`. Nunca lanza excepción por una firma inválida — siempre responde con el objeto. Solo valida la matemática de la firma, no si el certificado sigue vigente (eso es de `/certificate`). Dos modos:
  - **Con `llavePublicaEsperada`** (modo fuerte, recomendado en `/api`): valida contra una llave específica, ej. la guardada en la bóveda para el contribuyente que dice haber firmado. Es el único modo que de verdad confirma identidad.
  - **Sin `llavePublicaEsperada`**: extrae la llave del propio `<KeyInfo>` del documento. Solo confirma que nadie tocó el documento después de firmarlo — **no** confirma que esa llave sea de quien dice ser (cualquiera puede firmar con su propia llave y "pasar" este modo). Ver la nota de seguridad más abajo.

### `crypto.pin`
- **`validarPoliticaPin(pin)`** → `{ valido: boolean, motivo?: string }`. Política: 8-16 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 símbolo.
- **`hashearPin(pin)`** → `Promise<string>`. Valida la política y hashea con BCrypt. Lanza error si el PIN no cumple la política.
- **`verificarPin(pin, hashAlmacenado)`** → `Promise<boolean>`. Compara un PIN contra un hash ya guardado (compatible con hashes creados con `bcrypt.hash(pin, 10)` directo, como ya hace `contribuyentes/service.js`). No aplica el bloqueo de 3 intentos — eso le toca a quien la llame.

### `crypto.queries`
Funciones de acceso a datos, usadas internamente por `hsm` y expuestas por si `/api` necesita leer directamente:
- `obtenerLlaveDeBoveda(idContribuyente)`, `guardarLlaveEnBoveda(datos)` (bóveda)
- `registrarTransaccionFirma(datos)`, `obtenerTransaccionesFirmaPorContribuyente(idContribuyente)` (para "Ver historial de firmas")
- `registrarTransaccionCifrado(datos)`

## Flujo A — Alta de certificado (una sola vez por contribuyente)

Mi parte específica de este flujo (ver CLAUDE.md sección 6). El registro del
contribuyente en sí, la emisión del certificado X.509 y la validación de
duplicados **no son de este módulo** — eso ya está resuelto (Integrante 1)
o vive en `/certificate` (Integrante 2).

```js
const crypto = require('../modules/crypto');

async function altaCertificado(idContribuyente, pinElegido) {
  // 1. Generar el par de llaves RSA (2048 bits)
  const { publicKey, privateKey } = crypto.rsa.generarParLlavesRSA();

  // 2. Cifrar la llave privada y guardarla en la bóveda (AES-256-GCM).
  //    Esto ya registra la transacción de cifrado por su cuenta.
  await crypto.hsm.guardarLlaveEnBoveda(idContribuyente, publicKey, privateKey);

  // 3. El PIN de firma se guarda con hash BCrypt.
  //    (Guardar `pinHash` en la columna correspondiente le toca a
  //    Integrante 1/4 — este módulo solo genera el hash.)
  const pinHash = await crypto.pin.hashearPin(pinElegido);

  // 4. La llave pública (`publicKey`) es la que Integrante 2 usa para
  //    construir el certificado X.509 que se le entrega al contribuyente.
  return { publicKey, pinHash };
}
```

## Flujo B — Solicitud de firma (cada vez que se firma una factura)

Formato de entrada esperado, tal como llega desde `/api` (ver CLAUDE.md):

```json
{
  "numeroTributario": "3101123456",
  "pin": "MiPIN123!",
  "xmlFactura": "<FacturaElectronica>...</FacturaElectronica>"
}
```

```js
const crypto = require('../modules/crypto');

async function solicitarFirma({ idContribuyente, pinHashGuardado, serialCertificado, xmlFactura, pin }) {
  // 1. Verificar el PIN. Si falla, quien llama a esta función es responsable
  //    de contar el intento fallido y aplicar el bloqueo de 15 min tras 3 intentos.
  const pinValido = await crypto.pin.verificarPin(pin, pinHashGuardado);
  if (!pinValido) {
    throw new Error('PIN incorrecto');
  }

  // 2. Cargar temporalmente la llave privada (se descifra solo en memoria).
  const { llavePrivadaBuffer } = await crypto.hsm.cargarLlaveTemporalmente(idContribuyente);

  let xmlFirmado;
  try {
    // 3. Firmar el XML con XMLDSig.
    xmlFirmado = crypto.firma.firmarXML(xmlFactura, llavePrivadaBuffer);
  } finally {
    // 4. Destruir la llave de memoria SIEMPRE, incluso si firmarXML lanzó error.
    crypto.hsm.destruirLlaveDeMemoria(llavePrivadaBuffer);
  }

  // 5. Registrar la operación en Transacciones_Firma
  //    (fecha/hora UTC, hash del documento, serial del certificado usado).
  const hashDocumento = crypto.hash.calcularHashSHA256(xmlFirmado);
  await crypto.queries.registrarTransaccionFirma({
    idContribuyente,
    serialCertificado, // lo entrega /certificate — este módulo no lo genera
    hashDocumento,
    resultado: 'EXITOSA',
  });

  // 6. Devolver el XML firmado.
  return xmlFirmado;
}
```

## Qué NO hace este módulo (a propósito)

Para que quede claro dónde termina `/crypto` y dónde empieza el resto del
sistema:

- No expone rutas HTTP ni hace nada con `req`/`res`.
- No verifica si un certificado está vigente, revocado o expirado (`/certificate`).
- No busca al contribuyente por `numeroTributario` ni valida que exista (`/users`, `/api`).
- No cuenta intentos fallidos de PIN ni aplica el bloqueo de 15 minutos (`/auth` o `/users` — `crypto.pin.verificarPin` solo responde sí/no).
- No envía correos ni genera tokens de recuperación (`recuperacion_pin`, ya existente).
- No valida el XML de la factura contra el XSD de Hacienda — solo que esté bien formado (ver nota abajo).

## Notas de seguridad para la defensa

- **La llave privada nunca se guarda en claro.** Se cifra con AES-256-GCM antes de tocar disco, y cuando se necesita para firmar, se descifra únicamente en memoria (`Buffer`) y se destruye (`fill(0)`) apenas se usa.
- **AES-256-GCM es autenticado**: si alguien manipula el ciphertext guardado en la bóveda, `descifrarLlavePrivada` lanza error en vez de devolver datos corruptos (probado).
- **`firmarXML` rechaza XML mal formado** en vez de firmar una versión "reparada" por el parser en silencio — esto se descubrió probando el módulo (ver historial de la sesión que implementó el punto 3).
- **Cada operación de cifrado/descifrado y de firma queda registrada**, tanto si sale bien como si falla — útil para detectar intentos de manipulación.
- **`validarFirmaXML` sin llave esperada NO prueba identidad, solo integridad.** El documento trae su llave pública embebida (`<KeyInfo>`) para que se pueda validar sin ir a buscarla aparte, pero eso solo confirma que el documento no fue alterado después de firmarse con ESA llave — no que ESA llave sea de quien dice ser. Cualquiera podría firmar con su propia llave y ese modo diría `esValida: true`. **En `/api`, siempre que se sepa quién debería haber firmado, hay que pasar `llavePublicaEsperada`** (la de la bóveda, o la del certificado cuando exista) para el chequeo fuerte. El campo `origenLlave` de la respuesta indica cuál de los dos modos corrió.
