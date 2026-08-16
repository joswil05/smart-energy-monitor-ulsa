import React from 'react';
import { Zap, Activity, Gauge, Battery, Banknote } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import CountUp from 'react-countup';
import { ConsumptionChart } from '../components/ConsumptionChart';
import { calculateTotalCost } from '../hooks/billing';

export function DashboardTab({ metrics, currency, hourlyData, isOverload, darkMode = true, tariffRate }: any) {
    return (
        <div className="flex flex-col h-full gap-3 pb-6 sm:pb-8">
            {/* Tarjeta de Resumen Financiero y Facturación (Hero Card Industrial) */}
            <div className="bg-white dark:bg-[#0E1422] border border-slate-200/90 dark:border-slate-800/80 border-l-4 border-l-blue-600 dark:border-l-blue-500 rounded-2xl p-4 sm:p-5 shadow-sm shadow-slate-900/5 transition-[background-color,border-color] duration-150 select-none">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shrink-0 border border-blue-200/60 dark:border-blue-500/20">
                            <Banknote size={22} strokeWidth={2.2} />
                        </div>
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {tariffRate && tariffRate > 0 ? "Costo con Tarifa Fija" : "Costo Mensual Estimado"}
                            </span>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <span className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                                    <CountUp
                                        end={calculateTotalCost(metrics.energy, currency, tariffRate)}
                                        duration={0.8}
                                        decimals={2}
                                        separator=","
                                        preserveValue
                                    />
                                </span>
                                <span className="font-bold text-base text-blue-700 dark:text-blue-400">{currency}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#131A2B] border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                            {tariffRate && tariffRate > 0
                                ? `${currency} ${tariffRate.toFixed(2)}/kWh`
                                : `Tarifa Oficial INE (${currency})`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Rejilla de Telemetría Eléctrica (5 Parámetros Técnicos) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
                <MetricCard
                    title="Potencia"
                    value={metrics.power}
                    unit="W"
                    icon={Gauge}
                    isAlert={isOverload}
                    subtitle={isOverload ? "• Sobrecarga Activa" : "• Operación Normal"}
                    subtitleType={isOverload ? "alert" : "neutral"}
                />
                <MetricCard
                    title="Factor Pot."
                    value={metrics.powerFactor || 0.98}
                    unit="PF"
                    icon={Activity}
                    subtitle={metrics.powerFactor >= 0.9 ? "• Eficiencia Óptima" : "• Carga Inductiva"}
                    subtitleType={metrics.powerFactor >= 0.9 ? "success" : "warning"}
                />
                <MetricCard
                    title="Voltaje"
                    value={metrics.voltage}
                    unit="V"
                    icon={Zap}
                    subtitle="• Monitoreo RMS"
                    subtitleType="neutral"
                />
                <MetricCard
                    title="Corriente"
                    value={metrics.current}
                    unit="A"
                    icon={Activity}
                    subtitle="• Carga Activa"
                    subtitleType="neutral"
                />
                <MetricCard
                    title="Energía"
                    value={metrics.energy}
                    unit="kWh"
                    icon={Zap}
                    subtitle="• Total Acumulado"
                    subtitleType="neutral"
                    className="col-span-2 lg:col-span-1"
                />
            </div>

            {/* Gráfica de Consumo en Tiempo Real */}
            <div className="flex-1 bg-white dark:bg-[#0E1422] border border-slate-200/90 dark:border-slate-800/80 shadow-sm shadow-slate-900/5 rounded-2xl p-3 sm:p-4 flex flex-col pt-4 sm:pt-5 transition-[background-color,border-color] duration-150 min-h-0">
                <div className="flex items-center justify-between mb-2 select-none">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#131A2B] text-slate-600 dark:text-slate-300">
                            <Activity size={16} strokeWidth={2.2} />
                        </div>
                        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Consumo en Tiempo Real
                        </h2>
                    </div>
                    <select
                        aria-label="Filtro de período de consumo"
                        className="bg-slate-100 dark:bg-[#131A2B] border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-[11px] font-semibold uppercase tracking-wider rounded-lg px-2.5 py-1.5 cursor-pointer transition-[border-color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-blue-500/40 outline-none font-mono"
                    >
                        <option>Últimas 24 Horas</option>
                        <option>Últimos 7 Días</option>
                        <option>Este Mes</option>
                    </select>
                </div>
                <ConsumptionChart data={hourlyData} darkMode={darkMode} />
            </div>
        </div>
    );
}
