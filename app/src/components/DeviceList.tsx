import React from 'react';
import { Power, Wifi, WifiOff, Clock, Lightbulb, Refrigerator, Thermometer, Tv, Cog, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface Device {
  id: string;
  name: string;
  type: string;
  isOn: boolean;
  power: number; // Watts
  lastActive: string;
  isOnline: boolean;
}

interface DeviceListProps {
  devices: Device[];
  onToggle: (id: string) => void;
}

const getDeviceIcon = (type: string) => {
  switch (type) {
    case 'light': return Lightbulb;
    case 'appliance': return Refrigerator;
    case 'hvac': return Thermometer;
    case 'entertainment': return Tv;
    case 'motor': return Cog;
    case 'security': return ShieldAlert;
    default: return Power;
  }
};

export function DeviceList({ devices, onToggle }: DeviceListProps) {
  return (
    <div className="space-y-3 select-none pb-6">
      {devices.map((device) => {
        const Icon = getDeviceIcon(device.type);
        return (
          <div
            key={device.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-4 transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out",
              device.isOn
                ? "bg-white dark:bg-[#0E1422] border-blue-600/70 dark:border-blue-500/60 shadow-md shadow-blue-900/5 scale-[1.003]"
                : "bg-white dark:bg-[#0E1422] border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
            )}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-[background-color,color,box-shadow] duration-150 ease-out shrink-0",
                  device.isOn
                    ? "bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-500/30"
                    : "bg-slate-100 dark:bg-[#131A2B] text-slate-600 dark:text-slate-400"
                )}>
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h4 className={cn("font-bold text-sm sm:text-base transition-colors duration-150", device.isOn ? "text-slate-900 dark:text-slate-50" : "text-slate-700 dark:text-slate-300")}>
                    {device.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold text-[11px] border",
                      device.isOnline
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", device.isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                      {device.isOnline ? 'En línea' : 'Desconectado'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                      <Clock size={10} />
                      {device.lastActive}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-right flex flex-col items-end">
                  <div className={cn("font-mono font-bold tabular-nums text-xs sm:text-base", device.isOn ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500")}>
                    {device.isOn ? device.power : 0} <span className="text-[10px] sm:text-xs font-normal">W</span>
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Consumo</div>
                </div>

                <div className="p-1 -mr-1 flex items-center justify-center">
                  <button
                    onClick={async () => {
                      onToggle(device.id);
                      try { await Haptics.vibrate({ duration: 15 }); } catch (e) { }
                    }}
                    aria-label={`Alternar ${device.name}`}
                    className={cn(
                      "relative inline-flex h-7 w-12 items-center rounded-full transition-[background-color,transform] duration-200 ease-out active:scale-90 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/40",
                      device.isOn ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white transition-[transform,width] duration-200 ease-out shadow-sm",
                        device.isOn ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Glow Effect */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent pointer-events-none transition-opacity duration-200 ease-out",
                device.isOn ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
