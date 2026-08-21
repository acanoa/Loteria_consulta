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
  Ticket,
  Eye,
  Download,
  X
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
  const [totalResultados, setTotalResultados] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorQuery, setErrorQuery] = useState<string | null>(null);
  const [preparandoVista, setPreparandoVista] = useState(false);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [vistaExcelAbierta, setVistaExcelAbierta] = useState(false);
  const [registrosVista, setRegistrosVista] = useState<NumeroRegistro[]>([]);
  const [descargandoExcel, setDescargandoExcel] = useState(false);

  const [offset, setOffset] = useState(0);
  const [pageSize] = useState(50000);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reiniciar offset cuando cambian los filtros
  useEffect(() => {
    setOffset(0);
    setVistaExcelAbierta(false);
    setErrorVista(null);
  }, [tipoFiltro, filtroValor, orden, pageSize]);

  useEffect(() => {
    if (!vistaExcelAbierta) return;

    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVistaExcelAbierta(false);
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [vistaExcelAbierta]);

  // Cargar números de lotería
  useEffect(() => {
    // Si es tipo empieza/termina, validar longitud de 2 o 3 dígitos
    if ((tipoFiltro === 'empieza' || tipoFiltro === 'termina') && !/^\d{2,3}$/.test(filtroValor)) {
      setNumeros([]);
      setTotalResultados(0);
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
        setTotalResultados(res.total);
      } catch (err: unknown) {
        setErrorQuery(err instanceof Error ? err.message : 'Error de consulta');
        setTotalResultados(0);
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

  const mostrarVistaExcel = async () => {
    if (numeros.length === 0 || loading || preparandoVista) return;

    setPreparandoVista(true);
    setErrorVista(null);

    try {
      const registros = totalResultados > numeros.length
        ? (await fetchNumeros({
            tipo_filtro: tipoFiltro,
            filtro_valor: filtroValor || undefined,
            orden,
            limit: 100000,
            offset: 0,
          })).data
        : numeros;
      setRegistrosVista(registros);
      setVistaExcelAbierta(true);
    } catch (err: unknown) {
      setErrorVista(err instanceof Error ? err.message : 'No se pudo preparar la vista');
    } finally {
      setPreparandoVista(false);
    }
  };

  const cantidadColumnasVista = Math.min(
    10,
    Math.max(1, Math.ceil(Math.sqrt(registrosVista.length))),
  );
  const cantidadFilasVista = Math.ceil(registrosVista.length / cantidadColumnasVista);

  const descargarExcel = async () => {
    if (registrosVista.length === 0 || descargandoExcel) return;

    setDescargandoExcel(true);
    setErrorVista(null);

    try {
      const { default: ExcelJS } = await import('exceljs');
      const libro = new ExcelJS.Workbook();
      libro.creator = 'Lotería Nacional';
      libro.created = new Date();
      const hoja = libro.addWorksheet('Resultados');

      for (let columna = 1; columna <= cantidadColumnasVista; columna += 1) {
        hoja.getColumn(columna).width = 18;
      }

      registrosVista.forEach((registro, indice) => {
        const fila = Math.floor(indice / cantidadColumnasVista) + 1;
        const columna = (indice % cantidadColumnasVista) + 1;
        const celda = hoja.getCell(fila, columna);
        celda.value = {
          richText: [
            {
              text: registro.numero,
              font: { name: 'Consolas', bold: true, color: { argb: 'FF111827' } },
            },
            {
              text: `   ${registro.fracciones} f.`,
              font: { name: 'Arial', bold: true, color: { argb: 'FFD97706' } },
            },
          ],
        };
        celda.alignment = { vertical: 'middle', horizontal: 'center' };
        celda.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
        hoja.getRow(fila).height = 23;
      });

      const contenido = await libro.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(contenido)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      const valorFiltro = filtroValor || (tipoFiltro === 'menos_50' ? '50' : 'consulta');
      enlace.href = url;
      enlace.download = `loteria_${tipoFiltro}_${valorFiltro}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: unknown) {
      setErrorVista(err instanceof Error ? err.message : 'No se pudo descargar el archivo Excel');
    } finally {
      setDescargandoExcel(false);
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
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-slate-950/30 border-b border-slate-800/50">
          <span className="text-[10px] sm:text-xs text-slate-500">
            {totalResultados.toLocaleString('es-ES')} resultados
          </span>
          <button
            type="button"
            onClick={mostrarVistaExcel}
            disabled={numeros.length === 0 || loading || preparandoVista}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-[10px] sm:text-xs font-bold text-white rounded-lg transition-colors shadow-md active:scale-95 disabled:active:scale-100"
            title="Ver todos los resultados como una hoja de Excel"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{preparandoVista ? 'Preparando...' : 'Ver en Excel'}</span>
          </button>
        </div>
        {errorVista && (
          <div className="shrink-0 px-3 py-1.5 text-[10px] text-red-400 bg-red-500/5 border-b border-red-500/10">
            {errorVista}
          </div>
        )}
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

      {vistaExcelAbierta && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Vista Excel de resultados"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-emerald-700 text-white shadow-lg">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold">Vista Excel</h2>
              <p className="text-[10px] sm:text-xs text-emerald-100">
                {registrosVista.length.toLocaleString('es-ES')} números · {cantidadColumnasVista} columnas
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={descargarExcel}
                disabled={descargandoExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 disabled:bg-emerald-200 text-emerald-800 disabled:text-emerald-600 rounded-lg text-xs font-bold transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{descargandoExcel ? 'Descargando...' : 'Descargar'}</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaExcelAbierta(false)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 rounded-lg text-xs font-bold transition-colors"
              >
                <X className="w-4 h-4" />
                Cerrar
              </button>
            </div>
          </div>

          {errorVista && (
            <div className="shrink-0 px-4 py-2 text-xs text-red-700 bg-red-100 border-b border-red-200">
              {errorVista}
            </div>
          )}

          <div className="flex-1 overflow-auto bg-white">
            <table className="border-collapse text-xs text-slate-900">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 w-10 min-w-10 h-7 bg-slate-200 border border-slate-300" />
                  {Array.from({ length: cantidadColumnasVista }, (_, columna) => (
                    <th
                      key={columna}
                      className="min-w-36 h-7 bg-slate-200 border border-slate-300 font-semibold text-slate-600"
                    >
                      {String.fromCharCode(65 + columna)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: cantidadFilasVista }, (_, fila) => (
                  <tr key={fila}>
                    <th className="sticky left-0 z-10 w-10 min-w-10 h-8 bg-slate-100 border border-slate-300 font-normal text-slate-500">
                      {fila + 1}
                    </th>
                    {Array.from({ length: cantidadColumnasVista }, (_, columna) => {
                      const registro = registrosVista[(fila * cantidadColumnasVista) + columna];
                      return (
                        <td
                          key={columna}
                          className="min-w-36 h-8 px-2 text-center border border-slate-300 whitespace-nowrap bg-white hover:bg-emerald-50"
                        >
                          {registro && (
                            <>
                              <span className="font-mono font-bold">{registro.numero}</span>
                              <span className="ml-3 font-bold text-amber-600">{registro.fracciones} f.</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
