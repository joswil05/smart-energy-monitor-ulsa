import React, { useState } from 'react';
import {
  LayoutDashboard,
  Lightbulb,
  Activity,
  Settings,
  Zap,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { cn } from './lib/utils';
import { useEnergySystem } from './hooks/useEnergySystem';

// Views
import { DashboardTab } from './views/DashboardTab';
import { DevicesTab } from './views/DevicesTab';
import { SystemModesTab } from './views/SystemModesTab';
import { SettingsTab } from './views/SettingsTab';
import { ref, update } from 'firebase/database';
import { db } from './lib/firebase';

const navItems = [
  { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard },
  { id: 'devices', label: 'Dispositivos', icon: Lightbulb },
  { id: 'analytics', label: 'Modos', icon: Activity },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Custom Hook: Central Brain for State & Database
  const {
    devices,
    metrics,
    currentMode,
    isOnline,
    isIntrusion,
    pushNotifications,
    darkMode,
    currency,
    toggleDevice,
    changeMode,
    updateSetting
  } = useEnergySystem();

  const handleRestartESP32 = () => {
    update(ref(db, 'system/command'), { action: 'restart', timestamp: Date.now() });
    try { Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) { }
    alert('Comando de reinicio enviado al ESP32.');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab metrics={metrics} currency={currency} hourlyData={[]} isOverload={metrics.power > 1200} />;
      case 'devices': return <DevicesTab devices={devices} onToggle={toggleDevice} />;
      case 'analytics': return <SystemModesTab currentMode={currentMode} onModeChange={changeMode} />;
      case 'settings': return <SettingsTab pushNotifications={pushNotifications} darkMode={darkMode} currency={currency} onSettingChange={updateSetting} onRestartESP32={handleRestartESP32} />;
      default: return null;
    }
  };

  return (
    <div className="h-screen w-full bg-[#0B1120] text-slate-100 font-sans selection:bg-blue-500/30 flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[128px]" />
      </div>

      {/* Mobile AppBar */}
      <div className={cn(
        "pt-[env(safe-area-inset-top)] backdrop-blur-xl border-b z-50 lg:hidden shrink-0 transition-colors duration-500",
        isIntrusion ? "bg-red-950/80 border-red-500/50" : "bg-[#0B1120]/80 border-white/5"
      )}>
        <div className="h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-xl shadow-lg transition-colors", isIntrusion ? "bg-red-600 shadow-red-500/20" : "bg-gradient-to-br from-blue-600 to-blue-700 shadow-blue-500/20")}>
              {isIntrusion ? <ShieldAlert size={20} className="text-white animate-pulse" /> : <Zap size={20} className="text-white" fill="currentColor" />}
            </div>
            <span className={cn("font-bold text-lg tracking-tight transition-colors", isIntrusion ? "text-red-400" : "text-white")}>
              {isIntrusion ? "ALERTA INTRUSO" : "SmartEnergy"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-slate-500")} />
            <span className="text-xs font-medium text-slate-400">{isOnline ? "En línea" : "Desconectado"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative z-10">
        <aside className="hidden lg:flex flex-col w-72 h-full bg-[#0B1120]/95 backdrop-blur-xl border-r border-white/5 overflow-y-auto custom-scrollbar shrink-0">
          <div className="p-6 flex items-center gap-3">
            {/* Desktop Side Branding */}
            <div className={cn("p-2.5 rounded-xl shadow-lg transition-colors", isIntrusion ? "bg-red-600" : "bg-blue-600")}>
              <Zap size={24} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">SmartEnergy</span>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group", activeTab === item.id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5")}>
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative w-full">
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar relative">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15, ease: "easeOut" }} className="w-full h-full">
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile NavBar */}
      <div className="pb-[env(safe-area-inset-bottom)] bg-[#0B1120]/80 backdrop-blur-xl border-t border-white/5 lg:hidden z-50 shrink-0">
        <div className="h-20 flex justify-around items-center px-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={async () => { setActiveTab(item.id); try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) { } }} className={cn("relative flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-colors duration-200", activeTab === item.id ? "text-blue-500" : "text-slate-500 hover:text-slate-300")}>
              <div className="p-1.5 relative z-10 transition-transform active:scale-95">
                <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                {activeTab === item.id && (
                  <motion.div layoutId="mobileActiveTab" className="absolute inset-0 bg-blue-500/15 rounded-xl -z-10" transition={{ type: "tween", duration: 0.15, ease: "easeOut" }} />
                )}
              </div>
              <span className="text-[10px] font-medium z-10">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
