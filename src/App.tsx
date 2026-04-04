import React, { useState, useEffect } from 'react';
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

const mockHourlyData = [
  { time: '00:00', value: 150 },
  { time: '04:00', value: 120 },
  { time: '08:00', value: 850 },
  { time: '12:00', value: 1200 },
  { time: '16:00', value: 920 },
  { time: '20:00', value: 1600 },
  { time: '23:59', value: 400 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Custom Hook: Central Brain for State & Database
  const {
    devices,
    metrics,
    historicalData,
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
    try { Haptics.vibrate({ duration: 15 }); } catch (e) { }
    alert('Comando de reinicio enviado al ESP32.');
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#0B0F19';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#F8FAFC';
    }
  }, [darkMode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab metrics={metrics} currency={currency} hourlyData={historicalData} isOverload={metrics.power > 1200} />;
      case 'devices': return <DevicesTab devices={devices} onToggle={toggleDevice} />;
      case 'analytics': return <SystemModesTab currentMode={currentMode} onModeChange={changeMode} />;
      case 'settings': return <SettingsTab pushNotifications={pushNotifications} darkMode={darkMode} currency={currency} onSettingChange={updateSetting} onRestartESP32={handleRestartESP32} />;
      default: return null;
    }
  };

  return (
    <div className={cn(
      "h-screen w-full font-sans selection:bg-blue-500/30 flex flex-col overflow-hidden relative transition-colors duration-300",
      darkMode ? "dark bg-[#0B0F19] text-[#F1F5F9]" : "bg-[#F8FAFC] text-[#0F172A]"
    )}>

      {/* Mobile AppBar */}
      <div className={cn(
        "pt-[env(safe-area-inset-top)] border-b z-50 lg:hidden shrink-0 transition-colors duration-300",
        isIntrusion
          ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900/50"
          : "bg-white dark:bg-[#0B0F19] border-slate-200 dark:border-[#1E293B]"
      )}>
        <div className="h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg transition-colors", isIntrusion ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500")}>
              {isIntrusion ? <ShieldAlert size={20} className="animate-pulse" /> : <Zap size={20} fill="currentColor" />}
            </div>
            <span className={cn("font-bold text-lg tracking-tight transition-colors", isIntrusion ? "text-red-600 dark:text-red-400" : "text-[#0F172A] dark:text-[#F1F5F9]")}>
              {isIntrusion ? "ALERTA INTRUSO" : "SmartEnergy"}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#1E293B] px-2.5 py-1 rounded-full border border-slate-200 dark:border-[#334155]">
            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-slate-400 dark:bg-[#64748B]")} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">{isOnline ? "En línea" : "Desconectado"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative z-10 w-full max-w-[1600px] mx-auto">
        <aside className="hidden lg:flex flex-col w-72 h-full bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] border-r border-slate-200 dark:border-[#1E293B] overflow-y-auto custom-scrollbar shrink-0 transition-colors duration-300">
          <div className="p-6 flex items-center gap-3">
            {/* Desktop Side Branding */}
            <div className={cn("p-2 rounded-lg transition-colors", isIntrusion ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500")}>
              <Zap size={24} fill="currentColor" />
            </div>
            <span className="font-bold text-xl tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">SmartEnergy</span>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium", activeTab === item.id ? "bg-[#F8FAFC] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F1F5F9] border border-slate-200 dark:border-[#334155] shadow-sm shadow-blue-900/5 dark:shadow-none" : "text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F1F5F9] border border-transparent")}>
                <item.icon size={18} className={activeTab === item.id ? "text-blue-500" : ""} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative w-full">
          <div className="flex-1 overflow-y-auto px-2 py-2 md:p-4 lg:p-8 custom-scrollbar relative">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Mobile NavBar */}
      <div className="pb-[env(safe-area-inset-bottom)] bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] border-t border-slate-200 dark:border-[#1E293B] lg:hidden z-50 shrink-0 relative transition-colors duration-300">
        <div className="h-20 flex justify-around items-center px-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={async () => {
                  setActiveTab(item.id);
                  try { await Haptics.vibrate({ duration: 15 }); } catch (e) { }
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center w-full h-full transition-colors duration-300",
                  isActive ? "text-blue-600 dark:text-[#60A5FA]" : "text-slate-500 dark:text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]"
                )}
              >
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative px-5 py-1.5 mb-1 rounded-2xl flex items-center justify-center">
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 bg-blue-100 dark:bg-[#1E293B] rounded-xl"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <motion.div
                      animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.1 : 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className="relative z-10"
                    >
                      <item.icon
                        size={22}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                    </motion.div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold tracking-wide transition-all duration-300",
                    isActive ? "opacity-100" : "opacity-60"
                  )}>
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
