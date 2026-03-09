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
  const modes: { id: Mode; label: string; icon: any; iconClass: string; desc: string }[] = [
    { id: 'normal', label: 'Normal', icon: Zap, iconClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400', desc: 'Monitoreo estándar sin restricciones' },
    { id: 'eco', label: 'Eco', icon: Leaf, iconClass: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', desc: 'Límite de 600W con auto-desconexión de cargas no esenciales' },
    { id: 'away', label: 'Away', icon: Shield, iconClass: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400', desc: 'Seguridad máxima. Solo sistemas críticos activos' },
    { id: 'night', label: 'Night', icon: Moon, iconClass: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400', desc: 'Optimización de iluminación y ahorro en climatización' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {modes.map((mode, index) => {
        const isActive = currentMode === mode.id;
        return (
          <motion.button
            key={mode.id}
            whileTap={{ scale: 0.96 }}
            onClick={async () => {
              onModeChange(mode.id);
              try { await Haptics.vibrate({ duration: 15 }); } catch (e) { }
            }}
            className={cn(
              "relative p-4 rounded-2xl border text-left transition-all duration-300 group overflow-hidden",
              isActive
                ? "bg-[#F8FAFC] dark:bg-[#1E293B] border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]"
                : "bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] border-slate-200 dark:border-[#1E293B] hover:border-slate-300 dark:hover:border-[#334155]"
            )}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-50" />
            )}

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300",
                  isActive ? "bg-blue-600 dark:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]" : mode.iconClass
                )}>
                  <mode.icon size={20} strokeWidth={2.5} />
                </div>
                {isActive && (
                  <span className="flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </span>
                )}
              </div>

              <div className={cn("font-semibold transition-colors duration-300", isActive ? "text-[#0F172A] dark:text-[#F1F5F9]" : "text-[#64748B] dark:text-[#94A3B8]")}>
                {mode.label}
              </div>
              <div className={cn("text-xs mt-1 transition-colors duration-300", isActive ? "text-blue-600 dark:text-blue-400" : "text-[#94A3B8] dark:text-[#64748B]")}>
                {mode.desc}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
