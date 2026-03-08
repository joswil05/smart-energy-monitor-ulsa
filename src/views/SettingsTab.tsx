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
        try { Haptics.impact({ style: ImpactStyle.Light }); } catch (e) { }
    };

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onSettingChange('currency', e.target.value);
        try { Haptics.impact({ style: ImpactStyle.Light }); } catch (e) { }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-6">Ajustes Generales</h2>

                <div className="space-y-6">
                    {/* Cuenta */}
                    <div>
                        <h3 className="text-sm font-medium text-blue-400 mb-3 uppercase tracking-wider">Cuenta</h3>
                        <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
                                    U
                                </div>
                                <div>
                                    <p className="text-white font-medium">Usuario ULSA</p>
                                    <p className="text-xs text-slate-400">admin@ulsa.edu.ni</p>
                                </div>
                            </div>
                            <button className="text-sm text-red-400 hover:text-red-300 transition-colors font-medium">
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>

                    {/* Notificaciones */}
                    <div>
                        <h3 className="text-sm font-medium text-blue-400 mb-3 uppercase tracking-wider">Preferencias</h3>
                        <div className="bg-slate-800/50 rounded-xl border border-white/5 divide-y divide-white/5">
                            <div className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-white font-medium">Notificaciones Push</p>
                                    <p className="text-xs text-slate-400">Recibir alertas de intrusión y sobrecarga</p>
                                </div>
                                <button
                                    onClick={() => toggleSetting('pushNotifications', pushNotifications)}
                                    className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", pushNotifications ? "bg-blue-500" : "bg-slate-700")}
                                >
                                    <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", pushNotifications ? "translate-x-6" : "translate-x-1")} />
                                </button>
                            </div>
                            <div className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-white font-medium">Modo Oscuro</p>
                                    <p className="text-xs text-slate-400">Tema visual de la aplicación</p>
                                </div>
                                <button
                                    onClick={() => toggleSetting('darkMode', darkMode)}
                                    className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", darkMode ? "bg-blue-500" : "bg-slate-700")}
                                >
                                    <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", darkMode ? "translate-x-6" : "translate-x-1")} />
                                </button>
                            </div>
                            <div className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-white font-medium">Moneda Base</p>
                                    <p className="text-xs text-slate-400">Usado para cálculo de tarifa</p>
                                </div>
                                <select
                                    value={currency}
                                    onChange={handleCurrencyChange}
                                    className="bg-slate-900 border border-white/10 text-white text-sm rounded-lg px-2 py-1 outline-none"
                                >
                                    <option value="C$">C$ (Córdobas)</option>
                                    <option value="$">$ (USD)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Sistema */}
                    <div>
                        <h3 className="text-sm font-medium text-blue-400 mb-3 uppercase tracking-wider">Sistema (ESP32)</h3>
                        <div className="bg-slate-800/50 rounded-xl border border-white/5 divide-y divide-white/5">
                            <div className="p-4 flex items-center justify-between">
                                <p className="text-slate-300 text-sm">Versión del Firmware</p>
                                <p className="text-white font-mono text-sm">v1.2.5-stable</p>
                            </div>
                            <div className="p-4 flex items-center justify-between">
                                <p className="text-slate-300 text-sm">Dirección IP</p>
                                <p className="text-white font-mono text-sm">192.168.1.105</p>
                            </div>
                            <div className="p-4">
                                <button
                                    onClick={onRestartESP32}
                                    className="w-full py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors text-sm font-medium border border-red-500/20"
                                >
                                    Reiniciar Controlador
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-center text-xs text-slate-500 mt-8">SmartEnergy Monitor UI v1.2.0<br />Desarrollado para la Universidad La Salle</p>
        </div>
    );
}
