import React, { useState, useEffect, useRef } from 'react';
import { 
  fetchNumeros, 
  fetchEstadoImportacion, 
} from '../utils/api';
import type {
  NumeroRegistro, 
  EstadoImportacionResponse 
} from '../utils/api';
import { 
  Search, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Database,
  Ticket
} from 'lucide-react';

interface ConsultaVistaProps {
  onIrAActualizar: () => void;
}

export const ConsultaVista: React.FC<ConsultaVistaProps> = ({ onIrAActualizar }) => {
  const [tipoFiltro, setTipoFiltro] = useState<'menos_50' | 'empieza' | 'termina'>('menos_50');
  const [filtroValor, setFiltroValor] = useState('');
  const [orden, setOrden] = useState<'asc' | 'desc'>('asc');
  
  const [numeros, setNumeros] = useState<NumeroRegistro[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorQuery, setErrorQuery] = useState<string | null>(null);
  
  const [estadoImport, setEstadoImport] = useState<EstadoImportacionResponse | null>(null);

  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const containerRef = useRef<HTMLDivElement>(null);

  const cargarEstadoImportacion = async () => {
    try {
      const res = await fetchEstadoImportacion();
      setEstadoImport(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    cargarEstadoImportacion();
  }, []);

  // Calcular la altura dinámica y adaptar el tamaño de página
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        // Altura de fila estimada: 58px. Margen para cabecera/pie: 30px.
        const computedSize = Math.max(3, Math.floor((height - 30) / 58));
        setPageSize(computedSize);
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Reiniciar offset cuando cambian los filtros
  useEffect(() => {
    setOffset(0);
  }, [tipoFiltro, filtroValor, orden, pageSize]);

  // Cargar números de lotería
  useEffect(() => {
    // Si es tipo empieza/termina, validar longitud de 2 o 3 dígitos
    if ((tipoFiltro === 'empieza' || tipoFiltro === 'termina') && !/^\d{2,3}$/.test(filtroValor)) {
      setNumeros([]);
      setTotalRecords(0);
      return;
    }

    const cargarNumeros = async () => {
      setLoading(true);
      setErrorQuery(null);
      try {
        const res = await fetchNumeros({
          tipo_filtro: tipoFiltro,
          filtro_valor: tipoFiltro !== 'menos_50' ? filtroValor : undefined,
          orden,
          limit: pageSize,
          offset,
        });
        setNumeros(res.data);
        setTotalRecords(res.total);
      } catch (err: any) {
        setErrorQuery(err.message || 'Error de consulta');
      } finally {
        setLoading(false);
      }
    };

    cargarNumeros();
  }, [tipoFiltro, filtroValor, orden, pageSize, offset]);

  const handleAnterior = () => {
    setOffset((prev) => Math.max(0, prev - pageSize));
  };

  const handleSiguiente = () => {
    if (offset + pageSize < totalRecords) {
      setOffset((prev) => prev + pageSize);
    }
  };

  // Validar entrada del filtro de búsqueda
  const handleFiltroValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // Solo dígitos
    if (val.length <= 3) {
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

  // Renderizar estado de la importación
  const renderEstadoBadge = () => {
    if (!estadoImport) return null;
    const { ultima_importacion_correcta, importacion_activa } = estadoImport;
    
    if (importacion_activa) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Actualización en curso...
        </span>
      );
    }

    if (ultima_importacion_correcta) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" /> Activo
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
        <AlertTriangle className="w-3.5 h-3.5" /> Sin datos cargados
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Cabecera / Info del Sorteo */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="text-purple-400 w-5 h-5" />
              <h2 className="text-lg font-bold text-white tracking-wide">
                {estadoImport?.ultima_importacion_correcta?.sorteo_nombre || "Cargando sorteo..."}
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Actualizado el:{' '}
              <span className="text-slate-200">
                {estadoImport?.ultima_importacion_correcta?.fecha_fin
                  ? formatearFecha(estadoImport.ultima_importacion_correcta.fecha_fin)
                  : 'N/A'}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {renderEstadoBadge()}
            <p className="text-xs text-slate-400">
              Total décimos: <span className="font-semibold text-slate-200">{estadoImport?.total_registros ?? 0}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Zona de Filtros */}
      <div className="bg-slate-900/40 rounded-2xl p-3.5 border border-slate-800/60 space-y-3">
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800/50">
          {(['menos_50', 'empieza', 'termina'] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => {
                setTipoFiltro(tipo);
                if (tipo === 'menos_50') setFiltroValor('');
              }}
              className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all duration-200 ${
                tipoFiltro === tipo
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tipo === 'menos_50' ? '< 50 fracciones' : tipo === 'empieza' ? 'Empieza por' : 'Termina en'}
            </button>
          ))}
        </div>

        {/* Inputs adicionales si corresponde */}
        {tipoFiltro !== 'menos_50' && (
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

        {/* Ordenación */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Ordenación:</span>
          <button
            onClick={() => setOrden((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Número {orden === 'asc' ? 'Ascendente' : 'Descendente'}
          </button>
        </div>
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
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {numeros.map((reg) => (
              <div 
                key={reg.id} 
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30 transition-colors"
              >
                <span className="text-xl font-bold tracking-widest text-slate-100 font-mono">
                  {reg.numero}
                </span>
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                    reg.fracciones === 0 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : reg.fracciones < 10
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {reg.fracciones} {reg.fracciones === 1 ? 'fracción' : 'fracciones'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controles Inferiores (Paginación + Ir a actualización) */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={onIrAActualizar}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-purple-400 hover:text-purple-300 rounded-xl transition-all shadow-md"
        >
          Actualizar Datos
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleAnterior}
            disabled={offset === 0 || loading}
            className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleSiguiente}
            disabled={offset + pageSize >= totalRecords || loading}
            className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
