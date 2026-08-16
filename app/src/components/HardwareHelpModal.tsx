import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Cpu, Shield, Zap, Leaf, Moon, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface HardwareHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HardwareHelpModal({ isOpen, onClose }: HardwareHelpModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'modes' | 'pins'>('modes');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="relative z-10 w-full max-w-lg bg-white dark:bg-[#0E1422] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-slate-950/40 text-left overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/30 text-blue-700 dark:text-blue-400">
                  <HelpCircle size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                    Documentación Técnica
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    SmartEnergy Monitor • ULSA
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar ayuda"
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex gap-1.5 p-1 mt-4 bg-slate-100 dark:bg-[#070A11] border border-slate-200/80 dark:border-slate-800 rounded-xl">
              <button
                onClick={() => setActiveSubTab('modes')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold transition-[background-color,color] duration-150 cursor-pointer flex items-center justify-center gap-1.5",
                  activeSubTab === 'modes'
                    ? "bg-white dark:bg-[#131A2B] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-700"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Shield size={14} />
                Modos del Sistema
              </button>
              <button
                onClick={() => setActiveSubTab('pins')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold transition-[background-color,color] duration-150 cursor-pointer flex items-center justify-center gap-1.5",
                  activeSubTab === 'pins'
                    ? "bg-white dark:bg-[#131A2B] text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-700"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Cpu size={14} />
                Mapa de Pines ESP32
              </button>
            </div>

            {/* Tab Content Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar mt-4 space-y-3 pr-1">
              {activeSubTab === 'modes' ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/30">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm mb-1">
                      <Zap size={16} /> Modo Normal
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Monitoreo RMS completo sin restricciones. Todos los relés responden al control manual y automático.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/30">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm mb-1">
                      <Leaf size={16} /> Modo Eco (Ahorro Inteligente)
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Establece límite automático de 600W. Si el consumo supera el umbral, el sistema desconecta gradualmente las cargas no esenciales (*Load Shedding*).
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/30">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm mb-1">
                      <Shield size={16} /> Modo Away (Seguridad & Intrusión)
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Protección máxima cuando no hay nadie. Si el sensor PIR detecta presencia o si se detecta consumo eléctrico no autorizado, dispara la sirena y envía notificación de intruso.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/30">
                    <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-sm mb-1">
                      <Moon size={16} /> Modo Night (Nocturno)
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Optimización de iluminación y climatización para confort nocturno, reduciendo el consumo pasivo de energía.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-bold text-[#0F172A] dark:text-[#F1F5F9] flex justify-between">
                      <span>Periférico / Sensor</span>
                      <span>Pin ESP32</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      <div className="px-3.5 py-2.5 flex justify-between items-center">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Sensor Voltaje AC (ZMPT101B)</span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 px-2 py-0.5 rounded-md">GPIO 35 (ADC)</span>
                      </div>
                      <div className="px-3.5 py-2.5 flex justify-between items-center">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Sensor Corriente AC (SCT-013)</span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 px-2 py-0.5 rounded-md">GPIO 34 (ADC)</span>
                      </div>
                      <div className="px-3.5 py-2.5 flex justify-between items-center">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Sensor de Presencia PIR</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md">GPIO 26</span>
                      </div>
                      <div className="px-3.5 py-2.5 flex justify-between items-center">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Módulo 4 Relés (Cargas 1 a 4)</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-md">4, 16, 14, 27</span>
                      </div>
                      <div className="px-3.5 py-2.5 flex justify-between items-center">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">Pantalla OLED SSD1306 (I2C)</span>
                        <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/30 px-2 py-0.5 rounded-md">SDA: 21 • SCL: 22</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic text-center">
                    Desarrollado en PlatformIO C++ con FreeRTOS y Firebase ESP Client.
                  </p>
                </div>
              )}
            </div>

            {/* Footer button */}
            <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm transition-transform duration-150 active:scale-95 cursor-pointer shadow-md shadow-blue-900/20"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
