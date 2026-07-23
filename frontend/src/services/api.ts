import { API_BASE_URL } from '../config/env';
import type {
  ConsultaParams,
  EstadoImportacionResponse,
  NumeroRegistro,
  SorteoOption,
} from '../types/api';

interface ApiErrorBody {
  detail?: string;
  error_id?: string;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const reference = body.error_id ? ` Referencia: ${body.error_id}.` : '';
    throw new Error(
      `${body.detail || `Error HTTP ${response.status}`}.${reference}`.trim(),
    );
  }
  return response.json() as Promise<T>;
}

export function fetchNumeros(
  params: ConsultaParams,
): Promise<{ data: NumeroRegistro[]; total: number }> {
  const query = new URLSearchParams({
    tipo_filtro: params.tipo_filtro,
    orden: params.orden,
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.filtro_valor) query.set('filtro_valor', params.filtro_valor);
  return requestJson(`/numeros?${query.toString()}`);
}

export function fetchEstadoImportacion(): Promise<EstadoImportacionResponse> {
  return requestJson('/importacion-estado');
}

export function fetchSorteosDisponibles(): Promise<SorteoOption[]> {
  return requestJson('/sorteos');
}

export function iniciarActualizacionManual(
  sorteoId: string,
  sorteoNombre: string,
): Promise<{ mensaje: string; importacion_id: number }> {
  return requestJson('/actualizar-manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sorteo_id: sorteoId,
      sorteo_nombre: sorteoNombre,
    }),
  });
}
