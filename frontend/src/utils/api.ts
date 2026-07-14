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

const API_BASE = '/api';

export async function fetchNumeros(params: ConsultaParams): Promise<{ data: NumeroRegistro[]; total: number }> {
  const query = new URLSearchParams({
    tipo_filtro: params.tipo_filtro,
    orden: params.orden,
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.filtro_valor) {
    query.append('filtro_valor', params.filtro_valor);
  }

  const response = await fetch(`${API_BASE}/numeros?${query.toString()}`);
  if (!response.ok) {
    throw new Error('Error al consultar los números de lotería');
  }
  return response.json();
}

export async function fetchEstadoImportacion(): Promise<EstadoImportacionResponse> {
  const response = await fetch(`${API_BASE}/importacion-estado`);
  if (!response.ok) {
    throw new Error('Error al consultar el estado de la importación');
  }
  return response.json();
}

export async function fetchSorteosDisponibles(): Promise<SorteoOption[]> {
  const response = await fetch(`${API_BASE}/sorteos`);
  if (!response.ok) {
    throw new Error('Error al obtener la lista de sorteos');
  }
  return response.json();
}

export async function iniciarActualizacionManual(sorteoId: string, sorteoNombre: string): Promise<{ mensaje: string; importacion_id: number }> {
  const response = await fetch(`${API_BASE}/actualizar-manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sorteo_id: sorteoId, sorteo_nombre: sorteoNombre }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Error al iniciar la actualización manual');
  }
  return response.json();
}
