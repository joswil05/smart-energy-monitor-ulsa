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
    <div className="space-y-3">
      {devices.map((device) => {
        const Icon = getDeviceIcon(device.type);
        return (
          <div
            key={device.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300",
              device.isOn
                ? "bg-[#F8FAFC] dark:bg-[#1E293B] border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-[1.01]"
                : "bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] border-slate-200 dark:border-[#1E293B] hover:border-slate-300 dark:hover:border-[#334155]"
            )}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  device.isOn
                    ? "bg-blue-600 dark:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                    : "bg-[#F8FAFC] dark:bg-[#1E293B] text-[#64748B] dark:text-[#64748B]"
                )}>
                  <Icon size={24} strokeWidth={2} />
                </div>
                <div>
                  <h4 className={cn("font-semibold transition-colors duration-300", device.isOn ? "text-[#0F172A] dark:text-[#F1F5F9]" : "text-[#64748B] dark:text-[#94A3B8]")}>
                    {device.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <span className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded-md",
                      device.isOnline ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    )}>
                      {device.isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                      {device.isOnline ? 'En línea' : 'Desconectado'}
                    </span>
                    <span className="text-[#64748B] dark:text-[#64748B]">•</span>
                    <span className="flex items-center gap-1 text-[#64748B] dark:text-[#64748B]">
                      <Clock size={10} />
                      {device.lastActive}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className={cn("font-mono font-medium", device.isOn ? "text-blue-600 dark:text-blue-400" : "text-[#64748B] dark:text-[#64748B]")}>
                    {device.isOn ? device.power : 0} <span className="text-xs">W</span>
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#64748B] uppercase tracking-wider">Consumo</div>
                </div>

                <button
                  onClick={async () => {
                    onToggle(device.id);
                    try { await Haptics.vibrate({ duration: 15 }); } catch (e) { }
                  }}
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none",
                    device.isOn ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm",
                      device.isOn ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Active Glow Effect */}
            {device.isOn && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent pointer-events-none" />
            )}
          </div>
        );
      })}
    </div>
  );
}
