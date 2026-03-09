import React from 'react';
import { cn } from '../lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface SettingsTabProps {
    pushNotifications: boolean;
    darkMode: boolean;
    currency: string;
    onSettingChange: (key: string, value: any) => void;
    onRestartESP32: () => void;
}

export function SettingsTab({ pushNotifications, darkMode, currency, onSettingChange, onRestartESP32 }: SettingsTabProps) {
    const toggleSetting = (setting: string, currentValue: boolean) => {
        onSettingChange(setting, !currentValue);
        try { Haptics.vibrate({ duration: 15 }); } catch (e) { }
    };

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onSettingChange('currency', e.target.value);
        try { Haptics.vibrate({ duration: 15 }); } catch (e) { }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto pb-4">
            {/* Cuenta */}
            <div>
                <h3 className="text-xs font-bold text-blue-600 dark:text-blue-500 mb-2 uppercase tracking-wider transition-colors duration-300 px-2 lg:px-0">Cuenta</h3>
                <div className="bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] rounded-2xl p-4 flex items-center justify-between border border-slate-200 dark:border-[#1E293B] hover:border-slate-300 dark:hover:border-[#334155] transition-colors duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-lg font-bold transition-colors duration-300">
                            U
                        </div>
                        <div>
                            <p className="text-[#0F172A] dark:text-[#F1F5F9] text-base font-semibold transition-colors duration-300">Usuario ULSA</p>
                            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] transition-colors duration-300">admin@ulsa.edu.ni</p>
                        </div>
                    </div>
                    <button className="text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors font-medium">
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Notificaciones */}
            <div>
                <h3 className="text-xs font-bold text-blue-600 dark:text-blue-500 mb-2 uppercase tracking-wider transition-colors duration-300 px-2 lg:px-0">Preferencias</h3>
                <div className="bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] rounded-2xl border border-slate-200 dark:border-[#1E293B] hover:border-slate-300 dark:hover:border-[#334155] divide-y divide-slate-100 dark:divide-[#1E293B] transition-colors duration-300">
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[#0F172A] dark:text-[#F1F5F9] text-base font-medium transition-colors duration-300">Notificaciones Push</p>
                            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] transition-colors duration-300">Recibir alertas de intrusión y sobrecarga</p>
                        </div>
                        <button
                            onClick={() => toggleSetting('pushNotifications', pushNotifications)}
                            className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none", pushNotifications ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-200 dark:bg-[#334155]")}
                        >
                            <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm", pushNotifications ? "translate-x-6" : "translate-x-1")} />
                        </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[#0F172A] dark:text-[#F1F5F9] text-base font-medium transition-colors duration-300">Modo Oscuro</p>
                            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] transition-colors duration-300">Tema visual de la aplicación</p>
                        </div>
                        <button
                            onClick={() => toggleSetting('darkMode', darkMode)}
                            className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none", darkMode ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-200 dark:bg-[#334155]")}
                        >
                            <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm", darkMode ? "translate-x-6" : "translate-x-1")} />
                        </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[#0F172A] dark:text-[#F1F5F9] text-base font-medium transition-colors duration-300">Moneda Base</p>
                            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] transition-colors duration-300">Usado para cálculo de tarifa</p>
                        </div>
                        <select
                            value={currency}
                            onChange={handleCurrencyChange}
                            className="bg-[#F8FAFC] dark:bg-[#0B0F19] border border-slate-200 dark:border-[#334155] text-[#0F172A] dark:text-[#F1F5F9] text-base rounded-lg px-3 py-1.5 outline-none transition-colors duration-300"
                        >
                            <option value="C$">C$ (Córdobas)</option>
                            <option value="$">$ (USD)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Sistema */}
            <div>
                <h3 className="text-xs font-bold text-blue-600 dark:text-blue-500 mb-2 uppercase tracking-wider transition-colors duration-300 px-2 lg:px-0">Sistema (ESP32)</h3>
                <div className="bg-white shadow-sm shadow-blue-900/5 dark:bg-[#131B2F] rounded-2xl border border-slate-200 dark:border-[#1E293B] hover:border-slate-300 dark:hover:border-[#334155] divide-y divide-slate-100 dark:divide-[#1E293B] transition-colors duration-300">
                    <div className="p-4 flex items-center justify-between">
                        <p className="text-[#64748B] dark:text-[#94A3B8] text-base transition-colors duration-300">Versión del Firmware</p>
                        <p className="text-[#0F172A] dark:text-[#F1F5F9] font-mono text-base transition-colors duration-300">v1.2.5-stable</p>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <p className="text-[#64748B] dark:text-[#94A3B8] text-base transition-colors duration-300">Dirección IP</p>
                        <p className="text-[#0F172A] dark:text-[#F1F5F9] font-mono text-base transition-colors duration-300">192.168.1.105</p>
                    </div>
                    <div className="p-4">
                        <button
                            onClick={onRestartESP32}
                            className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-500 transition-colors text-sm font-bold border border-red-200 dark:border-red-500/20"
                        >
                            Reiniciar Controlador
                        </button>
                    </div>
                </div>
            </div>

            <p className="text-center text-sm text-[#64748B] dark:text-[#94A3B8] pb-6 mt-8">SmartEnergy Monitor UI v1.2.0<br />Desarrollado para la Universidad La Salle</p>
        </div>
    );
}
