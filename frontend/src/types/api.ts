export interface NumeroRegistro {
  id: number;
  numero: string;
  fracciones: number;
  sorteo_id: string;
  sorteo_nombre: string;
  fecha_importacion: string;
}

export interface ImportacionInfo {
  id?: number;
  sorteo_id: string;
  sorteo_nombre: string;
  fecha_inicio: string;
  fecha_fin?: string;
  estado: 'progreso' | 'completada' | 'error';
  registros_importados: number;
  mensaje_error?: string;
  tipo_ejecucion: 'manual' | 'automatica';
}

export interface EstadoImportacionResponse {
  ultima_importacion_correcta: ImportacionInfo | null;
  importacion_activa: ImportacionInfo | null;
  total_registros: number;
}

export interface SorteoOption {
  id: string;
  nombre: string;
}

export interface ConsultaParams {
  tipo_filtro: 'menos_50' | 'empieza' | 'termina';
  filtro_valor?: string;
  orden: 'asc' | 'desc';
  limit: number;
  offset: number;
}
