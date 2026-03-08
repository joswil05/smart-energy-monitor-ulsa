import React from 'react';
import { Settings } from 'lucide-react';
import { DeviceList, Device } from '../components/DeviceList';

interface DevicesTabProps {
    devices: Device[];
    onToggle: (id: string) => void;
}

export function DevicesTab({ devices, onToggle }: DevicesTabProps) {
    const totalActive = devices.filter(d => d.isOn).length;
    const totalOnline = devices.filter(d => d.isOnline).length;

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-fit">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white">Dispositivos Conectados</h2>
                        <p className="text-sm text-slate-400">
                            {totalActive} activos • {totalOnline} en línea
                        </p>
                    </div>
                    <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                        <Settings size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="space-y-4">
                    <DeviceList devices={devices} onToggle={onToggle} />
                </div>

                <button className="w-full mt-6 py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:bg-slate-800/50 hover:text-white transition-all text-sm font-medium">
                    + Añadir Nuevo Dispositivo
                </button>
            </div>
        </div>
    );
}
