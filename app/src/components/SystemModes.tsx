import React from 'react';
import { Leaf, Shield, Zap, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export type Mode = 'normal' | 'eco' | 'away' | 'night';

interface SystemModesProps {
  currentMode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function SystemModes({ currentMode, onModeChange }: SystemModesProps) {
  const modes: { id: Mode; label: string; icon: any; desc: string }[] = [
    { id: 'normal', label: 'Normal', icon: Zap, desc: 'Monitoreo estándar continuo sin restricciones de carga' },
    { id: 'eco', label: 'Eco', icon: Leaf, desc: 'Límite de 600W con auto-desconexión de cargas secundarias' },
    { id: 'away', label: 'Away', icon: Shield, desc: 'Seguridad máxima. Alarma e intrusión PIR activas' },
    { id: 'night', label: 'Night', icon: Moon, desc: 'Confort nocturno y reducción de consumo pasivo' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 select-none">
      {modes.map((mode) => {
        const isActive = currentMode === mode.id;
        return (
          <motion.button
            key={mode.id}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={async () => {
              onModeChange(mode.id);
              try { await Haptics.vibrate({ duration: 15 }); } catch (e) { }
            }}
            className={cn(
              "relative p-4 rounded-2xl border text-left transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out group overflow-hidden cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/40",
              isActive
                ? "bg-blue-50/40 dark:bg-blue-500/10 border-blue-600 dark:border-blue-500 shadow-md shadow-blue-900/5"
                : "bg-white dark:bg-[#0E1422] border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
            )}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent pointer-events-none" />
            )}

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-[background-color,color,box-shadow] duration-150 shrink-0",
                  isActive
                    ? "bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-500/30"
                    : "bg-slate-100 dark:bg-[#131A2B] text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                )}>
                  <mode.icon size={18} strokeWidth={2.2} />
                </div>
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-200/60 dark:border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                    Activo
                  </span>
                )}
              </div>

              <div className={cn(
                "font-bold text-sm sm:text-base transition-colors duration-150",
                isActive ? "text-blue-950 dark:text-slate-50" : "text-slate-800 dark:text-slate-200"
              )}>
                {mode.label}
              </div>
              <div className="text-xs mt-1 text-slate-500 dark:text-slate-400 leading-relaxed">
                {mode.desc}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
