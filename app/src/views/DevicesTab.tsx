import React from 'react';
import { DeviceList, Device } from '../components/DeviceList';

interface DevicesTabProps {
    devices: Device[];
    onToggle: (id: string) => void;
}

export function DevicesTab({ devices, onToggle }: DevicesTabProps) {
    const totalActive = devices.filter(d => d.isOn).length;

    return (
        <div className="space-y-4">
            <div className="bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-4 h-fit transition-[background-color,border-color] duration-150">
                <div className="flex items-center justify-between mb-4 select-none">
                    <div>
                        <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9] transition-colors duration-150">
                            Equipos <span className="font-mono tabular-nums text-sm font-semibold text-blue-600 dark:text-blue-400">({totalActive}/{devices.length})</span>
                        </h2>
                    </div>
                </div>

                <div className="space-y-2">
                    <DeviceList devices={devices} onToggle={onToggle} />
                </div>
            </div>
        </div>
    );
}
