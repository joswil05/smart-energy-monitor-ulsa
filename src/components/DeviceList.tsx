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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: parseInt(device.id) * 0.02, ease: "easeOut" }}
            key={device.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300",
              device.isOn
                ? "bg-slate-900/80 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-[1.01]"
                : "bg-slate-900/40 border-white/5 hover:bg-slate-900/60 hover:border-white/10"
            )}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  device.isOn
                    ? "bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                    : "bg-slate-800 text-slate-500"
                )}>
                  <Icon size={24} strokeWidth={2} />
                </div>
                <div>
                  <h4 className={cn("font-semibold transition-colors", device.isOn ? "text-white" : "text-slate-300")}>
                    {device.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <span className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded-md",
                      device.isOnline ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    )}>
                      {device.isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                      {device.isOnline ? 'En línea' : 'Desconectado'}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock size={10} />
                      {device.lastActive}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className={cn("font-mono font-medium", device.isOn ? "text-blue-400" : "text-slate-600")}>
                    {device.isOn ? device.power : 0} <span className="text-xs">W</span>
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Consumo</div>
                </div>

                <button
                  onClick={async () => {
                    onToggle(device.id);
                    try { await Haptics.impact({ style: device.isOn ? ImpactStyle.Light : ImpactStyle.Medium }); } catch (e) { }
                  }}
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                    device.isOn ? "bg-blue-500" : "bg-slate-700"
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
          </motion.div>
        );
      })}
    </div>
  );
}
