import React from 'react';
import { cn } from '../lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface SettingsTabProps {
    pushNotifications: boolean;
    darkMode: boolean;
    currency: string;
    tariffRate?: number;
    powerLimit?: number;
    onSettingChange: (key: string, value: any) => void;
    onRestartESP32: () => void;
    onOpenHelp?: () => void;
}

function HoldToConfirmButton({ onConfirm }: { onConfirm: () => void }) {
    const [isHolding, setIsHolding] = React.useState(false);
    const [isTriggered, setIsTriggered] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const startHold = () => {
        if (isTriggered) return;
        setIsHolding(true);
        try { Haptics.vibrate({ duration: 10 }); } catch (e) { }

        timerRef.current = setTimeout(() => {
            setIsTriggered(true);
            setIsHolding(false);
            try { Haptics.vibrate({ duration: 40 }); } catch (e) { }
            onConfirm();
            setTimeout(() => {
                setIsTriggered(false);
            }, 3000);
        }, 1500);
    };

    const cancelHold = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setIsHolding(false);
    };

    return (
        <div className="relative overflow-hidden rounded-xl border border-red-200 dark:border-red-500/30">
            <button
                type="button"
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                onTouchCancel={cancelHold}
                className={cn(
                    "relative w-full py-3.5 px-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-sm select-none transition-[transform,background-color] duration-150 cursor-pointer overflow-hidden flex items-center justify-center gap-2",
                    isHolding ? "scale-[0.98]" : ""
                )}
            >
                {/* Progress Fill Bar */}
                <div
                    className={cn(
                        "absolute inset-0 bg-red-500/25 dark:bg-red-500/35 pointer-events-none",
                        isHolding ? "transition-[clip-path] duration-[1500ms] ease-linear" : "transition-[clip-path] duration-200 ease-out"
                    )}
                    style={{
                        clipPath: isHolding ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)'
                    }}
                />

                <span className="relative z-10 flex items-center gap-2">
                    {isTriggered ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                            <span>¡Comando de Reinicio Enviado!</span>
                        </>
                    ) : isHolding ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                            <span>Mantén presionado...</span>
                        </>
                    ) : (
                        <span>Mantener presionado para Reiniciar</span>
                    )}
                </span>
            </button>
        </div>
    );
}

