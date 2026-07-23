import { useState, useEffect } from 'react';
import { ConsultaVista } from './components/ConsultaVista';
import { ActualizacionVista } from './components/ActualizacionVista';
import { Coins, RefreshCw } from 'lucide-react';
import { fetchEstadoImportacion } from './services/api';
import type { EstadoImportacionResponse } from './types/api';
import './App.css';

function App() {
  const [vista, setVista] = useState<'consulta' | 'actualizar'>('consulta');
  const [estadoImport, setEstadoImport] = useState<EstadoImportacionResponse | null>(null);

  const cargarEstado = async () => {
    try {
      const res = await fetchEstadoImportacion();
      setEstadoImport(res);
    } catch (err) {
      console.error("Error al cargar estado de importación:", err);
    }
  };

  useEffect(() => {
    cargarEstado();
  }, []);

  useEffect(() => {
    if (!estadoImport?.importacion_activa) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetchEstadoImportacion();
        setEstadoImport(res);
      } catch (err) {
        console.error("Error al consultar importación activa:", err);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [estadoImport?.importacion_activa]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-slate-950 to-purple-950/20 text-slate-100 flex flex-col items-center justify-center p-0 sm:p-4">
      {/* Contenedor Principal con estilo de App Móvil */}
      <div className="w-full sm:max-w-md h-screen sm:h-[880px] bg-slate-950/70 sm:rounded-3xl sm:border border-slate-900 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
        
        {/* Barra Superior / Logo */}
        <header className="px-3.5 py-2 border-b border-slate-900/60 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-1.5 rounded-lg shadow-inner">
              <Coins className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-extrabold tracking-wide uppercase bg-gradient-to-r from-purple-400 to-indigo-200 bg-clip-text text-transparent">
                Lotería Nacional
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {estadoImport?.importacion_activa ? (
              <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 text-amber-300 animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">Sincronizando</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-900/50 px-2 py-0.5 rounded-lg border border-slate-900">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-[8px] sm:text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                  En Línea
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Cuerpo de la Aplicación */}
        <main className="flex-1 overflow-hidden px-4 pt-1 pb-4 flex flex-col">
          {vista === 'consulta' ? (
            <ConsultaVista 
              onIrAActualizar={() => setVista('actualizar')} 
              estadoImport={estadoImport}
            />
          ) : (
            <ActualizacionVista 
              onVolver={() => setVista('consulta')} 
              estadoImport={estadoImport}
              onActualizarEstado={setEstadoImport}
            />
          )}
        </main>

        {/* Footer sutil */}
        <footer className="py-2.5 text-center border-t border-slate-900/60 bg-slate-950/40 shrink-0">
          <p className="text-[10px] text-slate-600">
            © {new Date().getFullYear()} Consulta de Décimos · Sin autenticación
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
