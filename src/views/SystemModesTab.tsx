import React from 'react';
import { SystemModes, Mode } from '../components/SystemModes';

interface SystemModesTabProps {
    currentMode: Mode;
    onModeChange: (mode: Mode) => void;
}

export function SystemModesTab({ currentMode, onModeChange }: SystemModesTabProps) {
    return (
        <div className="space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white">Modos del Sistema</h2>
                        <p className="text-sm text-slate-400">Ajustes rápidos de protección y confort</p>
                    </div>
                </div>
                <SystemModes currentMode={currentMode} onModeChange={onModeChange} />
            </div>
        </div>
    );
}
