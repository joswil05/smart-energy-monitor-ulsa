import React from 'react';
import { SystemModes, Mode } from '../components/SystemModes';

interface SystemModesTabProps {
    currentMode: Mode;
    onModeChange: (mode: Mode) => void;
}

export function SystemModesTab({ currentMode, onModeChange }: SystemModesTabProps) {
    return (
        <div className="space-y-4">
            <div className="bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-4 transition-colors duration-300">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div>
                        <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9] transition-colors duration-300">Modos del Sistema</h2>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] transition-colors duration-300">Ajustes rápidos de protección y confort</p>
                    </div>
                </div>
                <SystemModes currentMode={currentMode} onModeChange={onModeChange} />
            </div>
        </div>
    );
}
