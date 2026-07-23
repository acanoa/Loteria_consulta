import React, { useState, useEffect, useRef } from 'react';
import { fetchNumeros } from '../services/api';
import type {
  NumeroRegistro, 
  EstadoImportacionResponse 
} from '../types/api';
import { 
  Search, 
  ArrowUpDown, 
  AlertTriangle, 
  Database,
  Ticket
} from 'lucide-react';

interface ConsultaVistaProps {
  onIrAActualizar: () => void;
  estadoImport: EstadoImportacionResponse | null;
}

export const ConsultaVista: React.FC<ConsultaVistaProps> = ({ onIrAActualizar, estadoImport }) => {
  const [tipoFiltro, setTipoFiltro] = useState<'menos_50' | 'empieza' | 'termina'>('menos_50');
  const [filtroValor, setFiltroValor] = useState('');
  const [orden, setOrden] = useState<'asc' | 'desc'>('asc');
  
  const [numeros, setNumeros] = useState<NumeroRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorQuery, setErrorQuery] = useState<string | null>(null);

  const [offset, setOffset] = useState(0);
  const [pageSize] = useState(50000);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reiniciar offset cuando cambian los filtros
  useEffect(() => {
    setOffset(0);
  }, [tipoFiltro, filtroValor, orden, pageSize]);

  // Cargar números de lotería
  useEffect(() => {
    // Si es tipo empieza/termina, validar longitud de 2 o 3 dígitos
    if ((tipoFiltro === 'empieza' || tipoFiltro === 'termina') && !/^\d{2,3}$/.test(filtroValor)) {
      setNumeros([]);
      return;
    }

    const cargarNumeros = async () => {
      setLoading(true);
      setErrorQuery(null);
      try {
        const res = await fetchNumeros({
          tipo_filtro: tipoFiltro,
          filtro_valor: filtroValor || undefined,
          orden,
          limit: pageSize,
          offset,
        });
        setNumeros(res.data);
      } catch (err: unknown) {
        setErrorQuery(err instanceof Error ? err.message : 'Error de consulta');
      } finally {
        setLoading(false);
      }
    };

    cargarNumeros();
  }, [tipoFiltro, filtroValor, orden, pageSize, offset]);



  // Validar entrada del filtro de búsqueda
  const handleFiltroValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // Solo dígitos
    const maxLen = tipoFiltro === 'menos_50' ? 4 : 3;
    if (val.length <= maxLen) {
      setFiltroValor(val);
    }
  };

  // Formatear fecha
  const formatearFecha = (fechaStr: string) => {
    try {
      const date = new Date(fechaStr);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fechaStr;
    }
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Cabecera / Info del Sorteo */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-xl py-1.5 px-2.5 border border-slate-800/80 shadow-lg space-y-1.5">
        {/* Nombre del sorteo en una sola línea y más pequeño */}
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 bg-slate-950/40 px-2 py-1.5 rounded-lg border border-slate-800/40">
          <Ticket className="text-purple-400 w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {estadoImport?.ultima_importacion_correcta?.sorteo_nombre || "Cargando sorteo..."}
          </span>
        </div>
        
        {/* Actualizado, Total décimos y Botón de Actualizar en la misma línea */}
        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 px-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <span>
              Actualizado el:{' '}
              <span className="text-slate-200 font-medium">
                {estadoImport?.ultima_importacion_correcta?.fecha_fin
                  ? formatearFecha(estadoImport.ultima_importacion_correcta.fecha_fin)
                  : 'N/A'}
              </span>
            </span>
            <span className="text-slate-700 font-bold">•</span>
            <span>
              Total décimos:{' '}
              <span className="text-slate-200 font-semibold">
                {estadoImport?.total_registros ?? 0} ({numeros.length})
              </span>
            </span>
          </div>
          <button
            onClick={onIrAActualizar}
            className="shrink-0 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 border border-purple-500/20 text-[9px] font-bold text-white uppercase tracking-wider rounded-lg transition-all shadow-md active:scale-95"
          >
            Actualizar Datos
          </button>
        </div>
      </div>

      {/* Zona de Filtros */}
      <div className="bg-slate-900/40 rounded-2xl p-3.5 border border-slate-800/60 space-y-3">
        {/* Selector de filtro y Ordenación en la misma línea */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex-1 grid grid-cols-3 gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800/50">
            {(['menos_50', 'empieza', 'termina'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => {
                  setTipoFiltro(tipo);
                  setFiltroValor(''); // Limpiar al cambiar
                }}
                className={`py-2 px-1 text-[10px] sm:text-xs font-semibold rounded-lg transition-all duration-200 ${
                  tipoFiltro === tipo
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tipo === 'menos_50' ? `< ${filtroValor || '50'} frac.` : tipo === 'empieza' ? 'Empieza' : 'Termina'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOrden((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="shrink-0 flex items-center gap-1 px-2.5 py-2.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-xl text-[10px] sm:text-xs font-semibold text-slate-300 transition-colors shadow-md"
            title="Cambiar ordenación"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="capitalize">{orden === 'asc' ? 'Ascendente' : 'Descendente'}</span>
          </button>
        </div>

        {/* Inputs adicionales si corresponde */}
        {tipoFiltro === 'menos_50' ? (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Database className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="Modificar límite de fracciones (ej. 50)"
              value={filtroValor}
              onChange={handleFiltroValorChange}
              className="block w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="Introduce 2 o 3 dígitos"
              value={filtroValor}
              onChange={handleFiltroValorChange}
              className="block w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
        )}
      </div>

      {/* Resultados - Ajuste de altura dinámica */}
      <div 
        ref={containerRef} 
        className="flex-1 bg-slate-900/20 border border-slate-800/40 rounded-2xl flex flex-col overflow-hidden min-h-[220px]"
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2">
            <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500">Cargando décimos...</p>
          </div>
        ) : errorQuery ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-sm font-semibold text-slate-300">Error al cargar datos</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[250px]">{errorQuery}</p>
          </div>
        ) : (tipoFiltro === 'empieza' || tipoFiltro === 'termina') && !/^\d{2,3}$/.test(filtroValor) ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <Search className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-500 max-w-[200px]">
              Escribe 2 o 3 dígitos numéricos para buscar coincidencias.
            </p>
          </div>
        ) : numeros.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <Database className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-400">Sin resultados</p>
            <p className="text-xs text-slate-600 mt-1">Ningún décimo coincide con este filtro</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-2 bg-slate-950/10">
            {numeros.map((reg) => (
              <div 
                key={reg.id} 
                className="flex items-center justify-between px-2 py-1 hover:bg-slate-900/30 transition-colors border-b border-slate-900/40 [&:nth-child(odd)]:border-r [&:nth-child(odd)]:border-slate-900/40"
              >
                <span className="text-xs sm:text-sm font-bold text-slate-100 font-mono">
                  {reg.numero}
                </span>
                <div className="text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs sm:text-sm font-bold ${
                    reg.fracciones === 0 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : reg.fracciones < 10
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {reg.fracciones} f.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
