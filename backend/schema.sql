-- Creación del esquema independiente
CREATE SCHEMA IF NOT EXISTS loteria_numeros;

-- Tabla de importaciones e historial técnico
CREATE TABLE IF NOT EXISTS loteria_numeros.importaciones (
    id BIGSERIAL PRIMARY KEY,
    sorteo_id VARCHAR(50) NOT NULL,
    sorteo_nombre VARCHAR(255) NOT NULL,
    fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(20) NOT NULL, -- 'progreso', 'completada', 'error'
    registros_importados INTEGER DEFAULT 0,
    mensaje_error TEXT,
    tipo_ejecucion VARCHAR(20) NOT NULL -- 'manual', 'automatica'
);

-- Tabla de números de la última descarga exitosa
CREATE TABLE IF NOT EXISTS loteria_numeros.numeros (
    id BIGSERIAL PRIMARY KEY,
    numero VARCHAR(5) NOT NULL,
    fracciones INTEGER NOT NULL,
    sorteo_id VARCHAR(50) NOT NULL,
    sorteo_nombre VARCHAR(255) NOT NULL,
    fecha_importacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de búsqueda y filtrado rápido
CREATE INDEX IF NOT EXISTS idx_numeros_numero ON loteria_numeros.numeros (numero);
CREATE INDEX IF NOT EXISTS idx_numeros_fracciones ON loteria_numeros.numeros (fracciones);
CREATE INDEX IF NOT EXISTS idx_numeros_numero_prefix ON loteria_numeros.numeros (numero text_pattern_ops);