export function SettingsTab({
    pushNotifications,
    darkMode,
    currency,
    tariffRate = 0,
    powerLimit = 1200,
    onSettingChange,
    onRestartESP32,
    onOpenHelp
}: SettingsTabProps) {
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
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider transition-colors duration-150 px-2 lg:px-0 select-none">Cuenta</h3>
                <div className="bg-white dark:bg-[#0E1422] rounded-2xl p-4 flex items-center justify-between border border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-[background-color,border-color] duration-150 shadow-sm shadow-slate-900/5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/30 flex items-center justify-center text-blue-700 dark:text-blue-400 text-lg font-bold transition-colors duration-150 select-none">
                            U
                        </div>
                        <div>
                            <p className="text-slate-900 dark:text-slate-50 text-sm sm:text-base font-semibold transition-colors duration-150">Usuario ULSA</p>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 transition-colors duration-150 select-text">admin@ulsa.edu.ni</p>
                        </div>
                    </div>
                    <button className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 active:scale-95 transition-[transform,color] duration-150 font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500/40 rounded-lg px-2 py-1">
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Preferencias */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider transition-colors duration-150 px-2 lg:px-0 select-none">Preferencias</h3>
                <div className="bg-white dark:bg-[#0E1422] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800/80 transition-[background-color,border-color] duration-150 shadow-sm shadow-slate-900/5">
                    <div className="p-4 flex items-center justify-between select-none">
                        <div>
                            <p className="text-slate-900 dark:text-slate-50 text-sm sm:text-base font-medium transition-colors duration-150">Notificaciones Push</p>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 transition-colors duration-150">Recibir alertas de intrusión y sobrecarga</p>
                        </div>
                        <button
                            onClick={() => toggleSetting('pushNotifications', pushNotifications)}
                            aria-label="Alternar notificaciones push"
                            className={cn(
                                "relative inline-flex h-7 w-12 items-center rounded-full transition-[background-color,transform] duration-200 ease-out active:scale-90 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/40",
                                pushNotifications ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
                            )}
                        >
                            <span className={cn(
                                "inline-block h-5 w-5 transform rounded-full bg-white transition-[transform,width] duration-200 ease-out shadow-sm",
                                pushNotifications ? "translate-x-6" : "translate-x-1"
                            )} />
                        </button>
                    </div>
                    <div className="p-4 flex items-center justify-between select-none">
                        <div>
                            <p className="text-slate-900 dark:text-slate-50 text-sm sm:text-base font-medium transition-colors duration-150">Modo Oscuro</p>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 transition-colors duration-150">Tema visual de la aplicación</p>
                        </div>
                        <button
                            onClick={() => toggleSetting('darkMode', darkMode)}
                            aria-label="Alternar modo oscuro"
                            className={cn(
                                "relative inline-flex h-7 w-12 items-center rounded-full transition-[background-color,transform] duration-200 ease-out active:scale-90 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/40",
                                darkMode ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
                            )}
                        >
                            <span className={cn(
                                "inline-block h-5 w-5 transform rounded-full bg-white transition-[transform,width] duration-200 ease-out shadow-sm",
                                darkMode ? "translate-x-6" : "translate-x-1"
                            )} />
                        </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div className="select-none">
                            <p className="text-slate-900 dark:text-slate-50 text-sm sm:text-base font-medium transition-colors duration-150">Moneda Base</p>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 transition-colors duration-150">Usado para cálculo de tarifa eléctrica</p>
                        </div>
                        <select
                            value={currency}
                            onChange={handleCurrencyChange}
                            aria-label="Seleccionar moneda base"
                            className="bg-slate-100 dark:bg-[#131A2B] border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 text-sm font-semibold rounded-lg px-3 py-1.5 cursor-pointer transition-[border-color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-blue-500/40 outline-none font-mono"
                        >
                            <option value="C$">C$ (Córdobas)</option>
                            <option value="$">$ (USD)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Parámetros de Energía */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider transition-colors duration-150 px-2 lg:px-0 select-none">Parámetros de Energía</h3>
                <div className="bg-white dark:bg-[#0E1422] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800/80 transition-[background-color,border-color] duration-150 shadow-sm shadow-slate-900/5">
                    <div className="p-4 space-y-2">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-slate-900 dark:text-slate-50 text-sm sm:text-base font-medium">Límite de Sobrecarga (W)</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Desconexión de cargas al superar este umbral</p>
                            </div>
                            <span className="font-mono font-bold text-sm bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/30 px-2.5 py-1 rounded-lg">
                                {powerLimit} W
                            </span>
                        </div>
                        <input
                            type="range"
                            min="400"
                            max="3000"
                            step="50"
                            value={powerLimit}
                            onChange={(e) => onSettingChange('powerLimit', Number(e.target.value))}
                            className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
                        />
                    </div>
                    <div className="p-4 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-slate-900 dark:text-slate-50 text-sm sm:text-base font-medium">Tarifa por kWh ({currency})</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {tariffRate > 0 ? "Tarifa fija personalizada" : "Tarifa oficial escalonada INE/Disnorte"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                step="0.1"
                                placeholder={currency === '$' ? "0.18" : "6.50"}
                                value={tariffRate > 0 ? tariffRate : ""}
                                onChange={(e) => onSettingChange('tariffRate', Number(e.target.value) || 0)}
                                className="w-24 bg-slate-100 dark:bg-[#131A2B] border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-semibold rounded-lg px-2.5 py-1.5 text-right font-mono outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                            />
                            {tariffRate > 0 && (
                                <button
                                    onClick={() => onSettingChange('tariffRate', 0)}
                                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                                >
                                    Restablecer
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sistema y Hardware */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider transition-colors duration-150 px-2 lg:px-0 select-none">Sistema (ESP32)</h3>
                <div className="bg-white dark:bg-[#0E1422] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800/80 transition-[background-color,border-color] duration-150 shadow-sm shadow-slate-900/5">
                    <div className="p-4 flex items-center justify-between">
                        <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base select-none">Versión del Firmware</p>
                        <p className="text-slate-900 dark:text-slate-50 font-mono text-sm sm:text-base font-semibold select-text">v1.2.5-stable</p>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base select-none">Dirección IP</p>
                        <p className="text-slate-900 dark:text-slate-50 font-mono text-sm sm:text-base font-semibold select-text">192.168.1.105</p>
                    </div>
                    {onOpenHelp && (
                        <div className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-slate-900 dark:text-slate-50 text-sm sm:text-base font-medium">Mapa de Conexiones</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Diagrama de pines y sensores del controlador</p>
                            </div>
                            <button
                                type="button"
                                onClick={onOpenHelp}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#131A2B] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors border border-slate-200/60 dark:border-slate-700/60"
                            >
                                Ver Pines
                            </button>
                        </div>
                    )}
                    <div className="p-4 select-none">
                        <HoldToConfirmButton onConfirm={onRestartESP32} />
                    </div>
                </div>
            </div>

            <p className="text-center text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] pb-6 mt-8 select-none">
                SmartEnergy Monitor UI v1.2.0<br />
                Desarrollado para la Universidad La Salle
            </p>
        </div>
    );
}
