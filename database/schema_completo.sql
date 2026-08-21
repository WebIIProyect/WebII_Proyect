-- Schema completo — Módulo de Base de Datos y Contribuyentes

CREATE TABLE IF NOT EXISTS roles (
    id_rol          SERIAL PRIMARY KEY,
    nombre_rol      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion     VARCHAR(255),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE roles IS 'Roles del sistema (Administrador, Contribuyente, etc.)';

CREATE TABLE IF NOT EXISTS contribuyentes (
    id_contribuyente     SERIAL PRIMARY KEY,
    tipo_contribuyente   VARCHAR(10)   NOT NULL
        CHECK (tipo_contribuyente IN ('FISICO', 'JURIDICO')),
    identificacion       VARCHAR(20)   NOT NULL UNIQUE,
    nombre_razon_social  VARCHAR(150)  NOT NULL,
    correo               VARCHAR(150)  NOT NULL UNIQUE,
    telefono             VARCHAR(20),
    direccion            VARCHAR(255),
    actividad_economica  VARCHAR(150),
    pin_hash             VARCHAR(255)  NOT NULL,
    password_hash        VARCHAR(255),
    id_rol               INTEGER       NOT NULL REFERENCES roles(id_rol),
    estado                VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'ACTIVO', 'SUSPENDIDO', 'RECHAZADO')),
    fecha_registro        TIMESTAMP     NOT NULL DEFAULT NOW(),
    fecha_actualizacion   TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contribuyentes_identificacion ON contribuyentes(identificacion);
CREATE INDEX IF NOT EXISTS idx_contribuyentes_estado         ON contribuyentes(estado);
CREATE INDEX IF NOT EXISTS idx_contribuyentes_id_rol          ON contribuyentes(id_rol);
COMMENT ON TABLE contribuyentes IS 'Contribuyentes físicos/jurídicos inscritos en el servicio de firma digital';

