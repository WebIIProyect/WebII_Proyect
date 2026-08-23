# Guía de integración — API de Firma Digital (HSM Sign CR)

Esta guía es para **cualquier otro equipo** que necesite firmar o validar
documentos digitalmente usando este servicio, sin tener que leer el
código fuente. No importa si tu proyecto es de tributación directa,
facturación, contratos u otra cosa — el flujo es el mismo.

## 1. Qué hace este servicio

Recibe un documento XML, lo firma digitalmente con la llave privada del
usuario (protegida en un HSM simulado) y devuelve el XML firmado.
También puede validar si un XML ya firmado es auténtico y no fue
alterado. Internamente usa RSA-2048 + SHA-256 (XMLDSig), el mismo
esquema que usa Hacienda Costa Rica para facturación electrónica.

Lo que **no** hace: no genera el contenido del documento (eso lo arma tu
sistema), no gestiona usuarios de tu aplicación — usa a los
"contribuyentes" registrados en este servicio.

## 2. Dónde está el servicio

```
BASE_URL = <pídele esta URL al equipo de HSM Sign CR>
```

Ejemplo local de desarrollo: `http://localhost:3000`. Si el equipo lo
desplegó en un servidor (AWS u otro), pídeles la URL pública — todos los
endpoints de esta guía van después de esa base, ej.
`{BASE_URL}/api/documentos/firmar`.

Todas las peticiones son JSON normal por HTTP — se pueden probar a mano
en Postman o llamar desde cualquier lenguaje/backend.

## 3. Requisito previo: el usuario debe existir como "contribuyente"

Antes de poder firmar nada, la persona/empresa dueña del documento debe:

1. **Existir como contribuyente** en este sistema, con estado `ACTIVO`.
2. **Tener un certificado digital `VIGENTE`** emitido.

Si tu sistema ya tiene sus propios usuarios, dos formas de resolverlo:

- **Opción A :** que cada usuario se registre una sola vez
  en HSM Sign CR (vía `pages/register.html` o `POST /api/contribuyentes`)
  y obtenga su certificado antes de que tu sistema intente firmar nada
  a su nombre. Tu sistema solo necesita guardarse su `identificacion`
  (cédula/DIMEX) para poder pedir firmas después.
- **Opción B(recomendada):** tu backend llama directamente a `POST
  /api/contribuyentes` para registrar al usuario, y coordina con el
  equipo de HSM Sign CR para que se active la cuenta y se emita el
  certificado (ver paso 4 del flujo abajo). Útil si quieres automatizar
  el alta, pero requiere que también manejen el PIN de firma del
  usuario, que es sensible.

Sea cual sea la opción, **el PIN de firma es del usuario, no tuyo** —
tu sistema no debe guardarlo permanentemente; solo lo recibe del
usuario en el momento de firmar y lo reenvía en esa misma petición.

## 4. Flujo completo (referencia — normalmente ya está hecho antes de integrar)

```
1. GET  /api/roles                                   → obtener id_rol de CONTRIBUYENTE
2. POST /api/contribuyentes                           → registrar al usuario
3. PATCH /api/contribuyentes/:id/estado {"estado":"ACTIVO"}   → activar cuenta
4. POST /api/certificados/solicitudes {"id_contribuyente"}    → solicitar certificado
5. POST /api/certificados/solicitudes/:id/emitir      → emitir certificado (queda VIGENTE)
```

Con eso ya listo, tu integración del día a día son solo los pasos 5 y 6
de abajo.

## 5. Firmar un documento

**`POST {BASE_URL}/api/documentos/firmar`**

Headers: `Content-Type: application/json`

