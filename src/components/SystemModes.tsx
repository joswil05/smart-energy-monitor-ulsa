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
  const modes: { id: Mode; label: string; icon: any; color: string; bg: string; desc: string }[] = [
    { id: 'normal', label: 'Normal', icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10', desc: 'Monitoreo estándar sin restricciones' },
    { id: 'eco', label: 'Eco', icon: Leaf, color: 'text-emerald-400', bg: 'bg-emerald-500/10', desc: 'Límite de 600W con auto-desconexión de cargas no esenciales' },
    { id: 'away', label: 'Away', icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10', desc: 'Seguridad máxima. Solo sistemas críticos activos' },
    { id: 'night', label: 'Night', icon: Moon, color: 'text-indigo-400', bg: 'bg-indigo-500/10', desc: 'Optimización de iluminación y ahorro en climatización' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {modes.map((mode, index) => {
        const isActive = currentMode === mode.id;
        return (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15, delay: index * 0.02, ease: "easeOut" }}
            onClick={async () => {
              onModeChange(mode.id);
              try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (e) { }
            }}
            className={cn(
              "relative p-4 rounded-2xl border text-left transition-all duration-300 group overflow-hidden",
              isActive
                ? "bg-slate-800 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]"
                : "bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-slate-800/50"
            )}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-50" />
            )}

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isActive ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]" : cn(mode.bg, mode.color)
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

              <div className={cn("font-semibold transition-colors", isActive ? "text-white" : "text-slate-200")}>
                {mode.label}
              </div>
              <div className={cn("text-xs mt-1 transition-colors", isActive ? "text-blue-200" : "text-slate-500")}>
                {mode.desc}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
