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
    ('PIN_LONGITUD', '6', 'Cantidad de dígitos del PIN de contribuyente'),
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