Body:
```json
{
  "identificacion": "101110111",
  "pin": "PinDelUsuario123!",
  "xmlFactura": "<FacturaElectronica><Clave>...</Clave><Total>15000.00</Total></FacturaElectronica>"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `identificacion` | string | Cédula/DIMEX del contribuyente ya registrado en HSM Sign CR. |
| `pin` | string | PIN de firma del usuario (lo ingresa él mismo, tu sistema no lo guarda). |
| `xmlFactura` | string | El XML completo a firmar, como texto. |

Respuesta exitosa (`200`):
```json
{
  "success": true,
  "xmlFirmado": "<FacturaElectronica ...><Signature ...>...</Signature></FacturaElectronica>",
  "hashDocumento": "9f8c...",
  "serialCertificado": "CERT-20260821-XXXXXXXX"
}
```

Guarda `xmlFirmado` — es el documento oficial ya firmado, lo que le
entregas a tu usuario o lo que archivas.

Errores posibles:

| Código | Causa | Qué hacer |
|---|---|---|
| `400` | Falta algún campo, o el usuario no tiene certificado `VIGENTE` | Verifica que completó el paso 4 del flujo de alta. |
| `401` | PIN incorrecto | Pídele al usuario que reingrese el PIN — no reintentes automáticamente. |
| `404` | No existe un contribuyente con esa `identificacion` | Regístralo primero (ver sección 3). |

Ejemplo con `curl`:
```bash
curl -X POST {BASE_URL}/api/documentos/firmar \
  -H "Content-Type: application/json" \
  -d '{"identificacion":"101110111","pin":"PinDelUsuario123!","xmlFactura":"<FacturaElectronica><Clave>1234</Clave><Total>1000</Total></FacturaElectronica>"}'
```

Ejemplo con `fetch` (Node.js / navegador):
```js
const res = await fetch(`${BASE_URL}/api/documentos/firmar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identificacion, pin, xmlFactura }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error);
// data.xmlFirmado es el documento firmado
```

## 6. Validar la firma de un documento

**`POST {BASE_URL}/api/documentos/validar`**

Headers: `Content-Type: application/json`

Body:
```json
{ "xmlFirmado": "<FacturaElectronica ...><Signature ...>...</Signature></FacturaElectronica>" }
```

Solo necesitas el XML ya firmado — no hace falta mandar identificación
ni ningún otro dato, la firma ya trae todo lo necesario para verificarse.

Respuesta si la firma es válida (`200`):
```json
{
  "esValida": true,
  "signerId": "101110111",
  "signerName": "Ana Pérez",
  "algorithm": "RSA-2048",
  "certificateStatus": "VIGENTE",
  "signatureDate": "2026-08-21T10:59:55.711Z"
}
```

Respuesta si es inválida (igual `200`, revisa `esValida`):
```json
{ "esValida": false, "motivo": "La firma no es válida: el documento pudo haber sido alterado después de firmarse..." }
```

Casos en los que `esValida` sale `false`:
- El documento fue modificado después de firmarse (aunque sea un espacio).
- La llave que firmó no corresponde a ningún certificado emitido por este sistema.
- El certificado del firmante ya no está `VIGENTE` (fue revocado, expiró o fue renovado) —
  revisa `certificateStatus` para saber cuál de los tres.

Ejemplo con `curl`:
```bash
curl -X POST {BASE_URL}/api/documentos/validar \
  -H "Content-Type: application/json" \
  -d '{"xmlFirmado":"<...>"}'
```

## 7. Buenas prácticas al integrar

- **Nunca guardes el PIN** del usuario en tu base de datos ni en logs —
  pásalo directo del formulario del usuario a la llamada de `/firmar` y
  descártalo.
- **Usa HTTPS en producción.** Mientras el servicio esté solo con IP
  pública sin TLS (ver README del proyecto), no mandes datos sensibles
  por una red que no controles.
- **No reintentes automáticamente** una respuesta `401` (PIN
  incorrecto) — podrías activar el bloqueo por intentos fallidos del
  lado del usuario. Deja que él vuelva a escribir el PIN.
- **Guarda `xmlFirmado` completo**, no solo el hash — es el documento
  legal, el hash por sí solo no sirve para reconstruirlo.
- Antes de integrar en tu ambiente de pruebas, corre el flujo de la
  sección 4 una vez a mano (Postman o `curl`) con un contribuyente de
  prueba, para confirmar que tu conexión al `BASE_URL` funciona antes
  de automatizar nada.

## 8. Referencia completa de endpoints

Para el resto de operaciones (cambiar PIN, renovar/revocar certificado,
consultar historial, etc.) ver el `README.md` de la raíz del proyecto —
esta guía solo cubre lo que un equipo externo necesita para firmar y
validar.
