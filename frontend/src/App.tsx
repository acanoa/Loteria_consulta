import { useState } from 'react';
import { ConsultaVista } from './components/ConsultaVista';
import { ActualizacionVista } from './components/ActualizacionVista';
import { Coins } from 'lucide-react';
import './App.css';

function App() {
  const [vista, setVista] = useState<'consulta' | 'actualizar'>('consulta');

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-slate-950 to-purple-950/20 text-slate-100 flex flex-col items-center justify-center p-0 sm:p-4">
      {/* Contenedor Principal con estilo de App Móvil */}
      <div className="w-full sm:max-w-md h-screen sm:h-[880px] bg-slate-950/70 sm:rounded-3xl sm:border border-slate-900 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
        
        {/* Barra Superior / Logo */}
        <header className="px-5 py-4 border-b border-slate-900/60 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 rounded-xl shadow-inner">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wide uppercase bg-gradient-to-r from-purple-400 to-indigo-200 bg-clip-text text-transparent">
                Lotería Nacional
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">
                Consulta de Disponibilidad
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              En Línea
            </span>
          </div>
        </header>

        {/* Cuerpo de la Aplicación */}
        <main className="flex-1 overflow-hidden p-4 flex flex-col">
          {vista === 'consulta' ? (
            <ConsultaVista onIrAActualizar={() => setVista('actualizar')} />
          ) : (
            <ActualizacionVista onVolver={() => setVista('consulta')} />
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
