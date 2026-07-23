import React, { useState, useEffect } from 'react';
import { 
  fetchSorteosDisponibles, 
  iniciarActualizacionManual, 
  fetchEstadoImportacion, 
} from '../services/api';
import type {
  SorteoOption, 
  EstadoImportacionResponse,
} from '../types/api';
import { 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle,
  Clock
} from 'lucide-react';

interface ActualizacionVistaProps {
  onVolver: () => void;
  estadoImport: EstadoImportacionResponse | null;
  onActualizarEstado: (estado: EstadoImportacionResponse) => void;
}

export const ActualizacionVista: React.FC<ActualizacionVistaProps> = ({ onVolver, estadoImport, onActualizarEstado }) => {
  const [sorteos, setSorteos] = useState<SorteoOption[]>([]);
  const [sorteoSeleccionado, setSorteoSeleccionado] = useState<string>('');
  
  const [loadingSorteos, setLoadingSorteos] = useState(false);
  const [loadingAccion, setLoadingAccion] = useState(false);
  
  const [mensajeLocal, setMensajeLocal] = useState<{ tipo: 'info' | 'exito' | 'error'; texto: string } | null>(null);
  const [estabaActivo, setEstabaActivo] = useState(false);

  // Cargar sorteos disponibles
  const cargarInformacion = async () => {
    setLoadingSorteos(true);
    setMensajeLocal(null);
    
    // Obtener Sorteos de la página de Loterías
    try {
      const resSorteos = await fetchSorteosDisponibles();
      setSorteos(resSorteos);
      
      // Encontrar sorteo de Navidad por defecto
      const navidad = resSorteos.find(s => s.nombre.toUpperCase().includes('NAVIDAD'));
      if (navidad) {
        setSorteoSeleccionado(navidad.id);
      } else if (resSorteos.length > 0) {
        setSorteoSeleccionado(resSorteos[0].id);
      }
    } catch (err: unknown) {
      console.error("Error al cargar sorteos", err);
      setMensajeLocal({ 
        tipo: 'error', 
        texto: 'No se pudo obtener la lista de sorteos oficiales desde la página de Loterías y Apuestas del Estado.' 
      });
    } finally {
      setLoadingSorteos(false);
    }
  };

  useEffect(() => {
    cargarInformacion();
  }, []);

  // Detectar cuando termina la importación para mostrar el mensaje de éxito
  useEffect(() => {
    if (estadoImport?.importacion_activa) {
      setEstabaActivo(true);
    } else if (estabaActivo && estadoImport?.ultima_importacion_correcta) {
      setEstabaActivo(false);
      setMensajeLocal({
        tipo: 'exito',
        texto: `Actualización completada: se importaron ${estadoImport.ultima_importacion_correcta.registros_importados} décimos.`
      });
    }
  }, [estadoImport?.importacion_activa, estadoImport?.ultima_importacion_correcta, estabaActivo]);

  const handleActualizar = async () => {
    if (!sorteoSeleccionado) return;
    
    const sorteoObj = sorteos.find(s => s.id === sorteoSeleccionado);
    const sorteoNombre = sorteoObj ? sorteoObj.nombre : sorteoSeleccionado;

    setLoadingAccion(true);
    setMensajeLocal(null);
    try {
      await iniciarActualizacionManual(
        sorteoSeleccionado,
        sorteoNombre,
      );
      setMensajeLocal({
        tipo: 'info',
        texto: 'La descarga y procesamiento del sorteo ha comenzado correctamente en el servidor.'
      });
      // Refrescar estado para activar el poll en App.tsx
      const estadoActualizado = await fetchEstadoImportacion();
      onActualizarEstado(estadoActualizado);
    } catch (err: unknown) {
      setMensajeLocal({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo iniciar la descarga.'
      });
    } finally {
      setLoadingAccion(false);
    }
  };

  const importandoActualmente = !!estadoImport?.importacion_activa;

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Botón Volver */}
      <div>
        <button
          onClick={onVolver}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Consultas
        </button>
      </div>

      {/* Tarjeta de Control */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-slate-800/80 shadow-lg space-y-4">
        <div>
          <h2 className="text-base font-bold text-white mb-1">
            Actualizar Sorteo
          </h2>
          <p className="text-xs text-slate-400">
            Descarga directamente de la web oficial de Loterías los décimos y fracciones vigentes del sorteo seleccionado.
          </p>
        </div>

        {/* Formulario Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-400">
            Selecciona el sorteo a descargar:
          </label>
          {loadingSorteos ? (
            <div className="h-10 bg-slate-950/40 rounded-xl border border-slate-800 animate-pulse flex items-center justify-center">
              <span className="text-xs text-slate-500">Cargando sorteos disponibles...</span>
            </div>
          ) : (
            <select
              value={sorteoSeleccionado}
              onChange={(e) => setSorteoSeleccionado(e.target.value)}
              disabled={importandoActualmente || loadingAccion}
              className="block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            >
              {sorteos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Botón de Actualizar */}
        <button
          onClick={handleActualizar}
          disabled={importandoActualmente || loadingAccion || !sorteoSeleccionado}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white disabled:text-slate-500 font-bold rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          {importandoActualmente || loadingAccion ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Actualizar Ahora
            </>
          )}
        </button>
      </div>

      {/* Alerta de Seguridad / Resiliencia */}
      <div className="bg-blue-950/20 border border-blue-900/40 rounded-2xl p-4 flex gap-3 text-xs text-blue-300">
        <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-0.5">Operación Segura de Reemplazo</span>
          Si ocurre un fallo durante la descarga o validación del nuevo sorteo, los datos del sorteo previo se mantendrán intactos.
        </div>
      </div>

      {/* Estado y Mensajes de Progreso */}
      <div className="flex-1 space-y-3.5 overflow-y-auto">
        {mensajeLocal && (
          <div className={`p-4 rounded-xl border text-xs flex gap-2.5 ${
            mensajeLocal.tipo === 'exito'
              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
              : mensajeLocal.tipo === 'error'
              ? 'bg-red-950/20 border-red-900/50 text-red-300'
              : 'bg-indigo-950/20 border-indigo-900/50 text-indigo-300'
          }`}>
            {mensajeLocal.tipo === 'exito' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : mensajeLocal.tipo === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
            )}
            <div>
              {mensajeLocal.texto}
            </div>
          </div>
        )}

        {/* Información del Estado del Servidor */}
        {estadoImport && (
          <div className="bg-slate-900/20 border border-slate-800/40 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Detalle de Última Importación
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                <span className="text-slate-500 block mb-0.5">Sorteo Solicitado</span>
                <span className="font-semibold text-slate-300 truncate block">
                  {estadoImport.ultima_importacion_correcta?.sorteo_nombre || 'Ninguno'}
                </span>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                <span className="text-slate-500 block mb-0.5">Registros Cargados</span>
                <span className="font-semibold text-slate-300">
                  {estadoImport.ultima_importacion_correcta?.registros_importados ?? 0}
                </span>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                <span className="text-slate-500 block mb-0.5">Fecha Inicio</span>
                <span className="font-semibold text-slate-300">
                  {estadoImport.ultima_importacion_correcta?.fecha_inicio 
                    ? new Date(estadoImport.ultima_importacion_correcta.fecha_inicio).toLocaleString('es-ES')
                    : 'N/A'}
                </span>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                <span className="text-slate-500 block mb-0.5">Tipo de Ejecución</span>
                <span className="font-semibold text-slate-300 capitalize">
                  {estadoImport.ultima_importacion_correcta?.tipo_ejecucion || 'N/A'}
                </span>
              </div>
            </div>

            {/* Si el último intento fue fallido (o en progreso pero falló anteriormente) */}
            {estadoImport.ultima_importacion_correcta === null && estadoImport.total_registros === 0 && (
              <div className="p-3 bg-red-950/10 border border-red-900/30 rounded-xl text-xs text-red-400">
                Aún no se ha realizado ninguna importación exitosa de sorteos en el sistema.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
