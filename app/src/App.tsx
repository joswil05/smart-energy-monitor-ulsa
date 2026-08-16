import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Lightbulb,
  Activity,
  Settings,
  Zap,
  ShieldAlert,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics } from '@capacitor/haptics';
import { cn } from './lib/utils';
import { useEnergySystem } from './hooks/useEnergySystem';

// Views
import { DashboardTab } from './views/DashboardTab';
import { DevicesTab } from './views/DevicesTab';
import { SystemModesTab } from './views/SystemModesTab';
import { SettingsTab } from './views/SettingsTab';
import { ConfirmDialog } from './components/ConfirmDialog';
import { HardwareHelpModal } from './components/HardwareHelpModal';
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
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Custom Hook: Central Brain for State & Database
  const {
    devices,
    metrics,
    historicalData,
    currentMode,
    isOnline,
    latencyMs,
    isIntrusion,
    pushNotifications,
    darkMode,
    currency,
    tariffRate,
    powerLimit,
    pendingOverrideDevice,
    toggleDevice,
    confirmOverride,
    cancelOverride,
    changeMode,
    updateSetting,
    reconnectFirebase
  } = useEnergySystem();

  const handleRestartESP32 = () => {
    update(ref(db, 'system/command'), { action: 'restart', timestamp: Date.now() });
    try { Haptics.vibrate({ duration: 30 }); } catch (e) { }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#070A11';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#F1F5F9';
    }
  }, [darkMode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardTab
            metrics={metrics}
            currency={currency}
            hourlyData={historicalData}
            isOverload={metrics.power > (powerLimit || 1200)}
            darkMode={darkMode}
            tariffRate={tariffRate}
          />
        );
      case 'devices':
        return <DevicesTab devices={devices} onToggle={toggleDevice} />;
      case 'analytics':
        return <SystemModesTab currentMode={currentMode} onModeChange={changeMode} />;
      case 'settings':
        return (
          <SettingsTab
            pushNotifications={pushNotifications}
            darkMode={darkMode}
            currency={currency}
            tariffRate={tariffRate}
            powerLimit={powerLimit}
            onSettingChange={updateSetting}
            onRestartESP32={handleRestartESP32}
            onOpenHelp={() => setIsHelpModalOpen(true)}
          />
        );
      default:
        return null;
    }
  };

  const pendingDeviceObj = devices.find(d => d.id === pendingOverrideDevice);

  return (
    <div className={cn(
      "h-[100dvh] w-full font-sans selection:bg-blue-500/30 flex flex-col overflow-hidden relative transition-colors duration-200",
      darkMode ? "dark bg-[#070A11] text-[#F8FAFC]" : "bg-[#F1F5F9] text-[#0F172A]"
    )}>

      {/* Global Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!pendingOverrideDevice}
        title="⚠️ Modo Away Activo (Seguridad)"
        description={`El sistema está en modo seguridad anti-intrusión. Encender manualmente "${pendingDeviceObj?.name || 'este dispositivo'}" puede activar la alarma. ¿Deseas forzar el encendido?`}
        confirmText="Forzar Encendido"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={confirmOverride}
        onCancel={cancelOverride}
      />

      {/* Hardware & Help Modal */}
      <HardwareHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Mobile AppBar - Compact Native Height */}
      <div className={cn(
        "pt-[env(safe-area-inset-top)] border-b z-40 lg:hidden shrink-0 transition-colors duration-200 select-none",
        isIntrusion
          ? "bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-900/50"
          : "bg-white/95 dark:bg-[#070A11]/95 backdrop-blur-md border-slate-200/80 dark:border-slate-800/80"
      )}>
        <div className="h-13 flex items-center justify-between px-3.5">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg transition-colors", isIntrusion ? "bg-red-500/20 text-red-500" : "bg-blue-600/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400")}>
              {isIntrusion ? <ShieldAlert size={18} className="animate-pulse" /> : <Zap size={18} fill="currentColor" />}
            </div>
            <span className={cn("font-bold text-base tracking-tight transition-colors", isIntrusion ? "text-red-600 dark:text-red-400" : "text-[#0F172A] dark:text-[#F8FAFC]")}>
              {isIntrusion ? "ALERTA INTRUSO" : "SmartEnergy"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsHelpModalOpen(true)}
              aria-label="Abrir documentación técnica"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <HelpCircle size={17} />
            </button>
            <div className="flex items-center gap-1.5 bg-slate-200/60 dark:bg-[#131A2B] px-2.5 py-0.5 rounded-full border border-slate-300/60 dark:border-slate-700/60">
              <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">
                {isOnline ? `${latencyMs}ms` : "Offline"}
              </span>
              {!isOnline && (
                <button
                  onClick={reconnectFirebase}
                  title="Reconectar"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 p-0.5 cursor-pointer"
                >
                  <RefreshCw size={10} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative z-10 w-full max-w-[1600px] mx-auto">
        <aside className="hidden lg:flex flex-col w-72 h-full bg-white dark:bg-[#0A0E18] border-r border-slate-200/80 dark:border-slate-800/80 overflow-y-auto custom-scrollbar shrink-0 transition-colors duration-200 select-none">
          <div className="p-6 flex items-center justify-between">
            {/* Desktop Side Branding */}
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl transition-colors", isIntrusion ? "bg-red-500/20 text-red-500" : "bg-blue-600/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400")}>
                <Zap size={22} fill="currentColor" />
              </div>
              <span className="font-bold text-xl tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">SmartEnergy</span>
            </div>
            <button
              onClick={() => setIsHelpModalOpen(true)}
              aria-label="Abrir documentación técnica"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <HelpCircle size={18} />
            </button>
          </div>
          <div className="px-6 pb-2">
            <div className="flex items-center justify-between bg-slate-100 dark:bg-[#131A2B] px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono">
                  {isOnline ? `En línea · ${latencyMs}ms` : "Desconectado"}
                </span>
              </div>
              {!isOnline && (
                <button
                  onClick={reconnectFirebase}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold cursor-pointer"
                >
                  Reconectar
                </button>
              )}
            </div>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.98] group text-sm font-medium",
                  activeTab === item.id
                    ? "bg-blue-50/80 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/30 font-bold shadow-sm shadow-blue-900/5"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                )}
              >
                <item.icon size={18} className={activeTab === item.id ? "text-blue-600 dark:text-blue-400" : ""} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative w-full">
          <div className="flex-1 overflow-y-auto px-2 py-2 md:p-4 lg:p-8 custom-scrollbar relative">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                className="h-full flex flex-col"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile NavBar - Compact Native iOS/Android Dock */}
      <div className="pb-[env(safe-area-inset-bottom)] bg-white/95 dark:bg-[#0A0E18]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 lg:hidden z-40 shrink-0 relative transition-colors duration-200 select-none">
        <div className="h-14 flex justify-around items-center px-2">
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
                  "relative flex flex-col items-center justify-center w-full h-full py-1 transition-[transform,color] duration-150 active:scale-95 cursor-pointer",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <div className="relative flex flex-col items-center justify-center">
                  <motion.div
                    animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.05 : 1 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className="relative"
                  >
                    <item.icon
                      size={20}
                      strokeWidth={isActive ? 2.3 : 1.9}
                    />
                  </motion.div>
                  <span className={cn(
                    "text-[10px] tracking-tight transition-all duration-150 mt-0.5",
                    isActive ? "font-bold opacity-100 text-blue-600 dark:text-blue-400" : "font-medium opacity-70"
                  )}>
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      className="absolute -bottom-1 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400"
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