CREATE TABLE IF NOT EXISTS administradores (
    id_administrador  SERIAL PRIMARY KEY,
    nombre            VARCHAR(100)  NOT NULL,
    correo            VARCHAR(150)  NOT NULL UNIQUE,
    password_hash     VARCHAR(255)  NOT NULL,
    id_rol            INTEGER       NOT NULL REFERENCES roles(id_rol),
    activo            BOOLEAN       NOT NULL DEFAULT TRUE,
    fecha_creacion    TIMESTAMP     NOT NULL DEFAULT NOW(),
    ultimo_acceso     TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_administradores_id_rol ON administradores(id_rol);
COMMENT ON TABLE administradores IS 'Cuentas administrativas del servicio de firma digital';

CREATE TABLE IF NOT EXISTS recuperacion_pin (
    id_recuperacion     SERIAL PRIMARY KEY,
    id_contribuyente    INTEGER       NOT NULL
        REFERENCES contribuyentes(id_contribuyente) ON DELETE CASCADE,
    token_recuperacion  VARCHAR(255)  NOT NULL UNIQUE,
    fecha_solicitud     TIMESTAMP     NOT NULL DEFAULT NOW(),
    fecha_expiracion    TIMESTAMP     NOT NULL,
    usado               BOOLEAN       NOT NULL DEFAULT FALSE,
    ip_solicitud        VARCHAR(45)
);
CREATE INDEX IF NOT EXISTS idx_recuperacion_pin_contribuyente ON recuperacion_pin(id_contribuyente);
CREATE INDEX IF NOT EXISTS idx_recuperacion_pin_token         ON recuperacion_pin(token_recuperacion);
COMMENT ON TABLE recuperacion_pin IS 'Solicitudes de recuperación de PIN de contribuyentes';

CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id_configuracion     SERIAL PRIMARY KEY,
    clave                VARCHAR(100)  NOT NULL UNIQUE,
    valor                VARCHAR(500)  NOT NULL,
    descripcion          VARCHAR(255),
    fecha_actualizacion  TIMESTAMP     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE configuracion_sistema IS 'Parámetros de configuración global del sistema';


-- Seeds iniciales


INSERT INTO roles (nombre_rol, descripcion) VALUES
    ('ADMINISTRADOR', 'Gestiona contribuyentes, roles y configuración del sistema'),
    ('CONTRIBUYENTE', 'Persona física o jurídica inscrita para firmar facturas electrónicas')
ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
    ('PIN_EXPIRACION_MINUTOS', '15', 'Minutos de validez de un token de recuperación de PIN'),
    ('PIN_LONGITUD_MIN', '8', 'Longitud mínima del PIN de firma'),
    ('PIN_LONGITUD_MAX', '16', 'Longitud máxima del PIN de firma (requiere mayúscula, minúscula, número y símbolo)'),
    ('XML_VALIDADOR_VERSION', '4.3', 'Versión de la estructura XML de Hacienda usada para validar facturas'),
    ('ALGORITMO_FIRMA', 'RSA-SHA256', 'Algoritmo usado por el módulo de firma digital'),
    ('MAX_INTENTOS_PIN', '5', 'Intentos fallidos de PIN antes de suspender al contribuyente')
ON CONFLICT (clave) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- Módulo de Criptografía (Integrante 3 — /crypto)
-- Tablas propias del módulo.
-- ═══════════════════════════════════════════════════════════════

-- Punto 2 del checklist: HSM simulado / bóveda de llaves.
CREATE TABLE IF NOT EXISTS boveda_llaves_privadas (
    id_boveda              SERIAL        PRIMARY KEY,
    id_contribuyente       INTEGER       NOT NULL UNIQUE
        REFERENCES contribuyentes(id_contribuyente) ON DELETE CASCADE,
    llave_publica          TEXT          NOT NULL,
    llave_privada_cifrada  TEXT          NOT NULL,
    iv                     VARCHAR(64)   NOT NULL,
    auth_tag               VARCHAR(64)   NOT NULL,
    algoritmo              VARCHAR(30)   NOT NULL DEFAULT 'AES-256-GCM',
    fecha_creacion         TIMESTAMP     NOT NULL DEFAULT NOW(),
    fecha_actualizacion    TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_boveda_llaves_id_contribuyente ON boveda_llaves_privadas(id_contribuyente);
COMMENT ON TABLE boveda_llaves_privadas IS 'Bóveda de llaves privadas RSA de cada contribuyente. La llave privada nunca se guarda en claro: viaja cifrada con AES-256-GCM (iv y auth_tag guardados aparte para poder descifrar y verificar integridad). Administrada por el módulo /crypto.';

-- Punto 5 del checklist: registro de transacciones.
-- fecha_hora usa TIMESTAMPTZ (no TIMESTAMP): Postgres normaliza y guarda
-- internamente en UTC sin importar la zona horaria del servidor, así un
-- solo campo cubre "fecha + hora + UTC" sin ambigüedad, sin necesidad de
-- guardar la zona horaria aparte.
CREATE TABLE IF NOT EXISTS transacciones_firma (
    id_transaccion_firma  SERIAL        PRIMARY KEY,
    id_contribuyente      INTEGER       NOT NULL
        REFERENCES contribuyentes(id_contribuyente) ON DELETE CASCADE,
    serial_certificado    VARCHAR(100)  NOT NULL,
    hash_documento         VARCHAR(64)   NOT NULL,
    resultado               VARCHAR(10)   NOT NULL DEFAULT 'EXITOSA'
        CHECK (resultado IN ('EXITOSA', 'FALLIDA')),
    detalle_error           VARCHAR(255),
    fecha_hora               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transacciones_firma_id_contribuyente ON transacciones_firma(id_contribuyente);
CREATE INDEX IF NOT EXISTS idx_transacciones_firma_fecha_hora       ON transacciones_firma(fecha_hora);
COMMENT ON TABLE transacciones_firma IS 'Registro de cada operación de firma de factura (exitosa o fallida): fecha/hora en UTC, hash SHA-256 del documento firmado y serial del certificado usado. Administrada por el módulo /crypto.';

CREATE TABLE IF NOT EXISTS transacciones_cifrado (
    id_transaccion_cifrado  SERIAL        PRIMARY KEY,
    id_contribuyente        INTEGER       NOT NULL
        REFERENCES contribuyentes(id_contribuyente) ON DELETE CASCADE,
    operacion                 VARCHAR(10)   NOT NULL
        CHECK (operacion IN ('CIFRADO', 'DESCIFRADO')),
    algoritmo                 VARCHAR(30)   NOT NULL DEFAULT 'AES-256-GCM',
    resultado                  VARCHAR(10)   NOT NULL DEFAULT 'EXITOSA'
        CHECK (resultado IN ('EXITOSA', 'FALLIDA')),
    detalle_error              VARCHAR(255),
    fecha_hora                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transacciones_cifrado_id_contribuyente ON transacciones_cifrado(id_contribuyente);
CREATE INDEX IF NOT EXISTS idx_transacciones_cifrado_fecha_hora       ON transacciones_cifrado(fecha_hora);
COMMENT ON TABLE transacciones_cifrado IS 'Registro de cada operación de cifrado/descifrado de una llave privada en la bóveda del HSM simulado (exitosa o fallida). Administrada por el módulo /crypto.';

-- ═══════════════════════════════════════════════════════════════
-- Módulo de Autoridad Certificadora / PKI (Integrante 2 — /certificate)
-- Ciclo de vida completo de los certificados digitales.
-- ═══════════════════════════════════════════════════════════════

-- Solicitud inicial de un contribuyente para obtener un certificado.
CREATE TABLE IF NOT EXISTS solicitudes_certificado (
    id_solicitud       SERIAL        PRIMARY KEY,
    id_contribuyente   INTEGER       NOT NULL
        REFERENCES contribuyentes(id_contribuyente) ON DELETE CASCADE,
    estado             VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    observaciones      VARCHAR(255),
    fecha_solicitud    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    fecha_resolucion   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_certificado_id_contribuyente ON solicitudes_certificado(id_contribuyente);
CREATE INDEX IF NOT EXISTS idx_solicitudes_certificado_estado          ON solicitudes_certificado(estado);
COMMENT ON TABLE solicitudes_certificado IS 'Solicitudes de emisión de certificado digital hechas por un contribuyente. Administrada por el módulo /certificate.';

-- El certificado digital ya emitido (equivalente simplificado a un X.509).
CREATE TABLE IF NOT EXISTS certificados_digitales (
    id_certificado        SERIAL        PRIMARY KEY,
    id_contribuyente      INTEGER       NOT NULL
        REFERENCES contribuyentes(id_contribuyente) ON DELETE CASCADE,
    id_solicitud          INTEGER
        REFERENCES solicitudes_certificado(id_solicitud),
    numero_serie          VARCHAR(64)   NOT NULL UNIQUE,
    llave_publica          TEXT          NOT NULL,
    algoritmo               VARCHAR(30)   NOT NULL DEFAULT 'RSA-2048',
    estado                   VARCHAR(20)   NOT NULL DEFAULT 'VIGENTE'
        CHECK (estado IN ('VIGENTE', 'RENOVADO', 'REVOCADO', 'EXPIRADO')),
    fecha_emision             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    fecha_expiracion           TIMESTAMPTZ   NOT NULL,
    fecha_actualizacion         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_certificados_id_contribuyente ON certificados_digitales(id_contribuyente);
CREATE INDEX IF NOT EXISTS idx_certificados_numero_serie     ON certificados_digitales(numero_serie);
CREATE INDEX IF NOT EXISTS idx_certificados_estado           ON certificados_digitales(estado);
COMMENT ON TABLE certificados_digitales IS 'Certificados digitales emitidos a contribuyentes: serial único, llave pública (la privada vive cifrada en boveda_llaves_privadas, módulo /crypto), vigencia y estado actual. Administrada por el módulo /certificate.';

-- Cada vez que un certificado se renueva se emite uno nuevo; esta tabla
-- deja el vínculo explícito entre el certificado viejo y el nuevo.
CREATE TABLE IF NOT EXISTS renovaciones (
    id_renovacion             SERIAL        PRIMARY KEY,
    id_certificado_anterior   INTEGER       NOT NULL
        REFERENCES certificados_digitales(id_certificado),
    id_certificado_nuevo      INTEGER       NOT NULL UNIQUE
        REFERENCES certificados_digitales(id_certificado),
    motivo                    VARCHAR(255),
    fecha_renovacion          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_renovaciones_id_certificado_anterior ON renovaciones(id_certificado_anterior);
COMMENT ON TABLE renovaciones IS 'Historial de renovaciones: vincula cada certificado reemplazado (RENOVADO) con el certificado nuevo que lo sustituye. Administrada por el módulo /certificate.';

-- Revocaciones (certificado dado de baja antes de su expiración natural).
CREATE TABLE IF NOT EXISTS revocaciones (
    id_revocacion       SERIAL        PRIMARY KEY,
    id_certificado       INTEGER       NOT NULL UNIQUE
        REFERENCES certificados_digitales(id_certificado),
    motivo                VARCHAR(255)  NOT NULL,
    fecha_revocacion       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revocaciones_id_certificado ON revocaciones(id_certificado);
COMMENT ON TABLE revocaciones IS 'Revocaciones de certificados digitales (equivalente a una entrada de CRL): motivo y fecha. Administrada por el módulo /certificate.';

-- Bitácora de todo cambio de estado de un certificado (auditoría de la
-- máquina de estados completa: VIGENTE -> RENOVADO | REVOCADO | EXPIRADO).
CREATE TABLE IF NOT EXISTS historial_estados (
    id_historial         SERIAL        PRIMARY KEY,
    id_certificado        INTEGER       NOT NULL
        REFERENCES certificados_digitales(id_certificado) ON DELETE CASCADE,
    estado_anterior        VARCHAR(20),
    estado_nuevo            VARCHAR(20)   NOT NULL,
    motivo                   VARCHAR(255),
    fecha_cambio             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_historial_estados_id_certificado ON historial_estados(id_certificado);
CREATE INDEX IF NOT EXISTS idx_historial_estados_fecha_cambio   ON historial_estados(fecha_cambio);
COMMENT ON TABLE historial_estados IS 'Bitácora de auditoría de cada transición de estado de un certificado digital. Administrada por el módulo /certificate.';